// calccol suite - engine half (2026-10-10). js/penumbra_calc.js ALONE in a page
// (engine.html?id=zzcalc&calc=...): the parser, the values, the formats, the &calc=
// value, applyRows, stripFromState, the store, and the source (no eval / Function).
(function () {
  var R = { chk: {}, info: {}, errors: [] };
  window.addEventListener('error', function (e) { R.errors.push(String(e.message)); });
  var C = window.PenumbraCalc;
  function run(formula, row, fmt) {
    var c = C.compile(formula);
    if (!c.ok) return 'ERR:' + c.error;
    return C.evaluate(c.ast, function (n) { return row ? row[n] : undefined; }, fmt || 'number');
  }
  function err(formula) { var c = C.compile(formula); return c.ok ? '' : c.error; }
  function eq(name, got, want) { R.chk[name] = got === want; if (got !== want) R.info[name] = { got: got, want: want }; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  (async function () {
    try {
      if (!C) throw new Error('PenumbraCalc missing');
      // --- arithmetic -------------------------------------------------------------
      eq('add', run('{A} + {B}', { A: '1', B: '2' }), '3');
      eq('accounting', run('{A} - {B}', { A: '$1,234.50', B: '(500)' }), '1734.5');
      eq('pctIn', run('{A} * 2', { A: '12%' }), '24');
      eq('divZero', run('{A} / {B}', { A: '5', B: '0' }), '');
      eq('textIsBlank', run('{A} * 2', { A: 'abc' }), '');
      eq('blankIsBlank', run('{A} * 2', { A: '' }), '');
      eq('missingIsBlank', run('{A} + 1', {}), '');
      eq('leadPartial', run('{A} + 1', { A: '2014-0685' }), '');
      eq('precedence', run('1 + 2 * 3'), '7');
      eq('parens', run('(1 + 2) * 3'), '9');
      eq('unary', run('-{A} + 1', { A: '5' }), '-4');
      eq('doubleNeg', run('2 - -1'), '3');
      eq('leftAssoc', run('10 - 4 - 3'), '3');
      eq('divAssoc', run('100 / 10 / 2'), '5');
      eq('caseCols', run('{a} + {B}', { A: '1', B: '1' }), '2');
      eq('floatNoise', run('0.1 + 0.2'), '0.3');
      // --- ROUND ------------------------------------------------------------------
      eq('round2', run('ROUND(1.005, 2)'), '1.01');
      eq('roundNeg', run('ROUND(-2.5)'), '-3');
      eq('roundTens', run('ROUND(1234, -2)'), '1200');
      eq('roundBlank', run('ROUND({A})', { A: '' }), '');
      eq('roundCase', run('round({A} / 3, 1)', { A: '10' }), '3.3');
      // --- IF / comparisons -------------------------------------------------------
      eq('ifText', run('IF({S} = "open", "Y", "N")', { S: 'Open' }), 'Y');
      eq('ifTextNo', run('IF({S} = "open", "Y", "N")', { S: 'Closed' }), 'N');
      eq('numCompare', run('IF({A} > 9, 1, 0)', { A: '10' }), '1');
      eq('moneyCompare', run('IF({A} >= {B}, "ok", "short")', { A: '$1,000.00', B: '999.99' }), 'ok');
      eq('ifLazy', run('IF(1, 7, 1 / 0)'), '7');
      eq('ifBlank', run('IF({A}, "has", "none")', { A: '' }), 'none');
      eq('ifZero', run('IF({A}, "has", "none")', { A: '0' }), 'none');
      eq('ifNested', run('IF({A} < 0, "neg", IF({A} = 0, "zero", "pos"))', { A: '0' }), 'zero');
      eq('bareCompare', run('{A} <> {B}', { A: 'x', B: 'X' }), 'FALSE');
      eq('bangEq', run('{A} != 2', { A: '3' }), 'TRUE');
      eq('blankEqEmpty', run('IF({A} = "", "blank", "x")', { A: '' }), 'blank');
      eq('ifColValue', run('IF({A} > 0, {A}, 0)', { A: '5' }), '5');
      // --- formats ----------------------------------------------------------------
      eq('fmtCurrency', run('{A} * 1', { A: '1234.5' }, 'currency'), '$1,234.50');
      eq('fmtCurrencyNeg', run('0 - 12', null, 'currency'), '-$12.00');
      eq('fmtCurrencyNegZero', run('0 - 0.001', null, 'currency'), '$0.00');
      eq('fmtPercent', run('1 / 8', null, 'percent'), '12.5%');
      eq('fmtNumber', run('1 / 3'), '0.333333');
      eq('fmtBig', run('1000000 * 1000'), '1000000000');
      eq('fmtTextKeeps', run('IF(1, "Over", "Under")', null, 'currency'), 'Over');
      eq('fmtTextNumber', run('{A} * 1', { A: '1234.5' }, 'text'), '1234.5');
      // --- refusals ---------------------------------------------------------------
      R.chk.errMissingOp = /Missing an operator before \{B\}/.test(err('{A} {B}')) && /%2B/.test(err('{A} {B}'));
      R.chk.errBrace = /closing \}/.test(err('{A + 1'));
      R.chk.errEmptyBrace = /Empty braces/.test(err('{} + 1'));
      R.chk.errUnknownFn = /Unknown function FOO/.test(err('FOO(1)'));
      R.chk.errRoundArgs = /ROUND takes/.test(err('ROUND()')) && /ROUND takes/.test(err('ROUND(1,2,3)'));
      R.chk.errIfArgs = /IF takes three/.test(err('IF(1, 2)'));
      R.chk.errBareName = /braces: \{AMOUNT\}/.test(err('AMOUNT * 2'));
      R.chk.errAtAt = /@@/.test(err('IF(1, "@@HTML<b>x</b>", "")'));
      R.chk.errEmpty = !!err('') && !!err('   ');
      R.chk.errLong = /at most 500/.test(err('1+' + new Array(300).join('1+') + '1'));
      R.chk.errEndsSoon = /ends too soon/.test(err('1 +'));
      R.chk.errStrayChar = /"\^" is not part/.test(err('{A} ^ 2'));
      R.chk.errQuote = /closing "/.test(err('IF(1, "a, "b")') + err('"abc'));
      R.chk.refs = JSON.stringify(C.compile('{a} + IF({B} > 0, {C}, {A})').refs.slice().sort()) === '["A","B","C"]';
      // --- text & dates (2026-10-10, calcfn) -------------------------------------
      eq('catNames', run('{F} & " " & {L}', { F: 'Ada', L: 'Lovelace' }), 'Ada Lovelace');
      eq('catBlank', run('{F} & "-" & {L}', { F: 'Ada', L: '' }), 'Ada-');
      eq('catNumber', run('"FY" & {Y} + 1', { Y: '2025' }), 'FY2026');      // + binds tighter than &
      eq('catDate', run('"Due " & TODAY() - TODAY() & " days"'), 'Due 0 days');
      eq('catCompare', run('IF({F} & {L} = "AB", "y", "n")', { F: 'a', L: 'b' }), 'y');
      eq('dIso', run('DAYS({E}, {S})', { E: '2026-10-09', S: '2026-10-01' }), '8');
      eq('dUs', run('DAYS({E}, {S})', { E: '10/9/2026', S: '9/30/2026' }), '9');
      eq('dOracle', run('DAYS({E}, {S})', { E: '09-OCT-26', S: '01-SEP-26' }), '38');
      eq('dLong', run('DAYS({E}, {S})', { E: 'October 9, 2026', S: 'Jan 1, 2026' }), '281');
      eq('dTime', run('DAYS({E}, {S})', { E: '2026-10-09 14:30', S: '10/8/2026 23:59' }), '1');
      eq('dLeap', run('DAYS({E}, {S})', { E: '2024-03-01', S: '2024-02-28' }), '2');
      eq('dBadDay', run('DAYS({E}, {S})', { E: '2026-02-31', S: '2026-02-01' }), '');
      eq('dText', run('DAYS({E}, {S})', { E: 'soon', S: '2026-02-01' }), '');
      eq('dMinus', run('{E} - {S}', { E: '2026-10-09', S: '2026-10-01' }), '8');
      eq('dPlus', run('{S} + 30', { S: '2026-10-01' }), '2026-10-31');
      eq('dPlusFirst', run('30 + {S}', { S: '12/15/2026' }), '2027-01-14');
      eq('dMinusN', run('{S} - 1', { S: '2026-03-01' }), '2026-02-28');
      eq('dCompare', run('IF({E} < {S}, "before", "after")', { E: '9/30/2026', S: '2026-10-01' }), 'before');   // string order says otherwise
      eq('dNumNotDate', run('{N} + 1', { N: '20261009' }), '20261010');
      var now = new Date(), tIso = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
      eq('dToday', run('TODAY()'), tIso);
      eq('dSince', run('DAYS(TODAY(), {S})', { S: tIso }), '0');
      eq('dTodayCurrencyFmt', run('TODAY()', null, 'currency'), tIso);
      R.chk.errDaysArgs = /DAYS takes two dates/.test(err('DAYS({A})'));
      R.chk.errTodayArgs = /TODAY takes nothing/.test(err('TODAY(1)'));
      R.chk.errUnknownLists = /ROUND, IF, DAYS and TODAY/.test(err('NOW()'));
      R.chk.errAmpLink = /%26/.test(err('{A} {B}'));
      // --- the &calc= value ---------------------------------------------------------
      function pu(v) { var d = C.parseUrlValue(v); return d ? d.name + '/' + d.formula + '/' + d.format : null; }
      eq('urlFull', pu('Remaining|{A}-{B}|currency'), 'REMAINING/{A}-{B}/currency');
      eq('urlNoFmt', pu('R|{A}'), 'R/{A}/number');
      eq('urlSpaceName', pu('net amount|{A}'), 'NET_AMOUNT/{A}/number');
      eq('urlNoFormula', pu('R'), null);
      eq('urlBadName', pu('1R|{A}'), null);
      eq('urlPipeInText', pu('R|IF({A}>0,"a|b","c")'), 'R/IF({A}>0,"a|b","c")/number');
      eq('urlRoundTrip', pu(C.urlValue({ name: 'R', formula: '{A}*2', format: 'percent' })), 'R/{A}*2/percent');
      // --- applyRows ----------------------------------------------------------------
      C.fromState([{ name: 'S', formula: '{A} + {B}' }, { name: 'S2', formula: '{S} * 10', format: 'currency' },
                   { name: 'A', formula: '99' }, { name: 'MISS', formula: '{NOPE} + 1' }, { name: 'X', formula: '{A} {B}' }]);
      var rows = [{ A: '1', B: '2' }, { A: 'x', B: '2' }];
      var out = C.applyRows(rows);
      eq('applyCopies', out !== rows && !('S' in rows[0]) && out.length === 2, true);
      rows = out;
      eq('applyValue', rows[0].S, '3');
      eq('applyBlank', rows[1].S, '');
      eq('applyChain', rows[0].S2, '$30.00');
      eq('applyAtEnd', JSON.stringify(Object.keys(rows[0])), '["A","B","S","S2","URLCOL"]');   // (URLCOL: the page's &calc=)
      eq('applySkipsClash', rows[0].A, '1');
      R.chk.applySkipsBad = !('MISS' in rows[0]) && !('X' in rows[0]);
      await sleep(1100);
      R.chk.applyNotices = window.__toasts.some(function (t) { return /MISS/.test(t) && /\{NOPE\}/.test(t); }) && window.__toasts.some(function (t) { return /already in the report/.test(t); });
      // 2026-10-10 calcsweep: summable by EXACT name (C.isSummable), never pushed into the
      // SUBSTRING-matched totals whitelist (a column named S made every column containing S summable).
      R.chk.applySummable = !!C.isSummable && C.isSummable('S') && C.isSummable('S2') &&
        penumbra_vars.totalExemptions.indexOf('S') === -1 && penumbra_vars.totalExemptions.indexOf('S2') === -1;
      R.chk.applyEmpty = C.applyRows([]).length === 0;
      // --- stripFromState --------------------------------------------------------------
      var st = { calcColumns: [{ name: 'S' }], visibleColumns: ['#', 0, 1, 2, 3], columnOrder: [0, 1, 2, 3],
                 sortCriteria: [{ colIdentifier: 2, colIndex: 2, direction: 'asc' }, { colIdentifier: 0, colIndex: 0, direction: 'desc' }] };
      var n = C.stripFromState(st, { A: 0, B: 1, S: 2, S2: 3 });
      eq('stripCount', n, 3);
      eq('stripState', 'calcColumns' in st, false);
      eq('stripVisible', JSON.stringify(st.visibleColumns), '["#",0,1]');
      eq('stripOrder', JSON.stringify(st.columnOrder), '[0,1]');
      eq('stripSort', JSON.stringify(st.sortCriteria.map(function (c) { return c.colIndex; })), '[0]');
      // --- the store (?id=zzcalc) and the link (&calc=URLCOL...) -----------------------
      var act = C.active();
      R.chk.urlActive = act.some(function (d) { return d.name === 'URLCOL' && d.src === 'url' && d.formula === '{A}+{B}'; });
      C.fromState([]);
      C.openDialog(null);
      R.chk.dialogOpens = !!document.getElementById('pnbCalcOverlay');
      document.getElementById('pnbCalcName').value = 'my ratio';
      document.getElementById('pnbCalcFormula').value = 'ROUND({A} / {B}, 2)';
      // the dialog validates against the last rows: those of applyRows above (A, B)
      document.getElementById('pnbCalcFormula').dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
      R.chk.previewRows = document.querySelectorAll('#pnbCalcPrev tbody tr').length === 2 && document.querySelector('#pnbCalcPrev tbody td.pnb-calc-res').textContent === '0.5';
      document.getElementById('pnbCalcGo').click();
      var store = {}; try { store = JSON.parse(localStorage.getItem('penumbra_calc_columns') || '{}'); } catch (e) {}
      R.chk.storeSaved = !!store.zzcalc && store.zzcalc.length === 1 && store.zzcalc[0].name === 'MY_RATIO' && store.zzcalc[0].formula === 'ROUND({A} / {B}, 2)';
      R.chk.dialogClosed = !document.getElementById('pnbCalcOverlay');
      R.chk.panelListed = !!document.querySelector('#pnbCalcList [data-calc-edit="MY_RATIO"]') && !!document.querySelector('#pnbCalcList [data-calc-keep="URLCOL"]');
      // a name a real column has, and a reference the table does not have, are refused
      C.openDialog(null);
      document.getElementById('pnbCalcName').value = 'A';
      document.getElementById('pnbCalcFormula').value = '{B} * 2';
      document.getElementById('pnbCalcGo').click();
      R.chk.dialogRefusesClash = !!document.getElementById('pnbCalcOverlay') && /already has a column named A/.test(document.getElementById('pnbCalcErr').textContent);
      document.getElementById('pnbCalcName').value = 'Z';
      document.getElementById('pnbCalcFormula').value = '{NOPE} * 2';
      document.getElementById('pnbCalcGo').click();
      R.chk.dialogRefusesMissing = !!document.getElementById('pnbCalcOverlay') && /no column \{NOPE\}/.test(document.getElementById('pnbCalcErr').textContent);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      R.chk.escCloses = !document.getElementById('pnbCalcOverlay');
      // the link wins over a saved column of the same name
      try { var st2 = JSON.parse(localStorage.getItem('penumbra_calc_columns') || '{}'); st2.zzcalc.push({ name: 'URLCOL', formula: '{A} * 100', format: 'number' });
            localStorage.setItem('penumbra_calc_columns', JSON.stringify(st2)); } catch (e) {}
      var uw = C.active().filter(function (d) { return d.name === 'URLCOL'; });
      R.chk.urlWinsOverSaved = uw.length === 1 && uw[0].src === 'url' && uw[0].formula === '{A}+{B}';
      // Keep: the link's column joins the saved ones (in place of the saved one)
      document.querySelector('#pnbCalcList [data-calc-keep="URLCOL"]').click();
      try { store = JSON.parse(localStorage.getItem('penumbra_calc_columns') || '{}'); } catch (e) {}
      R.chk.keepSaves = store.zzcalc.some(function (d) { return d.name === 'URLCOL'; }) && C.active().filter(function (d) { return d.name === 'URLCOL'; })[0].src === 'saved';
      // Remove
      document.querySelector('#pnbCalcList [data-calc-del="MY_RATIO"]').click();
      try { store = JSON.parse(localStorage.getItem('penumbra_calc_columns') || '{}'); } catch (e) {}
      R.chk.removeDrops = !store.zzcalc.some(function (d) { return d.name === 'MY_RATIO'; }) && !C.active().some(function (d) { return d.name === 'MY_RATIO'; });
      // --- the source: no eval / Function / innerHTML of a formula unescaped -------------
      var srcText = await fetch('penumbra_calc.js', { cache: 'no-store' }).then(function (r) { return r.text(); });
      R.chk.noEval = !/\beval\s*\(/.test(srcText) && !/new\s+Function\s*\(/.test(srcText) && !/\bFunction\s*\(\s*['"]/.test(srcText);
      R.info.toasts = window.__toasts.slice(0, 4);
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
