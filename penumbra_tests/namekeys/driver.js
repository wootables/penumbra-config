// Name-keyed map sweep driver (2026-09-18). One page load per ?suite=:
//   main    - in-page phases A (autocomplete cache), Q (query rows + column map
//             + totals), J (JSON import parse), I (import naming - SAFE rulings),
//             P (per-report pref maps: writers and readers), C (column prefs),
//             W (rows-per-page prefs)
//   landing - boot with poisoned prefs and no ?id= (early theme + landing density)
//   report  - boot a saved report (?id=plainrep) with poisoned prefs
// Every prototype name gets its own fixture: a hasOwnProperty throw fires first
// and hides whatever __proto__ did (see drill_other_protokeys_2026_09_17).
(function () {
  var R = [];
  var NAME_ERR = /hasOwnProperty is not a function|is not a function/;
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function own(o, k) { return o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k); }
  function clearErr() { window.__errors.length = 0; window.__rejections.length = 0; window.__consoleErrors.length = 0; }
  function errs() { return window.__errors.concat(window.__rejections, window.__consoleErrors); }
  function nameErrs() { return errs().filter(function (s) { return NAME_ERR.test(s); }); }
  // Pollution check + scrub after EVERY call that could write onto
  // Object.prototype: left standing, the next jQuery call dies in its own for-in.
  function scrub() {
    var got = [];
    for (var k in Object.prototype) {
      if (Object.prototype.hasOwnProperty.call(Object.prototype, k)) { got.push(k); try { delete Object.prototype[k]; } catch (e) {} }
    }
    return got;
  }
  function call(fn) {
    try { return { ok: true, v: fn() }; } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return 'LS_ERR'; } }
  function setLs(k, v) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  function lsObj(k) { try { var o = JSON.parse(localStorage.getItem(k) || 'null'); return o; } catch (e) { return 'PARSE_ERR'; } }
  function finish(fatal) {
    var out = document.getElementById('out');
    var payload = { results: R, pageErrors: window.__errors.slice(0, 8), hookErr: [window.__NK_ERR, window.__NK_ERR2, window.__SB_ERR, (window.__NK_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    out.textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};

  async function runQuery(rows) {
    clearErr();
    window.__queryResponse = { data: rows };
    var ed = window.__NK.getEditor();
    if (ed) ed.setValue('SELECT 1 FROM DUAL');
    var before = window.__ajaxLog.length;
    $('#executeQuery').trigger('click');
    var i;
    for (i = 0; i < 200; i++) {
      await sleep(25);
      if (window.__ajaxLog.length > before && (window.__rejections.length || !$('#loadingOverlay').is(':visible'))) break;
    }
    await sleep(400);
    var th = $('#tableHeader th').map(function () { return $(this).attr('data-colname') + '|' + $(this).attr('data-column'); }).get();
    return {
      th: th, rows: $('#resultsTable tbody tr').length, cni: window.__NK.getCni(),
      tfoot: $('#resultsTable tfoot').length, foot: $('#resultsTable tfoot').text().replace(/\s+/g, ' ').trim(),
      errs: errs(), overlay: $('#loadingOverlay').is(':visible')
    };
  }
  function brief(q) { return 'th=' + q.th.join(',') + ' rows=' + q.rows + ' tfoot=' + q.tfoot + ' overlay=' + q.overlay + ' errs=' + q.errs.slice(0, 2).join(' / '); }

  // ------------------------------------------------------------------------
  // A. search builder autocomplete cache (_acCache, search_builder.js). FIRST,
  // so the initial cache is still the one the declaration made.
  async function phaseA() {
    var api = window._penumbraSearchAPI;
    var realAC = api && api.getColumnAutocompleteValues;
    var calls = [];
    api.getColumnAutocompleteValues = function (c) { calls.push(String(c)); return realAC ? realAC.apply(this, arguments) : null; };
    // Reachability: a pivot's custom aggregate label reaches the builder's
    // column list verbatim (no SQL alias needed; header names are UPPERCASED).
    $('#pivot-output-container').show();
    window.__NK.setPivotSettings({ agg: ['sum'], aggLabels: ['hasOwnProperty'] });
    var av = call(function () { return window.__SB.avail(); });
    rec('A0 reach: a pivot custom aggregate label reaches the builder column list verbatim',
      av.ok && av.v.aggregate.indexOf('hasOwnProperty') !== -1, av.ok ? JSON.stringify(av.v.aggregate) : av.err);
    window.__NK.setPivotSettings(null);
    $('#pivot-output-container').hide();

    // Both names on the INITIAL cache (the declaration) and again after a clear
    // (clearAutocompleteCache re-creates it): with the .call read in place a
    // plain {} misbehaves only for __proto__, so each cache needs its own.
    calls.length = 0;
    var p1 = call(function () { return window.__SB.getAC('__proto__'); });
    var p2 = call(function () { return window.__SB.getAC('__proto__'); });
    var p3 = call(function () { return window.__SB.getAC('COLLEGE'); });
    rec('A1 cache (initial declaration): __proto__ is cached once and later lookups still work',
      p1.ok && p2.ok && p3.ok && calls.filter(function (c) { return c === '__proto__'; }).length === 1,
      'calls=' + JSON.stringify(calls) + ' ' + [p1, p2, p3].map(function (x) { return x.ok ? 'ok' : x.err; }).join(' / '));
    calls.length = 0;
    var a1 = call(function () { return window.__SB.getAC('hasOwnProperty'); });
    var a2 = call(function () { return window.__SB.getAC('COLLEGE'); });
    var a3 = call(function () { return window.__SB.getAC('hasOwnProperty'); });
    rec('A2 cache (initial declaration): hasOwnProperty, then another column, then hasOwnProperty from the cache',
      a1.ok && a2.ok && a3.ok && calls.filter(function (c) { return c === 'hasOwnProperty'; }).length === 1,
      'calls=' + JSON.stringify(calls) + ' ' + [a1, a2, a3].map(function (x) { return x.ok ? 'ok' : x.err; }).join(' / '));

    window.__SB.clearAC();
    calls.length = 0;
    var b1 = call(function () { return window.__SB.getAC('__proto__'); });
    var b2 = call(function () { return window.__SB.getAC('__proto__'); });
    var b3 = call(function () { return window.__SB.getAC('COLLEGE'); });
    rec('A3 cache (after clear): __proto__ is cached once and later lookups still work',
      b1.ok && b2.ok && b3.ok && calls.filter(function (c) { return c === '__proto__'; }).length === 1,
      'calls=' + JSON.stringify(calls) + ' ' + [b1, b2, b3].map(function (x) { return x.ok ? 'ok' : x.err; }).join(' / '));
    window.__SB.clearAC();
    calls.length = 0;
    var c1 = call(function () { return window.__SB.getAC('hasOwnProperty'); });
    var c2 = call(function () { return window.__SB.getAC('COLLEGE'); });
    rec('A4 cache (after clear): a column named hasOwnProperty, then another column',
      c1.ok && c2.ok, (c1.ok ? 'ok' : c1.err) + ' / ' + (c2.ok ? 'ok' : c2.err));
    window.__SB.clearAC();
    api.getColumnAutocompleteValues = realAC;
    rec('A5 Object.prototype untouched after phase A', scrub().length === 0, '');
  }

  // ------------------------------------------------------------------------
  // Q. query result rows -> column map -> totals footer
  async function phaseQ() {
    var q0 = await runQuery([{ COLLEGE: 'Engineering', AMOUNT: '1' }, { COLLEGE: 'Science', AMOUNT: '2' }]);
    var rs = call(function () { return window.__NK.resolveSummaries(); });
    rec('Q0 control: plain columns render with a totals footer',
      q0.rows === 2 && q0.tfoot === 1 && q0.errs.length === 0 && !q0.overlay,
      brief(q0) + ' summaries=' + (rs.ok ? JSON.stringify(rs.v) : rs.err) + ' props=' + JSON.stringify($('#resultsTable').data('columnProperties')));

    var q1 = await runQuery([{ hasOwnProperty: 'a', AMOUNT: '1' }, { hasOwnProperty: 'b', AMOUNT: '2' }]);
    rec('Q1 a column aliased hasOwnProperty: the result handler does not throw',
      nameErrsIn(q1.errs).length === 0 && !q1.overlay, brief(q1));
    rec('Q2 hasOwnProperty column: the table renders both columns and both rows',
      q1.rows === 2 && q1.th.indexOf('HASOWNPROPERTY|0') !== -1 && q1.th.indexOf('AMOUNT|1') !== -1, brief(q1));
    rec('Q3 hasOwnProperty column: the column map records it as an own key',
      own(q1.cni, 'hasOwnProperty') && q1.cni['hasOwnProperty'] === 0, q1.cni ? JSON.stringify(Object.keys(q1.cni)) : 'no map');
    rec('Q4 hasOwnProperty column: the totals footer is built', q1.tfoot === 1, brief(q1));

    // JSON.parse, like the real response: an object LITERAL {__proto__: 'a'}
    // would set the prototype instead of making a column. AMOUNT_B, not AMOUNT:
    // a column SHARED with the previous run keeps its old position (the re-query
    // carry-over), which would put __PROTO__ last on any build.
    var q2 = await runQuery(JSON.parse('[{"__proto__":"a","AMOUNT_B":"1"},{"__proto__":"b","AMOUNT_B":"2"}]'));
    rec('Q5 a column aliased __proto__: the column map records it (index 0)',
      own(q2.cni, '__proto__') && q2.cni['__proto__'] === 0, q2.cni ? JSON.stringify(Object.keys(q2.cni)) : 'no map');
    rec('Q6 __proto__ column: header and cells carry data-column 0, not [object Object]',
      q2.th.join(',') === '#|#,__PROTO__|0,AMOUNT_B|1'
        && $('#resultsTable tbody td[data-column="[object Object]"]').length === 0
        && $('#resultsTable tbody td[data-column="0"]').length === 2, brief(q2));
    rec('Q7 Object.prototype untouched after phase Q', scrub().length === 0, '');

    // The totals READ on its own, against the map shape the pre-fix writer made
    // (a plain object whose own hasOwnProperty key shadows the method).
    await runQuery([{ COLLEGE: 'Engineering', AMOUNT: '1' }, { COLLEGE: 'Science', AMOUNT: '2' }]);
    clearErr();
    $('#resultsTable').data('columnNameToOriginalIndex', { hasOwnProperty: 5, COLLEGE: 0, AMOUNT: 1 });
    var t = call(function () { return window.__NK.totals(); });
    rec('Q8 updateTotalRow reads a column map that holds a hasOwnProperty key',
      t.ok && $('#resultsTable tfoot').length === 1, t.ok ? 'ok' : t.err);
  }
  function nameErrsIn(list) { return list.filter(function (s) { return NAME_ERR.test(s); }); }

  // ------------------------------------------------------------------------
  // J. JSON import parse (parseJSONToObjects reads the RAW parsed row)
  async function phaseJ() {
    var j1 = call(function () { return window.__NK.parseJSON('[{"hasOwnProperty":"x","B":"y"}]'); });
    rec('J1 JSON import with a key named hasOwnProperty parses',
      j1.ok && own(j1.v[0], 'HASOWNPROPERTY') && j1.v[0].HASOWNPROPERTY === 'x' && j1.v[0].B === 'y', j1.ok ? JSON.stringify(j1.v) : j1.err);
    var j2 = call(function () { return window.__NK.parseJSON('[{"rowData":{"hasOwnProperty":"x","B":"y"}}]'); });
    rec('J2 snapshot-format JSON import with a hasOwnProperty column parses',
      j2.ok && own(j2.v[0], 'HASOWNPROPERTY'), j2.ok ? JSON.stringify(j2.v) : j2.err);
    var j3 = call(function () { return window.__NK.parseJSON('[{"__proto__":"p","B":"y"}]'); });
    rec('J3 JSON import with a key named __proto__ keeps it (uppercased)',
      j3.ok && own(j3.v[0], '__PROTO__') && j3.v[0].__PROTO__ === 'p', j3.ok ? JSON.stringify(j3.v) : j3.err);
    rec('J4 Object.prototype untouched after phase J', scrub().length === 0, '');
  }

  // ------------------------------------------------------------------------
  // I. import NAMING - ruled SAFE: every path uppercases + [A-Z0-9_]-sanitises.
  // These pass on the pre-fix build too; they guard the ruling.
  async function phaseI() {
    window.__queryResponse = { data: [{ A: '1' }] };
    var i1 = call(function () { return window.__NK.importFile([{ A: '1' }], 'hasOwnProperty.csv'); });
    await sleep(200);
    rec('I1 SAFE: a file named hasOwnProperty.csv registers as HASOWNPROPERTY',
      i1.ok && own(window._penumbraImportedData, 'HASOWNPROPERTY') && !own(window._penumbraImportedData, 'hasOwnProperty')
        && typeof window._penumbraImportedData.hasOwnProperty === 'function',
      (i1.ok ? 'ok' : i1.err) + ' keys=' + JSON.stringify(Object.keys(window._penumbraImportedData)));
    var i2 = call(function () { return window.__NK.importFile([{ A: '1' }], '__proto__.json'); });
    await sleep(200);
    rec('I2 SAFE: a file named __proto__.json registers as PROTO',
      i2.ok && own(window._penumbraImportedData, 'PROTO'), (i2.ok ? 'ok' : i2.err) + ' keys=' + JSON.stringify(Object.keys(window._penumbraImportedData)));
    var i3 = call(function () { return window.__NK.parseCSV('hasOwnProperty,__proto__,constructor\n1,2,3\n', ','); });
    rec('I3 SAFE: CSV headers are uppercased (no constructor_NaN, no dropped __proto__)',
      i3.ok && JSON.stringify(Object.keys(i3.v[0])) === '["HASOWNPROPERTY","__PROTO__","CONSTRUCTOR"]', i3.ok ? JSON.stringify(i3.v) : i3.err);
    var i4 = call(function () { return window.__NK.importFile(i3.v, 'plain.csv'); });
    await sleep(200);
    rec('I4 SAFE: importing those rows passes the # column check', i4.ok, i4.ok ? 'ok' : i4.err);
    rec('I5 Object.prototype untouched after phase I', scrub().length === 0, '');
  }

  // ------------------------------------------------------------------------
  // P. per-report pref maps, keyed by the report's NAME (local save name /
  // short id / a shared link's state name - all free text).
  async function selectTheme(v) { $('#spThemeSelector').val(v).trigger('change'); await sleep(60); }
  async function phaseP() {
    // --- theme: the WRITER leaves the poisoned key behind ------------------
    setLs('penumbra_pref_theme', null);
    window.__NK.setName('hasOwnProperty');
    await selectTheme('theme-dark');
    var stored = lsObj('penumbra_pref_theme');
    rec('P0 reach: a theme change on a report named hasOwnProperty stores that key',
      stored && own(stored, 'hasOwnProperty') && stored.hasOwnProperty === 'theme-dark', ls('penumbra_pref_theme'));

    // --- theme readers, on ANOTHER report, with the poisoned map in place ----
    setLs('penumbra_pref_theme', '{"hasOwnProperty":"theme-dark","plainrep":"theme-wolfpack"}');
    setLs('penumbra_user_theme', null);
    window.__NK.setName('plainrep');
    window.__NK.setReportTheme('theme-default');
    clearErr();
    var sp = call(function () { return window.__NK.openSP(); });
    rec('P1 settings panel (63247) shows plainrep\'s own theme pref', sp.ok && $('#spThemeSelector').val() === 'theme-wolfpack',
      (sp.ok ? 'ok' : sp.err) + ' val=' + $('#spThemeSelector').val());
    var dl = call(function () { return window.__NK.dataLookup('theme'); });
    rec('P2 penumbraDataLookup(theme) (65566) returns plainrep\'s theme', dl.ok && dl.v && dl.v.v === 'theme-wolfpack',
      dl.ok ? JSON.stringify(dl.v) : dl.err);
    var ib = call(function () { return window.__NK.infobox('data(theme)', [], []); });
    rec('P3 infobox data(theme) (54965) returns plainrep\'s theme', ib.ok && ib.v && ib.v.html === 'theme-wolfpack',
      ib.ok ? JSON.stringify(ib.v) : ib.err);

    // --- theme under __proto__: the pref must record at all ------------------
    setLs('penumbra_pref_theme', null);
    window.__NK.setName('__proto__');
    await selectTheme('theme-dark');
    var st2 = lsObj('penumbra_pref_theme');
    rec('P4 a theme change on a report named __proto__ is stored under that name',
      st2 && own(st2, '__proto__') && st2['__proto__'] === 'theme-dark', ls('penumbra_pref_theme'));
    var sp2 = call(function () { return window.__NK.openSP(); });
    rec('P5 and the settings panel reads it back', sp2.ok && $('#spThemeSelector').val() === 'theme-dark',
      (sp2.ok ? 'ok' : sp2.err) + ' val=' + $('#spThemeSelector').val());
    rec('P6 Object.prototype untouched after the theme cases', scrub().length === 0, '');

    // --- density -------------------------------------------------------------
    setLs('penumbra_pref_density', '{"hasOwnProperty":"compact","plainrep":"easy-read"}');
    window.__NK.setName('plainrep');
    var spd = call(function () { return window.__NK.openSP(); });
    rec('P7 settings panel (63256) shows plainrep\'s own density pref', spd.ok && $('#spDensitySelector').val() === 'easy-read',
      (spd.ok ? 'ok' : spd.err) + ' val=' + $('#spDensitySelector').val());
    setLs('penumbra_pref_density', null);
    window.__NK.setName('__proto__');
    $('#spDensitySelector').val('compact').trigger('change');
    await sleep(30);
    var sd = lsObj('penumbra_pref_density');
    rec('P8 a density change on a report named __proto__ is stored under that name',
      sd && own(sd, '__proto__') && sd['__proto__'] === 'compact', ls('penumbra_pref_density'));

    // --- resolver links ------------------------------------------------------
    setLs('penumbra_resolver_prefs', '{"hasOwnProperty":true,"plainrep":false}');
    window.__NK.setName('plainrep');
    var lr = call(function () { return window.__NK.loadResolver(); });
    rec('P9 loadResolverPref (64196) returns plainrep\'s own pref', lr.ok && lr.v === false, lr.ok ? String(lr.v) : lr.err);
    setLs('penumbra_resolver_prefs', null);
    window.__NK.setName('__proto__');
    var sr = call(function () { return window.__NK.saveResolver(); });
    var srv = lsObj('penumbra_resolver_prefs');
    rec('P10 the resolver pref of a report named __proto__ is stored under that name',
      sr.ok && srv && own(srv, '__proto__'), (sr.ok ? '' : sr.err + ' ') + ls('penumbra_resolver_prefs'));

    // --- row expand ----------------------------------------------------------
    setLs('penumbra_pref_rowExpand', '{"hasOwnProperty":true,"plainrep":false}');
    window.__NK.setName('plainrep');
    var ly = call(function () { return window.__NK.layout(); });
    rec('P11 applyLayoutPreferences (63062) applies plainrep\'s own row-expand pref',
      ly.ok && window.__NK.getRowExpand() === false, (ly.ok ? 'ok' : ly.err) + ' active=' + window.__NK.getRowExpand());
    setLs('penumbra_pref_rowExpand', null);
    window.__NK.setName('__proto__');
    $('#spRowExpandToggle').prop('checked', true).trigger('change');
    await sleep(30);
    var sx = lsObj('penumbra_pref_rowExpand');
    rec('P12 the row-expand pref of a report named __proto__ is stored under that name',
      sx && own(sx, '__proto__') && sx['__proto__'] === true, ls('penumbra_pref_rowExpand'));
    // --- the snippet action() triggers write the same two maps --------------
    setLs('penumbra_pref_theme', null);
    setLs('penumbra_pref_rowExpand', null);
    window.__NK.setName('__proto__');
    var $a = $('<a class="snippet-action" data-action-name="trigger" data-action-value="theme|theme-dark">t</a>').appendTo('#reportSnippetOutput');
    $a.trigger('click');
    await sleep(80);
    var st3 = lsObj('penumbra_pref_theme');
    rec('P14 action(trigger, theme) on a report named __proto__ stores the pref under that name (48776)',
      st3 && own(st3, '__proto__') && st3['__proto__'] === 'theme-dark', ls('penumbra_pref_theme'));
    var $b = $('<a class="snippet-action" data-action-name="trigger" data-action-value="rowexpand">r</a>').appendTo('#reportSnippetOutput');
    $b.trigger('click');
    await sleep(30);
    var sx2 = lsObj('penumbra_pref_rowExpand');
    rec('P15 action(trigger, rowexpand) on a report named __proto__ stores the pref under that name (48812)',
      sx2 && own(sx2, '__proto__') && typeof sx2['__proto__'] === 'boolean', ls('penumbra_pref_rowExpand'));
    $a.remove(); $b.remove();

    // --- the save dialog pre-selects the pref'd theme + density (70862/70868) --
    setLs('penumbra_pref_theme', '{"hasOwnProperty":"theme-dark","plainrep":"theme-wolfpack"}');
    setLs('penumbra_pref_density', '{"hasOwnProperty":"compact","plainrep":"easy-read"}');
    window.__NK.setName('plainrep');
    window.__NK.setReportTheme('theme-default');
    $('#serverSaveTheme').val('theme-default'); $('#serverSaveDensity').val('standard');
    var ed = window.__NK.getEditor();
    if (ed) ed.setValue('SELECT 1 FROM DUAL');
    clearErr();
    $('#saveQuery').trigger('click');
    await sleep(150);
    rec('P16 the save dialog pre-selects plainrep\'s own theme and density',
      $('#serverSaveTheme').val() === 'theme-wolfpack' && $('#serverSaveDensity').val() === 'easy-read',
      'theme=' + $('#serverSaveTheme').val() + ' density=' + $('#serverSaveDensity').val() + ' errs=' + errs().slice(0, 2).join(' / '));
    rec('P13 Object.prototype untouched after phase P', scrub().length === 0, '');
    window.__NK.setName(null);
  }

  // ------------------------------------------------------------------------
  // C. column prefs (penumbra_column_prefs) - entries are OBJECTS, so a report
  // named __proto__ reads Object.prototype as its entry and writes onto it.
  async function phaseC() {
    setLs('penumbra_column_prefs', null);
    window.__NK.setName('__proto__');
    var c1 = call(function () { return window.__NK.persistSummaries({ '1': 'avg' }, null); });
    var pol1 = scrub();
    rec('C1 column summaries on a report named __proto__ do not write onto Object.prototype',
      c1.ok && pol1.length === 0, (c1.ok ? '' : c1.err + ' ') + 'polluted=' + JSON.stringify(pol1));
    var cp = lsObj('penumbra_column_prefs');
    rec('C2 and are stored under that name', cp && own(cp, '__proto__') && cp['__proto__'] && cp['__proto__'].summaries && cp['__proto__'].summaries['1'] === 'avg',
      ls('penumbra_column_prefs'));
    var c3 = call(function () { return window.__NK.persistBadge(false); });
    var pol3 = scrub();
    rec('C3 the badge pref on a report named __proto__ does not write onto Object.prototype',
      c3.ok && pol3.length === 0, (c3.ok ? '' : c3.err + ' ') + 'polluted=' + JSON.stringify(pol3));
    var lc = call(function () { return window.__NK.loadColPrefs(); });
    rec('C4 loadColumnPrefs returns that report\'s own entry, not Object.prototype',
      lc.ok && lc.v && lc.v !== Object.prototype && lc.v.summaries && lc.v.summaries['1'] === 'avg', lc.ok ? JSON.stringify(lc.v) : lc.err);
    setLs('penumbra_column_prefs', null);
    window.__NK.setName('constructor');
    var c5 = call(function () { return window.__NK.persistSummaries({ '2': 'max' }, null); });
    var staticLeak = own(Object, 'summaries');
    try { delete Object.summaries; } catch (e) {}
    var cp5 = lsObj('penumbra_column_prefs');
    rec('C5 a report named constructor stores its own entry (no property on the Object constructor)',
      c5.ok && !staticLeak && cp5 && own(cp5, 'constructor') && cp5.constructor.summaries && cp5.constructor.summaries['2'] === 'max',
      (c5.ok ? '' : c5.err + ' ') + 'Object.summaries leaked=' + staticLeak + ' ' + ls('penumbra_column_prefs'));
    rec('C6 Object.prototype untouched after phase C', scrub().length === 0, '');
    window.__NK.setName(null);
  }

  // ------------------------------------------------------------------------
  // W. rows-per-page prefs (penumbra_report_preferences)
  async function phaseW() {
    setLs('penumbra_report_preferences', null);
    window.__NK.setName('__proto__');
    $('#rowsPerPageSelector').val('50').trigger('change');
    await sleep(30);
    var w = lsObj('penumbra_report_preferences');
    rec('W1 rows per page on a report named __proto__ is stored under that name',
      w && own(w, '__proto__') && w['__proto__'] === '50', ls('penumbra_report_preferences'));
    rec('W2 Object.prototype untouched after phase W', scrub().length === 0, '');
    window.__NK.setName(null);
  }

  // ------------------------------------------------------------------------
  async function mainSuite() {
    if (!window.__NK || !window.__SB) { finish('hooks missing: __NK=' + !!window.__NK + ' __SB=' + !!window.__SB + ' ' + (window.__NK_ERR || '') + ' ' + (window.__SB_ERR || '')); return; }
    await sleep(300);
    var phases = [['A', phaseA], ['Q', phaseQ], ['J', phaseJ], ['I', phaseI], ['P', phaseP], ['C', phaseC], ['W', phaseW]];
    for (var i = 0; i < phases.length; i++) {
      try { await phases[i][1](); }
      catch (e) { rec('phase ' + phases[i][0] + ' completed', false, String((e && e.stack) || e).slice(0, 400)); scrub(); }
    }
    finish();
  }

  async function landingSuite() {
    await sleep(600);
    rec('L1 landing: the early theme apply (91553) honours the __landing__ pref',
      document.body.getAttribute('data-theme') === 'theme-dark', 'data-theme=' + document.body.getAttribute('data-theme'));
    rec('L2 landing: the landing density (91590) honours the __landing__ pref',
      $('body').hasClass('density-compact'), 'class=' + document.body.className);
    finish();
  }

  async function reportSuite() {
    var i;
    for (i = 0; i < 80; i++) { await sleep(50); if (window.__ajaxLog.some(function (u) { return /query\.php/.test(u); }) && !$('#loadingOverlay').is(':visible')) break; }
    await sleep(400);
    var themes = (window.__themeTrail || []).join(' > ');
    rec('R1 report boot: the early theme apply (91553) honours plainrep\'s pref',
      (window.__themeTrail || [])[0] === 'theme-dark', 'trail=' + themes);
    rec('R2 report boot: the state loader (92015) applies plainrep\'s theme',
      document.body.getAttribute('data-theme') === 'theme-dark', 'data-theme=' + document.body.getAttribute('data-theme') + ' trail=' + themes);
    rec('R3 report boot: the state loader (92041) applies plainrep\'s density',
      $('body').hasClass('density-compact'), 'class=' + document.body.className);
    rec('R4 report boot: the report query actually runs',
      window.__ajaxLog.some(function (u) { return /query\.php/.test(u); }), 'ajax=' + JSON.stringify(window.__ajaxLog.slice(0, 6)));
    rec('R5 report boot: no "Error processing state" and no name TypeError',
      nameErrs().length === 0 && !errs().some(function (s) { return /Error processing state/.test(s); }), errs().slice(0, 3).join(' / '));
    rec('R6 report boot: applyLayoutPreferences (63062) applied plainrep\'s row-expand pref',
      window.__NK && window.__NK.getRowExpand() === false, 'active=' + (window.__NK && window.__NK.getRowExpand()));
    rec('R7 report boot: loadResolverPref (64196) applied plainrep\'s resolver-link pref',
      window.__NK && window.__NK.getResolver() === false, 'resolverLinksEnabled=' + (window.__NK && window.__NK.getResolver()));
    rec('R8 report boot: the report renders and the loading overlay clears',
      $('#resultsTable tbody tr').length === 1 && !$('#loadingOverlay').is(':visible'),
      'rows=' + $('#resultsTable tbody tr').length + ' overlay=' + $('#loadingOverlay').is(':visible'));
    finish();
  }

  var s = window.__SUITE;
  var p = (s === 'landing') ? landingSuite() : (s === 'report') ? reportSuite() : mainSuite();
  p.catch(function (e) { finish('driver threw: ' + String((e && e.stack) || e)); });
})();
