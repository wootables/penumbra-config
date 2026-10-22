// viewlink suite - page half (2026-10-21). "Copy a link to this view" (?id=&view=) on the REAL
// main.js, colmenu harness (saveconf fixture, 300 rows; shown V_ID V_NAME V_AMOUNT V_DATE V_LINK
// V_STATUS; hidden H_*; g* open grouped by H_GROUP, p* on a pivot). run.py compares a capture
// page's view with the page the link opens (the round trip) - this half reports what it sees.
//   vcapA   no link: a view made through the real controls (filter, sort, hide, freeze, width,
//           format), built into a link and copied
//   vcapB   that link opened: what shows, and the view captured again
//   gvA / pvA       grouped / pivot report captured;  vgrpB / vpivB  opened on a FLAT report
//   pflatB  vcapA's flat link opened on a PIVOT report
//   vwins   the viewer's own saved layout (seed.js) vs a link: the link wins, nothing saved changes
//   vwinsc  the same saved layout, no link (the control: it does apply)
//   vstale  a link naming columns the report no longer has
//   vbad    hostile values; vsql SQL-looking filter; vhuge / vbomb oversize; vnoid / vstate ignored
//   vprompt prompt answers ride as ?name= (reserved / forced / hidden do not)
//   vlimit  a view too big for a URL: the least visible parts left out, the URL fits
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, errors: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function V() { return window.PenumbraViewLink; }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function rclick(el) {
    var r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function menuItem(act) {
    var ps = document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub');
    for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; }
    return null;
  }
  async function choose(name, act) {
    var th = fth(name); if (!th) return false;
    if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close();
    rclick(th);
    var it = menuItem(act);
    if (!it || it.getAttribute('aria-disabled') === 'true') { if (window.Penumbra.colMenu) window.Penumbra.colMenu.close(); return false; }
    it.click(); await sleep(500); return true;
  }
  function shownNames() {
    return Array.prototype.filter.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (t) { return t.style.display !== 'none' && t.getAttribute('data-column') !== '#'; })
      .map(function (t) { return t.getAttribute('data-colname'); });
  }
  function rowsText(n) {
    var shown = shownNames(), out = [];
    var trs = document.querySelectorAll('#resultsTable tbody tr');
    for (var i = 0; i < trs.length && out.length < n; i++) {
      if (!trs[i].getClientRects().length) continue;
      var cells = [];
      shown.forEach(function (nm) {
        var th = fth(nm), id = th ? th.getAttribute('data-column') : null;
        var td = id !== null ? trs[i].querySelector('td[data-column="' + id + '"]') : null;
        cells.push(td ? td.textContent.trim() : '?');
      });
      out.push(cells.join(' | '));
    }
    return out;
  }
  function vis(sel) { var e = document.querySelector(sel); return !!(e && (e.offsetWidth || e.offsetHeight)); }
  function dom() {
    return { search: document.getElementById('tableSearch').value, shown: shownNames(), rows: rowsText(5),
      grouped: vis('#groupedResultsContainer'), pivot: vis('#pivot-output-container'), flat: vis('#resultsTable'),
      rpp: $('#rowsPerPageSelector').val() };
  }
  function bodyText() { return document.body.innerText || ''; }
  function capture() {
    var b = V().build();
    R.info.build = { error: b.error || null, len: b.url ? b.url.length : 0, included: b.included, dropped: b.dropped };
    return b;
  }
  async function noteShown() { return until(function () { return bodyText().indexOf('Opened a shared view') >= 0; }, 6000); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (/^g/.test(SCN) && !(await until(function () { return document.querySelectorAll('#groupedResultsContainer tbody tr td').length > 0; }, 20000))) throw new Error('no grouped view');
    await sleep(800);
  }
  function stubToasts() {
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function queryCalls() { return (window.__ajaxLog || []).filter(function (u) { return /query\.php/.test(u); }).length; }
  var ALLOWED = ['v', 'm', 's', 'o', 'r', 'c', 'g', 'p', 'fz', 'w', 'fm', 'hl', 'cs', 'sb', 'cso', 'pg', 'cc', 'th', 'dn'];

  async function main() {
    await boot();
    var u = new URLSearchParams(location.search);
    R.info.active = !!(V() && V().active());
    if (SCN === 'vcapA') {
      R.chk.api = !!V() && typeof V().build === 'function' && V().available() === true;
      function vcount() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (t) { return t.getClientRects().length; }).length + '/' + rowsText(3).join(';').slice(0, 60); }
      R.info.steps = ['start ' + vcount()];
      var ts = document.getElementById('tableSearch'); ts.focus(); ts.value = 'Alpha';
      $(ts).trigger('input').trigger($.Event('keydown', { key: 'Enter', keyCode: 13, which: 13 }));
      await sleep(1500);
      R.chk.filtered = rowsText(200).length > 0 && document.querySelectorAll('#resultsTable tbody tr.search-hidden').length > 0; R.info.steps.push('search ' + vcount());
      R.chk.sorted = await choose('V_AMOUNT', 'sortDesc'); R.info.steps.push('sort ' + vcount());
      R.chk.hidden = await choose('V_DATE', 'hide'); R.info.steps.push('hide ' + vcount());
      R.chk.frozen = await choose('V_NAME', 'freeze'); R.info.steps.push('freeze ' + vcount());
      try { window.Penumbra.colWidthsHost.setUser('V_NAME', 280); window.Penumbra.colWidths.apply(); R.chk.width = true; } catch (e) { R.chk.width = 'threw ' + e; }
      try { window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0'); R.chk.format = true; } catch (e) { R.chk.format = 'threw ' + e; }
      // what a refresh shows: the filter run over the layout as it is now
      $('#tableSearch').trigger('input'); await sleep(900);
      R.info.steps.push('end ' + vcount());
      var b = capture();
      R.info.token = b.token; R.info.view = b.token ? V().decode(b.token) : null; R.info.dom = dom();
      var v = R.info.view || {};
      R.chk.built = !!b.token && !b.error;
      R.chk.carries = v.s === 'Alpha' && /V_AMOUNT\|desc/.test(v.o || '') && v.fz >= 1 && !!(v.w && v.w.V_NAME) && !!(v.fm && v.fm.V_AMOUNT) && !!v.c && v.c.v.indexOf('V_DATE') < 0;
      R.chk.urlShape = !!b.url && b.url.indexOf(location.origin + location.pathname + '?id=lrfix') === 0 && /&view=[A-Za-z0-9_-]+$/.test(b.url)
        && !/[?&](state|noadm|console|rowlimit|search|sort)=/.test(b.url) && (new URL(b.url).pathname + new URL(b.url).search).length <= 2000;
      window.__clip = [];
      await V().copy(); await sleep(200);
      R.chk.copied = window.__clip.length === 1 && window.__clip[0] === b.url;
      await until(function () { return bodyText().indexOf('Link copied.') >= 0; }, 3000);
      var t = bodyText();
      R.info.toast = t.slice(t.indexOf('Link copied.'), t.indexOf('Link copied.') + 400);
      R.chk.toast = /Link copied\./.test(t) && /filter/.test(t) && /carries no data/.test(t) && !/—/.test(t);
      R.chk.noNoteWithoutLink = bodyText().indexOf('Opened a shared view') < 0 && !V().active();
    } else if (SCN === 'vcapB' || SCN === 'vgrpB' || SCN === 'vpivB' || SCN === 'pflatB') {
      if (SCN === 'vgrpB') await until(function () { return document.querySelectorAll('#groupedResultsContainer tbody tr td').length > 0; }, 20000);
      if (SCN === 'vpivB') await until(function () { return vis('#pivot-output-container') && document.querySelectorAll('#pivot-output-container td').length > 0; }, 20000);
      R.chk.note = await noteShown();
      await sleep(500);
      var b2 = capture();
      R.info.view = b2.token ? V().decode(b2.token) : null; R.info.dom = dom();
      R.chk.active = V().active();
      if (SCN === 'vcapB') R.info.fx = [113, 34].map(function (i) { var r = window.__rowsFixture[i]; return Object.keys(r).filter(function (k) { return /alpha/i.test(String(r[k])); }).join(','); });
      R.chk.oneQuery = queryCalls() === 1;
    } else if (SCN === 'gvA' || SCN === 'pvA') {
      if (SCN === 'pvA') await until(function () { return vis('#pivot-output-container') && document.querySelectorAll('#pivot-output-container td').length > 0; }, 20000);
      var b3 = capture();
      R.info.token = b3.token; R.info.view = b3.token ? V().decode(b3.token) : null; R.info.dom = dom();
      R.chk.built = !!b3.token;
      R.chk.mode = !!R.info.view && R.info.view.m === (SCN === 'gvA' ? 'group' : 'pivot');
    } else if (SCN === 'vwins' || SCN === 'vwinsc') {
      if (SCN === 'vwins') R.chk.note = await noteShown();
      R.info.dom = dom();
      if (SCN === 'vwinsc') {
        R.chk.seedApplies = JSON.stringify(shownNames()) === JSON.stringify(['V_ID', 'V_NAME', 'V_AMOUNT']);
      } else {
        R.chk.linkWins = JSON.stringify(shownNames()) === JSON.stringify(['V_ID', 'V_STATUS', 'H_CODE']);
        var cv = V().decode(V().build().token) || {};
        R.chk.linkFrozen = cv.fz === 1;
        R.chk.linkWidth = !!(cv.w && cv.w.V_STATUS === 250) && !(cv.w && cv.w.V_NAME);
        R.chk.untouchedOnLoad = localStorage.getItem('penumbra_column_prefs') === window.__SEEDED;
        // the viewer changes things on the page: they hold for the page, nothing saved moves
        var hid = await choose('V_STATUS', 'hide');
        var fr = true;
        try { window.Penumbra.colWidthsHost.setUser('V_ID', 222); window.Penumbra.colWidths.apply(); } catch (e) { }
        try { window.Penumbra.setColOpt('V_ID', 'format', 'text'); } catch (e) { }
        await sleep(600);
        R.info.after = { hid: hid, fr: fr, shown: shownNames() };
        R.chk.sessionHolds = hid && fr && JSON.stringify(shownNames()) === JSON.stringify(['V_ID', 'H_CODE']);
        R.chk.savedUntouched = localStorage.getItem('penumbra_column_prefs') === window.__SEEDED;
        R.info.savedNow = localStorage.getItem('penumbra_column_prefs');
      }
    } else if (SCN === 'vstale') {
      R.chk.note = await noteShown();
      var bt = bodyText();
      R.chk.staleListed = /Skipped, no longer in this report: .*GONE_A/.test(bt) && /OLD_B/.test(bt) && /GONE_C/.test(bt);
      R.chk.restApplied = JSON.stringify(shownNames()) === JSON.stringify(['V_ID', 'V_NAME']) && V().missing().length === 3;
      R.info.missing = V().missing(); R.info.dom = dom();
    } else if (SCN === 'vbad') {
      await sleep(2500);
      R.chk.noScript = window.__pwn === undefined && document.querySelectorAll('img[onerror]').length === 0;
      R.chk.noPollution = ({}).polluted === undefined;
      R.chk.searchLiteral = document.getElementById('tableSearch').value === u.get('expect_s');
      R.chk.noViewOptions = $('#viewOptionSearch').length === 1 && $('#viewOptionSearch').is(':checked') && $('#viewOptionExport').is(':checked');
      R.chk.staleNameAsText = bodyText().indexOf('<img src=x onerror="window.__pwn=2">') >= 0;
      R.chk.noAdminOverrides = window._penumbraUrlOverrides.rowlimit === null && window._penumbraUrlOverrides.download === null
        && window._penumbraUrlOverrides.theme === null && window._penumbraUrlOverrides.density === null;
      R.chk.queryUnchanged = queryCalls() === 1 && (window.__lastQueryText === undefined || /LR_FIXTURE/.test(window.__lastQueryText));
      R.chk.namesUnchanged = JSON.stringify(shownNames().slice(0, 1)) === JSON.stringify(['V_ID']);
      var dv = V() ? (V().decode(u.get('view')) || {}) : null;
      R.chk.unknownDropped = !!dv && Object.keys(dv).every(function (k) { return ALLOWED.indexOf(k) >= 0; }) && !dv.query && !dv.viewOptions;
      R.info.decoded = dv; R.info.dom = dom();
    } else if (SCN === 'vsql') {
      await sleep(1500);
      R.chk.searchAsText = document.getElementById('tableSearch').value === "V_NAME = 'x' OR 1=1 --";
      R.chk.oneQuery = queryCalls() === 1;
    } else if (SCN === 'vhuge' || SCN === 'vbomb' || SCN === 'vnoid' || SCN === 'vstate') {
      await sleep(1500);
      R.chk.ignored = !(V() && V().active()) && bodyText().indexOf('Opened a shared view') < 0;
      R.chk.defaultView = JSON.stringify(shownNames()) === JSON.stringify(['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS']);
    } else if (SCN === 'vprompt') {
      var P = V()._notePrompt;
      P({ name: 'pi_name' }, 'url', 'Anderson, James (1209)');
      P({ name: 'kinds' }, 'interactive', ['A,1', 'B;2']);
      P({ name: 'forced_one' }, 'forced', 'Limon');
      P({ name: 'secret', hidden: true }, 'interactive', 'x');
      P({ name: 'noadm' }, 'interactive', '1');
      P({ name: 'id' }, 'interactive', 'other');
      P({ name: 'view' }, 'interactive', 'zzz');
      var bp = capture(), qs = new URL(bp.url).searchParams;
      R.chk.promptRides = qs.get('pi_name') === 'Anderson, James (1209)';
      R.info.kinds = qs.get('kinds'); R.info.url = bp.url;
      R.chk.multiGrammar = qs.get('kinds') === 'A&#44;1,B&#59;2';
      R.chk.forcedHiddenSkipped = !qs.has('forced_one') && !qs.has('secret');
      R.chk.reservedSkipped = !qs.has('noadm') && qs.getAll('id').length === 1 && qs.get('id') === 'lrfix' && qs.getAll('view').length === 1;
      R.chk.includesPrompts = (bp.included || []).indexOf('prompt answers') >= 0;
    } else if (SCN === 'vccA') {
      R.chk.calcShown = shownNames().indexOf('DOUBLE') >= 0 && shownNames().indexOf('TRIPLE') >= 0;
      var bc = capture(), vc = bc.token ? (V().decode(bc.token) || {}) : {};
      R.info.token = bc.token; R.info.view = vc; R.info.dom = dom();
      var ccn = (vc.cc || []).map(function (x) { return x.name; });
      R.chk.carriesCalc = ccn.indexOf('DOUBLE') >= 0 && (bc.included || []).indexOf('calculated columns') >= 0;
      R.chk.reportNotRepeated = ccn.indexOf('TRIPLE') < 0;
      // the calc dialog's own "Copy link with this column", for a column not added yet
      window.__clip = [];
      window.PenumbraCalc.openDialog(null); await sleep(600);
      $('#pnbCalcName').val('HALF').trigger('input'); $('#pnbCalcFormula').val('{H_NUM} / 2').trigger('input'); await sleep(400);
      var lb = document.getElementById('pnbCalcLink'); if (lb) lb.click();
      await until(function () { return window.__clip.length > 0; }, 3000);
      var cl = window.__clip[window.__clip.length - 1] || '';
      var ct = (cl.match(/[?&]view=([A-Za-z0-9_-]+)/) || [])[1], cv = ct ? V().decode(ct) : null;
      R.info.halfToken = ct || null; R.info.calcLink = cl.slice(0, 160);
      R.chk.calcDialogViewLink = !!cv && !/[?&]calc=/.test(cl) && (cv.cc || []).some(function (x) { return x.name === 'HALF' && x.formula === '{H_NUM} / 2'; })
        && (cv.cc || []).some(function (x) { return x.name === 'DOUBLE'; }) && !!cv.c && cv.c.v.indexOf('HALF') >= 0;
      var cx = document.querySelector('#pnbCalcOverlay .pnb-calc-cancel'); if (cx) cx.click();
    } else if (SCN === 'vccB' || SCN === 'vcchB') {
      R.chk.note = await noteShown(); await sleep(500);
      var want = SCN === 'vccB' ? 'DOUBLE' : 'HALF', mul = SCN === 'vccB' ? 2 : 0.5;
      var def = (window.PenumbraCalc.active() || []).filter(function (d) { return d.name === want; })[0];
      R.chk.calcApplied = shownNames().indexOf(want) >= 0 && !!def && def.src === 'state';
      var th = fth(want), tr = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (t) { return t.getClientRects().length; })[0];
      var idTd = tr ? tr.querySelector('td[data-column="' + fth('V_ID').getAttribute('data-column') + '"]') : null;
      var row = idTd ? window.__rowsFixture.filter(function (r) { return r.V_ID === idTd.textContent.trim(); })[0] : null;
      var cell = (th && tr) ? tr.querySelector('td[data-column="' + th.getAttribute('data-column') + '"]') : null;
      var got = cell ? parseFloat(cell.textContent.replace(/[^0-9.\-]/g, '')) : NaN;
      R.info.calc = { want: want, got: got, hnum: row ? row.H_NUM : null };
      R.chk.calcValue = !!row && Math.abs(got - parseFloat(row.H_NUM) * mul) < 0.01;
      R.chk.calcNotSaved = localStorage.getItem('penumbra_calc_columns') === null;
      if (SCN === 'vccB') { var bcb = capture(); R.info.view = bcb.token ? V().decode(bcb.token) : null; R.info.dom = dom(); }
    } else if (SCN === 'vmail') {
      // the Email dialog's option and notice, through its own change handlers (the link view: T_MAIL)
      await noteShown(); await sleep(300);
      $('#emailLightbox').show();
      function wtext() { return ($('#emailWarnings').text() || '').replace(/\s+/g, ' '); }
      $('#emailIncludeLink').prop('checked', false).trigger('change'); await sleep(200);
      R.chk.rowShown = $('#emailViewLinkRow').length === 1 && $('#emailViewLinkRow').css('display') === 'block';
      R.chk.disabledUntilLink = $('#emailLinkAsView').prop('disabled') === true && $('#emailViewLinkRow label').hasClass('option-disabled');
      $('#emailIncludeLink').prop('checked', true).trigger('change'); await sleep(200);
      R.chk.enabledWithLink = $('#emailLinkAsView').prop('disabled') === false && !$('#emailViewLinkRow label').hasClass('option-disabled');
      R.chk.noListUnticked = wtext().indexOf('opens your view') < 0;
      $('#emailLinkAsView').prop('checked', true).trigger('change'); await sleep(300);
      var wt = wtext(); R.info.warn = wt;
      R.chk.listsCustomizations = wt.indexOf('The live-report link opens your view: filter "Alpha"; sorted by V_AMOUNT (descending); 3 of 20 columns shown; 1 frozen column; 25 rows per page, page 2.') >= 0;
      $('#emailIncludeLink').prop('checked', false).trigger('change'); await sleep(200);
      R.chk.disabledAgain = $('#emailLinkAsView').prop('disabled') === true && wtext().indexOf('opens your view') < 0;
    } else if (SCN === 'vthA') {
      // the theme and density the sender sees (set on the page as the Settings panel's apply does)
      PENUMBRA_THEME_IDS.forEach(function (t) { document.body.classList.remove(t); });
      document.body.setAttribute('data-theme', 'theme-dark-blue'); document.body.classList.add('theme-dark-blue');
      document.body.classList.remove('density-standard', 'density-easy-read'); document.body.classList.add('density-compact');
      var bt = capture(), vt = bt.token ? (V().decode(bt.token) || {}) : {};
      R.info.token = bt.token; R.info.view = vt;
      R.chk.carriesTheme = vt.th === 'theme-dark-blue' && vt.dn === 'compact' && (bt.included || []).indexOf('theme') >= 0 && (bt.included || []).indexOf('density') >= 0;
      var dl = V().describe(bt) || [];
      R.info.describe = dl;
      R.chk.describedTheme = dl.indexOf('theme Dark Blue') >= 0 && dl.indexOf('density compact') >= 0;
    } else if (SCN === 'vthB') {
      R.chk.note = await noteShown(); await sleep(400);
      var dt = document.body.getAttribute('data-theme') || '';
      R.info.body = { theme: dt, cls: document.body.className };
      R.chk.themeApplied = (dt === 'theme-dark-blue' || document.body.classList.contains('theme-dark-blue')) && document.body.classList.contains('density-compact');
      R.chk.prefsNotSaved = localStorage.getItem('penumbra_pref_theme') === null && localStorage.getItem('penumbra_pref_density') === null
        && localStorage.getItem('penumbra_user_theme') === null && localStorage.getItem('penumbra_user_density') === null;
      var btb = capture(); R.info.view = btb.token ? V().decode(btb.token) : null;
    } else if (SCN === 'vpgA') {
      // 300 rows at 25 a page, turned to page 3 through the pager's own buttons
      $('#rowsPerPageSelector').val('25').trigger('change'); await sleep(600);
      $('#nextPageBtn').trigger('click'); await sleep(300); $('#nextPageBtn').trigger('click'); await sleep(600);
      var bg = capture();
      R.info.token = bg.token; R.info.view = bg.token ? V().decode(bg.token) : null;
      R.info.dom = { page: $('#pageInfo').text(), rows: rowsText(3) };
      R.chk.turned = R.info.dom.page === 'Page 3 of 12';
      R.chk.carriesPage = !!R.info.view && R.info.view.pg === 3 && R.info.view.r === '25' && (bg.included || []).indexOf('page 3') >= 0;
    } else if (SCN === 'vpgB' || SCN === 'vpgstale') {
      R.chk.note = await noteShown(); await sleep(400);
      R.info.dom = { page: $('#pageInfo').text(), rows: rowsText(3) };
      if (SCN === 'vpgstale') R.chk.clamped = R.info.dom.page === 'Page 12 of 12' && /^ID-1276 /.test(R.info.dom.rows[0] || '');
    } else if (SCN === 'vlimit') {
      var junk = '', sd = 12345; for (var i = 0; i < 1900; i++) { sd = (sd * 1103515245 + 12345) & 0x7fffffff; junk += String.fromCharCode(48 + (sd >> 8) % 75); }
      $('#tableSearch').val(junk.replace(/[|,]/g, 'x'));
      var bl = capture();
      var L = bl.url ? (new URL(bl.url).pathname + new URL(bl.url).search).length : 99999;
      R.chk.fits = !!bl.url && L <= 2000;
      R.chk.droppedNamed = (bl.dropped || []).length > 0;
      R.info.len = L;
    }
  }
  main().then(function () { }, function (e) { R.errors.push('driver: ' + (e && e.stack || e)); }).then(function () {
    R.errors = R.errors.concat((window.__errors || []).filter(function (x) { return !/ResizeObserver/.test(x); }));
    window.__HCRESULT = R; window.__HCDONE = true;
  });
})();
