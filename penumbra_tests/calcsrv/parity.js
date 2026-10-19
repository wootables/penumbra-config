// calcsrv suite - parity half, browser side (2026-10-11). The module ALONE
// (js/penumbra_calc.js) works a corpus of formulas over a corpus of rows; run.py
// hands the same rows + definitions to penumbra_calc.php (parity.php) and compares
// every appended cell and every row's column order, byte for byte.
(function () {
  var R = { sets: [], rows: null, today: null, errors: [] };
  try {
    // ---- the values: every edge the two engines could read differently
    var V = ['', null, '0', '1', '-1', '2.5', '-2.5', '0.125', '1.005', '1.045', '0.5', '1.5', '(500)', '$1,234.50', '12%', '-$3.33',
      '1e3', ' 42 ', ' 7 ', 'abc', 'ABC', 'TRUE', 'FALSE', 'true', 'yes', '2026-10-09', '10/9/2026', '09-OCT-26', 'October 9, 2026',
      'Oct. 9, 2026', '2026-02-31', '2026-10-09 13:45:00', '2026-10-09T08:00', '1/1/69', '1/1/70', '2024-02-29', '12/31/1999',
      123.456, 0.1, 1e21, -0.0001, 999999999999.995, 5000000000.004, 123456789012.47, 1.005, 2.5, -2.5, 0, -0.5, 1234567.891, 0.000001, 1e-7,
      'Ünïcode', '2014-0685', 'x\ny', '  ', '.5', '5.', '+5', '1,000,000', '(0.004)', '33.333333333', '7', '-7', '100', '3'];
    var DATES = ['2026-10-09', '2025-01-31', '10/9/2026', '09-OCT-26', 'October 9, 2026', '2026-02-31', '', 'abc', '2026-10-09 13:45:00', '1/1/69',
      '2000-02-29', '12-DEC-99', 'Dec 1, 1999', '2026-03-08', '2026-11-01'];
    var seed = 20261011;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    var rows = [];
    // every value meets every value as A and B at least once over the first rows
    for (var i = 0; i < V.length; i++) rows.push({ A: V[i], B: V[(i * 7 + 3) % V.length], C: V[(i * 11 + 5) % V.length], T: pick(['abc', 'ABC', 'Abc', '', 'z', 'TRUE']), D1: pick(DATES), D2: pick(DATES), mixedCase: V[(i * 5) % V.length] });
    for (var j = 0; j < 360; j++) rows.push({ A: pick(V), B: pick(V), C: pick(V), T: pick(['abc', 'ABC', 'Abc', '', 'z', 'TRUE', 'FALSE', 'é']), D1: pick(DATES), D2: pick(DATES), mixedCase: pick(V) });
    R.rows = rows;
    var F = ['{A} + {B}', '{A} - {B}', '{A} * {B}', '{A} / {B}', '-{A}', '+{A}', '--{A}', '({A} + {B}) * {C}', '{A} / 3', 'ROUND({A})', 'ROUND({A}, 2)',
      'ROUND({A} / 7, 3)', 'ROUND({A}, -2)', 'ROUND({A}, {B})', 'ROUND({A}, 12)', 'IF({A} > {B}, "gt", "le")', 'IF({A}, 1, 0)', 'IF({T} = "abc", {A}, {B})',
      'IF({T} <> "ABC", "ne", "eq")', '{A} = {B}', '{A} >= {B}', '{T} < {A}', '{A} & {B}', '{T} & " " & {A}', '{D1} - {D2}', '{D1} + {A}', '{A} + {D1}',
      '{D1} - 30', 'DAYS({D1}, {D2})', '{D1} < {D2}', '{D1} = {D2}', 'IF({D1} > {D2}, {D1}, {D2})', '{D1} & ""', '{A} * 1000000', '{A} / 0', '1 / 3',
      '0.1 + 0.2', '{MIXEDCASE} + 1', '{mixedcase} * 2', '"x" & 1.5', 'IF({A} = "", "blank", "set")', '{A} = ""', 'ROUND({A} * 100) / 100', 'ROUND(1.005, 2)',
      'ROUND(2.5)', 'ROUND(-2.5)', '{A} * 0.1', '100 * {A} / {B}', 'IF({A} > 0, {A}, -{A}) & "!"', '{A} <> {B}', '{A} <= {B}', '{A} != {B}', '{A} < {B}',
      'IF({T}, "t", "f")', 'IF({A} > {B}, {A} > {C}, FALSE_COL_NOT)', '{D1} + 0.9', '{D1} - -1.9', '1e3', 'ROUND({A}, 2.9)', 'ROUND({A}, -11)',
      '{A}*{B}/{C}', '{ a } + 1', '{C} & {D1} & {T}', 'DAYS(TODAY(), {D1})', 'TODAY() & ""', 'TODAY() > {D1}', '"" & {A}', '{A} & ""'];
    var FMT = ['number', 'currency', 'percent', 'text'];
    var defs = [];
    F.forEach(function (f, k) { FMT.forEach(function (fm, m) { defs.push({ name: 'F' + k + '_' + m, formula: f, format: fm }); }); });
    var sets = [];
    for (var s = 0; s < defs.length; s += 20) sets.push({ id: 'corpus' + (s / 20), defs: defs.slice(s, s + 20) });
    // ---- the structural cases: order, loops, clashes, refusals, limits
    sets.push({ id: 'depOrder', defs: [{ name: 'Z3', formula: '{Z2} * 2' }, { name: 'Z2', formula: '{Z1} + 1', format: 'currency' }, { name: 'Z1', formula: '{A} + 0' }, { name: 'Z4', formula: 'IF({Z3} > 2, {Z2}, "no")', format: 'text' }] });
    sets.push({ id: 'loop', defs: [{ name: 'L1', formula: '{L2} + 1' }, { name: 'L2', formula: '{L1} + 1' }, { name: 'L3', formula: '{A} + 1' }, { name: 'L4', formula: '{L1} * 2' }, { name: 'L5', formula: '{L5} + 1' }] });
    sets.push({ id: 'clash', defs: [{ name: 'A', formula: '{B} + 1' }, { name: 'MIXEDCASE', formula: '1' }, { name: 'OK1', formula: '{A} * 2' }, { name: 'USESA', formula: '{A} + {OK1}' }] });
    sets.push({ id: 'missing', defs: [{ name: 'M1', formula: '{NOPE} + 1' }, { name: 'M2', formula: '{M1} + 1' }, { name: 'M3', formula: '{A} +' }, { name: 'M4', formula: 'FOO({A})' }, { name: 'M5', formula: '{A} + 1' }] });
    sets.push({ id: 'dupes', defs: [{ name: 'D', formula: '{A} + 1' }, { name: 'E', formula: '{A} + 2' }, { name: 'd', formula: '{A} + 3', format: 'currency' }] });
    sets.push({ id: 'names', defs: [{ name: '1BAD', formula: '1' }, { name: 'has space', formula: '{A} + 1' }, { name: 'nb sp', formula: '2' }, { name: '', formula: '3' },
      { name: 'NOFORMULA', formula: '' }, { name: 'BADFMT', formula: '{A}', format: 'Weird' }, { name: 'UPFMT', formula: '{A}', format: ' CURRENCY ' }, { name: 'X'.repeat(61), formula: '1' },
      { name: 'TRIMMED  ', formula: '  {A} * 2  ' }, { name: 'NBSPF', formula: '{A} * 2' }, { name: 'UNI', formula: '"éè ☃" & {T}', format: 'text' },
      { name: 'ATAT', formula: '"@@HTML" & 1' }, { name: 'LONG', formula: '1' + new Array(251).join(' +1') }, { name: 'LONGOK', formula: '1' + new Array(166).join(' +1') },
      { name: 'ASTRAL', formula: '"' + new Array(201).join('😀') + '" & {T}', format: 'text' }] });
    var many = []; for (var q = 0; q < 25; q++) many.push({ name: 'N' + q, formula: '{A} + ' + q });
    sets.push({ id: 'many', defs: many });
    sets.push({ id: 'manyDupes', defs: [{ name: 'Q', formula: '1' }].concat(many.slice(0, 19)).concat([{ name: 'Q', formula: '2' }, { name: 'LATE', formula: '3' }]) });
    sets.push({ id: 'junk', defs: [null, 'str', 5, { formula: '1' }, { name: 'OK', formula: '{A}' }, { name: 'ARR', formula: ['x'] }] });
    // (2026-10-18, calcadj) adjustable values: I1 carries R, I2 and I4 use it; I3 names one no
    // column carries (left out); I5's value is over its highest (kept to it) and K is lowercase;
    // I6's value is not a number (dropped, the column still uses I5's K)
    sets.push({ id: 'inputs', defs: [
      { name: 'I1', formula: '{A} * {@R}', input: { name: 'R', value: 0.55 } },
      { name: 'I2', formula: 'ROUND({I1} + {@R}, 2)', format: 'currency' },
      { name: 'I3', formula: '{A} * {@NOPE}' },
      { name: 'I4', formula: '{@R} > 0.5', format: 'text' },
      { name: 'I5', formula: '{B} / {@K}', input: { name: 'k', value: 7, min: 0, max: 5, step: 0.5 } },
      { name: 'I6', formula: '{@K} & "x" & {@r}', format: 'text', input: { name: 'BAD', value: 'abc' } },
      { name: 'I7', formula: '{A} + {@S}', format: 'percent', input: { name: 'S', value: '1e3', min: 9, max: 1 } }] });
    // ---- run them
    var C = window.PenumbraCalc;
    sets.forEach(function (set) {
      C.fromState(set.defs, 'report');
      var copy = rows.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); return o; });
      var out = C.applyRows(copy);
      var keys0 = Object.keys(rows[0]);
      R.sets.push({ id: set.id, defs: set.defs, out: out.map(function (r) {
        var ks = Object.keys(r);
        return { keys: ks.join('|'), vals: ks.filter(function (k) { return keys0.indexOf(k) === -1; }).map(function (k) { return r[k]; }) };
      }) });
    });
    C.fromState([], 'report');
    // rows whose keys differ: the plan is made from the FIRST row's
    var odd = [{ A: '1', B: '2' }, { B: '5', A: '4', EXTRA: '9' }, { A: '7' }];
    C.fromState([{ name: 'S', formula: '{A} + {B}' }, { name: 'X2', formula: '{EXTRA} + 1' }], 'report');
    var oo = C.applyRows(odd.map(function (r) { if (!r || typeof r !== 'object') return r; var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); return o; }));
    R.odd = { rows: odd, out: oo };
    C.fromState([], 'report');
    var d = new Date(); R.today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    R.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) { R.fatal = String((e && e.stack) || e); }
  window.__PARITY = R; window.__HCDONE = true;
})();
