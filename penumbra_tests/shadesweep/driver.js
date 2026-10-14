// shadesweep suite - browser half (2026-10-10). The REAL main.js (ready closure
// unwrapped; window.__SF.ev evaluates inside it) on the sumnone fixture (ID, DEPT,
// NAME, AMOUNT currency, QTY, NOTE): the viewer shading chip (Settings panel),
// its menu, and the cells it shades.
//   theme   T  a data bar keeps the theme's text readable after a THEME switch
//   kbd     K  the chip by keyboard: Enter opens, a pick / Escape put focus back on the chip
//   adhoc   A  an unsaved query's shading is page-only (no '__landing__' record)
//   formula F  the chip stays on the column's own line when Custom Formula opens its box
//   aria    R  the current option of both menus says aria-checked (forced colors read it)
//   grouped G  shading paints and clears in the grouped view
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
    window.__SFRESULT = payload; window.__SFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) { } await sleep(25); }
    return false;
  }
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
  async function waitBoot() {
    await waitFor(function () { return window.__queryDone >= 1 && document.querySelectorAll('#resultsTable tbody tr').length === window.__LIVE.length; }, 30000);
    await sleep(400);
  }
  function openPanel() {
    document.getElementById('settingsPanel').style.cssText += ';transform:none;left:0;top:0;width:360px;visibility:visible;display:block';
    ev('populateSettingsColumns()');
  }
  function row(name) { return document.querySelector('#spColumnList .sp-col-item[data-colname="' + name + '"]'); }
  function chip(name) { return document.querySelector('.sp-col-shade[data-shade-col="' + name + '"]'); }
  function menu() { return document.querySelector('.sp-sumtype-menu'); }
  // the cells of COL in a table, found through its header
  function cellsOf(table, col) {
    var ths = table.querySelectorAll('thead th'), pos = -1;
    for (var i = 0; i < ths.length; i++) if (String(ths[i].getAttribute('data-colname') || '').toUpperCase() === col) { pos = i; break; }
    if (pos < 0) return [];
    return Array.prototype.map.call(table.tBodies[0].rows, function (r) { return r.cells[pos]; }).filter(Boolean);
  }
  // ---- colour maths -----------------------------------------------------------
  function parseColor(s) {
    var m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = /#([0-9a-f]{6})/i.exec(s);
    if (m) { var h = m[1]; return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }; }
    return null;
  }
  function lum(c) { function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b); }
  function ratio(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  // the bar's colour: the first colour in the cell's background-image gradient
  function barColor(td) { return parseColor(getComputedStyle(td).backgroundImage || ''); }

  // A theme switch the way the Settings panel makes one (its change handler, which
  // ends in _spThemeSwitchTail), not a bare applyTheme().
  async function switchTheme(id) {
    var sel = document.getElementById('spThemeSelector');
    if (!sel.querySelector('option[value="' + id + '"]')) { var o = document.createElement('option'); o.value = id; o.textContent = id; sel.appendChild(o); }
    $(sel).val(id).trigger('change');
    await sleep(500);
  }
  // T: a data bar's tint keeps the THEME's text readable - also after a theme switch
  async function scnTheme() {
    await waitBoot();
    window.Penumbra.setShade('AMOUNT', 'bar');
    await sleep(200);
    var cells = cellsOf(document.getElementById('resultsTable'), 'AMOUNT');
    var big = cells[cells.length - 1];
    var b0 = barColor(big), t0 = parseColor(getComputedStyle(big).color);
    var r0 = (b0 && t0) ? ratio(b0, t0) : 0;
    rec('T-light', !!b0 && r0 >= 4.5, 'bar=' + J(b0) + ' text=' + J(t0) + ' ratio=' + r0.toFixed(2));
    await shot('bar-light');
    window.PENUMBRA_THEMES['theme-dark-blue'] = { id: 'theme-dark-blue', label: 'Dark Blue', isDark: true, modern: true };   // as themes_config.php registers it
    await switchTheme('theme-dark-blue');
    var c2 = cellsOf(document.getElementById('resultsTable'), 'AMOUNT'), big2 = c2[c2.length - 1];
    var b1 = barColor(big2), t1 = parseColor(getComputedStyle(big2).color);
    var r1 = (b1 && t1) ? ratio(b1, t1) : 0;
    await shot('bar-dark');
    rec('T-dark', !!b1 && r1 >= 4.5, 'after the switch to dark-blue: bar=' + J(b1) + ' text=' + J(t1) + ' ratio=' + r1.toFixed(2));
    await switchTheme('theme-default');
    var c3 = cellsOf(document.getElementById('resultsTable'), 'AMOUNT'), big3 = c3[c3.length - 1];
    var b2 = barColor(big3), t2 = parseColor(getComputedStyle(big3).color);
    var r2 = (b2 && t2) ? ratio(b2, t2) : 0;
    rec('T-back', !!b2 && r2 >= 4.5, 'back to light: bar=' + J(b2) + ' text=' + J(t2) + ' ratio=' + r2.toFixed(2));
  }

  // K: keyboard
  async function scnKbd() {
    await waitBoot();
    openPanel(); await sleep(60);
    var c = chip('QTY');
    rec('K-chip', !!c, 'QTY chip=' + !!c);
    if (!c) return;
    c.focus();
    await act(['Enter']); await sleep(80);
    var first = document.querySelector('.pnb-shade-menu .pnb-shade-opt');
    rec('K-open', !!menu() && document.activeElement === first, 'menu=' + !!menu() + ' active=' + (document.activeElement && document.activeElement.className));
    await act(['ArrowDown', 'ArrowDown', 'Enter']); await sleep(150);
    var c2 = chip('QTY');
    rec('K-pick', !menu() && !!c2 && c2.getAttribute('data-shade') === 'bar' && document.activeElement === c2,
      'menu=' + !!menu() + ' QTY=' + (c2 && c2.getAttribute('data-shade')) + ' active=' + (document.activeElement && (document.activeElement.className || document.activeElement.tagName)));
    // Escape out of the menu puts focus back on the chip too
    if (c2) c2.focus();
    await act(['Enter']); await sleep(80);
    var opened = !!menu();
    await act(['Escape']); await sleep(80);
    rec('K-esc', opened && !menu() && document.activeElement === chip('QTY'), 'opened=' + opened + ' menu=' + !!menu() + ' active=' + (document.activeElement && (document.activeElement.className || document.activeElement.tagName)));
  }

  // A: an unsaved query keeps its shading for the page only
  async function scnAdhoc() {
    await waitBoot();
    ev('currentLoadedStateName = null');
    var before = localStorage.getItem('penumbra_column_prefs') || '{}';
    window.Penumbra.setShade('QTY', 'bar');
    await sleep(150);
    var after = JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}');
    var cells = cellsOf(document.getElementById('resultsTable'), 'QTY');
    var painted = cells.some(function (td) { return /gradient/.test(td.style.backgroundImage || ''); });
    rec('A-pageonly', !Object.prototype.hasOwnProperty.call(after, '__landing__') && window.Penumbra.shadeMap().QTY === 'bar' && painted,
      'prefs before=' + before + ' after=' + J(after) + ' map=' + J(window.Penumbra.shadeMap()) + ' painted=' + painted);
  }

  // F: the chip keeps its line when the formula box opens
  async function scnFormula() {
    await waitBoot();
    openPanel(); await sleep(60);
    var r = row('AMOUNT');
    var sum = r.querySelector('.sp-col-sumtype');
    click(sum); await sleep(40);
    var fx = document.querySelector('.sp-sumtype-menu .sp-sumtype-opt[data-type="formula"]');
    if (fx) click(fx);
    await sleep(80);
    r = row('AMOUNT');
    var box = r.querySelector('.sp-col-formula'), c = r.querySelector('.sp-col-shade'), nm = r.querySelector('.sp-col-name');
    var boxShown = !!box && box.style.display !== 'none';
    var cr = c ? c.getBoundingClientRect() : null, nr = nm.getBoundingClientRect(), br = box ? box.getBoundingClientRect() : null;
    var sameLine = !!cr && Math.abs((cr.top + cr.height / 2) - (nr.top + nr.height / 2)) < 3;
    rec('F-line', boxShown && sameLine && cr.bottom <= br.top + 1,
      'box shown=' + boxShown + ' chip mid=' + (cr && (cr.top + cr.height / 2).toFixed(1)) + ' name mid=' + (nr.top + nr.height / 2).toFixed(1) + ' box top=' + (br && br.top.toFixed(1)));
    await shot('formula-row');
  }

  // R: aria-checked on the current option of both menus
  async function scnAria() {
    await waitBoot();
    window.Penumbra.setShade('AMOUNT', 'bar');
    openPanel(); await sleep(60);
    click(chip('AMOUNT')); await sleep(60);
    var opts = Array.prototype.map.call(document.querySelectorAll('.pnb-shade-menu .pnb-shade-opt'), function (o) { return (o.getAttribute('data-shade') || 'none') + '=' + o.getAttribute('aria-checked'); });
    rec('R-shade', J(opts) === J(['none=false', 'scale=false', 'bar=true']), 'shade menu ' + opts.join(' '));
    ev('_spCloseSummaryMenu()');
    click(row('AMOUNT').querySelector('.sp-col-sumtype')); await sleep(60);
    var sopts = Array.prototype.filter.call(document.querySelectorAll('.sp-sumtype-menu .sp-sumtype-opt'), function (o) { return o.getAttribute('aria-checked') === 'true'; })
      .map(function (o) { return o.getAttribute('data-type'); });
    var unset = Array.prototype.filter.call(document.querySelectorAll('.sp-sumtype-menu .sp-sumtype-opt'), function (o) { return o.getAttribute('aria-checked') === null; }).length;
    rec('R-summary', J(sopts) === J(['sum']) && unset === 0, 'checked=' + J(sopts) + ' without aria-checked=' + unset);
    ev('_spCloseSummaryMenu()');
    // the shading menu's text in a DARK theme (its colour was the undefined --text-primary)
    window.PENUMBRA_THEMES['theme-dark-blue'] = { id: 'theme-dark-blue', label: 'Dark Blue', isDark: true, modern: true };
    var sel = document.getElementById('spThemeSelector');
    if (!sel.querySelector('option[value="theme-dark-blue"]')) { var op = document.createElement('option'); op.value = 'theme-dark-blue'; sel.appendChild(op); }
    $(sel).val('theme-dark-blue').trigger('change');
    await sleep(500);
    openPanel(); await sleep(60);
    click(chip('AMOUNT')); await sleep(60);
    var low = [];
    Array.prototype.forEach.call(document.querySelectorAll('.pnb-shade-menu .pnb-shade-opt:not(.is-current) .sp-sumtype-label, .pnb-shade-menu .pnb-shade-note'), function (el) {
      var fg = parseColor(getComputedStyle(el).color), bg = null;
      for (var nd = el; nd && nd.nodeType === 1; nd = nd.parentElement) { var c = parseColor(getComputedStyle(nd).backgroundColor); if (c && c.a > 0.5) { bg = c; break; } }
      var rr = (fg && bg) ? ratio(fg, bg) : 0;
      if (rr < 4.5) low.push(el.className + ' ' + rr.toFixed(2));
    });
    rec('R-dark', low.length === 0, low.length ? 'BELOW 4.5: ' + low.join(', ') : 'all shading menu text >= 4.5 on dark-blue');
    ev('_spCloseSummaryMenu()');
  }

  // G: grouped view paints and clears
  async function scnGrouped() {
    await waitFor(function () { return window.__queryDone >= 1 && document.querySelectorAll('#groupedResultsContainer table').length > 0; }, 30000);
    await sleep(500);
    window.Penumbra.setShade('AMOUNT', 'bar');
    await sleep(200);
    var tables = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer table'));
    var painted = 0, total = 0;
    tables.forEach(function (t) { cellsOf(t, 'AMOUNT').forEach(function (td) { total++; if (/gradient/.test(td.style.backgroundImage || '')) painted++; }); });
    rec('G-paint', total > 0 && painted === total, painted + '/' + total + ' AMOUNT cells with a bar in ' + tables.length + ' group tables');
    window.Penumbra.setShade('AMOUNT', '');
    await sleep(200);
    var left = 0;
    tables = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer table'));
    tables.forEach(function (t) { cellsOf(t, 'AMOUNT').forEach(function (td) { if (td.style.backgroundImage) left++; }); });
    rec('G-clear', left === 0, left + ' AMOUNT cells still carry a bar after None');
  }

  async function scnDiag() {
    await waitBoot();
    window.Penumbra.setShade('AMOUNT', 'bar');
    await sleep(200);
    window.PENUMBRA_THEMES['theme-dark-blue'] = { id: 'theme-dark-blue', label: 'Dark Blue', isDark: true, modern: true };   // as themes_config.php registers it
    ev("applyTheme('theme-dark-blue')");
    await sleep(400);
    var t = document.getElementById('resultsTable');
    var a = cellsOf(t, 'AMOUNT'), nm = cellsOf(t, 'NAME');
    var td = a[a.length - 1], tn = nm[nm.length - 1];
    info('body=' + document.body.className + ' data-theme=' + document.body.getAttribute('data-theme'));
    info('AMOUNT inline style=' + td.getAttribute('style'));
    info('AMOUNT computed color=' + getComputedStyle(td).color + ' bg=' + getComputedStyle(td).backgroundColor);
    info('NAME computed color=' + getComputedStyle(tn).color + ' bg=' + getComputedStyle(tn).backgroundColor + ' inline=' + tn.getAttribute('style'));
    info('tr bg=' + getComputedStyle(td.parentNode).backgroundColor + ' table bg=' + getComputedStyle(t).backgroundColor);
    rec('D', true, '');
  }
  var SCN = { diag: scnDiag, theme: scnTheme, kbd: scnKbd, adhoc: scnAdhoc, formula: scnFormula, aria: scnAria, grouped: scnGrouped };
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
