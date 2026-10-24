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
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded ' + JSON.stringify({ q: window.__queryDone, h: window.__HC_HIDES, ajax: (window.__ajaxLog || []).slice(-6), errs: (window.__errors || []).slice(-4), cerr: (window.__cerr || []).slice(-4), rej: (window.__rejections || []).slice(-4), cmp: !!document.getElementById('snapshotComparisonContainer'), bodyCls: document.body.className, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400) }));
    if (/^g/.test(SCN) && !(await until(function () { return document.querySelectorAll('#groupedResultsContainer tbody tr td').length > 0; }, 20000))) throw new Error('no grouped view');
    await sleep(800);
  }
  function stubToasts() {
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function queryCalls() { return (window.__ajaxLog || []).filter(function (u) { return /query\.php/.test(u); }).length; }
  var ALLOWED = ['v', 'm', 's', 'o', 'r', 'c', 'g', 'p', 'fz', 'w', 'fm', 'hl', 'cs', 'sb', 'cso', 'pg', 'cc', 'th', 'dn', 'tr', 'lc', 'f', 'fi'];

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
      if (SCN === 'vpivB') R.chk.defaultIsReports = !window._reportDefaultPivot;   // a flat report: no pivot of its own to restore
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
      R.chk.tagTextRefused = document.getElementById('tableSearch').value === '';
      R.chk.noViewOptions = $('#viewOptionSearch').length === 1 && $('#viewOptionSearch').is(':checked') && $('#viewOptionExport').is(':checked');
      R.chk.staleNameAsText = bodyText().indexOf('GONE_&amp;X') >= 0;
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
      // (round 7) Copy link: the view link, copied with nothing ticked and nothing sent
      window.__clip = []; var ajaxBefore = (window.__ajaxLog || []).length;
      var cpl = document.getElementById('emailCopyViewLink'); if (cpl) cpl.click();
      await until(function () { return window.__clip.length > 0; }, 3000);
      var cpu = window.__clip[0] || '', cpt = (cpu.match(/[?&]view=([A-Za-z0-9_-]+)/) || [])[1];
      R.info.copy = { url: cpu.slice(0, 120), s: cpt ? (V().decode(cpt) || {}).s : null, ajax: (window.__ajaxLog || []).slice(-8) };
      R.chk.copyWithoutSending = !!cpt && (V().decode(cpt) || {}).s === 'Alpha' && !$('#emailIncludeLink').is(':checked') && (window.__ajaxLog || []).length === ajaxBefore;
      R.chk.labelsReworded = /Include a link to the live report/.test($('#emailIncludeLink').parent().text()) && /^\s*As you see it now: filter, sort, columns, layout and display\s*$/.test($('#emailLinkAsView').parent().text());
      R.chk.rowShown = $('#emailViewLinkRow').length === 1 && $('#emailViewLinkRow').css('display') === 'block';
      R.chk.disabledUntilLink = $('#emailLinkAsView').prop('disabled') === true && $('#emailViewLinkRow label').hasClass('option-disabled')
        && $('#emailViewLinkRow label').attr('title') === 'Tick "Include a link to the live report" first';
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
    } else if (SCN === 'vshare' || SCN === 'vsharenoid') {
      // the console's Share button: a view link on a saved report, the ?state= link on unsaved work
      window.__clip = [];
      // keep the synthetic modifier-click from opening a tab: record it instead
      window.__opened = [];
      var _disp = HTMLAnchorElement.prototype.dispatchEvent;
      HTMLAnchorElement.prototype.dispatchEvent = function (ev) { if (ev && ev.type === 'click') { window.__opened.push(this.href); return false; } return _disp.call(this, ev); };
      if (SCN === 'vshare') { var ts2 = document.getElementById('tableSearch'); ts2.value = 'Alpha'; }
      $('#shareQuery').trigger('click');
      await until(function () { return window.__clip.length > 0; }, 4000); await sleep(400);
      HTMLAnchorElement.prototype.dispatchEvent = _disp;
      var su = window.__clip[window.__clip.length - 1] || '';
      R.info.share = su.slice(0, 160); R.info.opened = (window.__opened[0] || '').slice(0, 160);
      if (SCN === 'vshare') {
        var sv = (su.match(/[?&]view=([A-Za-z0-9_-]+)/) || [])[1];
        R.chk.shareIsViewLink = /[?&]id=lrfix/.test(su) && !!sv && !/[?&]state=/.test(su) && (V().decode(sv) || {}).s === 'Alpha';
        R.chk.shareOpened = window.__opened[0] === su;
        R.chk.shareToast = bodyText().indexOf('A link to this view: it opens this report with your filter') >= 0;
      } else {
        R.chk.shareKeepsState = /[?&]state=/.test(su) && !/[?&]view=/.test(su);
      }
    } else if (SCN === 'vscrA' || SCN === 'vscrB' || SCN === 'vfindA' || SCN === 'vfindB') {
      // (round 6) where the table is scrolled, and an open Find on its match
      var FH6 = window.Penumbra.findHost, wr6 = FH6 && FH6.wrapper();
      function headBottom() { var h = document.querySelector('#resultsTable thead'); return wr6.getBoundingClientRect().top + (h ? h.getBoundingClientRect().height : 0); }
      function stickyRight() { var r = wr6.getBoundingClientRect().left; Array.prototype.forEach.call(document.querySelectorAll('#tableHeader th'), function (th) { if (th.style.display !== 'none' && getComputedStyle(th).position === 'sticky' && getComputedStyle(th).left !== 'auto') r = Math.max(r, th.getBoundingClientRect().right); }); return r; }
      function idOf(tr) { var t = tr && tr.querySelector('td[data-column="' + fth('V_ID').getAttribute('data-column') + '"]'); return t ? t.textContent.trim() : null; }
      function where() {
        var top = headBottom(), row = null, col = null, edge = stickyRight();
        Array.prototype.some.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { if (tr.classList.contains('search-hidden') || tr.style.display === 'none') return false; if (tr.getBoundingClientRect().bottom > top + 1) { row = idOf(tr); return true; } return false; });
        Array.prototype.some.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (th) { if (th.style.display === 'none' || (getComputedStyle(th).position === 'sticky' && getComputedStyle(th).left !== 'auto') || th.getAttribute('data-colname') === '#') return false; if (th.getBoundingClientRect().right > edge + 2) { col = th.getAttribute('data-colname'); return true; } return false; });
        return { row: row, col: col, st: wr6.scrollTop, sl: wr6.scrollLeft };
      }
      function curCell() {
        var td = document.querySelector('#resultsTable td.pnb-find-cur'); if (!td) return null;
        var th = document.querySelector('#tableHeader th[data-column="' + td.getAttribute('data-column') + '"]'), b = wr6.getBoundingClientRect(), r = td.getBoundingClientRect();
        return { id: idOf(td.parentNode), col: th ? th.getAttribute('data-colname') : null, onScreen: r.bottom > headBottom() && r.top < b.bottom && r.right > b.left && r.left < b.right, text: td.textContent.trim().slice(0, 40) };
      }
      var FN6 = window.Penumbra.find;
      if (SCN === 'vscrA' || SCN === 'vfindA') {
        // wide columns, so the table scrolls sideways too
        ['V_NAME', 'V_AMOUNT', 'V_DATE'].forEach(function (c) { window.Penumbra.colWidthsHost.setUser(c, 600); });
        window.Penumbra.colWidths.apply(); await sleep(400);
        wr6.scrollTop = 1400; wr6.scrollLeft = 700; await sleep(400);
        R.info.where = where();
      }
      if (SCN === 'vfindA') {
        FN6.open('Alpha');
        await until(function () { var s6 = FN6._state(); return !s6.scanning && s6.cur >= 0; }, 8000);
        var inp6 = document.querySelector('.pnb-find-input');
        for (var k6 = 0; k6 < 3; k6++) { inp6.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await sleep(250); }
        R.info.fcur = FN6._state().cur; R.info.cell = curCell(); R.info.where = where();
        R.chk.findStepped = R.info.fcur >= 3 && !!R.info.cell;
      }
      if (SCN === 'vscrB' || SCN === 'vfindB') {
        R.chk.note = await noteShown();
        if (SCN === 'vfindB') await until(function () { return FN6.isOpen() && FN6._state().cur >= 0 && !!curCell(); }, 10000);
        await sleep(800);
        R.info.where = where();
        if (SCN === 'vfindB') { R.info.fcur = FN6._state().cur; R.info.cell = curCell(); R.chk.findOpen = FN6.isOpen() && document.querySelector('.pnb-find-input').value === 'Alpha'; R.chk.cellOnScreen = !!R.info.cell && R.info.cell.onScreen; }
      }
      var b6 = capture(); R.info.token = b6.token; R.info.view = b6.token ? V().decode(b6.token) : null;
      if (SCN === 'vscrA') { R.chk.carriesScroll = !!R.info.view && R.info.view.tr > 0 && R.info.view.lc === R.info.where.col && (b6.included || []).indexOf('scroll position') >= 0; }
      if (SCN === 'vfindA') {
        R.chk.carriesFind = !!R.info.view && R.info.view.f === 'Alpha' && R.info.view.fi === R.info.fcur && (b6.included || []).indexOf('Find') >= 0;
        R.chk.describedFind = (V().describe(b6) || []).indexOf('Find "Alpha" on match ' + (R.info.fcur + 1)) >= 0;
      }
    } else if (SCN === 'vbadpiv' || SCN === 'vbadpiv2' || SCN === 'vbadpiv3' || SCN === 'vbadpiv4' || SCN === 'vbadgrp' || SCN === 'vbadgrp2' || SCN === 'vbadgrp3') {
      // (sweep) a crafted pivot / grouping in a link: labels, field names, a formula, an aggregate - as text, never code
      await sleep(3500);
      var onAt = []; Array.prototype.forEach.call(document.querySelectorAll('#pivot-output-container *, #groupedResultsContainer *, #resultsTable *, #undo_text, #undo_text *, .zz-toast *'), function (e) { for (var i = 0; i < e.attributes.length; i++) if (/^on/i.test(e.attributes[i].name)) onAt.push(e.tagName + '.' + e.attributes[i].name); });
      R.info.onAttrs = onAt.slice(0, 8);
      R.chk.noScript = window.__pwn === undefined && onAt.length === 0;
      R.chk.pageAlive = vis('#resultsTable') || vis('#pivot-output-container') || vis('#groupedResultsContainer');
      R.info.dom = { pivot: vis('#pivot-output-container'), grouped: vis('#groupedResultsContainer'), flat: vis('#resultsTable'), pwn: window.__pwn };
      if (SCN === 'vbadpiv' || SCN === 'vbadpiv3') R.chk.pivotShown = vis('#pivot-output-container') && !!document.querySelector('#pivot-output-container td');
      if (SCN === 'vbadgrp' || SCN === 'vbadgrp3') R.chk.grouped = vis('#groupedResultsContainer');
    } else if (SCN === 'vfmsave') {
      // (sweep) the link's formats are this page's own, the report's stay the report's: an editor's save keeps them
      R.chk.note = await noteShown(); await sleep(500);
      var bf = capture(), vf = bf.token ? (V().decode(bf.token) || {}) : {};
      R.info.view = vf;
      R.chk.wysiwygFormats = JSON.stringify(vf.fm || {}) === JSON.stringify({ V_AMOUNT: 'number:1' });
      R.chk.csoRoundTrip = !!(vf.cso && vf.cso.V_STATUS && JSON.stringify(vf.cso.V_STATUS.values) === JSON.stringify(['Pending', 'Open', 'Closed']));
      window.__SAVE_ANSWER = function (b) { return { ok: true, json: { success: true, new_id: b.short_id, numeric_id: 7, is_new: false, updated_at: '2026-10-22 10:00:00.000000' } }; };
      var n9 = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n9; }, 8000); await sleep(300);
      var sd9 = null; try { sd9 = JSON.parse(window.__saves[window.__saves.length - 1].state_data); } catch (e) { }
      R.info.saved = sd9 ? { fm: sd9.columnFormats, cso: sd9.customSortOrders } : null;
      R.chk.savedReportFormats = !!sd9 && JSON.stringify(sd9.columnFormats || {}) === JSON.stringify({ V_AMOUNT: 'currency:0', V_DATE: 'date:YYYY' });
      R.chk.urlDropsView = !new URLSearchParams(location.search).has('view');
    } else if (SCN === 'vcmpF') {
      // (10-23) a filter during a comparison: typed, then a group hidden with its X - what the banner's link carries
      var snapRowsF = window.__rowsFixture.slice(0, 280).map(function (r, i) { var c = {}; for (var k in r) c[k] = r[k]; if (i % 25 === 0) c.V_STATUS = 'Archived'; return { rowData: c }; });
      window.__VL.runComparisonAndDisplayGrouped({ name: 'Baseline (server)', displayName: 'Baseline', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
        columnNames: window.__COLS.slice(), kind: 'server', serverId: '55', creator: 'harness', compressedData: window.__VL.compressString(JSON.stringify(snapRowsF)) }, ['V_ID']);
      R.chk.compared = await until(function () { return vis('#snapshotComparisonContainer') && document.querySelectorAll('#snapshotComparisonContainer tbody tr').length > 0; }, 25000);
      await sleep(600);
      function groups() { return Array.prototype.map.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper'), function (w) { return w.getAttribute('data-group-key') + ':' + (w.style.display === 'none' ? 'hidden' : 'shown'); }); }
      async function bannerLink() { window.__clip = []; $('#snapAnalysisDock .snap-banner-link').first().trigger('click'); await until(function () { return window.__clip.length > 0; }, 4000); return window.__clip[0] || ''; }
      function params(u) { try { var q = new URL(u).searchParams, o = {}; q.forEach(function (v, k) { if (k !== 'view') o[k] = v; }); var t = q.get('view'); if (t) { var dv = V().decode(t) || {}; o.view_s = dv.s; o.view_sx = dv.sx; } return o; } catch (e) { return { err: String(e) }; } }
      // 1. a typed filter, applied with Enter (the comparison re-runs through it)
      var h0 = window.__HC_HIDES || 0, ts = document.getElementById('tableSearch');
      ts.value = 'Alpha'; $(ts).trigger($.Event('keydown', { key: 'Enter', keyCode: 13, which: 13 }));
      await until(function () { return (window.__HC_HIDES || 0) > h0; }, 15000); await sleep(800);
      R.info.typed = { box: ts.value, groups: groups(), link: params(await bannerLink()) };
      // 2. the Unchanged group hidden with its X
      var h1 = window.__HC_HIDES || 0;
      var x = document.querySelector('#snapshotComparisonContainer .group-wrapper[data-group-key="Unchanged Rows"] .group-hide');
      if (x) x.click();
      await until(function () { return (window.__HC_HIDES || 0) > h1; }, 15000); await sleep(800);
      R.info.hidden = { box: ts.value, groups: groups(), link: params(await bannerLink()) };
      R.chk.typedCarried = R.info.typed.link.search === 'Alpha';
      R.chk.hiddenCarried = R.info.hidden.link.search === 'Alpha' && JSON.stringify(R.info.hidden.link.view_sx || []) === JSON.stringify(['Unchanged Rows']);
      var hl = await bannerLink(); try { var hu = new URL(hl); R.info.path = hu.pathname.replace(/^\//, '') + hu.search; } catch (e) { }
      // 3. the box cleared but not re-run: the diff on screen is still the filtered one, and so is the link
      ts.value = '';
      R.info.cleared = params(await bannerLink());
      R.chk.appliedFallback = R.info.cleared.search === 'Alpha';
    } else if (SCN === 'vcmpG') {
      // (10-23 d) how many times the comparison is drawn: the link's hidden groups must not cost a second diff
      window.__cmpDraws = 0;
      new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.id === 'snapshotComparisonContainer') window.__cmpDraws++; }); }); })
        .observe(document.getElementById('groupedResultsContainer'), { childList: true, subtree: true });
      var snapRowsG = window.__rowsFixture.slice(0, 280).map(function (r, i) { var c = {}; for (var k in r) c[k] = r[k]; if (i % 25 === 0) c.V_STATUS = 'Archived'; return { rowData: c }; });
      window.__VL.runComparisonAndDisplayGrouped({ name: 'Baseline (server)', displayName: 'Baseline', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
        columnNames: window.__COLS.slice(), kind: 'server', serverId: '55', creator: 'harness', compressedData: window.__VL.compressString(JSON.stringify(snapRowsG)) }, ['V_ID']);
      R.chk.compared = await until(function () { return vis('#snapshotComparisonContainer') && document.querySelectorAll('#snapshotComparisonContainer tbody tr').length > 0; }, 25000);
      R.chk.hiddenAgain = await until(function () {
        var w = document.querySelector('#snapshotComparisonContainer .group-wrapper[data-group-key="Unchanged Rows"]');
        return (!w || w.classList.contains('search-hidden') || !w.getClientRects().length) && /__SNAP_TYPE != 'Unchanged Rows'/.test(document.getElementById('tableSearch').value);
      }, 15000);
      R.info.box = document.getElementById('tableSearch').value;
      R.chk.filterKept = /^Alpha\b/.test(R.info.box);
      await sleep(2500);
      R.info.draws = window.__cmpDraws;
      R.chk.oneRun = window.__cmpDraws === 1;
    } else if (SCN === 'ggvA' || SCN === 'ggvB') {
      // (10-23) the List layout's open group and where its box is scrolled
      var GLs = function () { return (window.Penumbra.groupList && window.Penumbra.groupList.state()) || {}; };
      R.chk.listOn = await until(function () { return GLs().on && document.querySelectorAll('#groupedResultsContainer .group-wrapper.group-leaf').length >= 3; }, 20000);
      function topId(box) {
        var top = box.getBoundingClientRect().top + ((box.querySelector('thead') || { getBoundingClientRect: function () { return { height: 0 }; } }).getBoundingClientRect().height), id = null;
        Array.prototype.some.call(box.querySelectorAll('tbody tr'), function (tr) { if (!tr.getClientRects().length || tr.getBoundingClientRect().bottom <= top + 1) return false; var t = tr.querySelector('td[data-column="' + fth('V_ID').getAttribute('data-column') + '"]'); id = t ? t.textContent.trim() : null; return true; });
        return id;
      }
      if (SCN === 'ggvA') {
        var lw = document.querySelectorAll('#groupedResultsContainer .group-wrapper.group-leaf')[2];
        window.Penumbra.groupList.selectGroup(lw); await sleep(500);
        var bx = lw.querySelector(':scope > .group-content'); bx.scrollTop = 300; await sleep(400);
        R.info.sel = GLs().selPath; R.info.top = topId(bx);
        var bg = capture(); R.info.token = bg.token; R.info.view = bg.token ? V().decode(bg.token) : null;
        R.chk.carriesGroup = !!R.info.view && R.info.view.gp === R.info.sel && R.info.view.gr > 0 && (bg.included || []).indexOf('the open group') >= 0;
      } else {
        R.chk.note = await noteShown();
        await until(function () { return GLs().selPath != null && GLs().selPath !== '' ; }, 8000); await sleep(1200);
        R.info.sel = GLs().selPath;
        var w2 = null; Array.prototype.some.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper'), function (w) { if ((w.getAttribute('data-group-path') || w.getAttribute('data-group-key')) === R.info.sel) { w2 = w; return true; } return false; });
        R.info.top = w2 ? topId(w2.querySelector(':scope > .group-content')) : null;
      }
    } else if (SCN === 'ggcA' || SCN === 'ggcB') {
      // (10-23 b) a comparison drawn as a List (the live app's way): its open group and where it is scrolled
      var snapRowsL = window.__rowsFixture.slice(0, 280).map(function (r, i) { var c = {}; for (var k in r) c[k] = r[k]; if (i % 4 === 0) c.V_STATUS = 'Archived'; return { rowData: c }; });
      window.__VL.runComparisonAndDisplayGrouped({ name: 'Baseline (server)', displayName: 'Baseline', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
        columnNames: window.__COLS.slice(), kind: 'server', serverId: '55', creator: 'harness', compressedData: window.__VL.compressString(JSON.stringify(snapRowsL)) }, ['V_ID']);
      R.chk.compared = await until(function () { return vis('#snapshotComparisonContainer') && document.querySelectorAll('#snapshotComparisonContainer tbody tr').length > 0; }, 25000);
      var GLc = function () { return (window.Penumbra.groupList && window.Penumbra.groupList.state()) || {}; };
      R.chk.listOn = await until(function () { return !!GLc().on; }, 10000);
      function cTop(box) {
        var top = box.getBoundingClientRect().top + ((box.querySelector('thead') || { getBoundingClientRect: function () { return { height: 0 }; } }).getBoundingClientRect().height), id = null;
        Array.prototype.some.call(box.querySelectorAll('tbody tr'), function (tr) { if (!tr.getClientRects().length || tr.getBoundingClientRect().bottom <= top + 1) return false; var tds = tr.querySelectorAll('td'); id = Array.prototype.map.call(tds, function (t) { return t.textContent.trim(); }).filter(function (x) { return /^ID-\d+$/.test(x); })[0] || null; return true; });
        return id;
      }
      var mw = function () { return document.querySelector('#snapshotComparisonContainer .group-wrapper[data-group-key="Modified Rows"]'); };
      if (SCN === 'ggcA') {
        window.Penumbra.groupList.selectGroup(mw()); await sleep(500);
        var cb = mw().querySelector(':scope > .group-content'); cb.scrollTop = 250; await sleep(400);
        R.info.sel = GLc().selPath; R.info.top = cTop(cb);
        var bl = capture(); R.info.view = bl.token ? V().decode(bl.token) : null;
        if (bl.url) { var ul = new URL(bl.url); R.info.path = ul.pathname.replace(/^\//, '') + ul.search; }
        R.chk.carriesCmpGroup = !!R.info.view && R.info.view.m === 'keep' && R.info.view.gp === 'Modified Rows' && R.info.view.gr > 0;
      } else {
        await until(function () { return GLc().selPath === 'Modified Rows'; }, 10000); await sleep(1200);
        R.info.sel = GLc().selPath; R.info.top = mw() ? cTop(mw().querySelector(':scope > .group-content')) : null;
      }
    } else if (SCN === 'ggsA' || SCN === 'ggsB' || SCN === 'vcmpS' || SCN === 'vcmpT') {
      // (10-23 c) STACKED groups: which are open, where each open box and the page are scrolled
      var isCmp = SCN === 'vcmpS' || SCN === 'vcmpT';
      if (isCmp) {
        var snapRowsS = window.__rowsFixture.slice(0, 280).map(function (r, i) { var c = {}; for (var k in r) c[k] = r[k]; if (i % 4 === 0) c.V_STATUS = 'Archived'; return { rowData: c }; });
        window.__VL.runComparisonAndDisplayGrouped({ name: 'Baseline (server)', displayName: 'Baseline', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
          columnNames: window.__COLS.slice(), kind: 'server', serverId: '55', creator: 'harness', compressedData: window.__VL.compressString(JSON.stringify(snapRowsS)) }, ['V_ID']);
        R.chk.compared = await until(function () { return vis('#snapshotComparisonContainer') && document.querySelectorAll('#snapshotComparisonContainer tbody tr').length > 0; }, 25000);
        await sleep(600);
      }
      function wpath(w) { return w.getAttribute('data-group-path') || w.getAttribute('data-group-key') || ''; }
      function wraps() { return Array.prototype.filter.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper'), function (w) { return !!wpath(w) && !w.closest('.group-grand-total'); }); }
      function openSet() { return wraps().filter(function (w) { return w.classList.contains('open'); }).map(wpath).sort(); }
      function boxTop(w) {
        var box = w && w.querySelector(':scope > .group-content'); if (!box) return null;
        var th = box.querySelector('thead'), top = box.getBoundingClientRect().top + (th ? th.getBoundingClientRect().height : 0), id = null;
        Array.prototype.some.call(box.querySelectorAll('tbody tr'), function (tr) { if (!tr.getClientRects().length || tr.getBoundingClientRect().bottom <= top + 1) return false; var tds = tr.querySelectorAll('td'); id = Array.prototype.map.call(tds, function (t) { return t.textContent.trim(); }).filter(function (x) { return /^ID-\d+$/.test(x); })[0] || null; return true; });
        return id;
      }
      function topGroup() { var hit = null; wraps().some(function (w) { var h = w.querySelector(':scope > .group-header'); if (h && h.getClientRects().length && w.getBoundingClientRect().bottom > 1 && h.getBoundingClientRect().bottom > -1) { hit = wpath(w); return true; } return false; }); return hit; }
      var keep = isCmp ? ['Modified Rows'] : null;
      if (SCN === 'ggsA' || SCN === 'vcmpS') {
        var ws = wraps();
        R.chk.stacked = ws.length >= 3 && !(window.Penumbra.groupList && window.Penumbra.groupList.state().on);
        if (!keep) keep = [wpath(ws[1]), wpath(ws[3] || ws[2])];
        // open exactly `keep` with the bands' own clicks
        ws.forEach(function (w) { var want = keep.indexOf(wpath(w)) >= 0; if (w.classList.contains('open') !== want) { var h = w.querySelector(':scope > .group-header'); if (h) h.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } });
        await sleep(600);
        var tw = ws.filter(function (w) { return wpath(w) === keep[keep.length - 1]; })[0];
        var tb = tw && tw.querySelector(':scope > .group-content'); if (tb) tb.scrollTop = 200;
        if (!isCmp) { window.scrollTo(0, 0); window.scrollBy(0, Math.round(tw.getBoundingClientRect().top)); }
        await sleep(500);
        R.info.open = openSet(); R.info.top = boxTop(tw); R.info.page = topGroup(); R.info.keep = keep;
        var bs = capture(); R.info.view = bs.token ? V().decode(bs.token) : null; R.info.token = bs.token;
        if (bs.url) { var us = new URL(bs.url); R.info.path = us.pathname.replace(/^\//, '') + us.search; }
        var vs = R.info.view || {};
        R.chk.carriesOpen = JSON.stringify((vs.go || []).slice().sort()) === JSON.stringify(R.info.open) && !vs.ga && Array.isArray(vs.gb) && vs.gb.length === 1;
      } else {
        R.chk.note = await noteShown();
        if (!keep) keep = [];
        await sleep(1800);
        R.info.open = openSet();
        var tw2 = wraps().filter(function (w) { return R.info.open.length && wpath(w) === R.info.open[R.info.open.length - 1]; })[0];
        R.info.top = tw2 ? boxTop(tw2) : null; R.info.page = topGroup();
      }
    } else if (SCN === 'vcmpA' || SCN === 'vcmpB') {
      // (10-23) a snapshot comparison on screen: the link = the comparison's own + the view
      // a server snapshot (id 55): the fixture's first 280 rows, every 25th row's V_STATUS changed
      var snapRowsC = window.__rowsFixture.slice(0, 280).map(function (r, i) { var c = {}; for (var k in r) c[k] = r[k]; if (i % 25 === 0) c.V_STATUS = 'Archived'; return { rowData: c }; });
      window.__VL.runComparisonAndDisplayGrouped({ name: 'Baseline (server)', displayName: 'Baseline', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
        columnNames: window.__COLS.slice(), kind: 'server', serverId: '55', creator: 'harness', compressedData: window.__VL.compressString(JSON.stringify(snapRowsC)) }, ['V_ID']);
      R.info.vl = Object.keys(window.__VL || {});
      R.chk.compared = await until(function () { return vis('#snapshotComparisonContainer') && document.querySelectorAll('#snapshotComparisonContainer tbody tr').length > 0; }, 25000);
      await sleep(600);
      if (SCN === 'vcmpA') {
        try { window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0'); } catch (e) { }
        await sleep(400);
      }
      var bm = capture(), dm = bm.token ? (V().decode(bm.token) || {}) : null;
      R.info.url = bm.url || null; R.info.view = dm; R.info.err = bm.error || null;
      if (bm.url) { var um = new URL(bm.url); R.info.path = um.pathname.replace(/^\//, '') + um.search; }
      R.chk.cmpLink = !!bm.url && /[?&]snapcmp=55(&|$)/.test(bm.url) && /[?&]id=lrfix(&|$)/.test(bm.url) && /&view=[A-Za-z0-9_-]+$/.test(bm.url)
        && !!dm && dm.m === 'keep' && !dm.g && !dm.s && JSON.stringify(dm).indexOf('__SNAP_TYPE') < 0 && (bm.included || [])[0] === 'the comparison';
      R.chk.cmpCarriesView = !!dm && !!dm.fm && dm.fm.V_AMOUNT === 'currency:0';
      if (SCN === 'vcmpA') {
        R.info.describe = V().describe(bm);
        R.chk.cmpDescribed = (R.info.describe || [])[0] === 'the snapshot comparison (rows paired on V_ID)';
        window.__clip = [];
        $('#snapAnalysisDock .snap-banner-link').first().trigger('click');
        await until(function () { return window.__clip.length > 0; }, 4000);
        R.info.banner = (window.__clip[0] || '').slice(0, 200);
        R.chk.bannerCarriesView = !!window.__clip[0] && window.__clip[0] === bm.url;
      } else {
        R.chk.note = bodyText().indexOf('Opened a shared view') >= 0 || await noteShown();
        R.chk.noStale = V().active() && V().missing().length === 0;
      }
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
    } else if (SCN === 'vfitA' || SCN === 'vfitB') {
      // (2026-10-22) Fit to page through a link: the shares of the page ride it, and the screen that opens it
      // sizes each column as that share of its own box, with no sideways scroll
      var W7 = window.Penumbra.colWidths, H7 = window.Penumbra.colWidthsHost, wrap7 = document.getElementById('results-wrapper'), tbl7 = document.getElementById('resultsTable');
      R.info.inWrap = !!(tbl7 && tbl7.closest('#results-wrapper'));
      if (SCN === 'vfitA') {
        W7.fitPage(fth('V_NAME')); await sleep(400);
        var u7 = H7.state().user, sk7 = Object.keys(u7).filter(function (k) { return /%$/.test(String(u7[k])); });
        R.info.user = u7;
        R.chk.fitShares = sk7.length === shownNames().length && sk7.length >= 5;
        var b7 = capture(), v7 = b7.token ? (V().decode(b7.token) || {}) : {};
        R.info.token = b7.token; R.info.view = v7; R.info.dom = dom();
        var w7 = v7.w || {}, ks7 = Object.keys(w7);
        R.chk.carriesShares = ks7.length === sk7.length && ks7.length >= 5 && ks7.every(function (k) { return /%$/.test(String(w7[k])); })
          && Math.abs(ks7.reduce(function (a, k) { return a + parseFloat(w7[k]); }, 0) - 100) < 1 && (b7.included || []).indexOf('widths') >= 0;
      } else {
        R.chk.note = await noteShown();
        await sleep(600);
        var rep7 = H7.state().report || {}, rk7 = Object.keys(rep7).filter(function (k) { return /%$/.test(String(rep7[k])); });
        var room7 = W7.roomOf('flat'), off7 = [];
        rk7.forEach(function (k) {
          var th7 = fth(k), want7 = parseFloat(rep7[k]) / 100 * room7, got7 = th7 ? th7.getBoundingClientRect().width : -1;
          if (Math.abs(got7 - want7) > 2) off7.push(k + ' ' + Math.round(got7) + ' vs ' + Math.round(want7));
        });
        R.info.report = rep7; R.info.room = room7; R.info.off = off7; R.info.scroll = [wrap7.scrollWidth, wrap7.clientWidth];
        R.chk.sharesApplied = rk7.length >= 5 && off7.length === 0 && wrap7.scrollWidth <= wrap7.clientWidth + 1;
        var b7b = capture(); R.info.view = b7b.token ? V().decode(b7b.token) : null; R.info.dom = dom();
      }
    } else if (SCN === 'vjrn') {
      // (2026-10-22) a link naming the journal's columns: none listed as gone; the journal places them by the
      // link's order (Notes after V_ID, Done after V_AMOUNT) and keeps the one the sender had hidden hidden
      R.chk.note = await noteShown();
      await sleep(400);
      var miss8 = V().missing(), bt8 = bodyText(), at8 = bt8.indexOf('Opened a shared view');
      R.info.missing = miss8; R.info.noteText = at8 >= 0 ? bt8.slice(at8, at8 + 300) : '';
      R.chk.jrnNotMissing = miss8.every(function (n) { return String(n).toUpperCase().indexOf('__JOURNAL') !== 0; });
      R.chk.jrnNoSkipNote = R.chk.note === true && bt8.indexOf('no longer in this report') < 0;
      window._penumbraToggleState = window._penumbraToggleState || {};
      window._penumbraJournalKeyColumns = ['V_ID'];   // (the harness has no journal: a key column gives its rows cells)
      window.Penumbra.journalPaintFor([{ key: 'done', label: 'Done' }], true);
      await sleep(500);
      var heads8 = Array.prototype.map.call(document.querySelectorAll('#tableHeader > th'), function (t) { return t.getAttribute('data-column'); });
      var hn8 = document.querySelector('#tableHeader > th[data-column="__JOURNAL_NOTES"]'), ht8 = document.querySelector('#tableHeader > th[data-column="__JOURNAL_TOGGLE__done"]');
      var idOf8 = function (n) { var t = fth(n); return t ? t.getAttribute('data-column') : null; };
      var iId8 = heads8.indexOf(idOf8('V_ID')), iAmt8 = heads8.indexOf(idOf8('V_AMOUNT'));
      R.info.heads = heads8;
      R.chk.jrnPlaced = iId8 >= 0 && heads8[iId8 + 1] === '__JOURNAL_NOTES' && iAmt8 >= 0 && heads8[iAmt8 + 1] === '__JOURNAL_TOGGLE__done';
      var tr8 = document.querySelector('#resultsTable tbody tr'), cells8 = tr8 ? Array.prototype.map.call(tr8.children, function (c) { return c.getAttribute('data-column'); }) : [];
      var cId8 = cells8.indexOf(idOf8('V_ID')), cAmt8 = cells8.indexOf(idOf8('V_AMOUNT'));
      R.info.cells = cells8;
      R.chk.jrnCellsFollow = cId8 >= 0 && cells8[cId8 + 1] === '__JOURNAL_NOTES' && cAmt8 >= 0 && cells8[cAmt8 + 1] === '__JOURNAL_TOGGLE__done';
      var nCell8 = tr8 ? tr8.querySelector('[data-column="__JOURNAL_NOTES"]') : null;
      R.chk.jrnHidden = !!hn8 && hn8.style.display === 'none' && !!nCell8 && nCell8.style.display === 'none';
      R.chk.jrnShown = !!ht8 && ht8.style.display !== 'none';
      R.info.toggleW = ht8 ? Math.round(ht8.getBoundingClientRect().width) : null;
      R.chk.jrnWidth = !!ht8 && Math.abs(ht8.getBoundingClientRect().width - 90) <= 2;
    } else if (SCN === 'vlimit') {
      var junk = '', sd = 12345; for (var i = 0; i < 1900; i++) { sd = (sd * 1103515245 + 12345) & 0x7fffffff; var ch = 48 + (sd >> 8) % 75; junk += String.fromCharCode(ch === 60 ? 61 : ch); }   // (no '<': a tag-shaped text is refused)
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
