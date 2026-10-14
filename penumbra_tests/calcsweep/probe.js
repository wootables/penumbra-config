// Engine probe for js/penumbra_calc.js: each case records got vs want; mismatches are the findings.
(async function () {
  var OUT = { cases: [], errors: [] };
  window.addEventListener('error', function (e) { OUT.errors.push(String(e.message)); });
  var C = window.PenumbraCalc;
  function run(f, row, fmt) {
    var c = C.compile(f);
    if (!c.ok) return 'ERR:' + c.error;
    return C.evaluate(c.ast, function (n) { return row ? row[n] : undefined; }, fmt || 'number');
  }
  function eq(id, got, want, note) { OUT.cases.push({ id: id, ok: got === want, got: got === undefined ? '(undefined)' : got, want: want, note: note || '' }); }
  try {
    // ---- ROUND precision ------------------------------------------------------
    eq('round-1.005', run('ROUND(1.005, 2)'), '1.01');
    eq('round-2.675', run('ROUND(2.675, 2)'), '2.68', 'decimal half-away (Excel 2.68)');
    eq('round-neg1.005', run('ROUND(-1.005, 2)'), '-1.01');
    eq('round-big2', run('ROUND(5000000000.004, 2)'), '5000000000', 'nudge = |v|*f*1e-12 >= 0.5 here');
    eq('round-big2b', run('ROUND(123456789012.344, 2)'), '123456789012.34');
    eq('round-6pl', run('ROUND(1234567.1234561, 6)'), '1234567.123456');
    eq('round-10pl', run('ROUND(1000.00000000004, 10)'), '1000', 'number format shows 6 places');
    eq('round-neg-places', run('ROUND(1250, -2)'), '1300');
    eq('round-tiny', run('ROUND(0.0000005, 6)'), '0.000001');
    eq('fmt-num-noise', run('{A} * 1', { A: '123456789012.47' }), '123456789012.47', 'toFixed(6) of a 12-digit value shows binary noise');
    eq('fmt-num-noise2', run('{A} + {B}', { A: '1000000000.1', B: '0.2' }), '1000000000.3');
    // ---- truthiness ----------------------------------------------------------
    eq('if-FALSE-text', run('IF({F}, "y", "n")', { F: 'FALSE' }), 'n', 'a calc boolean is written as FALSE');
    eq('if-false-lc', run('IF({F}, "y", "n")', { F: 'false' }), 'n');
    eq('if-TRUE-text', run('IF({F}, "y", "n")', { F: 'TRUE' }), 'y');
    eq('if-Y-text', run('IF({F}, "y", "n")', { F: 'N' }), 'y', 'other text stays truthy (unchanged)');
    // ---- comparisons -----------------------------------------------------------
    eq('blank-lt-5', run('IF({A} < 5, "y", "n")', { A: '' }), 'y');
    eq('blank-eq-0', run('IF({A} = 0, "y", "n")', { A: '' }), 'n', 'blank is text "", not 0 (documented: text compare)');
    eq('num-vs-text', run('IF({A} = "10", "y", "n")', { A: '10.0' }), 'y');
    // ---- formatting ----------------------------------------------------------
    eq('fmt-cur-neg', run('0 - 1234.5', null, 'currency'), '-$1,234.50');
    eq('fmt-pct-str', run('IF(1, {R}, 0)', { R: '12%' }, 'percent'), '1200%', 'a 12% cell reads as 12 (page rule)');
    eq('fmt-num-big', run('{A} * 1', { A: '12345678.5' }), '12345678.5');
    eq('fmt-bool-num', run('{A} > 1', { A: '5' }, 'number'), 'TRUE');
    // ---- tokenizer / parser errors ---------------------------------------------
    eq('err-true-literal', run('IF({A} > 1, TRUE, FALSE)', { A: '2' }).slice(0, 4), 'ERR:', 'no TRUE/FALSE literals');
    eq('err-2e5', run('2e5').slice(0, 4), 'ERR:');
    eq('chain-cmp', run('1 < 2 < 3').slice(0, 4), 'ERR:');
    eq('deep-parens', run(new Array(201).join('(') + '1' + new Array(201).join(')')), '1');
    eq('max-len', run('1' + new Array(500).join('+1')).slice(0, 4), 'ERR:', '999 chars > 500');
    // ---- applyRows: chaining and order -------------------------------------------
    localStorage.clear();
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'OVER', formula: '{S} > {B}', format: 'text' },
      { name: 'MSG', formula: 'IF({OVER}, "over", "ok")', format: 'text' },
      { name: 'THIRD', formula: '{A} / 3', format: 'currency' },
      { name: 'BACK', formula: '{THIRD} * 3', format: 'number' }
    ] }));
    var rows = C.applyRows([{ S: '10', B: '100', A: '1' }]);
    eq('chain-bool', rows[0].MSG, 'ok', 'OVER = FALSE, so MSG must be ok');
    eq('chain-currency', rows[0].BACK, '0.99', 'reads the displayed $0.33 (as a real column would)');
    // ---- the dialog: editing a column that another depends on --------------------
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'BASE', formula: '{A} * 2', format: 'number' },
      { name: 'DEP', formula: '{BASE} + 1', format: 'number' }
    ] }));
    C.applyRows([{ A: '5' }]);
    C.openDialog('BASE');
    document.getElementById('pnbCalcFormula').value = '{A} * 3';
    document.getElementById('pnbCalcGo').click();
    var after = JSON.parse(localStorage.getItem('penumbra_calc_columns')).zzprobe.map(function (d) { return d.name; }).join(',');
    eq('edit-keeps-order', after, 'BASE,DEP', 'an edit must not move the column to the end');
    var r2 = C.applyRows([{ A: '5' }]);
    eq('edit-dep-still-works', r2[0].DEP, '16', 'DEP = BASE + 1 after BASE becomes {A}*3');
    eq('edit-col-order', Object.keys(r2[0]).join(','), 'A,BASE,DEP');
    // ---- the dialog: rename with a dependant ---------------------------------------
    C.openDialog('BASE');
    document.getElementById('pnbCalcName').value = 'BASE2';
    document.getElementById('pnbCalcGo').click();
    var r3 = C.applyRows([{ A: '5' }]);
    var st3 = JSON.parse(localStorage.getItem('penumbra_calc_columns')).zzprobe;
    eq('rename-dep', JSON.stringify([Object.keys(r3[0]).join(','), r3[0].DEP, st3[1] && st3[1].formula]), JSON.stringify(['A,BASE2,DEP', '16', '{BASE2} + 1']),
      'a rename carries the column that uses it');
    // ---- the dialog: a forward reference accepted by the dialog --------------------
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'P', formula: '{A} + 1', format: 'number' },
      { name: 'Q', formula: '{A} + 2', format: 'number' }
    ] }));
    C.applyRows([{ A: '5' }]);
    C.openDialog('P');
    document.getElementById('pnbCalcFormula').value = '{Q} * 10';
    document.getElementById('pnbCalcGo').click();
    var dlgOpen = !!document.getElementById('pnbCalcOverlay');
    var r4 = C.applyRows([{ A: '5' }]);
    eq('forward-ref-order', JSON.stringify([Object.keys(r4[0]).join(','), r4[0].P, r4[0].Q]), JSON.stringify(['A,P,Q', '70', '7']),
      'P uses Q, listed after it: worked out, and P keeps its place');
    // ---- cycle via edit: P refs Q, then Q edited to ref P ----------------------------
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'P', formula: '{A} + 1', format: 'number' },
      { name: 'Q', formula: '{P} + 2', format: 'number' }
    ] }));
    C.applyRows([{ A: '5' }]);
    C.openDialog('P');
    document.getElementById('pnbCalcFormula').value = '{Q} + 1';
    var errTxt = (function () { document.getElementById('pnbCalcGo').click(); var e = document.getElementById('pnbCalcErr'); return e ? e.textContent : '(closed)'; })();
    var r5 = C.applyRows([{ A: '5' }]);
    eq('cycle-refused', /loop/.test(errTxt) && Object.keys(r5[0]).join(','), 'A,P,Q', 'the dialog refuses the loop; nothing changes');
    // a loop stored anyway (a link, an old store) is left out and NAMED
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'L1', formula: '{L2} + 1', format: 'number' }, { name: 'L2', formula: '{L1} + 1', format: 'number' },
      { name: 'OK1', formula: '{A} + 1', format: 'number' } ] }));
    var r6 = C.applyRows([{ A: '5' }]);
    var bad6 = (document.querySelector('#pnbCalcList .pnb-calc-bad') || {}).title || '';
    eq('cycle-named', JSON.stringify([Object.keys(r6[0]).join(','), /loop/.test(bad6)]), JSON.stringify(['A,OK1', true]), bad6);
    document.querySelectorAll('#pnbCalcOverlay').forEach(function (n) { n.remove(); });
    // ---- the Save strip (stripFromState) and the exact-name questions ---------------------
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'REM', formula: '{A} - 1', format: 'number' }, { name: 'LBL', formula: 'IF({A} > 1, "hi", "lo")', format: 'text' } ] }));
    C.applyRows([{ A: '5', AMT: '3' }]);
    if (!C.isSummable) C.isSummable = function () { return 'missing'; };
    if (!C.isCalc) C.isCalc = function () { return 'missing'; };
    eq('summable-exact', JSON.stringify([C.isSummable('REM'), C.isSummable('rem'), C.isSummable('LBL'), C.isSummable('REMAINING'), C.isSummable('AMT')]),
      JSON.stringify([true, true, false, false, false]), 'number columns only, by exact name');
    eq('iscalc', JSON.stringify([C.isCalc('REM'), C.isCalc('LBL'), C.isCalc('A')]), JSON.stringify([true, true, false]));
    eq('no-whitelist-push', JSON.stringify(window.penumbra_vars.totalExemptions), '[]');
    var said = []; window.show_text = function (h) { said.push(String(h)); };
    var s1 = { groupBy: 'REM:bin5,LBL', groupAgg: { column: 'AMT', type: 'sum' }, groupSort: { key: 'summary', dir: 'desc' }, groupStartDepth: 1, groupLimit: { n: 3 },
               customSortOrders: { LBL: ['hi', 'lo'] }, columnSummaryFormulas: { REM: '{sum}' } };
    C.stripFromState(s1, {});
    eq('strip-all-levels', JSON.stringify(s1), '{}', 'every level was calculated: every group key goes; the maps empty out');
    var s2 = { pivot: { rows: ['A'], cols: [], vals: 'AMT', agg: ['sum'], aggFilters: ['LBL=hi'] }, viewOptions: { journalKeyColumns: ['REM'] } };
    C.stripFromState(s2, {});
    var s3 = { pivot: { rows: ['A'], cols: [], vals: 'AMT', agg: ['sum'], aggFilters: ['NOTE=REMOTE'] } };
    C.stripFromState(s3, {});
    eq('strip-pivot-filter', JSON.stringify([!s2.pivot, !!s3.pivot, s2.viewOptions.journalKeyColumns.join()]), JSON.stringify([true, true, 'REM']),
      'a filter naming LBL drops the pivot; REMOTE is not REM; the journal key stays');
    await new Promise(function (r) { setTimeout(r, 1100); });
    eq('strip-notice', said.some(function (h) { return /grouping by REM, LBL/.test(h); }) && said.some(function (h) { return /Journal is keyed on REM/.test(h); }), true, said.join(' | ').slice(0, 300));
    // ---- Copy link carries the calculated columns the column uses --------------------------
    localStorage.setItem('penumbra_calc_columns', JSON.stringify({ zzprobe: [
      { name: 'REM', formula: '{A} - 1', format: 'number' }, { name: 'PCT', formula: '{REM} / {A}', format: 'percent' } ] }));
    C.applyRows([{ A: '5' }]);
    var copied = '';
    window._pnbCopyText = function (u) { copied = String(u); };
    C.openDialog('PCT');
    document.getElementById('pnbCalcLink').click();
    document.querySelectorAll('#pnbCalcOverlay').forEach(function (n) { n.remove(); });
    var calcs = new URL(copied || 'http://x/').searchParams.getAll('calc').map(function (v) { return v.split('|')[0]; });
    eq('link-deps', calcs.join(','), 'REM,PCT', copied.slice(0, 200));
  } catch (e) { OUT.errors.push('probe threw: ' + (e && e.stack || e)); }
  window.__OUT = OUT; window.__DONE = true;
})();
