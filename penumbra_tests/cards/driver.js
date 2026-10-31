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
  // (clbar) the brand bar's width: the value's place among the page's rows (ties share their run's middle; above zero at least 2%)
  function rankWant(rows, name, v) { var vals = rows.map(function (tr) { return Math.abs(parseFloat(tdText(tr, name))); }).filter(function (x) { return !isNaN(x); }).sort(function (a, b) { return a - b; }); if (vals.length < 2) return 100; var a = vals.indexOf(v), b = vals.lastIndexOf(v), w = (a + b) / 2 / (vals.length - 1) * 100; return (v > 0 && w < 2) ? 2 : w; }
  function tok(o) { var z = pako.deflate(JSON.stringify(o)), s = ''; for (var i = 0; i < z.length; i++) s += String.fromCharCode(z[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function canon(o) { if (Array.isArray(o)) return o.map(canon); if (o && typeof o === 'object') { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = canon(o[k]); }); return r; } return o; }
  function sameKeys(a, b) { return same(canon(a), canon(b)); }
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
    R.chk.switchShown = vis(sw()) && same(qa('#pnbCardsSwitch .pnb-cseg-opt').map(function (o) { return o.getAttribute('data-view'); }), ['table', 'cards', 'board']);   // (round S) the board
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
    R.chk.switchA11y = s.getAttribute('role') === 'radiogroup' && radios.length === 3 && radios.every(function (r) { return r.getAttribute('role') === 'radio'; })
      && opt('cards').getAttribute('aria-checked') === 'true' && opt('table').getAttribute('aria-checked') === 'false' && opt('board').getAttribute('aria-checked') === 'false' && opt('cards').classList.contains('is-selected');   // (round S) three
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
    var meter = q('.pnb-card-meter', c0), bar = meter && meter.firstElementChild, w = bar ? parseFloat(bar.style.width) : -1, want = rankWant(rows, 'H_NUM', Math.abs(parseFloat(tdText(r0, 'H_NUM'))));   // (clbar) the value's place among the page's rows
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
  // (cfmt) a cell's highlight worn by its value on the card; changed in the column options while the cards show
  S.cfmt = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    await sleep(200);
    // (cfmt2) 300 rows: drawn once (a frame's timestamp is not a second draw's `again`)
    R.chk.firstDrawOnce = !!C().state() && C().state().again === false;
    R.info.firstDraw = C().state() && C().state().again;
    var rows = shownRows(), cs = cards(), n = Math.min(cs.length, rows.length), bad = { t: [], s: [], sp: [], b: [], f: [], fp: [] }, closed = 0, open = 0;
    for (var i = 0; i < n; i++) {
      var c = cs[i], tr = rows[i];
      var ti = q('.pnb-card-title', c), tc = td(tr, 'V_NAME');
      if (!(ti && tc.style.backgroundColor && ti.style.backgroundColor === tc.style.backgroundColor && ti.style.color === tc.style.color)) bad.t.push(i);
      var sv = q('.pnb-card-sub .pnb-card-val[data-col="V_STATUS"]', c), sc = td(tr, 'V_STATUS');
      if (sc.textContent.trim() === 'Closed') { closed++; if (!(sv && sv.style.fontStyle === 'italic' && sv.style.color === sc.style.color && !!sc.style.color)) bad.s.push(i); }
      else { open++; if (sv && sv.getAttribute('style')) bad.sp.push(i); }
      var bv = q('.pnb-card-bigval', c), bc = td(tr, 'H_AMT');
      if (bv && !(bc.style.backgroundColor && bv.style.backgroundColor === bc.style.backgroundColor)) bad.b.push(i);
      var fd = q('.pnb-card-fields dd[data-col="V_DATE"]', c);
      if (!(fd && fd.style.fontWeight === 'bold' && fd.style.textDecoration.indexOf('underline') >= 0)) bad.f.push(i);
      var fi = q('.pnb-card-fields dd[data-col="V_ID"]', c);
      if (fi && fi.getAttribute('style')) bad.fp.push(i);
    }
    R.info.cfmt = [n, closed, open, bad];
    R.chk.titleRuled = n > 0 && bad.t.length === 0;
    R.chk.subRuled = closed > 0 && bad.s.length === 0;
    R.chk.subPlain = open > 0 && bad.sp.length === 0;
    R.chk.bigRuled = n > 0 && !!q('.pnb-card-bigval', cs[0]) && bad.b.length === 0;
    R.chk.fieldRuled = n > 0 && bad.f.length === 0;
    R.chk.fieldPlain = n > 0 && !!q('.pnb-card-fields dd[data-col="V_ID"]', cs[0]) && bad.fp.length === 0;
    // a rule added to V_ID in its column options: the cell is painted in place, the cards must follow
    window.Penumbra.setColOpt('V_ID', 'highlight', [{ id: 'x1', w: '', css: 'color: #6a1b9a' }]);
    await until(function () { var d = q('.pnb-card-fields dd[data-col="V_ID"]', cards()[0]); return !!(d && d.style.color); }, 3000);
    var d0 = q('.pnb-card-fields dd[data-col="V_ID"]', cards()[0]), c0 = td(shownRows()[0], 'V_ID');
    R.chk.liveRule = !!(d0 && c0.style.color && d0.style.color === c0.style.color);
    R.info.liveRule = [d0 && d0.getAttribute('style'), c0 && c0.getAttribute('style')];
    // a format picked for the big number's column: the cell is written again in place, the card's text must follow
    var before = text(q('.pnb-card-bigval', cards()[0]));
    window.Penumbra.setColOpt('H_AMT', 'format', 'currency:0');
    await until(function () { var b = q('.pnb-card-bigval', cards()[0]); return !!b && text(b) !== before; }, 3000);
    var after = text(q('.pnb-card-bigval', cards()[0])), cellNow = tdText(shownRows()[0], 'H_AMT');
    R.chk.liveFormat = !!after && after !== before && after === cellNow && after.indexOf('$') === 0;
    R.info.liveFormat = [before, after, cellNow];
    // (cfmt2) the big number's menu: Filter to / Exclude name the value as shown ($...), the filter keeps the stored value
    var bvEl = q('.pnb-card-bigval', cards()[0]), bcell = td(shownRows()[0], 'H_AMT');
    rclick(bvEl); await sleep(100);
    var fi2 = menu() ? q('.pnb-hm-item[data-act="cellFilter"]', menu()) : null, ex2 = menu() ? q('.pnb-hm-item[data-act="cellExclude"]', menu()) : null;
    if (!fi2) { var fs2 = await openSub('filterMenu'); fi2 = fs2 ? q('.pnb-hm-item[data-act="cellFilter"]', fs2) : null; ex2 = fs2 ? q('.pnb-hm-item[data-act="cellExclude"]', fs2) : null; }
    var raw2 = bcell && bcell.getAttribute('data-pnb-raw'), lab2 = fi2 ? text(q('.pnb-hm-label', fi2) || fi2) : null;
    R.chk.menuShown = !!raw2 && !!fi2 && !!ex2 && lab2.indexOf('Filter to "' + text(bvEl) + '"') === 0 && text(q('.pnb-hm-label', ex2) || ex2).indexOf('Exclude "' + text(bvEl) + '"') === 0;
    if (fi2) { fi2.click(); await until(function () { return q('#tableSearch').value.replace(/\\/g, '').indexOf(raw2) >= 0; }, 3000); }
    var box2 = q('#tableSearch').value;
    R.chk.menuShown = R.chk.menuShown && box2.replace(/\\/g, '').indexOf(raw2) >= 0 && box2.indexOf('$75') < 0;
    R.info.menu = [lab2, box2, raw2, text(bvEl)];
    if (menu()) { keyOn(document.activeElement, 'Escape'); await sleep(80); if (menu()) document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await sleep(60); }
    // the details window: the same fields wear the same styles
    C().openDetails(cards()[0]);
    await until(function () { return !!q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_DATE"]'); }, 3000);
    var dd = q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_DATE"]'), dt = q('#pnbCardDetails .pnb-card-title');
    R.chk.detRuled = !!(dd && dd.style.fontWeight === 'bold' && dt && dt.style.backgroundColor);
    R.info.det = [dd && dd.getAttribute('style'), dt && dt.getAttribute('style')];
    try { C().closeDetails(); } catch (e) { }
    // (cfmt2) the window's buttons named for whom they act
    await sleep(100); C().openConfig(); await sleep(150);
    R.chk.buttonWords = text(cbtn('pnb-ccfg-reset')) === 'Reset my cards' && text(cbtn('pnb-ccfg-default')) === 'Make default for everyone' && text(cbtn('pnb-ccfg-nodefault')) === 'Remove the default for everyone'
      && /^Every viewer of this report/.test(cbtn('pnb-ccfg-default').getAttribute('title') || '') && !/Use the report|Use as the report/.test(cfg().textContent);
    R.info.words = [text(cbtn('pnb-ccfg-reset')), text(cbtn('pnb-ccfg-default')), text(cbtn('pnb-ccfg-nodefault')), cbtn('pnb-ccfg-reset').title];
    C().closeConfig();
  };
  // (cfmt2) 2,500 rows: main.js defers its format pass 50 ms; the cards must show the highlights after it, a page turn too
  S.cfmtbig = async function () {
    await until(function () { return on() && cards().length > 0; }, 15000);
    function ruled() { var rows = shownRows(), cs = cards(), n = Math.min(rows.length, cs.length), bad = 0; for (var i = 0; i < n; i++) { var ti = q('.pnb-card-title', cs[i]), tc = td(rows[i], 'V_NAME'); if (!(ti && tc.style.backgroundColor && ti.style.backgroundColor === tc.style.backgroundColor)) bad++; } return { n: n, bad: bad }; }
    await until(function () { var r = ruled(); return r.n > 0 && r.bad === 0; }, 3000);
    var r1 = ruled(); R.info.big1 = [r1, shownRows().length, text(q('#pageInfo'))];
    R.chk.bigRuled = r1.n === 25 && r1.bad === 0;
    var calls = 0, F = C().formatted; C().formatted = function () { calls++; return F.apply(this, arguments); };
    q('#nextPageBtn').click();
    await until(function () { return /Page 2 of/.test(text(q('#pageInfo'))) && cards().length === 25; }, 6000);
    await until(function () { var r = ruled(); return r.n > 0 && r.bad === 0 && calls > 0; }, 3000);
    var r2 = ruled(); R.info.big2 = [r2, calls, text(q('#pageInfo'))];
    R.chk.pageTurnRuled = /Page 2 of/.test(text(q('#pageInfo'))) && r2.n === 25 && r2.bad === 0;
    R.chk.hookRedraw = calls >= 1;
    C().formatted = F;
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
    // (round N) every report offers cards; the switch waits for a reason to show (a default, a pick, an ask, cards on)
    R.chk.offeredHidden = !!C() && C().offered() === true && typeof C().switchShown === 'function' && C().switchShown() === false;
    if (C()) C().set('cards'); await sleep(300);
    R.chk.setShows = on() && vis(host()) && vis(sw());
    if (C()) C().set('table'); await sleep(300);
    R.chk.switchStays = !on() && vis(sw()) && (prefs().lrfix || {}).view === 'table';   // (the viewer used cards here: the pick keeps it)
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
    // (round O) the Cards segment open, then no reason left for it (no pick, no default, no ask): hidden, closed
    q('#sbCardsOpen').click(); await sleep(80); var wasOpen = segOpen();
    localStorage.removeItem('penumbra_column_prefs'); C().setReport(null); await sleep(150);
    R.chk.segClosesHidden = wasOpen && !vis(segEl()) && !segOpen();
    R.info.segClose = { was: wasOpen, shown: vis(segEl()), open: segOpen() };
  };
  S.cviewer = async function () {
    R.chk.noForm = !q('#viewOptionCards') && !window.penumbra_vars.canEditReport;
    R.info.viewer = [!!q('#viewOptionCards'), !!q('#view-options-tab'), window.penumbra_vars.canEditReport, window.penumbra_vars.isAdmin];
    R.chk.switchShown = vis(sw());
    await pickView('cards');
    var sl = slots();
    R.chk.cards = on() && cards().length === 200 && !!sl && sl.title === 'V_NAME';
    // (round N) Configure cards for a viewer: no report default to make or remove; a pick is the viewer's own
    C().openConfig(); await until(cfgShown, 3000);
    R.chk.viewerWindow = cfgShown() && cbtn('pnb-ccfg-default').hidden && cbtn('pnb-ccfg-editor').hidden && cbtn('pnb-ccfg-reset').disabled;
    setSel('pnbCcfgTitle1', 'V_STATUS'); await sleep(200);
    R.chk.viewerPick = slots().title === 'V_STATUS' && !!mine() && mine().own === 1 && mine().title === 'V_STATUS' && !cbtn('pnb-ccfg-reset').disabled;
    R.info.viewerPref = mine();
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
    // (round N) Configure cards: its size list is the viewer's size; an editor's default carries it, Standard drops the key
    var b1 = bsoCards();
    C().openConfig(); await until(cfgShown, 3000);
    var s0 = q('#pnbCcfgSize').value;
    setSel('pnbCcfgSize', 'xl'); await sleep(100); var px = (prefs().lrfix || {}).size;
    cbtn('pnb-ccfg-default').click(); await sleep(150); var b2 = bsoCards();
    setSel('pnbCcfgSize', 'standard'); await sleep(100); cbtn('pnb-ccfg-default').click(); await sleep(150); var b3 = bsoCards();
    R.chk.formSize = !!b1 && b1.size === 'large' && s0 === 'standard' && px === 'xl' && !!b2 && b2.size === 'xl' && !!b3 && b3.size === undefined;
    R.info.form = [b1, s0, px, b2, b3];
    C().closeConfig();
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
  // (round N) no report setup on a phone: the table (cards are every report's option now, the phone default is not)
  S.cnarrowN = async function () {
    await sleep(1500);
    R.chk.noDefaultTable = !on() && window.innerWidth < 600 && !!C() && C().view() === 'table' && (prefs().lrfix || {}).view === undefined;
    R.info.narrow = [window.innerWidth, on(), (prefs().lrfix || {}).view];
  };
  var PICKS = { title: 'V_NAME', sub: ['V_ID'], big: 'H_AMT', pill: 'V_STATUS', bar: 'H_NUM', fields: ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE'] };
  function bsoCards() { var st = window.__HC.bso(); return st && st.viewOptions ? st.viewOptions.cards : undefined; }
  // ---- (round N, ccfg) Configure cards: the window ----------------------------------------------------------
  function cfg() { return q('#pnbCardsConfig'); }
  function cfgShown() { var el = cfg(); return !!el && el.style.display === 'flex' && document.body.classList.contains('pnb-ccfg-open'); }
  function cchip(name) { return q('#pnbCcfgFields input[value="' + name + '"]'); }
  function cbtn(cls) { return cfg() ? q('.' + cls, cfg()) : null; }
  function mine() { return (prefs().lrfix || {}).cards; }
  function ctrlShiftL() { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', code: 'KeyL', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })); }
  // an editor on a report with no card setup: Settings > Cards opens the window (the cards behind it), the picks are
  // drawn and kept as the editor's own (never the report's); the size; Use as the report's default (the editor's own
  // goes), Remove the report's default; Escape, Ctrl+Shift+L, a card's menu and the table's Show as cards list
  S.cauth = async function () {
    R.chk.switchHidden = !vis(sw()) && !on();
    // (round P, the user) Settings > Cards is gone (the panel's columns section still lifted here); Quick actions' way in
    R.chk.sectionGone = !lay() && !q('#spCardConfigBtn') && !!q('.sp-columns-section') && C().canConfig() === true;
    C().openConfig(); await until(function () { return cfgShown() && on() && cards().length > 0; }, 4000); await sleep(150);
    R.chk.paletteOpens = cfgShown() && cfg().getAttribute('role') === 'dialog' && cfg().getAttribute('aria-modal') === 'true' && C().configOpen() === true;
    R.chk.cardsBehind = on() && cards().length === 200 && vis(sw());
    R.chk.focusFirst = document.activeElement === q('#pnbCcfgSize');
    var opts = qa('#pnbCcfgTitle1 option');
    R.chk.pickersListed = opts.length === 21 && opts[0].value === '' && opts[0].textContent === 'Automatic' && opts.some(function (o) { return o.value === 'V_NAME'; }) && opts.some(function (o) { return o.value === 'H_TEXT' && /hidden/.test(o.textContent); })
      && qa('#pnbCcfgPill option')[0].textContent === 'None' && qa('#pnbCcfgSize option').map(function (o) { return o.value; }).join(',') === 'compact,standard,large,xl' && q('#pnbCcfgSize').value === 'standard';
    R.chk.chipsListed = qa('#pnbCcfgFields .pnb-cards-chip').length === 20 && text(q('#pnbCcfgFieldsCount')) === 'Automatic';
    R.chk.noDefaultYet = bsoCards() === undefined && cbtn('pnb-ccfg-reset').disabled && !cbtn('pnb-ccfg-default').hidden && cbtn('pnb-ccfg-editor').hidden;
    setSel('pnbCcfgTitle1', 'V_NAME'); setSel('pnbCcfgSub1', 'V_ID'); setSel('pnbCcfgBig', 'H_AMT'); setSel('pnbCcfgPill', 'V_STATUS'); setSel('pnbCcfgBar', 'H_NUM');
    ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE'].forEach(function (n) { cchip(n).click(); });
    await sleep(250);
    R.chk.drawnPicks = same(slots(), PICKS); R.info.slots = slots();
    var pc = mine(); R.info.pref = pc;
    R.chk.keptAsPref = !!pc && pc.own === 1 && pc.title === 'V_NAME' && same(pc.sub, ['V_ID']) && pc.big === 'H_AMT' && pc.pill === 'V_STATUS' && pc.bar === 'H_NUM' && same(pc.fields, PICKS.fields) && !cbtn('pnb-ccfg-reset').disabled;
    R.chk.notReports = bsoCards() === undefined;
    // (round R) twelve at most: eight more ticked, the rest wait; untick them, the four picks again
    var four = text(q('#pnbCcfgFieldsCount')), more = qa('#pnbCcfgFields input:not(:checked)').slice(0, 8);
    more.forEach(function (b) { b.click(); }); await sleep(150);
    var rest = qa('#pnbCcfgFields input:not(:checked)');
    R.info.limit = { four: four, now: text(q('#pnbCcfgFieldsCount')), rest: rest.length, off: rest.filter(function (b) { return b.disabled; }).length };
    R.chk.fieldLimit = four === '4 of 12' && more.length === 8 && text(q('#pnbCcfgFieldsCount')) === '12 of 12' && rest.length > 0 && rest.every(function (b) { return b.disabled && b.parentNode.classList.contains('is-full'); });
    more.forEach(function (b) { b.click(); }); await sleep(150);
    R.chk.fieldLimit = R.chk.fieldLimit && text(q('#pnbCcfgFieldsCount')) === '4 of 12' && same(mine().fields, PICKS.fields);
    setSel('pnbCcfgSize', 'compact'); await until(function () { return host().classList.contains('is-compact'); }, 3000);
    R.chk.sizePick = C().size() === 'compact' && (prefs().lrfix || {}).size === 'compact' && sizeSel().value === 'compact';
    // an editor's Use as the report's default: the window's setup and size are the report's (saved with it), the editor's own go
    cbtn('pnb-ccfg-default').click(); await sleep(250);
    var b = bsoCards(); R.info.bso = b;
    R.chk.makeDefault = same(b, Object.assign({}, PICKS, { size: 'compact' })) && /Save the report/.test(text(cbtn('pnb-ccfg-note'))) && !cbtn('pnb-ccfg-editor').hidden && /not saved yet/.test(text(cbtn('pnb-ccfg-has')));
    R.chk.defaultClearsMine = !mine() && (prefs().lrfix || {}).size === undefined && same(slots(), PICKS) && C().size() === 'compact' && cbtn('pnb-ccfg-reset').disabled;
    cbtn('pnb-ccfg-nodefault').click(); await sleep(250);
    R.info.after = { bso: bsoCards(), slots: slots(), size: C().size() };
    R.chk.removeDefault = bsoCards() === undefined && cbtn('pnb-ccfg-editor').hidden && on() && slots().title === 'V_ID' && C().size() === 'standard' && q('#pnbCcfgSize').value === 'standard';
    // Escape closes the window (the cards stay); nothing behind it takes the key (the Report Tools console)
    var adm = localStorage.getItem('penumbra_admin_open');
    keyOn(q('#pnbCcfgTitle1'), 'Escape'); await sleep(150);
    R.chk.escCloses = !cfgShown() && C().configOpen() === false && on() && localStorage.getItem('penumbra_admin_open') === adm;
    // Ctrl+Shift+L opens it, and closes it
    ctrlShiftL(); await sleep(150); var o1 = cfgShown(); ctrlShiftL(); await sleep(150);
    R.chk.hotkeyToggles = o1 && !cfgShown();
    // a card's right-click menu: Configure cards...
    rclick(q('.pnb-card-title', cards()[2])); await sleep(100);
    var it = menu() ? q('.pnb-hm-item[data-act="cardConfig"]', menu()) : null;
    if (it) it.click(); await sleep(150);
    R.chk.menuOpens = !!it && cfgShown() && !menu();
    C().closeConfig();
    // the table's Show as cards list: Configure cards... (the cards come up behind the window)
    await pickView('table');
    rclick(td(shownRows()[1], 'V_NAME')); await sleep(80);
    var sub = await openSub('showCards'), ci = sub ? q('.pnb-hm-item[data-act="showCardsConfig"]', sub) : null;
    if (ci) ci.click(); await until(function () { return cfgShown() && on(); }, 3000);
    R.chk.tableMenuOpens = !!ci && cfgShown() && on();
    C().closeConfig();
  };
  // an editor on a report WITH a setup (its default): the switch, the table first on a desktop; the window shows the
  // report's picks and says so; the editor's change is their own; re-made the default; a re-run keeps it unsaved
  S.cauthB = async function () {
    R.chk.switchShown = vis(sw()) && !on();
    R.chk.roundTrip = same(bsoCards(), PICKS); R.info.bso = bsoCards();
    C().openConfig(); await until(function () { return cfgShown() && on(); }, 4000); await sleep(100);
    R.chk.editorLine = !cbtn('pnb-ccfg-editor').hidden && text(cbtn('pnb-ccfg-has')) === 'This report has a default card setup.' && !cbtn('pnb-ccfg-default').hidden && /This report's cards/.test(text(q('#pnbCcfgSub')));
    R.chk.pickersShow = q('#pnbCcfgTitle1').value === 'V_NAME' && q('#pnbCcfgSub1').value === 'V_ID' && q('#pnbCcfgSub2').value === '' && q('#pnbCcfgBig').value === 'H_AMT' && q('#pnbCcfgPill').value === 'V_STATUS' && q('#pnbCcfgBar').value === 'H_NUM';
    R.chk.chipsShow = same(qa('#pnbCcfgFields input:checked').map(function (i) { return i.value; }), PICKS.fields) && text(q('#pnbCcfgFieldsCount')) === '4 of 12';
    // the title and the subtitle back to Automatic / None: the editor's own setup, the report's untouched (V_ID is
    // guessed: no longer taken by the subtitle)
    setSel('pnbCcfgTitle1', ''); setSel('pnbCcfgSub1', ''); await sleep(200);
    R.chk.mineFirst = same(bsoCards(), PICKS) && !!mine() && mine().own === 1 && mine().title === undefined && slots().title === 'V_ID' && slots().sub.length === 0;
    // made the report's default: the state drops them
    cbtn('pnb-ccfg-default').click(); await sleep(200);
    var b2 = bsoCards();
    R.chk.reedit = !!b2 && b2.title === undefined && b2.sub === undefined && b2.big === 'H_AMT' && same(b2.fields, PICKS.fields) && !mine() && slots().title === 'V_ID';
    R.info.reedit = [b2, slots()];
    // a re-run before the Save hands the saved setup back (formWins): the unsaved default stays; a state load replaces it
    C().setReport(PICKS, true); await sleep(100);
    var b3 = bsoCards();
    C().setReport(PICKS, false); await sleep(100);
    R.chk.pendingKept = !!b3 && b3.title === undefined && b3.big === 'H_AMT' && same(bsoCards(), PICKS);
    R.info.pending = [b3, bsoCards()];
  };
  // a setup naming columns the query no longer returns: the guesses fill in; the window lists them, marked
  S.cauthM = async function () {
    await pickView('cards');
    R.chk.guessFallsBack = slots().title === 'V_ID';
    R.chk.keptField = same(slots().fields, ['V_DATE']);
    R.info.slots = slots();
    C().openConfig(); await until(cfgShown, 3000);
    var t = q('#pnbCcfgTitle1'), o = t.options[t.selectedIndex];
    R.chk.missingListed = t.value === 'GONE_COL' && /not in the results/.test(o.textContent);
    var ch = cchip('GONE2');
    R.chk.missingChip = !!ch && ch.checked && ch.parentNode.classList.contains('is-missing') && cchip('V_DATE').checked;
  };
  // (clbar) the brand bar on H_NUM with one 1e9 value, two 500s and a 0 on the page: every width the value's place
  S.cbarrank = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var rows = shownRows(), cs = cards(), hn = function (tr) { return Math.abs(parseFloat(tdText(tr, 'H_NUM'))); };
    function wOf(c) { var m = q('.pnb-card-meter', c); return m ? parseFloat(m.firstElementChild.style.width) : -1; }
    var ok = cs.length === 200 && rows.length === 200, bad = [];
    for (var i = 0; i < cs.length && ok; i++) { var v = hn(rows[i]), w = wOf(cs[i]), want = rankWant(rows, 'H_NUM', v); ok = Math.abs(w - want) < 0.2; if (!ok) bad = [i, v, w, want]; }
    R.chk.ranked = ok; R.info.bad = bad;
    R.chk.outlierFull = hn(rows[0]) === 1000000000 && Math.abs(wOf(cs[0]) - 100) < 0.2;
    R.chk.tiesEqual = hn(rows[1]) === 500 && hn(rows[2]) === 500 && wOf(cs[1]) === wOf(cs[2]) && wOf(cs[1]) > 0;
    R.chk.zeroEmpty = hn(rows[3]) === 0 && wOf(cs[3]) === 0;
    var ws = cs.map(wOf), wide = ws.filter(function (w) { return w >= 25; }).length;
    R.chk.spread = wide >= 120;   // a share of the 1e9 value would have drawn 199 bars under 0.1%
    var vals = rows.map(hn).sort(function (a, b) { return a - b; }), med = vals[Math.floor(vals.length / 2)], mi = rows.map(hn).indexOf(med);
    R.chk.medianHalf = mi >= 0 && Math.abs(wOf(cs[mi]) - 50) < 6;
    R.info.ws = [ws.slice(0, 6), med, mi, wide];
  };
  // (clbar) the view link carries the viewer's own card setup: built from the cards, from the table's Open as cards
  // (none from a plain table link), cleaned on read; cvlD opens the first link
  var T_SETUP = { title: 'V_STATUS', big: 'H_AMT', bar: 'H_NUM', sub: ['V_ID'], fields: ['V_DATE', 'V_LINK', 'H_TEXT', 'V_NAME', 'H_CODE'], own: 1, nolabels: 1 };
  S.cvlC = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    window.Penumbra.cardsHost.layoutSet(T_SETUP); C().redraw(); await sleep(250);
    R.chk.setupDrawn = same(slots(), { title: 'V_STATUS', sub: ['V_ID'], big: 'H_AMT', pill: null, bar: 'H_NUM', fields: T_SETUP.fields }) && !!q('.pnb-card-fields.is-nolabels', cards()[0]);
    var b = window.PenumbraViewLink.build(); R.info.token = b.token;
    var d = window.PenumbraViewLink.decode(b.token); R.info.cl = d && d.cl;
    R.chk.carriesSetup = !!d && d.cv === 1 && sameKeys(d.cl, T_SETUP) && sameKeys(b.view.cl, T_SETUP);
    R.chk.included = (b.included || []).indexOf('card setup') >= 0;
    R.chk.described = (window.PenumbraViewLink.describe(b) || []).some(function (x) { return /your card setup/.test(x); });
    await pickView('table');
    var b2 = window.PenumbraViewLink.build({ cards: true, size: 'large' }), d2 = window.PenumbraViewLink.decode(b2.token);
    R.chk.emailCarries = !!d2 && d2.cv === 1 && d2.cz === 'large' && sameKeys(d2.cl, T_SETUP);
    var b3 = window.PenumbraViewLink.build(), d3 = window.PenumbraViewLink.decode(b3.token);
    R.chk.noneOnTable = !!d3 && d3.cv === undefined && d3.cl === undefined;
    var dirty = tok({ v: 1, m: 'flat', o: 'none', cv: 1, cl: { own: true, title: '<img src=x>', sub: ['V_ID', 'V_NAME', 'V_DATE'], big: 42, pill: '', bar: 'h_num',
      fields: ['V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_CODE', 'H_NUM', 'H_DATE', 'H_MONEY', 'H_AMT', 'H_TEXT', 'H_GROUP', 'H_NULL', 'H_HTML'], nolabels: true } });
    var dd = window.PenumbraViewLink.decode(dirty); R.info.dirty = dd && dd.cl;
    R.chk.cleaned = !!dd && !!dd.cl && dd.cl.title === undefined && same(dd.cl.sub, ['V_ID', 'V_NAME']) && dd.cl.big === undefined && dd.cl.pill === undefined && dd.cl.bar === 'H_NUM' && dd.cl.fields.length === 12 && dd.cl.own === 1 && dd.cl.nolabels === 1;
    var de = window.PenumbraViewLink.decode(tok({ v: 1, m: 'flat', o: 'none', cv: 1, cl: { pill: 'V_STATUS' } }));
    R.chk.emptyDropped = !!de && de.cl === undefined;   // a pill alone is no setup (as layoutSet keeps none)
    window.Penumbra.cardsHost.layoutSet(null);
  };
  S.cvlD = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.bootsSetup = on() && window.PenumbraViewLink.active() && same(slots(), { title: 'V_STATUS', sub: ['V_ID'], big: 'H_AMT', pill: null, bar: 'H_NUM', fields: T_SETUP.fields });
    R.info.slots = slots(); R.info.layout = C().layout();
    R.chk.layoutIsLinks = sameKeys(C().layout(), T_SETUP) && sameKeys((window.Penumbra.cardsHost.viewLink() || {}).setup, T_SETUP);
    R.chk.prefUntouched = (prefs().lrfix || {}).cards === undefined;
    R.chk.labelsOff = !!q('.pnb-card-fields.is-nolabels', cards()[0]) && qa('.pnb-card-fields dd', cards()[0]).length === 5;
    C().openConfig(); await sleep(200);
    var el = q('#pnbCardsConfig');
    R.chk.windowShowsLink = !!el && q('select[data-slot="bar"]', el).value === 'H_NUM' && q('select[data-slot="title"]', el).value === 'V_STATUS' && qa('#pnbCcfgFields input[type="checkbox"]:checked', el).length === 5 && !q('#pnbCcfgLabels', el).checked;
    C().closeConfig(); await sleep(50);
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
    pickSize('large'); await until(function () { return C().state() && C().state().size === 'large'; }, 4000);
    R.chk.backToLarge = host().classList.contains('is-large') && !host().classList.contains('is-xl') && (prefs().lrfix || {}).size === 'large';
    // (round N) an editor's default at Extra large, then Large, through Configure cards
    C().openConfig(); await until(cfgShown, 3000);
    setSel('pnbCcfgSize', 'xl'); await sleep(100); cbtn('pnb-ccfg-default').click(); await sleep(150); var b2 = bsoCards();
    setSel('pnbCcfgSize', 'large'); await sleep(100); cbtn('pnb-ccfg-default').click(); await sleep(150); var b3 = bsoCards();
    R.chk.formXl = !!b2 && b2.size === 'xl' && !!b3 && b3.size === 'large';
    C().closeConfig();
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
    R.chk.position = detPos() === expPos(2, flatKept().length, rppNow()) && !q('#pnbCardDetails .pnb-cdet-prev').disabled && !q('#pnbCardDetails .pnb-cdet-next').disabled;
    q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(120);
    var tr3 = shownRows()[3];
    R.chk.next = detTitle() === tdText(tr3, 'V_NAME') && detPos() === expPos(3, flatKept().length, rppNow()) && cs[3].getAttribute('aria-current') === 'true' && C().details().at === 3;
    keyOn(document.activeElement, 'ArrowLeft'); await sleep(120);
    R.chk.prevKey = detTitle() === tdText(tr2, 'V_NAME') && C().details().at === 2;
    keyOn(document.activeElement, 'Escape'); await sleep(120);
    R.chk.escCloses = !detOpen() && document.activeElement === cards()[2];
    // the filter respected: only the rows shown are stepped through
    await runSearch('V_STATUS = Closed'); await until(function () { return shownRows().length > 0 && shownRows().length < 200 && same(cardRows(), shownRows().map(rowIdx)); }, 6000);
    var sr = shownRows();
    q('.pnb-card-fields dt', cards()[0]).click(); await sleep(150);
    q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(120);
    R.chk.filtered = detOpen() && detTitle() === tdText(sr[1], 'V_NAME') && detPos() === expPos(1, flatKept().length, rppNow()) && detPairs().some(function (p) { return p[0] === thName('V_STATUS') && p[1] === 'Closed'; });
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
    R.chk.opensInGroup = detOpen() && C().details().at === li && detPos() === (li + 1) + ' of ' + all.length + ' cards' && li > 0;
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
    // (round T) the status bar's Configure cards over the tiles: shown, greyed, its reason under it
    var why = C().configWhyNot ? C().configWhyNot() : null, sb = q('#sbCardsConfig'), sn = q('#sbCardsCfgNote');
    R.info.segCfg = { why: why, hidden: sb && sb.hidden, dis: sb && sb.disabled, title: sb && sb.title, note: sn && !sn.hidden, desc: sb && sb.getAttribute('aria-describedby') };
    R.chk.segCfgOff = !!why && !!sb && !sb.hidden && sb.disabled && sb.title === why && !!sn && !sn.hidden && vis(sn) && /pivot/i.test(text(sn)) && sb.getAttribute('aria-describedby') === 'sbCardsCfgNote';
    // a tile's value: the pivot's own menu for its cell (marked pnb-hm-for), the card's items after it
    var ev = rclick(dd); await sleep(80);
    var m = menu(), a = acts(), marked = q('#pivotResultTable td.pnb-hm-for');
    R.info.pvActs = a;
    var cfgIt = m ? q('.pnb-hm-item[data-act="cardConfig"]', m) : null, cfgOff = { dis: cfgIt && cfgIt.getAttribute('aria-disabled'), title: cfgIt && cfgIt.getAttribute('title') };   // (round T)
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
    R.chk.totalTileMenu = ev.defaultPrevented && !!menu() && a.indexOf('cardSize') >= 0 && a.indexOf('cardsTable') >= 0 && a.every(function (x) { return x === 'cardSize' || x === 'cardsTable' || x === 'cardOpen' || x === 'cardConfig'; });   // (round T: Configure cards greyed)   // (cdet: Open details joins the card's own items)
    // (round O) a tile value's white space: the tile's own menu - its row label's (not the value cell's)
    var wdd = q('.pnb-card-pvfields dd[data-pvc]', leaf), wtr = wdd ? textRect(wdd) : null, wr2 = wdd ? wdd.getBoundingClientRect() : null;
    if (wdd && wtr) { rclick(wdd, { x: Math.min(wr2.right - 2, wtr.right + 24), y: (wtr.top + wtr.bottom) / 2 }); await sleep(80); }
    var wmk = q('#pivotResultTable td.pnb-hm-for');
    R.info.pvWhite = { dd: !!wdd, text: wtr, box: wr2 ? [wr2.left, wr2.right] : null, marked: wmk ? wmk.outerHTML.slice(0, 80) : null };
    R.chk.tileWhiteLabel = !!wdd && !!wtr && wr2.right - 2 > wtr.right + 6 && !!menu() && !!wmk && wmk.hasAttribute('data-row-field');
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(60);
    rclick(q('.pnb-card-title', cs[0])); await sleep(80);   // the total tile's menu again, for the steps after
    // (round N) no Configure cards over pivot tiles: the pivot draws them (menus, Quick actions, Settings > Cards)
    R.info.cfgOff = cfgOff;
    R.chk.tileConfigOff = cfgOff.dis === 'true' && !!why && cfgOff.title === why && !(C().canConfig && C().canConfig()) && (!lay() || lay().hidden);   // (round T) greyed with its reason, never hidden
    // Show as table from a tile: the pivot table shows again
    q('.pnb-hm-item[data-act="cardsTable"]', menu()).click(); await until(function () { return !on(); }, 4000);
    R.chk.tileShowTable = !on() && !menu() && getComputedStyle(q('#pivotResultTable')).visibility !== 'hidden';
    var tis = C().tableItems({ th: q('#pivotResultTable thead th') }), sub = (tis && tis[0] && tis[0].items) ? tis[0].items() : [], tc = sub.filter(function (x) { return x && x.act === 'showCardsConfig'; })[0];
    R.info.tableCfg = tc ? { dis: tc.disabled, why: tc.why } : null;
    R.chk.tableCfgOff = !!tc && tc.disabled === true && tc.why === why && typeof tc.run !== 'function';   // (round T)
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
    R.chk.flyout = has && same(sa.slice(0, 5), ['showCards-compact', 'showCards-standard', 'showCards-large', 'showCards-xl', 'showCardRow']);
    // (round N, the user) the table shows: no size is ticked; Configure cards... closes the list
    R.chk.noneTicked = !!sub && qa('.pnb-hm-item', sub).every(function (x) { return x.getAttribute('aria-checked') !== 'true'; }) && sa[sa.length - 1] === 'showCardsConfig'
      && qa('.pnb-hm-item', sub).slice(-1)[0].getAttribute('aria-disabled') !== 'true';   // (round T) usable on a flat table (greyed only over a pivot)
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
    R.chk.headerFlyout = ha.filter(function (x) { return /^showCards-/.test(x); }).length === 4 && ha.indexOf('showCardRow') < 0;
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
    await until(function () { return window.Penumbra.cardsHost && window.Penumbra.cardsHost.loaded(); }, 8000);
    // (round N) the lists are Configure cards'; on live (the control) View Options' card's
    var W = !!C().openConfig;
    if (W) { C().openConfig(); await until(cfgShown, 3000); } else { C().populate(); } await sleep(100);
    function id(sl) { return '#' + (W ? 'pnbCcfg' + (sl === 'Title' ? 'Title1' : sl) : 'pnbCard' + sl); }
    function o(v) { return q(id('Bar') + ' option[value="' + v + '"]'); }
    R.info.bar = qa(id('Bar') + ' option').map(function (x) { return x.value + (x.disabled ? '-' : '+'); });
    R.chk.textOff = ['V_NAME', 'V_ID', 'H_TEXT', 'H_GROUP', 'H_GROUP2', 'H_FLAG', 'H_CODE', 'H_JSON'].every(function (v) { return !!o(v) && o(v).disabled; });
    R.chk.numberOn = ['V_AMOUNT', 'H_NUM', 'H_AMT', 'H_MONEY'].every(function (v) { return !!o(v) && !o(v).disabled; });
    R.chk.pickedKept = q(id('Bar')).value === 'V_STATUS' && !!o('V_STATUS') && !o('V_STATUS').disabled;
    R.chk.otherSlotsOpen = qa(id('Title') + ' option').length > 5 && !q(id('Title') + ' option:disabled') && !q(id('Pill') + ' option:disabled') && !q(id('Big') + ' option:disabled') && !q(id('Sub1') + ' option:disabled');
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
  // (round N; round P: Settings > Cards gone) the viewer's setup through the window: a title and
  // fields picked (drawn, kept as the viewer's whole setup, never the report's), Use the report's; a round L layout
  // ({ title, fields }) seeded: drawn, shown in the window, the report's untouched
  S.clayout = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    C().sync(); await sleep(100);
    R.info.sec = { hidden: lay() ? lay().hidden : null, btn: !!q('#spCardConfigBtn') };
    R.chk.sectionGone = !lay() && !q('#spCardConfigBtn') && !q('#spCardTitle') && !!q('.sp-columns-section');   // (round P) Settings > Cards is gone
    var opened = C().openConfig(); await sleep(250);
    R.chk.paletteOpens = opened === true && C().canConfig() === true && cfgShown() && document.activeElement === q('#pnbCcfgSize');
    setSel('pnbCcfgTitle1', 'V_STATUS'); await sleep(250);
    R.chk.titlePicked = !!slots() && slots().title === 'V_STATUS' && text(q('.pnb-card-title', cards()[0])) === tdText(shownRows()[0], 'V_STATUS');
    var dc = cchip('V_DATE'); if (dc && dc.checked) dc.click();
    ['V_AMOUNT', 'V_ID'].forEach(function (n) { var c = cchip(n); if (c) { c.click(); } }); await sleep(250);
    R.info.slots = slots();
    R.chk.fieldsPicked = !!slots() && same(slots().fields, ['V_ID', 'V_AMOUNT']) && same(qa('.pnb-card-fields dd[data-col]', cards()[0]).map(function (d) { return d.getAttribute('data-col'); }), ['V_ID', 'V_AMOUNT']);
    var pc = mine();
    R.info.pref = pc;
    R.chk.keptAsPref = !!pc && pc.own === 1 && pc.title === 'V_STATUS' && same(pc.fields, ['V_ID', 'V_AMOUNT']) && !cbtn('pnb-ccfg-reset').disabled;
    R.chk.authorUntouched = same(bsoCards(), { title: 'V_NAME', fields: ['V_DATE'] });
    R.info.bso = bsoCards();
    cbtn('pnb-ccfg-reset').click(); await sleep(250);
    R.chk.resetBack = R.chk.titlePicked === true && slots().title === 'V_NAME' && same(slots().fields, ['V_DATE']) && !mine() && q('#pnbCcfgTitle1').value === 'V_NAME'
      && cbtn('pnb-ccfg-reset').disabled && /report's cards/.test(text(cbtn('pnb-ccfg-note')));
    C().closeConfig();
  };
  S.clayoutB = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    C().sync(); await sleep(100);
    R.info.slots = slots();
    R.chk.seededDrawn = !!slots() && slots().title === 'V_STATUS' && same(slots().fields, ['V_ID', 'V_AMOUNT']);
    R.chk.formIsAuthors = same(bsoCards(), { title: 'V_NAME', fields: ['V_DATE'] });
    C().openConfig(); await until(cfgShown, 3000);
    R.chk.seededShown = q('#pnbCcfgTitle1').value === 'V_STATUS' && cchip('V_ID').checked && cchip('V_AMOUNT').checked && !cchip('V_DATE').checked && text(q('#pnbCcfgFieldsCount')) === '2 of 12' && !cbtn('pnb-ccfg-reset').disabled;
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
  // ---- (round O) a card's white space; the details past the page; the status bar's Cards segment ---------------------
  function textRect(el) {   // the union of the element's text boxes, or null
    var rg = document.createRange(), w = document.createTreeWalker(el, 4), n, o = null;
    while ((n = w.nextNode())) {
      if (!/\S/.test(n.nodeValue)) continue;
      rg.selectNodeContents(n); var rs = rg.getClientRects();
      for (var i = 0; i < rs.length; i++) { var x = rs[i]; if (!o) o = { left: x.left, right: x.right, top: x.top, bottom: x.bottom }; else { o.left = Math.min(o.left, x.left); o.right = Math.max(o.right, x.right); o.top = Math.min(o.top, x.top); o.bottom = Math.max(o.bottom, x.bottom); } }
    }
    return o;
  }
  function fieldMenu(a) { return a.indexOf('cardsTable') >= 0 && (a.indexOf('sortAsc') >= 0 || a.indexOf('cellFilter') >= 0 || a.indexOf('filterMenu') >= 0); }
  function cardMenu(a) { return a.indexOf('cardsTable') >= 0 && a.indexOf('cardConfig') >= 0 && a.indexOf('sortAsc') < 0 && a.indexOf('cellFilter') < 0 && a.indexOf('filterMenu') < 0 && a.indexOf('hide') < 0; }
  function moveAt(el, x, y) { el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window })); }
  function flatKept() { return qa('#resultsTable > tbody > tr').filter(function (tr) { return !tr.classList.contains('search-hidden'); }); }
  function rppNow() { var s = q('#rowsPerPageSelector'); return s ? parseInt(s.value, 10) : NaN; }
  function expPos(g, all, rpp) {   // the details window's count, as it should read
    var s = (g + 1).toLocaleString() + ' of ' + all.toLocaleString() + ' cards';
    if (rpp > 0 && all > rpp) { var pg = Math.floor(g / rpp), onp = Math.min(rpp, all - pg * rpp); s += ' Page ' + (pg + 1) + ' of ' + Math.ceil(all / rpp) + ': ' + (g - pg * rpp + 1) + ' of ' + onp + ' on this page'; }
    return s;
  }
  async function menuAt(el, x, y) { if (menu()) { keyOn(document.activeElement, 'Escape'); await sleep(60); } var ev = rclick(el, { x: x, y: y }); await sleep(80); return { ev: ev, a: acts() }; }
  S.cwhite = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    var c = cards()[1], dd = q('.pnb-card-fields dd[data-col="V_DATE"]', c), tr = textRect(dd), r = dd.getBoundingClientRect(), my = (tr.top + tr.bottom) / 2;
    var wx = Math.min(r.right - 2, tr.right + 24);
    R.info.dd = { text: tr, box: [r.left, r.right], wx: wx };
    // a value's text: its column's menu, marked
    var m = await menuAt(dd, tr.left + 3, my);
    R.chk.textField = m.ev.defaultPrevented && fieldMenu(m.a) && dd.classList.contains('is-menu-for');
    // the white space beside it (past the margin): the card's own menu, the card's title on top
    m = await menuAt(dd, wx, my); R.info.whiteActs = m.a.slice(0, 10);
    R.chk.whiteCard = wx > tr.right + 6 && m.ev.defaultPrevented && cardMenu(m.a) && text(q('.pnb-hm-name', menu())) === text(q('.pnb-card-title', c));
    // a small margin round the text is still the field's
    m = await menuAt(dd, tr.right + 2, my);
    R.chk.marginField = fieldMenu(m.a);
    // the title's white space, the big number's: the card's; the pill and the bar (no text): their fields'
    var tt = q('.pnb-card-title', c), ttr = textRect(tt), tbox = tt.getBoundingClientRect();
    m = await menuAt(tt, Math.min(tbox.right - 2, ttr.right + 24), (ttr.top + ttr.bottom) / 2);
    R.chk.titleWhite = tbox.right - 2 > ttr.right + 6 && cardMenu(m.a);
    var bg = q('.pnb-card-big', c), btr = textRect(bg), bbox = bg.getBoundingClientRect();
    m = await menuAt(bg, Math.min(bbox.right - 2, btr.right + 24), (btr.top + btr.bottom) / 2);
    R.chk.bigWhite = bbox.right - 2 > btr.right + 6 && cardMenu(m.a);
    R.info.parts = { title: [ttr && ttr.right, tbox.right], big: [btr && btr.right, bbox.right] };
    var pl = q('.pnb-card-pill', c), pr = pl.getBoundingClientRect();
    m = await menuAt(pl, pr.left + 2, (pr.top + pr.bottom) / 2);
    R.chk.pillField = fieldMenu(m.a);
    var mt = q('.pnb-card-meter', c), mr = mt.getBoundingClientRect();
    m = await menuAt(mt, (mr.left + mr.right) / 2, (mr.top + mr.bottom) / 2);
    R.chk.barField = fieldMenu(m.a);
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(60);
    // the lit field: on its value's text, never its white space nor its label
    moveAt(dd, tr.left + 3, my); await sleep(30);
    var hotText = dd.classList.contains('is-hot'), hbg = getComputedStyle(dd).backgroundColor, lbg = getComputedStyle(dd.previousElementSibling).backgroundColor;
    moveAt(dd, wx, my); await sleep(30);
    var hotWhite = dd.classList.contains('is-hot');
    var dt = dd.previousElementSibling, dr = dt.getBoundingClientRect(); moveAt(dt, dr.left + 3, (dr.top + dr.bottom) / 2); await sleep(30);
    R.info.hot = { text: hotText, white: hotWhite, bg: hbg, lbg: lbg, n: qa('.is-hot').length };
    R.chk.hotOnText = hotText;
    R.chk.hotNotWhite = !hotWhite && qa('.is-hot').length === 0;
    R.chk.hotLit = hotText && hbg !== 'rgba(0, 0, 0, 0)' && hbg !== 'transparent' && hbg === lbg;
    // the details window: a value's text, its cell's menu; its white space, the card's
    q('.pnb-card-fields dt', c).click(); await until(function () { return detOpen(); }, 3000); await sleep(150);
    var ddd = q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_DATE"]'), dtr = textRect(ddd), dbox = ddd.getBoundingClientRect(), dmy = (dtr.top + dtr.bottom) / 2;
    m = await menuAt(ddd, dtr.left + 3, dmy);
    R.chk.detTextField = fieldMenu(m.a) && detOpen();
    m = await menuAt(ddd, Math.min(dbox.right - 2, dtr.right + 30), dmy);
    R.chk.detWhiteCard = dbox.right - 2 > dtr.right + 6 && m.a.indexOf('sortAsc') < 0 && m.a.indexOf('cellFilter') < 0 && m.a.indexOf('hide') < 0 && detOpen();
    R.info.detWhite = { acts: m.a.slice(0, 8), text: dtr, box: [dbox.left, dbox.right] };
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(60);
    C().closeDetails();
  };
  S.cdetpage = async function () {
    await until(function () { return on() && cards().length === 25; }, 8000);
    var all = flatKept(), n = all.length, rpp = 25, t = function (i) { return tdText(all[i], 'V_ID'); };   // (the guessed title)
    // the page's last card: the count over every card, the page; Next on
    q('.pnb-card-fields dt', cards()[24]).click(); await until(function () { return detOpen(); }, 3000); await sleep(150);
    R.info.pos = [detPos(), expPos(24, n, rpp)];
    R.chk.posAll = detOpen() && detPos() === expPos(24, n, rpp);
    R.chk.nextEnabled = !q('#pnbCardDetails .pnb-cdet-next').disabled;
    // Next: the next page, its first card in the window (selected), the window's count
    q('#pnbCardDetails .pnb-cdet-next').click(); await until(function () { return detOpen() && detTitle() === t(25); }, 4000); await sleep(150);
    var cs = cards();
    R.info.turn = { title: detTitle(), want: t(25), at: C().details().at, n: cs.length, first: cs[0] && cs[0].getAttribute('data-row'), pos: detPos() };
    R.chk.nextTurns = detOpen() && detTitle() === t(25) && C().details().at === 0 && cs.length === 25 && cs[0].getAttribute('data-row') === String(rowIdx(all[25])) && cs[0].getAttribute('aria-current') === 'true';
    R.chk.posPage = detPos() === expPos(25, n, rpp);
    // Previous at a page's first card: the page before, its last card
    q('#pnbCardDetails .pnb-cdet-prev').click(); await until(function () { return detOpen() && detTitle() === t(24); }, 4000); await sleep(150);
    R.chk.prevTurns = detOpen() && detTitle() === t(24) && C().details().at === 24;
    // the Right key goes past the page too
    keyOn(q('#pnbCardDetails .pnb-cdet-box'), 'ArrowRight'); await until(function () { return detOpen() && detTitle() === t(25); }, 4000); await sleep(100);
    R.chk.keysTurn = detOpen() && detTitle() === t(25);
    // the last page's last card: Next off, Previous on
    C().closeDetails(); await sleep(80);
    q('#lastPageBtn').click(); await until(function () { return cards().length > 0 && cards()[cards().length - 1].getAttribute('data-row') === String(rowIdx(all[n - 1])); }, 4000); await sleep(150);
    var cl = cards(); q('.pnb-card-fields dt', cl[cl.length - 1]).click(); await until(function () { return detOpen(); }, 3000); await sleep(150);
    R.chk.lastOff = detOpen() && q('#pnbCardDetails .pnb-cdet-next').disabled && !q('#pnbCardDetails .pnb-cdet-prev').disabled && detPos() === expPos(n - 1, n, rpp);
    R.info.last = detPos();
    C().closeDetails();
  };
  S.cdetmore = async function () {
    await until(function () { return on() && cards().length === 1000; }, 20000);
    var all = flatKept(), n = all.length;
    q('.pnb-card-fields dt', cards()[999]).click(); await until(function () { return detOpen(); }, 3000); await sleep(150);
    R.info.pos = [detPos(), expPos(999, n, NaN), n];
    R.chk.posMore = detOpen() && n === 1003 && detPos() === expPos(999, n, NaN) && !q('#pnbCardDetails .pnb-cdet-next').disabled;
    var want = tdText(all[1000], 'V_ID');   // (the guessed title)
    q('#pnbCardDetails .pnb-cdet-next').click(); await until(function () { return detOpen() && C().details().at === 1000; }, 8000); await sleep(150);
    R.info.more = { at: C().details().at, n: cards().length, title: detTitle(), want: want, pos: detPos() };
    R.chk.nextDraws = detOpen() && cards().length === 1003 && C().details().at === 1000 && detTitle() === want && detPos() === expPos(1000, n, NaN);
    C().closeDetails();
  };
  function segEl() { return q('#sbCardsSeg'); }
  function segOpen() { return !!segEl() && segEl().classList.contains('sb-open'); }
  S.cseg = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var g = segEl(), pop = q('#sbCardsPop');
    R.chk.segShown = !!g && vis(g) && !g.classList.contains('sb-opt') && !!g.previousElementSibling && g.previousElementSibling.id === 'sbColsSeg';
    R.chk.controlsIn = !!pop && pop.contains(sw()) && pop.contains(sizeSel()) && pop.contains(q('#pnbCardsSort')) && pop.contains(q('#pnbCardsSortDir')) && !!q('#sbCardsConfig', pop) && !q('#resultCount + #pnbCardsSwitch');
    R.chk.chipCards = text(q('#sbCardsChip')) === 'Cards' && !q('#sbCardsChip').classList.contains('sb-off');
    R.chk.fieldsWord = text(q('#sbColsOpen .sb-lab')) === 'Fields' && text(q('#sbColsPopHead')) === 'Fields';
    R.chk.cardsRowsShown = !q('#sbCardsSizeRow').hidden && !q('#sbCardsSortRow').hidden && vis(sizeSel()) && vis(q('#pnbCardsSort')) && !q('#sbCardsConfig').hidden;
    // its trigger opens its card (main.js, as the bar's other cards) and closes it
    q('#sbCardsOpen').click(); await sleep(80);
    var o1 = segOpen() && q('#sbCardsOpen').getAttribute('aria-expanded') === 'true';
    q('#sbCardsOpen').click(); await sleep(80);
    R.chk.opens = o1 && !segOpen() && q('#sbCardsOpen').getAttribute('aria-expanded') === 'false';
    R.info.open = { o1: o1, now: segOpen(), aria: q('#sbCardsOpen').getAttribute('aria-expanded') };
    // Escape inside it: closed, the focus back on its trigger
    q('#sbCardsOpen').click(); await sleep(80); sizeSel().focus();
    keyOn(sizeSel(), 'Escape'); await sleep(80);
    R.chk.escFocus = !segOpen() && document.activeElement === q('#sbCardsOpen');
    R.info.esc = { open: segOpen(), act: document.activeElement && (document.activeElement.id || document.activeElement.tagName) };
    // a pick inside keeps it open
    q('#sbCardsOpen').click(); await sleep(80); setSel('pnbCardsSize', 'large'); await sleep(150);
    R.chk.pickKeepsOpen = segOpen() && host().classList.contains('is-large');
    // Configure cards...: the card closes, the window opens; closed, the focus back on the trigger
    q('#sbCardsConfig').focus(); q('#sbCardsConfig').click(); await sleep(150);   // (a real click focuses the button first)
    var up = C().configOpen() === true && !segOpen();
    C().closeConfig(); await sleep(80);
    R.chk.configBtn = up && document.activeElement === q('#sbCardsOpen');
    R.info.cfg = { up: up, act: document.activeElement && (document.activeElement.id || document.activeElement.tagName) };
    // the table: the chip says so, Cols again, the size and Sort rows gone, the segment stays
    await pickView('table');
    R.chk.tableWords = text(q('#sbCardsChip')) === 'Table' && q('#sbCardsChip').classList.contains('sb-off') && text(q('#sbColsOpen .sb-lab')) === 'Cols' && text(q('#sbColsPopHead')) === 'Columns'
      && q('#sbCardsSizeRow').hidden && q('#sbCardsSortRow').hidden && vis(segEl());
  };
  // (round P, cxl2) Extra large: a card whose fields are all short lays them out in two columns - the first half down the
  // left, the rest down the right, each pair on its row, no value wrapped; the card with a long value keeps one column; a
  // value grown long in place goes back to one column, short again back to two; never in the details window, with one
  // field or at Large; on a phone (cxl2ph) none
  function fdl(c) { return q('.pnb-card-fields', c); }
  function split2(c) { var d = fdl(c); return !!d && d.classList.contains('is-2col'); }
  function oneLine(el) {   // every word of the value on one line (its text rects' tops within 4px)
    var rg = document.createRange(), w = document.createTreeWalker(el, 4), t, lo = Infinity, hi = -Infinity;
    while ((t = w.nextNode())) { if (!/\S/.test(t.nodeValue)) continue; rg.selectNodeContents(t); Array.prototype.forEach.call(rg.getClientRects(), function (r) { if (r.width > 0) { lo = Math.min(lo, r.top); hi = Math.max(hi, r.top); } }); }
    return hi >= lo && hi - lo < 4;
  }
  function longCard() { return cards().filter(function (c) { return text(q('.pnb-card-title', c)) === 'Long status row'; })[0] || null; }
  S.cxl2 = async function () {
    await until(function () { return on() && cards().length === 300 && host().classList.contains('is-xl'); }, 10000);
    await until(function () { return !!C().split() && C().split().split > 0; }, 4000); await sleep(150);
    // a redraw read in the same task: split already (no timer has run between the draw and this read)
    C().redraw(); var syncSplit = qa('#pnbCardsHost .pnb-card-fields.is-2col').length;
    R.chk.drawnSplit = syncSplit === 299;
    await sleep(150);
    var cs = cards(), lc = longCard(), sp = C().split(), others = cs.filter(function (c) { return c !== lc; });
    R.info.split = { sp: sp, n: cs.length, long: !!lc, w: fdl(cs[0]) && fdl(cs[0]).clientWidth, notSplit: others.filter(function (c) { return !split2(c); }).length };
    R.chk.splitShort = !!lc && others.length === 299 && others.every(split2) && !!sp && sp.split === 299 && sp.lists === 300;
    R.chk.longStays = !!lc && !split2(lc) && qa('dd', fdl(lc)).length === 4;
    // the order reads on: the first two fields down the left, the next two down the right
    var c0 = others[0], dts = qa(':scope > dt', fdl(c0)), dds = qa(':scope > dd', fdl(c0));
    function rc(e) { return e.getBoundingClientRect(); }
    var r = dts.map(rc), v = dds.map(rc);
    R.info.pos = r.map(function (x) { return [Math.round(x.left), Math.round(x.top)]; });
    R.chk.columnMajor = dts.length === 4 && Math.abs(r[0].left - r[1].left) < 1 && Math.abs(r[2].left - r[3].left) < 1 && r[2].left > v[0].right - 1
      && Math.abs(r[0].top - r[2].top) < 1 && Math.abs(r[1].top - r[3].top) < 1 && r[1].top > r[0].top + 4 && dts[2].classList.contains('is-cf2') && !dts[1].classList.contains('is-cf2');
    R.chk.pairsAligned = dts.length === 4 && dts.every(function (d, i) { return Math.abs(r[i].top - v[i].top) < 2 && v[i].left > r[i].left; })
      && v[0].right <= r[2].left + 1 && v[2].right <= fdl(c0).getBoundingClientRect().right + 1;
    R.chk.noWrap = others.slice(0, 40).every(function (c) { return qa(':scope > dd', fdl(c)).every(oneLine); });
    // a value grown long in place: that card back to one column (read in one column again), the others kept; short again: two
    var dv = dds[1], was = dv.innerHTML;
    dv.textContent = 'Waiting on the sponsor for the final signed agreement and its budget pages';
    await until(function () { return !split2(c0); }, 3000); await sleep(100);
    R.chk.regrowUnsplits = !split2(c0) && split2(others[1]) && split2(others[2]);
    dv.innerHTML = was;
    await until(function () { return split2(c0); }, 3000); await sleep(100);
    R.chk.shrinkSplits = split2(c0) && C().split().split === 299;
    // the details window: never split
    C().openDetails(c0); await until(detOpen, 3000); await sleep(150);
    R.chk.detailsNone = detOpen() && !q('#pnbCardDetails .is-2col') && split2(c0);
    C().closeDetails(); await sleep(100);
    // one field: none
    C().openConfig(); await until(cfgShown, 3000);
    ['V_STATUS', 'V_DATE', 'V_AMOUNT'].forEach(function (n) { var ch = cchip(n); if (ch && ch.checked) ch.click(); });
    await until(function () { return !!slots() && slots().fields.length === 1; }, 3000); await sleep(250);
    R.info.one = { fields: slots() && slots().fields, sp: C().split(), lists: qa('#pnbCardsHost .is-2col').length };
    R.chk.oneFieldNone = !!slots() && same(slots().fields, ['V_ID']) && !q('#pnbCardsHost .is-2col') && C().split().split === 0;
    cbtn('pnb-ccfg-reset').click(); await sleep(250); C().closeConfig();
    await until(function () { return C().split() && C().split().split === 299; }, 3000);
    // Large: none
    C().setSize('large'); await until(function () { return host().classList.contains('is-large'); }, 3000); await sleep(250);
    R.chk.largeNone = host().classList.contains('is-large') && !q('#pnbCardsHost .is-2col') && same(C().split(), { lists: 0, split: 0 });
    C().setSize('xl'); await until(function () { return host().classList.contains('is-xl') && C().split() && C().split().split === 299; }, 4000);
    if (P.get('shot')) { window.scrollTo(0, 0); await sleep(200); }
  };
  S.cxl2ph = async function () {
    await until(function () { return on() && cards().length === 300; }, 10000); await sleep(300);
    R.info.ph = { w: window.innerWidth, sp: C().split(), xl: host().classList.contains('is-xl') };
    R.chk.phoneNone = window.innerWidth <= 600 && host().classList.contains('is-xl') && !q('#pnbCardsHost .is-2col') && !!C().split() && C().split().split === 0;
  };

  // (round P, colsview) the status bar's Cols card ends with the Layout line: table, Switch to cards layout, on a report
  // with no card setup (the Cards segment not shown yet); the link shows the cards, closes the card, puts the focus on the
  // count, the Cards segment then shown; the line reads cards and Switch to table layout, back to the table. What cards are
  // for: the switch's two options, the link, the table's Show as cards
  function cv() { return q('#sbColsView'); }
  function cvBtn() { return q('#sbColsViewSwitch'); }
  function colsOpen() { return q('#sbColsSeg').classList.contains('sb-cl-open'); }
  S.ccolsview = async function () {
    await until(function () { return !!C() && !!window.Penumbra.cardsHost && window.Penumbra.cardsHost.loaded(); }, 8000); C().sync(); await sleep(150);
    var pu = C().purpose();
    R.info.cv = { disp: cv() && cv().style.display, now: text(q('#sbColsViewNow')), btn: text(cvBtn()), seg: segEl() && segEl().style.display };
    R.chk.lineShown = !!cv() && cv().style.display === '' && !!q('#sbColsPop') && q('#sbColsPop').contains(cv()) && cv().previousElementSibling === q('#sbColsList')
      && text(q('#sbColsView dt')) === 'Layout' && text(q('#sbColsViewNow')) === 'table' && text(cvBtn()) === 'Switch to cards layout' && q('#sbColsView .sb-cl-row').classList.contains('sb-cl-off');
    R.chk.segHiddenBefore = !on() && !!segEl() && segEl().style.display === 'none' && !C().switchShown();
    R.chk.purposeWords = /more detail than reads well across one line/.test(pu.cards) && /smaller/.test(pu.cards) && /any size works/.test(pu.cards) && /scanning and comparing many rows/.test(pu.table);
    // the table's Show as cards and the link say what cards are for (the switch's options: read once it shows, below)
    var ti = C().tableItems({ th: fth('V_NAME') }), tc = ti && ti[0], linkTitle = cvBtn() && cvBtn().title;
    // the count opens the card (main.js); the line is in it, on screen
    q('#sbColsOpen').click(); await sleep(120);
    R.chk.opensCols = colsOpen() && vis(cv()) && vis(cvBtn());
    R.info.open = { open: colsOpen(), ready: q('#sbColsSeg').classList.contains('sb-cl-ready') };
    // the link: cards, the card closed, the focus on the count, the Cards segment shown, the pick kept
    cvBtn().click(); await until(function () { return on() && cards().length > 0; }, 6000); await sleep(150);
    R.info.sw = { on: on(), open: colsOpen(), act: document.activeElement && (document.activeElement.id || document.activeElement.tagName), seg: segEl().style.display, pref: prefs().lrfix };
    R.chk.linkSwitches = on() && cards().length > 0 && !colsOpen() && segEl().style.display === '' && (prefs().lrfix || {}).view === 'cards';
    R.chk.focusBack = document.activeElement === q('#sbColsOpen');
    R.info.titles = { cards: opt('cards') && opt('cards').title, table: opt('table') && opt('table').title, link: linkTitle, menu: tc && tc.title };
    R.chk.purposeTitles = !!opt('cards') && opt('cards').title === 'Each row as a card. ' + pu.cards && opt('table').title === pu.table
      && linkTitle === 'Each row as a card. ' + pu.cards && !!tc && tc.act === 'showCards' && tc.title === 'The same rows drawn as cards. ' + pu.cards;
    q('#sbColsOpen').click(); await sleep(120);
    R.chk.cardsWords = colsOpen() && text(q('#sbColsViewNow')) === 'cards' && text(cvBtn()) === 'Switch to table layout' && cvBtn().title === pu.table
      && q('#sbColsView .sb-cl-row').classList.contains('sb-cl-on') && text(q('#sbColsPopHead')) === 'Fields';
    cvBtn().click(); await until(function () { return !on(); }, 6000); await sleep(150);
    R.chk.backToTable = !on() && !colsOpen() && (prefs().lrfix || {}).view === 'table' && text(q('#sbColsViewNow')) === 'table' && text(cvBtn()) === 'Switch to cards layout' && document.activeElement === q('#sbColsOpen');
    if (P.get('shot')) { var cp = q('#sbCardsPop'); if (cp) cp.style.setProperty('display', 'none', 'important'); q('#sbColsOpen').click(); await sleep(250); }   // (the harness draws the Cards card open: hidden for the picture)
  };
  // (round Q) a pivot on link-valued fields (H_GROUP > H_GROUP2 down, V_STATUS across, each value an @@HTML link, as
  // ?id=int-col-mat's colleges and awards): no tile, details window or menu shows the marker or markup - a tile's
  // subtitle is its parent's text, its fields' labels the columns' texts; from the table, a column heading's Filter to
  // names its text; from a tile, a value's menu heading and its title's Filter to name texts, and Filter to filters
  function noMk(s) { return !/@@HTML|<a[\s>]|href=/i.test(String(s || '')); }
  S.pvhtml = async function () {
    await until(function () { return on() && cards().length > 2 && C().state() && C().state().pivot === true; }, 10000); await sleep(200);
    var cs = cards(), leaves = cs.filter(function (c) { return !c.classList.contains('is-total'); });
    var parents = qa('#pivotResultTable td[data-row-field="0"]').map(function (td) {   // its text without the collapse arrow / notes button, as a tile reads it
      var c = td.cloneNode(true); qa('.pivot-collapse-toggle, .journal-pvnote-btn, .pivot-other-count', c).forEach(function (x) { x.parentNode.removeChild(x); }); return text(c);
    });
    R.info.tiles = { n: cs.length, sub0: leaves[0] && text(q('.pnb-card-sub', leaves[0])), title0: leaves[0] && text(q('.pnb-card-title', leaves[0])), parents: parents.slice(0, 4), raw: (q('#pivotResultTable tr[data-pivot-row]') || { getAttribute: function () { return null; } }).getAttribute('data-pivot-row') };
    R.chk.noMarkup = cs.length > 2 && cs.every(function (c) { return noMk(c.textContent); }) && /@@HTML/.test(R.info.tiles.raw || '');
    var subs = leaves.map(function (c) { return text(q('.pnb-card-sub', c)); }).filter(Boolean);
    R.chk.subText = subs.length > 0 && parents.length > 0 && subs.every(function (s) { return parents.indexOf(s) >= 0; });
    var dts = qa('#pnbCardsHost .pnb-card-pvfields dt').map(function (d) { return text(d); });
    R.info.dts = dts.slice(0, 6);
    R.chk.fieldLabels = dts.length > 0 && dts.every(noMk) && dts.some(function (t) { return /^(Open|Closed|Pending)( |$)/.test(t); });
    // the details window
    C().openDetails(leaves[0]); await until(detOpen, 3000); await sleep(150);
    R.info.det = detOpen() ? q('#pnbCardDetails').textContent.replace(/\s+/g, ' ').slice(0, 240) : null;
    R.chk.detailsText = detOpen() && noMk(q('#pnbCardDetails').textContent) && text(q('#pnbCardDetails .pnb-card-sub')) === subs[0];
    C().closeDetails(); await sleep(100);
    // a tile value's menu: the pivot cell's, its heading the row / column path as text
    var dd = q('.pnb-card-pvfields dd[data-pvc]', leaves[0]); rclick(dd); await sleep(100);
    var mm = menu();
    R.info.valueMenu = mm ? { name: text(q('.pnb-hm-name', mm)), items: qa('.pnb-hm-item', mm).map(function (i) { return text(i); }) } : null;
    R.chk.valueMenuText = !!mm && noMk(mm.textContent) && noMk(qa('.pnb-hm-item', mm).map(function (i) { return i.getAttribute('title') || ''; }).join(' ')) && !!text(q('.pnb-hm-name', mm));
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
    // a tile title's menu: its row label's, Filter to / Exclude naming the label's text
    var t0 = text(q('.pnb-card-title', leaves[0]));
    rclick(q('.pnb-card-title', leaves[0])); await sleep(100);
    var lm = menu(), only = lm ? q('.pnb-hm-item[data-act="pvLabelOnly"]', lm) : null;
    R.info.labelMenu = lm ? { t0: t0, items: qa('.pnb-hm-item', lm).map(function (i) { return text(i); }), title: only && only.getAttribute('title') } : null;
    R.chk.labelMenuText = !!only && text(only) === 'Filter to "' + t0 + '"' && noMk(lm.textContent) && noMk(only.getAttribute('title') || '');
    // ...and its Filter to filters: the box holds the text, the pivot keeps that label's rows
    if (only) only.click();
    await until(function () { return /\S/.test(q('#tableSearch').value || ''); }, 4000); await sleep(700);
    var box = q('#tableSearch').value || '', left = qa('#pivotResultTable tbody tr[data-pivot-row]');
    R.info.filter = { box: box, rows: left.length, keys: left.slice(0, 3).map(function (tr) { return tr.getAttribute('data-pivot-row'); }) };
    R.chk.filterWorks = noMk(box) && box.indexOf(t0) >= 0 && left.length > 0 && left.every(function (tr) { return String(tr.getAttribute('data-pivot-row')).indexOf('>' + t0 + '<') >= 0; });
    // the table: a column heading's Filter to names the column's text
    C().set('table'); await until(function () { return !on(); }, 4000); await sleep(200);
    var th = qa('#pivotResultTable thead th').filter(function (h) { return /^(Open|Closed|Pending)$/.test(text(h)); })[0];
    if (th) rclick(th); await sleep(100);
    var hm = menu(), col = hm ? q('.pnb-hm-item[data-act="pvColOnly"]', hm) : null;
    R.info.colMenu = hm ? { th: th && text(th), items: qa('.pnb-hm-item', hm).map(function (i) { return text(i); }), title: col && col.getAttribute('title') } : { th: th && text(th) };
    R.chk.colHeadText = !!col && text(col) === 'Filter to "' + text(th) + '"' && noMk(col.getAttribute('title') || '') && noMk(hm.textContent);
    if (menu()) keyOn(document.activeElement, 'Escape');
  };
  // (round R) more fields per card: the report's ten (twelve at most) drawn; the window's count, its twelve and the kept
  // setup's; Show field labels off - the values alone (each label hidden for a screen reader, the value's hover title, the
  // value at the list's left), kept, the window showing it, made the report's default; at Extra large two value columns;
  // the details window naming every column; on again
  var TEN = ['V_ID', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_CODE', 'H_NUM', 'H_DATE', 'H_MONEY', 'H_AMT'];
  function lblBox() { return q('#pnbCcfgLabels'); }
  function flip(b) { b.checked = !b.checked; b.dispatchEvent(new Event('change', { bubbles: true })); }
  S.cfields = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000); await sleep(150);
    var rep = C().report(), c0 = cards()[0], dl = q('.pnb-card-fields', c0), dds = qa(':scope > dd', dl);
    R.info.ten = { rep: rep && rep.fields, slots: slots() && slots().fields, dds: dds.map(function (d) { return d.getAttribute('data-col'); }) };
    R.chk.reportTen = !!rep && same(rep.fields, TEN);
    R.chk.tenDrawn = !!slots() && same(slots().fields, TEN) && dds.length >= 8 && same(dds.map(function (d) { return d.getAttribute('data-col'); }), TEN.filter(function (n) { return dds.some(function (d) { return d.getAttribute('data-col') === n; }); }));
    var dt0 = q(':scope > dt', dl);
    R.chk.labelsShown = !dl.classList.contains('is-nolabels') && !!dt0 && dt0.getBoundingClientRect().width > 10 && !dds[0].hasAttribute('title');
    // the window: ten of twelve; two more: twelve, the rest wait, the kept setup has twelve; untick them
    C().openConfig(); await until(cfgShown, 3000); await sleep(100);
    var ten = text(q('#pnbCcfgFieldsCount')), two = qa('#pnbCcfgFields input:not(:checked)').slice(0, 2);
    two.forEach(function (b) { b.click(); }); await sleep(200);
    var rest = qa('#pnbCcfgFields input:not(:checked)'), m12 = mine();
    R.info.win = { ten: ten, now: text(q('#pnbCcfgFieldsCount')), mine: m12 && m12.fields, rest: rest.length };
    R.chk.windowCount = ten === '10 of 12' && text(q('#pnbCcfgFieldsCount')) === '12 of 12' && rest.length > 0 && rest.every(function (b) { return b.disabled; }) && !!m12 && m12.fields.length === 12 && slots().fields.length === 12;
    two.forEach(function (b) { b.click(); }); await sleep(200);
    R.chk.labelsBox = !!lblBox() && lblBox().checked === true;
    // labels off
    flip(lblBox()); await until(function () { var d = q('.pnb-card-fields', cards()[0]); return !!d && d.classList.contains('is-nolabels'); }, 3000); await sleep(150);
    c0 = cards()[0]; dl = q('.pnb-card-fields', c0); dds = qa(':scope > dd', dl); dt0 = q(':scope > dt', dl);
    var dlr = dl.getBoundingClientRect(), d0r = dds[0].getBoundingClientRect(), mo = mine();
    R.info.off = { cls: dl.className, dtW: dt0 && dt0.getBoundingClientRect().width, title: dds[0].getAttribute('title'), dtText: text(dt0), dlL: dlr.left, ddL: d0r.left, mine: mo };
    R.chk.labelsOff = dl.classList.contains('is-nolabels') && !!dt0 && dt0.getBoundingClientRect().width <= 1 && text(dt0).length > 0 && dds[0].getAttribute('title') === text(dt0)
      && Math.abs(d0r.left - dlr.left) < 2 && !!mo && mo.nolabels === 1 && mo.fields.length === 10;
    // the box follows the setup: Use the report's (the report shows labels) checks it and draws the labels; off again
    cbtn('pnb-ccfg-reset').click(); await sleep(250);
    var back = q('.pnb-card-fields', cards()[0]);
    R.info.kept = { box: lblBox() && lblBox().checked, cls: back && back.className, mine: mine() };
    R.chk.labelsKept = !!lblBox() && lblBox().checked === true && !!back && !back.classList.contains('is-nolabels') && !mine();
    flip(lblBox()); await until(function () { var d = q('.pnb-card-fields', cards()[0]); return !!d && d.classList.contains('is-nolabels'); }, 3000); await sleep(150);
    // the report's default carries it
    cbtn('pnb-ccfg-default').click(); await sleep(200);
    var b = bsoCards(); R.info.bso = b;
    R.chk.labelsDefault = !!b && b.nolabels === 1 && same(b.fields.slice().sort(), TEN.slice().sort());   // (the window lists the fields in the columns' order)
    C().closeConfig(); await sleep(100);
    // Extra large: two columns of values (the first value at the list's left, the right half's beside it on its row)
    C().setSize('xl'); await until(function () { return host().classList.contains('is-xl') && !!q('#pnbCardsHost .pnb-card-fields.is-2col.is-nolabels'); }, 4000); await sleep(150);
    var sdl = q('#pnbCardsHost .pnb-card-fields.is-2col.is-nolabels'), sdd = sdl ? qa(':scope > dd', sdl) : [], half = sdd.filter(function (d) { return d.classList.contains('is-cf2'); })[0];
    var sr = sdl ? sdl.getBoundingClientRect() : null, a0 = sdd[0] ? sdd[0].getBoundingClientRect() : null, h0 = half ? half.getBoundingClientRect() : null;
    R.info.split = { n: qa('#pnbCardsHost .pnb-card-fields.is-2col').length, sp: C().split(), a0: a0 && [a0.left, a0.top], h0: h0 && [h0.left, h0.top], dl: sr && [sr.left, sr.width] };
    R.chk.splitNoLabels = !!half && Math.abs(a0.left - sr.left) < 2 && h0.left >= sr.left + sr.width / 2 - 8 && Math.abs(h0.top - a0.top) < 2;
    // the details window names every column
    C().openDetails(cards()[0]); await until(detOpen, 3000); await sleep(150);
    var ddt = qa('#pnbCardDetails .pnb-cdet-fields dt');
    R.info = Object.assign({ det: { open: detOpen(), n: ddt.length, ws: ddt.slice(0, 3).map(function (d) { return Math.round(d.getBoundingClientRect().width); }), all: qa('#pnbCardDetails dt').length, dls: qa('#pnbCardDetails dl').map(function (d) { return d.className; }) } }, R.info);   // (first: the info line is cut at 900)
    R.chk.detailsLabels = detOpen() && ddt.length === 6 && ddt.every(function (d) { return d.getBoundingClientRect().width > 10; });   // (the six shown columns besides the title, each named)
    C().closeDetails(); await sleep(100);
    // labels on again
    C().openConfig(); await until(cfgShown, 3000); flip(lblBox()); await sleep(250);
    var dl2 = q('.pnb-card-fields', cards()[0]), m2 = mine();
    R.chk.labelsOn = !!dl2 && !dl2.classList.contains('is-nolabels') && !!m2 && !('nolabels' in m2);
    C().closeConfig();
  };
  // (round R) a fresh visit with a kept labels-off setup (seeded): the cards drawn without labels, the window opening
  // with Show field labels unchecked
  S.cfieldsB = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000); await sleep(150);
    var d = q('.pnb-card-fields', cards()[0]);
    R.chk.seededNoLabels = !!d && d.classList.contains('is-nolabels') && !!mine() && mine().nolabels === 1;
    C().openConfig(); await until(cfgShown, 3000); await sleep(100);
    R.info.seed = { cls: d && d.className, mine: mine(), box: lblBox() && lblBox().checked };
    R.chk.seededBox = !!lblBox() && lblBox().checked === false;
    C().closeConfig();
  };
  // (round S) the board: lanes side by side, one per outer group (its name, its count, its cards in one column);
  // the switch and the chip; Board by; the keys across lanes; the details window across lanes; a lane folds; a lane's
  // menu; Board by another column; leaving keeps a grouping the board did not make. From flat cards: the guess (the pill's
  // column), entering groups by it (kept), leaving ungroups, entering again, an ungroup elsewhere goes back to Cards.
  // A kept board on a visit groups the flat report by its column.
  function lanes() { return qa('#pnbCardsHost .pnb-cards-lane'); }
  function laneCards(l) { return qa('.pnb-card', l); }
  function topGroups() { return qa('#groupedResultsContainer > .group-wrapper').filter(function (w) { return !w.classList.contains('group-grand-total') && w.style.display !== 'none' && !w.classList.contains('search-hidden'); }); }
  function grpOn() { return document.body.classList.contains('group-mode-active'); }
  function grpLeafRows(w) {
    var ls = w.classList.contains('group-leaf') ? [w] : qa('.group-wrapper.group-leaf', w), n = 0;
    ls.forEach(function (x) { n += qa(':scope > .group-content > table > tbody > tr', x).filter(function (tr) { return !tr.classList.contains('search-hidden'); }).length; });
    return n;
  }
  function laneName(l) { return text(q('.pnb-cards-grpname', l)); }
  S.gboard = async function () {
    await until(function () { return on() && lanes().length > 0; }, 10000); await sleep(200);
    var L = lanes(), T = topGroups(), b = C().board();
    R.info.board = { lanes: L.length, tops: T.length, b: b, names: L.slice(0, 4).map(laneName) };
    // (the picture) a board wider than the window scrolls in itself, never the page (nor squeezes what is beside it)
    var bd = q('.pnb-cards-board'); R.info.widths = { doc: document.documentElement.scrollWidth, vw: window.innerWidth, sw: bd.scrollWidth, cw: bd.clientWidth };
    R.chk.noPageScroll = document.documentElement.scrollWidth <= window.innerWidth + 2 && bd.scrollWidth > bd.clientWidth + 50;
    R.chk.boardShown = b.on && b.view && host().classList.contains('is-board') && L.length === T.length && L.length >= 2
      && L.every(function (l, i) { return laneName(l) === text(q(':scope > .group-header .group-name', T[i])); });
    var r0 = L[0].getBoundingClientRect(), r1 = L[1].getBoundingClientRect();
    R.chk.lanesSideBySide = r1.left >= r0.right - 1 && Math.abs(r1.top - r0.top) < 2 && r0.width > 150;
    R.chk.laneCards = L.every(function (l, i) { return laneCards(l).length === grpLeafRows(T[i]); }) && cards().length === L.reduce(function (n, l) { return n + laneCards(l).length; }, 0);
    var c0 = laneCards(L[0]), a = c0[0].getBoundingClientRect(), bb = c0[1] ? c0[1].getBoundingClientRect() : null;
    R.chk.oneColumn = !!bb && bb.top >= a.bottom - 1 && Math.abs(bb.left - a.left) < 2;
    // (the picture) a lane's cards keep their height: none cut, the title and the fields inside the card
    await sleep(200);
    var whole = c0.slice(0, 8).map(function (c) { var t = q('.pnb-card-title', c), f = q('.pnb-card-fields', c), cr = c.getBoundingClientRect(), fr = f ? f.getBoundingClientRect() : null; return { cut: c.classList.contains('is-clipped'), h: Math.round(cr.height), inside: !!fr && fr.bottom <= cr.bottom + 1 && !!t && t.getBoundingClientRect().height > 8 }; });
    R.info.whole = whole.slice(0, 3);
    R.chk.cardsWhole = whole.length > 1 && whole.every(function (w) { return !w.cut && w.inside && w.h > 60; });
    R.chk.chipBoard = text(q('#sbCardsChip')) === 'Board' && !!opt('board') && opt('board').classList.contains('is-selected') && opt('board').getAttribute('aria-checked') === 'true';
    R.chk.boardByRow = !q('#sbCardsBoardRow').hidden && q('#pnbCardsBoardBy').value === 'H_GROUP' && b.by === 'H_GROUP';
    // the keys: down the lane, across to the next lane (the same place), back, up
    c0[0].focus(); keyOn(c0[0], 'ArrowDown'); await sleep(60); var k1 = document.activeElement === c0[1];
    keyOn(document.activeElement, 'ArrowRight'); await sleep(60); var c1 = laneCards(L[1]), k2 = c1.indexOf(document.activeElement) === Math.min(1, c1.length - 1);
    keyOn(document.activeElement, 'ArrowLeft'); await sleep(60); var k3 = document.activeElement === c0[Math.min(1, c0.length - 1)];
    keyOn(document.activeElement, 'ArrowUp'); await sleep(60); var k4 = document.activeElement === c0[0];
    R.info.keys = [k1, k2, k3, k4];
    R.chk.keysLanes = k1 && k2 && k3 && k4;
    // the details window: Next from a lane's last card is the next lane's first
    var last0 = c0[c0.length - 1], first1 = c1[0];
    C().openDetails(last0); await until(detOpen, 3000); await sleep(120);
    var dt0 = detTitle(); q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(250);
    R.info.det = { t0: dt0, now: detTitle(), want: text(q('.pnb-card-title', first1)) };
    R.chk.detailsAcross = dt0 === text(q('.pnb-card-title', last0)) && detTitle() === text(q('.pnb-card-title', first1));
    C().closeDetails(); await sleep(100);
    // a lane folds (a narrow strip, its group closed, no cards) and opens again
    q('.pnb-cards-grptoggle', lanes()[0]).click(); await until(function () { var l = lanes()[0]; return !!l && l.classList.contains('is-closed'); }, 3000); await sleep(150);
    var lc = lanes()[0], fold = lc.classList.contains('is-closed') && lc.getBoundingClientRect().width < 60 && !T[0].classList.contains('open') && laneCards(lc).length === 0;
    q('.pnb-cards-grptoggle', lc).click(); await until(function () { var l = lanes()[0]; return !!l && !l.classList.contains('is-closed'); }, 3000); await sleep(150);
    R.chk.laneFold = fold && laneCards(lanes()[0]).length === c0.length;
    // a lane's heading: the group's menu
    rclick(q('.pnb-cards-grptoggle', lanes()[0])); await sleep(100);
    var lm = menu(), la = acts(); R.info.laneActs = la;
    R.chk.laneMenu = !!lm && text(q('.pnb-hm-name', lm)) === laneName(lanes()[0]) && la.indexOf('gToggle') >= 0;
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
    // Board by another column: the lanes are its values, kept
    setSel('pnbCardsBoardBy', 'V_STATUS');
    await until(function () { return C().board().by === 'V_STATUS' && lanes().length === 3; }, 8000); await sleep(300);
    var st = lanes().map(laneName).sort();
    R.info.byPick = { b: C().board(), lanes: st };
    R.chk.boardByPick = C().board().by === 'V_STATUS' && C().board().kept === 'V_STATUS' && same(st, ['Closed', 'Open', 'Pending']) && C().board().made === null;
    // leaving: the grouping the board did not make stays (as bands)
    opt('cards').click(); await until(function () { return on() && !host().classList.contains('is-board'); }, 4000); await sleep(300);
    R.chk.leaveKeeps = grpOn() && !host().classList.contains('is-board') && qa('#pnbCardsHost .pnb-cards-grp').length > 0 && (prefs().lrfix || {}).view === 'cards';
    if (P.get('shot')) { var cp = q('#sbCardsPop'); if (cp) cp.style.setProperty('display', 'none', 'important'); opt('board').click(); await until(function () { return lanes().length > 0; }, 4000); window.scrollTo(0, 0); await sleep(300); }   // (the picture: the lanes)
  };
  S.cboard = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000); await sleep(150);
    R.info.guess = C().boardGuess();
    R.chk.guessPill = C().boardGuess() === 'H_GROUP';
    var flatN = cards().length;
    opt('board').click(); await until(function () { return lanes().length > 0; }, 8000); await sleep(300);
    var b = C().board(), p = prefs().lrfix || {};
    R.info.enter = { b: b, p: p, lanes: lanes().length, tops: topGroups().length };
    R.chk.enterGroups = grpOn() && b.on && b.by === 'H_GROUP' && b.made === 'H_GROUP' && b.kept === 'H_GROUP' && lanes().length === topGroups().length && p.view === 'board' && p.board === 'H_GROUP';
    opt('cards').click(); await until(function () { return !grpOn() && on() && !host().classList.contains('is-board') && cards().length > 0; }, 6000); await sleep(250);
    R.info.leave = { grp: grpOn(), n: cards().length, flatN: flatN, b: C().board() };
    R.chk.leaveUngroups = !grpOn() && cards().length === flatN && C().board().made === null && (prefs().lrfix || {}).view === 'cards';
    opt('board').click(); await until(function () { return lanes().length > 0; }, 8000); await sleep(250);
    R.chk.reenter = grpOn() && C().board().by === 'H_GROUP' && C().board().on;
    // ungrouped from elsewhere (the grouping's own Ungroup): back to Cards
    q('#removeGroupingLink').click(); await until(function () { return C().view() === 'cards'; }, 4000); await sleep(400);
    R.info.flip = { view: C().view(), grp: grpOn(), p: prefs().lrfix };
    R.chk.ungroupFlips = C().view() === 'cards' && !grpOn() && !host().classList.contains('is-board') && (prefs().lrfix || {}).view === 'cards';
  };
  S.cboardload = async function () {
    await until(function () { return on() && lanes().length > 0; }, 10000); await sleep(250);
    var b = C().board(); R.info.load = { b: b, lanes: lanes().map(laneName) };
    R.chk.loadGroups = grpOn() && b.on && b.by === 'H_GROUP' && b.made === 'H_GROUP' && lanes().length === topGroups().length && lanes().length >= 2;   // (the kept column, never the guess's V_STATUS)
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
