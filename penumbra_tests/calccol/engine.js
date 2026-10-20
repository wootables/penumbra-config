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
      // --- adjustable values (2026-10-18, calcadj) -----------------------------------------
      eq('inpToken', run('{A} * {@R}', { A: '10', '@R': 0.5 }), '5');
      eq('inpMissing', run('{A} * {@R}', { A: '10' }), '');
      eq('inpInText', run('"{@R}"', { '@R': 1 }, 'text'), '{@R}');
      eq('inpErrEmpty', /Empty \{@\}/.test(err('{@} + 1')), true);
      var ci = C.compile('{@RATE} + {A} - {@rate}');
      eq('inpCompile', ci.ok && ci.inputs.join(',') === 'RATE' && ci.refs.join(',') === 'A', true);
      var pui = C.parseUrlValue('X|{A}*{@R}|currency|@R=0.5,0,1,0.05');
      eq('urlInput', JSON.stringify(pui), JSON.stringify({ name: 'X', formula: '{A}*{@R}', format: 'currency', input: { name: 'R', value: 0.5, min: 0, max: 1, step: 0.05 } }));
      eq('urlInputRoundTrip', C.urlValue(pui), 'X|{A}*{@R}|currency|@R=0.5,0,1,0.05');
      var pui2 = C.parseUrlValue('X|{A}*{@R}|@R=2');
      eq('urlInputNoFmt', !!pui2 && pui2.format === 'number' && pui2.input.value === 2 && pui2.input.min === undefined && C.urlValue(pui2) === 'X|{A}*{@R}|@R=2', true);
      C.fromState([{ name: 'X', formula: '{A}', input: { name: 'r', value: 5, min: 0, max: 1 } }, { name: 'Y', formula: '{A}', input: { name: 'B', value: 'abc' } }], 'state');
      var ax = C.active().filter(function (d) { return d.name === 'X'; })[0], ay = C.active().filter(function (d) { return d.name === 'Y'; })[0];
      eq('cleanInputClamp', !!ax && !!ax.input && ax.input.name === 'R' && ax.input.value === 1 && ax.input.min === 0 && ax.input.max === 1 && ax.input.step === undefined, true);
      eq('cleanInputBad', !!ay && ay.input === undefined, true);
      // one value, shared: X carries R, Y uses it; Z names a value no column carries
      C.fromState([{ name: 'X', formula: '{A} * {@R}', input: { name: 'R', value: 2 } }, { name: 'Y', formula: '{X} + {@R}' }, { name: 'Z', formula: '{A} * {@Q}' }], 'state');
      var ar = C.applyRows([{ A: '3' }]);
      eq('applyInputs', ar[0].X + '/' + ar[0].Y, '6/8');
      await sleep(1100);
      eq('applyNoInput', !('Z' in ar[0]) && window.__toasts.some(function (t) { return /Z<\/strong> was left out: no column carries an adjustable value named \{@Q\}/.test(t); }), true);
      // the viewer moves it: an override of their own, every knob follows, what leaves the page is at that value
      eq('inputsListed', C.inputs().R.value === 2 && C.inputs().R.col === 'X' && C.inputs().R.def === 2, true);
      eq('setInput', C.setInput('R', 4) === true && C.inputs().R.value === 4 && C.applyRows([{ A: '3' }])[0].X === '12'
        && C.forState().filter(function (d) { return d.name === 'X'; })[0].input.value === 4, true);
      var lsI = JSON.parse(localStorage.getItem('penumbra_calc_inputs') || '{}');
      eq('setInputStored', !!lsI.zzcalc && lsI.zzcalc.R === 4, true);
      eq('setInputBad', C.setInput('R', 'abc') === false && C.setInput('NOPE', 1) === false && C.inputs().R.value === 4, true);
      eq('inputsFor', C.inputsFor('Y').map(function (x) { return x.name; }).join(',') === 'R' && C.inputsFor('X')[0].name === 'R' && C.inputsFor('Z').length === 0, true);
      eq('knobHtml', /data-calc-input="R"/.test(C.knobHtml(C.inputs().R, 'x')) && !/type="range"/.test(C.knobHtml(C.inputs().R, 'x')), true);
      C.fromState([{ name: 'X', formula: '{A} * {@R}', input: { name: 'R', value: 2, min: 0, max: 3, step: 0.5 } }], 'state');
      eq('setInputClamp', C.setInput('R', 9) === true && C.inputs().R.value === 3 && /type="range"/.test(C.knobHtml(C.inputs().R, 'x')), true);
      eq('setInputBackToDefault', C.setInput('R', 2) === true && !Object.prototype.hasOwnProperty.call(JSON.parse(localStorage.getItem('penumbra_calc_inputs') || '{}').zzcalc || {}, 'R'), true);
      C.setInput('R', 1);
      C.clearSaved();
      eq('clearInputs', C.inputs().R.value === 2 && !JSON.parse(localStorage.getItem('penumbra_calc_inputs') || '{}').zzcalc, true);
      // the panel's row carries the knob; a change in its box moves the value
      C.applyRows([{ A: '3' }]);
      var knob = document.querySelector('#pnbCalcList [data-calc-input="R"]');
      eq('panelKnob', !!knob && knob.value === '2' && !!document.querySelector('#pnbCalcList [data-calc-range="R"]'), true);
      if (knob) { knob.value = '2.5'; knob.dispatchEvent(new Event('change', { bubbles: true })); }
      eq('panelKnobChange', C.inputs().R.value === 2.5 && (document.querySelector('#pnbCalcList [data-calc-range="R"]') || {}).value === '2.5', true);
      // the dialog's Adjustable value row: closed by default, the other columns' values as chips;
      // a value the formula names must exist; a bad default, bad bounds, a name another column has
      C.openDialog(null);
      var wrap = document.getElementById('pnbCalcAdjWrap');
      eq('dialogAdjRow', !!wrap && !wrap.open && !!document.getElementById('pnbCalcAdjName') && /\{@R\}/.test((document.getElementById('pnbCalcCols') || {}).textContent || ''), true);
      document.getElementById('pnbCalcName').value = 'ADJCOL';
      document.getElementById('pnbCalcFormula').value = '{A} * {@K}';
      document.getElementById('pnbCalcGo').click();
      eq('dialogAdjMissing', !!document.getElementById('pnbCalcOverlay') && /adjustable value named \{@K\}/.test(document.getElementById('pnbCalcErr').textContent), true);
      document.getElementById('pnbCalcAdjName').value = 'K';
      document.getElementById('pnbCalcAdjVal').value = 'abc';
      document.getElementById('pnbCalcGo').click();
      eq('dialogAdjBadVal', /default/.test(document.getElementById('pnbCalcErr').textContent) && document.getElementById('pnbCalcAdjTok').textContent === '{@K}', true);
      document.getElementById('pnbCalcAdjVal').value = '2';
      document.getElementById('pnbCalcAdjMin').value = '5';
      document.getElementById('pnbCalcAdjMax').value = '1';
      document.getElementById('pnbCalcGo').click();
      eq('dialogAdjBadBounds', /lowest/.test(document.getElementById('pnbCalcErr').textContent), true);
      document.getElementById('pnbCalcAdjMin').value = '0';
      document.getElementById('pnbCalcAdjMax').value = '10';
      document.getElementById('pnbCalcAdjName').value = 'R';
      document.getElementById('pnbCalcGo').click();
      eq('dialogAdjClash', /already the adjustable value of X/.test(document.getElementById('pnbCalcErr').textContent), true);
      document.getElementById('pnbCalcAdjName').value = 'K';
      document.getElementById('pnbCalcFormula').dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(250);
      eq('dialogAdjPreview', document.getElementById('pnbCalcErr').textContent === '' && document.querySelectorAll('#pnbCalcPrev tbody tr').length === 1
        && (document.querySelector('#pnbCalcPrev tbody tr td.pnb-calc-res') || {}).textContent === '6', true);
      document.getElementById('pnbCalcGo').click();
      var st3 = JSON.parse(localStorage.getItem('penumbra_calc_columns') || '{}');
      var sdef = (st3.zzcalc || []).filter(function (d) { return d.name === 'ADJCOL'; })[0];
      eq('dialogAdjSaved', !document.getElementById('pnbCalcOverlay') && !!sdef && JSON.stringify(sdef.input) === JSON.stringify({ name: 'K', value: 2, min: 0, max: 10 }), true);
      // an edit that leaves the value alone keeps the knob; one that changes it puts the knob back
      C.applyRows([{ A: '3' }]);
      C.setInput('K', 7);
      C.openDialog('ADJCOL');
      eq('dialogAdjEditOpen', document.getElementById('pnbCalcAdjWrap').open === true && document.getElementById('pnbCalcAdjVal').value === '2' && document.getElementById('pnbCalcAdjMax').value === '10', true);
      document.getElementById('pnbCalcGo').click();
      eq('dialogAdjEditKeepsKnob', (C.inputs().K || {}).value === 7, true);
      C.openDialog('ADJCOL');
      document.getElementById('pnbCalcAdjVal').value = '3';
      document.getElementById('pnbCalcGo').click();
      eq('dialogAdjEditResets', (C.inputs().K || {}).value === 3 && (C.inputs().K || {}).def === 3, true);
      R.info.adj = { inputs: C.inputs(), active: C.active() };
      // --- round 2 (2026-10-19) ---------------------------------------------------------
      // the Save dialog's list: a ticked column using {@R} takes the column CARRYING R along
      C.clearSaved();
      C.fromState([{ name: 'CAR', formula: '{A} + 0', input: { name: 'R', value: 2 } }, { name: 'USER', formula: '{A} * {@R}' }], 'state');
      C.applyRows([{ A: '3' }]);
      var lsb = document.getElementById('lastStopCardBody'); if (!lsb) { lsb = document.createElement('div'); lsb.id = 'lastStopCardBody'; document.body.appendChild(lsb); }
      C.renderSaveList();
      document.querySelector('#pnbCalcSaveRow input[data-calc-save="CAR"]').checked = false;
      var sst = { visibleColumns: ['#', 0, 1, 2], columnOrder: [0, 1, 2] };
      C.stripFromState(sst, { A: 0, CAR: 1, USER: 2 });
      eq('stripCarrier', !!sst.calcColumns && sst.calcColumns.map(function (d) { return d.name; }).join(',') === 'CAR,USER' && sst.calcColumns[0].input.value === 2, true);
      lsb.innerHTML = '';
      // two active columns carrying one value name: the later loses its own (one knob, one id)
      C.fromState([{ name: 'C1', formula: '{A}', input: { name: 'R', value: 1 } }, { name: 'C2', formula: '{A}', input: { name: 'r', value: 9 } }], 'state');
      var ac = C.active();
      eq('dupInput', !!ac.filter(function (d) { return d.name === 'C1'; })[0].input && ac.filter(function (d) { return d.name === 'C2'; })[0].input === undefined && C.inputs().R.value === 1 && C.inputs().R.col === 'C1', true);
      C.applyRows([{ A: '3' }]);
      eq('applyBoxSame', (function () {
        // Enter on an untouched box is not a move: no override, no reset button
        var kb = document.querySelector('#pnbCalcList [data-calc-input="R"]');
        kb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        var ov = JSON.parse(localStorage.getItem('penumbra_calc_inputs') || '{}');
        return !(ov.zzcalc && Object.prototype.hasOwnProperty.call(ov.zzcalc, 'R')) && document.querySelector('#pnbCalcList [data-calc-inpreset="R"]').hidden === true;
      })(), true);
      // --- round 5 (2026-10-19): a date value ------------------------------------------------
      C.fromState([{ name: 'DX', formula: 'DAYS({@ASOF}, {D})', input: { name: 'asof', kind: 'date', value: '10/31/2026', min: '2026-01-01', max: '2026-12-31', step: 7 } },
        { name: 'DY', formula: '{@ASOF} + 30' }, { name: 'DZ', formula: '{A} * {@ASOF}' }], 'state');
      var dd = C.active().filter(function (d) { return d.name === 'DX'; })[0];
      eq('cleanInputDate', !!dd.input && dd.input.kind === 'date' && dd.input.value === '2026-10-31' && dd.input.min === '2026-01-01' && dd.input.max === '2026-12-31' && dd.input.step === 7, true);
      var dr = C.applyRows([{ A: '3', D: '2026-10-01' }]);
      eq('inpDateEval', dr[0].DX + '/' + dr[0].DY + '/' + dr[0].DZ, '30/2026-11-30/');
      var pud = C.parseUrlValue('X|{A}|@ASOF=2026-12-31,2026-01-01,2026-12-31,7');
      eq('inpDateInferred', !!pud && (pud.input || {}).kind === 'date' && C.urlValue(pud) === 'X|{A}|@ASOF=2026-12-31,2026-01-01,2026-12-31,7', true);
      // (null-safe below: a mutant that drops the date kind must turn these red, not kill the page)
      var ia = function () { return C.inputs().ASOF || {}; };
      eq('setInputDate', C.setInput('ASOF', '2027-06-01') === true && ia().value === '2026-12-31' && C.setInput('ASOF', '11/15/2026') === true && ia().value === '2026-11-15'
        && C.applyRows([{ A: '3', D: '2026-10-01' }])[0].DX === '45', true);
      eq('setInputDateBad', C.setInput('ASOF', '12') === false && C.setInput('ASOF', 'soon') === false && ia().value === '2026-11-15', true);
      var kd = C.inputs().ASOF ? C.knobHtml(C.inputs().ASOF, 'x') : '';
      eq('knobDate', /type="date"/.test(kd) && /min="2026-01-01"/.test(kd) && /step="7"/.test(kd) && !/type="range"/.test(kd), true);
      eq('stateDateEffective', ((C.forState().filter(function (d) { return d.name === 'DX'; })[0] || {}).input || {}).value === '2026-11-15', true);
      // (round 7) the date's knob in the panel is wide enough for a date, not a number's 62px
      var dk = document.querySelector('#pnbCalcList [data-calc-input="ASOF"]');
      eq('knobDateWide', !!dk && dk.type === 'date' && dk.getBoundingClientRect().width >= 120, true);
      R.info.dateKnob = dk ? dk.getBoundingClientRect().width : null;
      // (round 8) a date typed segment by segment: the browser fires change with 0002-11-15 for the year's
      // first digit - the box keeps what was typed and nothing applies; leaving the box springs it back;
      // a whole date typed applies while the box still has focus
      if (dk) {
        dk.focus(); dk.value = '0002-11-15'; dk.dispatchEvent(new Event('change', { bubbles: true }));
        eq('dateTypingKept', dk.value === '0002-11-15' && ia().value === '2026-11-15' && document.activeElement === dk, true);
        dk.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        eq('dateLeaveSprings', dk.value === '2026-11-15' && ia().value === '2026-11-15', true);
        dk.focus(); dk.value = '2026-11-20'; dk.dispatchEvent(new Event('change', { bubbles: true }));
        eq('dateTypedApplies', ia().value === '2026-11-20', true);
        await sleep(400);
      }
      C.setInput('ASOF', '2026-10-31');
      // the dialog's Kind: Date turns the value boxes into date pickers and reads dates
      C.openDialog(null);
      document.getElementById('pnbCalcName').value = 'DCOL';
      document.getElementById('pnbCalcFormula').value = 'DAYS({@CUT}, {D})';
      document.getElementById('pnbCalcAdjName').value = 'CUT';
      var ks = document.getElementById('pnbCalcAdjKind'); ks.value = 'date'; ks.dispatchEvent(new Event('change', { bubbles: true }));
      eq('dialogKindDate', document.getElementById('pnbCalcAdjVal').type === 'date' && /Step \(days\)/.test(document.querySelector('#pnbCalcOverlay label[for="pnbCalcAdjStep"]').textContent), true);
      document.getElementById('pnbCalcGo').click();
      eq('dialogKindDateErr', /a date, e\.g\./.test(document.getElementById('pnbCalcErr').textContent), true);
      document.getElementById('pnbCalcAdjVal').value = '2026-12-31';
      document.getElementById('pnbCalcGo').click();
      var sd2 = (JSON.parse(localStorage.getItem('penumbra_calc_columns') || '{}').zzcalc || []).filter(function (d) { return d.name === 'DCOL'; })[0];
      eq('dialogKindDateSaved', !document.getElementById('pnbCalcOverlay') && !!sd2 && !!sd2.input && sd2.input.kind === 'date' && sd2.input.value === '2026-12-31', true);
      // an error about the adjustable value opens its row
      C.openDialog(null);
      document.getElementById('pnbCalcName').value = 'ERRCOL';
      document.getElementById('pnbCalcFormula').value = '{A} * {@NOPE}';
      document.getElementById('pnbCalcGo').click();
      eq('adjErrOpens', document.getElementById('pnbCalcAdjWrap').open === true && /\{@NOPE\}/.test(document.getElementById('pnbCalcErr').textContent), true);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      // --- round 8 (2026-10-19, closing sweep) ----------------------------------------------
      // a stored override of the other kind (a number kept for a value that is a date now) is not one in a view link / Keep / Save
      localStorage.setItem('penumbra_calc_inputs', JSON.stringify({ zzcalc: { ASOFK: 0.9 } }));
      C.fromState([{ name: 'DK', formula: '{D}', input: { name: 'ASOFK', kind: 'date', value: '2026-10-31' } }], 'state');
      var fsDK = ((C.forState().filter(function (d) { return d.name === 'DK'; })[0] || {}).input) || {};
      eq('plainKindGuard', fsDK.value === '2026-10-31' && fsDK.kind === 'date', true);
      localStorage.removeItem('penumbra_calc_inputs');
      // removing the column that carries a value forgets the value's override
      C.fromState([{ name: 'RM', formula: '{A}', input: { name: 'RV', value: 1 } }], 'state');
      C.setInput('RV', 5);
      var ovBefore = ((JSON.parse(localStorage.getItem('penumbra_calc_inputs') || '{}').zzcalc) || {}).RV === 5;
      C.remove('RM');
      var ovAfter = (JSON.parse(localStorage.getItem('penumbra_calc_inputs') || '{}').zzcalc) || {};
      eq('removeForgets', ovBefore && !Object.prototype.hasOwnProperty.call(ovAfter, 'RV'), true);
      // a ticked column's carrier is saved with it even when this run left the carrier out (its formula
      // names a column this table lacks): its value still fed the ticked column
      C.clearSaved();
      C.fromState([{ name: 'CARX', formula: '{NOPE} + 0', input: { name: 'RX', value: 2 } }, { name: 'USERX', formula: '{A} * {@RX}' }], 'state');
      var rx = C.applyRows([{ A: '3' }]);
      C.renderSaveList();
      var sstx = { visibleColumns: ['#', 0, 1], columnOrder: [0, 1] };
      C.stripFromState(sstx, { A: 0, USERX: 1 });
      var carx = sstx.calcColumns ? sstx.calcColumns.filter(function (d) { return d.name === 'CARX'; })[0] : null;
      eq('stripCarrierLeftOut', rx[0].USERX === '6' && !!sstx.calcColumns && sstx.calcColumns.map(function (d) { return d.name; }).sort().join(',') === 'CARX,USERX' && !!carx && !!carx.input && carx.input.value === 2, true);
      lsb.innerHTML = '';
      // a column left out is noticed; working again, then left out again, it is noticed again (not once per page)
      window.__toasts.length = 0;
      C.fromState([{ name: 'ORPH', formula: '{A} * {@RQ}' }], 'state'); C.applyRows([{ A: '3' }]);
      await sleep(1100);
      var n1 = window.__toasts.filter(function (h) { return /ORPH/.test(h); }).length;
      C.fromState([{ name: 'CARQ', formula: '{A}', input: { name: 'RQ', value: 2 } }, { name: 'ORPH', formula: '{A} * {@RQ}' }], 'state'); C.applyRows([{ A: '3' }]);
      C.fromState([{ name: 'ORPH', formula: '{A} * {@RQ}' }], 'state'); C.applyRows([{ A: '3' }]);
      await sleep(1100);
      var n2 = window.__toasts.filter(function (h) { return /ORPH/.test(h); }).length;
      eq('noticedAgain', n1 + '/' + n2, '1/2');
      // the chip's popover: every id once (two rows of one value shared the knob's id); the chip again closes
      // it; Tab out of it closes it, focus moving inside or nowhere does not
      C.fromState([{ name: 'CAR', formula: '{A} + 0', input: { name: 'R', value: 2 } }, { name: 'USER', formula: '{A} * {@R}' }], 'state');
      C.applyRows([{ A: '3' }]);
      var anc = document.createElement('button'); anc.id = 'fakeChip'; anc.textContent = 'chip'; document.body.appendChild(anc);
      C.openChipMenu(anc);
      var popIds = Array.prototype.map.call(document.querySelectorAll('#pnbCalcPop [id]'), function (x) { return x.id; });
      var knobIds = popIds.filter(function (i) { return /pnbCalcInp_/.test(i); });
      eq('popKnobIds', knobIds.length === 2 && popIds.length === popIds.filter(function (i, k) { return popIds.indexOf(i) === k; }).length, true);
      C.openChipMenu(anc);
      eq('popToggle', !document.getElementById('pnbCalcPop'), true);
      C.openChipMenu(anc);
      var pb = document.querySelectorAll('#pnbCalcPop button');
      pb[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: pb[1] }));
      var stayIn = !!document.getElementById('pnbCalcPop');
      pb[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      var stayNone = !!document.getElementById('pnbCalcPop');
      pb[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.getElementById('pnbCalcAdd') }));
      eq('popTabOut', stayIn && stayNone && !document.getElementById('pnbCalcPop'), true);
      C.closeChipMenu(false);
      anc.remove();
      // --- the source: no eval / Function / innerHTML of a formula unescaped -------------
      var srcText = await fetch('penumbra_calc.js', { cache: 'no-store' }).then(function (r) { return r.text(); });
      R.chk.noEval = !/\beval\s*\(/.test(srcText) && !/new\s+Function\s*\(/.test(srcText) && !/\bFunction\s*\(\s*['"]/.test(srcText);
      R.info.toasts = window.__toasts.slice(0, 4);
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
