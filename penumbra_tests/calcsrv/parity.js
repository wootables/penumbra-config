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
    // (2026-11-26, calctext) text the text functions read: entities, @@HTML, @@JSON, case, accents, emoji, spaces of every
    // kind, line breaks, lists
    var TX = ['', null, 'abc', '  Padded   text  ', 'O&#039;Brien', 'R&amp;D Lab', '&lt;b&gt;x&lt;/b&gt;', '@@HTML<a href="x">Duke &amp; Co</a>',
      '@@HTML  <b>NC State</b>  ', '@@JSON[{"A":1}]', 'NC State University', 'nc state', '\u00e9clair \u00dcn\u00efcode', '\u039f\u0394\u039f\u03a3', '\u0130stanbul',
      'stra\u00dfe', '\ud83d\ude00 emoji \ud83d\ude00', 'line\nbreak', 'tab\there', 'x\u00a0y', '\u0085NEL\u0085', 'Dept. of Math', 'MiXeD CaSe', '12345',
      '2026-10-09', 'a;b;c', 'TRUE', '\ufb01 ligature', 'NC\u00a0State', 'cr\rlf', 'a\u2028b', '  ', 'x', 'A b C d E',
      // (p2 sweep) runs of spaces; Greek with its final sigma; the sharp s's ss; entities an @@HTML cell may hold (and a plain
      // cell's literal "&eacute;", escaped once); a project ID shown as a link; text that turns into @@; U+FF21 against an emoji
      'Ann  Lee', '  Ann   Bo  Lee ', '\u039f\u0394\u039f\u03a3 \u03a3\u039f\u03a6\u039f\u03a3', 'STRASSE', '@@HTML<b>Caf&eacute;&nbsp;Bar &mdash; c&#8217;s &#x1F600; &bogus; &#0;</b>',
      '@@HTML<a class="resolver-link" href="x">2014-0685</a>', 'x@HTML&lt;b&gt;bold&lt;/b&gt;', 'x@@JSON[1,[2,3],true]', '\uff21', 'Caf&amp;eacute;', '\uff21\ud83d\ude00',
      // (calcfix) yes / no words, a percent, a linked amount
      'N', 'No', 'no', 'F', 'Y', '52.5%', '(12%)', '@@HTML<a href="x">1,234.50</a>', '@@HTML<b>2026-01-05</b>'];
    var LS = ['Smith; Jones', 'Smith;Jones;Lee', ' ; ', '', null, 'one', 'a|b|c', 'x;;y', ';lead', 'trail;', 'Ann Lee; Bo Ng; Cy Wu', 'R&amp;D; Ops'];
    var seed = 20261011;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    var rows = [];
    // every value meets every value as A and B at least once over the first rows
    for (var i = 0; i < V.length; i++) rows.push({ A: V[i], B: V[(i * 7 + 3) % V.length], C: V[(i * 11 + 5) % V.length], T: pick(['abc', 'ABC', 'Abc', '', 'z', 'TRUE']), D1: pick(DATES), D2: pick(DATES), mixedCase: V[(i * 5) % V.length], S: TX[i % TX.length], L: LS[(i * 3) % LS.length] });
    for (var j = 0; j < 360; j++) rows.push({ A: pick(V), B: pick(V), C: pick(V), T: pick(['abc', 'ABC', 'Abc', '', 'z', 'TRUE', 'FALSE', 'é']), D1: pick(DATES), D2: pick(DATES), mixedCase: pick(V), S: pick(TX), L: pick(LS) });
    R.rows = rows;
    var F = ['{A} + {B}', '{A} - {B}', '{A} * {B}', '{A} / {B}', '-{A}', '+{A}', '--{A}', '({A} + {B}) * {C}', '{A} / 3', 'ROUND({A})', 'ROUND({A}, 2)',
      'ROUND({A} / 7, 3)', 'ROUND({A}, -2)', 'ROUND({A}, {B})', 'ROUND({A}, 12)', 'IF({A} > {B}, "gt", "le")', 'IF({A}, 1, 0)', 'IF({T} = "abc", {A}, {B})',
      'IF({T} <> "ABC", "ne", "eq")', '{A} = {B}', '{A} >= {B}', '{T} < {A}', '{A} & {B}', '{T} & " " & {A}', '{D1} - {D2}', '{D1} + {A}', '{A} + {D1}',
      '{D1} - 30', 'DAYS({D1}, {D2})', '{D1} < {D2}', '{D1} = {D2}', 'IF({D1} > {D2}, {D1}, {D2})', '{D1} & ""', '{A} * 1000000', '{A} / 0', '1 / 3',
      '0.1 + 0.2', '{MIXEDCASE} + 1', '{mixedcase} * 2', '"x" & 1.5', 'IF({A} = "", "blank", "set")', '{A} = ""', 'ROUND({A} * 100) / 100', 'ROUND(1.005, 2)',
      'ROUND(2.5)', 'ROUND(-2.5)', '{A} * 0.1', '100 * {A} / {B}', 'IF({A} > 0, {A}, -{A}) & "!"', '{A} <> {B}', '{A} <= {B}', '{A} != {B}', '{A} < {B}',
      'IF({T}, "t", "f")', 'IF({A} > {B}, {A} > {C}, FALSE_COL_NOT)', '{D1} + 0.9', '{D1} - -1.9', '1e3', 'ROUND({A}, 2.9)', 'ROUND({A}, -11)',
      '{A}*{B}/{C}', '{ a } + 1', '{C} & {D1} & {T}', 'DAYS(TODAY(), {D1})', 'TODAY() & ""', 'TODAY() > {D1}', '"" & {A}', '{A} & ""',
      // (2026-11-26, calctext) the text functions, alone and together
      'LEN({S})', 'LOWER({S})', 'UPPER({S})', 'TRIM({S})', 'LEFT({S})', 'LEFT({S}, 3)', 'RIGHT({S}, 4)', 'MID({S}, 2, 3)', 'LEFT({S}, {A})', 'MID({S}, {A}, 2)',
      'RIGHT({S}, -1)', 'PART({L}, ";", 1)', 'PART({L}, ";", 2)', 'PART({L}, ";", -1)', 'PART({S}, " ", 2)', 'PART({L}, {T}, 1)', 'REPLACE({S}, "a", "A")',
      'REPLACE({S}, " ", "")', 'REPLACE({S}, {T}, "#")', 'CONTAINS({S}, "state")', 'STARTS({S}, "nc")', 'ENDS({S}, "y")', 'CONTAINS({S}, {T})', 'CONTAINS({S}, "")',
      'MATCHES({S}, "^\\w+$")', 'MATCHES({S}, "st.te")', 'MATCHES({S}, "\\s")', 'MATCHES({S}, "^.+$")', 'IN({T}, "abc", "z")', 'IN({A}, 1, 2.5, "abc")',
      'IN({D1}, "2026-10-09")', 'IFS({A} > 1, "big", {A} > 0, "small", TRUE, "none")', 'IFS({T} = "abc", {A})', 'IF(CONTAINS({S}, "o"), UPPER({S}), LOWER({S}))',
      'LEFT({A}, 2)', 'LEN({A})', 'LEN({D1})', 'UPPER({D1})', 'TRUE', 'IF(FALSE, 1, 2)', 'LOWER({S}) = "abc"', 'LEFT(UPPER({S}), 2) & "|" & RIGHT({L}, 1)',
      'LEN(TRIM({S}))', 'PART(UPPER({L}), ";", 2)', 'UPPER({S}) & LOWER({S})', 'MID({L}, 3, 5)',
      // (p2 sweep) the sweep's rules: white space separators, folded case, link IDs, entities, no @@ out, the browser's text
      // order, patterns once refused or now refused, exponents
      'PART({S}, " ", -1)', 'PART({S}, "  ", 1)', 'CONTAINS({S}, "\u03a3")', 'CONTAINS({S}, "STRASSE")', 'STARTS({S}, "strasse")', 'ENDS({S}, "\u03c3")',
      'IN({S}, "2014-0685", "x")', '{S} = "2014-0685"', 'IN({S}, "Duke & Co")', 'REPLACE({S}, "x", "@")', 'MID({S}, 2, 99)', 'IF({S} < "\ud83d\ude00", "lt", "ge")',
      'IF({S} < "\uff21", "lt", "ge")', 'MATCHES({S}, " ")', 'MATCHES({S}, "[^.]")', 'MATCHES({S}, "^[\\w-]+$")', 'MATCHES({S}, "^(\\d{3}-){2}\\d{4}$")',
      'LEN({S}) & "|" & UPPER({S})', '{A} * 1000000000000000000000000000000', 'MATCHES({S}, "(?:\\s){600}|a")', 'RIGHT({S}, 3) & LEFT({S}, 2)',
      // the chain rule: safe patterns with three open-ended repeats that cannot trade characters
      'MATCHES({S}, "^[^\\s]+ [^\\s]+ [^\\s]+$")', 'MATCHES({S}, "^\\s*\\d+\\s*$")', 'MATCHES({S}, "x{2,}y+z*")', 'MATCHES({S}, "^\\S+ \\S+$")',
      // (calcfix #7/#8) the cost rule: a repeat at the end, three after a ^, resets, bounded widths; (calcfix #20) N / No in IF
      'MATCHES({S}, ".*NC.*State.*")', 'MATCHES({S}, "^.*univ.*of.*$")', 'MATCHES({S}, "\\d+[a-z]+\\d+[a-z]+x")', 'MATCHES({S}, "^\\d+-\\d+-\\d+-\\d+$")',
      'MATCHES({S}, "\\w{0,50}\\w{0,50}\\w{0,50}!")', 'MATCHES({S}, "\\d+\\s*\\d+\\s*\\d+x")', 'IF({S}, "t", "f")',
      // (calcfix #19) a link cell in arithmetic and as a date
      '{S} + 1', 'DAYS({S}, "2026-01-01")'];
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
    // (2026-11-26, calctext) refused the same way in both: a pattern the engines read apart, from a column, unreadable; too
    // few arguments; TRUE( ) is no function
    sets.push({ id: 'textRefusals', defs: [{ name: 'TR1', formula: 'MATCHES({S}, "\\p{L}")' }, { name: 'TR2', formula: 'MATCHES({S}, {T})' },
      { name: 'TR3', formula: 'LEFT()' }, { name: 'TR4', formula: 'IFS(1)' }, { name: 'TR5', formula: 'UPPER({S})', format: 'text' }, { name: 'TR6', formula: 'IN({S})' },
      { name: 'TR7', formula: 'MATCHES({S}, "(")' }, { name: 'TR8', formula: 'TRUE()' }, { name: 'TR9', formula: 'LEN({TR5})' }] });
    // (p2 sweep) patterns both engines now refuse: backtracking for seconds a cell, classes PCRE refuses, a count PCRE
    // cannot hold, a control character
    sets.push({ id: 'rxRefusals', defs: [{ name: 'RX1', formula: 'MATCHES({S}, "^.*a.*a.*a.*b$")' }, { name: 'RX2', formula: 'MATCHES({S}, "^\\w*\\w*\\w*\\w*\\w*\\w*$")' },
      { name: 'RX3', formula: 'MATCHES({S}, "^(?:a|aa){26}$")' }, { name: 'RX4', formula: 'MATCHES({S}, "^(?:\\w+\\s?){9}$")' }, { name: 'RX5', formula: 'MATCHES({S}, "[\\w-.]")' },
      { name: 'RX6', formula: 'MATCHES({S}, "^[:digit:]+$")' }, { name: 'RX7', formula: 'MATCHES({S}, "(?:..){1000}")' }, { name: 'RX8', formula: 'MATCHES({S}, "(?:\\s){700}")' },
      { name: 'RX9', formula: 'MATCHES({S}, "a\u0001b")' }, { name: 'RX10', formula: 'MATCHES({S}, "[a-\\d]")' }, { name: 'RX11', formula: 'MATCHES({S}, "(a?){9}")' },
      { name: 'RX12', formula: 'MATCHES({S}, "[.a.]")' }, { name: 'RX13', formula: 'MATCHES({S}, "a*\\w*.*")' }, { name: 'RX14', formula: 'MATCHES({S}, "ok")' }] });
    // (p2 sweep) text functions read a formatted calculated column as it shows ("26.1%", "$1,000.00"); = IN and math its value;
    // (a date-format column's own cell is the date on the page and the pattern on the server by design: not in a parity set)
    sets.push({ id: 'shownText', defs: [{ name: 'PCT', formula: '{A} / 1000', format: 'percent' }, { name: 'CUR', formula: '{A} * 1000', format: 'currency' },
      { name: 'NUM', formula: '{A} / 7', format: 'number' },
      { name: 'T1', formula: 'CONTAINS({PCT}, "%")', format: 'text' }, { name: 'T2', formula: 'LEFT({CUR}, 1)', format: 'text' }, { name: 'T3', formula: 'LEN({NUM})', format: 'text' },
      { name: 'T4', formula: '{PCT} * 2' }, { name: 'T5', formula: 'IN({PCT}, 0.001, 0.002)', format: 'text' },
      { name: 'T7', formula: 'REPLACE({CUR}, ",", "")', format: 'text' }, { name: 'T8', formula: 'PART({PCT}, ".", 1)', format: 'text' }, { name: 'T9', formula: 'MATCHES({PCT}, "%$")', format: 'text' }] });
    // (calcfix #4) a pass-through column gives its value to the columns that read it (the cell "0.25" as Percent, not its 25%)
    sets.push({ id: 'passThrough', defs: [{ name: 'PP', formula: '{A}', format: 'percent' }, { name: 'PPX', formula: '{PP} * 2' },
      { name: 'PC', formula: '{A}', format: 'currency' }, { name: 'PCX', formula: '{PC} * 1000' }, { name: 'PN', formula: '{S}', format: 'number' }, { name: 'PNX', formula: '{PN} + 1' }] });
    // (2026-10-22) names as typed: the label is the row's key in both engines (a label that is not the name
    // in another case is dropped)
    sets.push({ id: 'labels', defs: [{ name: 'Net Amount', formula: '{A} + 1' }, { name: 'twice', formula: '{net_amount} * 2', format: 'currency' },
      { name: 'X1', label: 'Elsewhere', formula: '{A}' }, { name: 'lowerOnly', formula: '{A} * 3' }] });   // (the rows have a real mixedCase)
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
    // (2026-10-19, round 5) a DATE value: J1 carries ASOF (read as a date from its value), J2 a
    // bounded CUT in US spelling, J3 / J4 use them, J5 multiplies a date (blank), J6's value is
    // neither a number nor a date (dropped, J6 left out), J7's is over its highest (kept to it)
    sets.push({ id: 'dateInputs', defs: [
      { name: 'J1', formula: 'DAYS({@ASOF}, {D1})', input: { name: 'ASOF', value: '2026-10-31' } },
      { name: 'J2', formula: 'IF({D1} < {@CUT}, "before", "after")', format: 'text', input: { name: 'cut', kind: 'date', value: '10/15/2026', min: '2026-01-01', max: '2026-12-31', step: 7 } },
      { name: 'J3', formula: '{@ASOF} + 30' }, { name: 'J4', formula: '{@CUT} & ""', format: 'text' }, { name: 'J5', formula: '{A} * {@ASOF}' },
      { name: 'J6', formula: '{A} + {@NOPE}', input: { name: 'NOPE', value: '2026-13-45' } },
      { name: 'J7', formula: 'DAYS({@LATE}, {D2})', input: { name: 'LATE', kind: 'date', value: '2027-06-01', max: '2026-12-31' } }] });
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
