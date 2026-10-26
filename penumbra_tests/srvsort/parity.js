// srvsort suite - the page's side (2026-10-24). The page's OWN code, lifted out of js/main.js by run.py into
// lifted.js: _pnbStateSortByName as window.__SS, and the query success handler's own lines - the header map
// (newColumnNames -> columnNameToOriginalIndex) and the state load's by-name block (ldsort) - as window.__LOADSORT.
// A corpus of saved states and results: each fixture is saved the way the page saves (a sort level = a heading
// click: colIdentifier = its data('colname'), colIndex = its data('column'), the column's place in the page's
// result; columnOrder / visibleColumns / layoutColumnNames as buildStateObject writes them), then loaded against the
// result NOW. run.py hands the corpus and the page's answers to the PHP side: parity.php (the twin in
// penumbra_layout.php), hooks.php (index.php ?json=1's own sort block) and stubhook.php (the stub's own).
(function () {
  var R = { fx: [], errors: [] };
  try {
    var $ = window.jQuery;
    var BASE = ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_CODE', 'V_STATUS', 'V_TIE', 'H_NOTE'];
    function without(a, x) { return a.filter(function (n) { return x.indexOf(n) < 0; }); }
    function renamed(a, from, to) { return a.map(function (n) { return n === from ? to : n; }); }
    function rowJson(cols) {   // one row as query.php sends it: the keys in the SQL's order
      return '{' + cols.map(function (c) { return JSON.stringify(String(c)) + ':' + JSON.stringify('v_' + c); }).join(',') + '}';
    }
    function keysOf(cols) { return Object.keys(JSON.parse(rowJson(cols))); }
    // what a click on the heading of column n puts in the sort as its colIdentifier (main.js: $header.data("colname"))
    function heading(n) { return $('<th>').attr('data-colname', String(n).toUpperCase()).data('colname'); }
    var J = { '__J': ['__JOURNAL_TOGGLE__K1', '__JOURNAL_TOGGLE__k1'], '__JBY': ['__JOURNAL_BY__K1', '__JOURNAL_BY__k1'] };
    // A save against the page's result then (`saved` in the SQL's order, then the calculated columns the page had
    // appended, `savedCalc`): the headings in display order (`order` first, the rest after it in place order), the
    // shown ones ('#' first), each as its PLACE in that result's keys; the names at each place unless names ===
    // false; the sort levels as heading clicks put them ('#' and the journal's as their headings carry them)
    function save(f) {
      var k = keysOf(f.saved.concat(f.savedCalc || []));
      var place = function (n) { var i = k.indexOf(n); if (i < 0) throw new Error('fixture ' + f.id + ': no column ' + n); return i; };
      var ord = (f.order || []).map(place);
      k.forEach(function (n, i) { if (ord.indexOf(i) < 0) ord.push(i); });
      var st = { query: 'SELECT V_ID, V_NAME FROM SRVSORT_FIXTURE', reportTitle: 'srvsort fixture', theme: 'theme-default',
                 columnOrder: ord, visibleColumns: ['#'].concat((f.vis || k.slice(0, 6)).map(function (n) { return typeof n === 'number' ? n : place(n); })) };
      if (f.names !== false) st.layoutColumnNames = k.map(function (n) { return String(n).toUpperCase(); });
      st.sortCriteria = (f.sort || []).map(function (lv) {
        var n = lv[0], dir = lv[1];
        if (n === '#') return { colIdentifier: '#', colIndex: '#', direction: dir };
        if (Object.prototype.hasOwnProperty.call(J, n)) return { colIdentifier: J[n][0], colIndex: J[n][1], direction: dir };   // not J[n]: a column named __proto__
        return { colIdentifier: heading(n), colIndex: place(n), direction: dir };
      });
      var defs = f.calcDefs || (f.savedCalc || []).map(function (n) { return { name: n }; });
      if (defs.length) st.calcColumns = defs.map(function (d) {
        // (a formula that names no column works out on any result: the fixture's savedCalc / nowCalc say which do)
        var o = { name: d.name, formula: d.formula === undefined ? '2 * 3' : d.formula, format: 'number' };
        if (d.input) o.input = d.input;
        return o;
      });
      return st;
    }
    var CASE = ['V_ID', 'v_amount', 'V_NAME', 'V_AMOUNT', 'V_TIE', 'V_DATE', 'V_CODE', 'H_NOTE'];
    var WIDE = []; for (var w = 1; w <= 83; w++) WIDE.push('W' + w);
    var NUMS = ['X', '2021', '01', '-5', '0', '4294967295', '4294967294', '7', 'Y'];
    var SHUF = ['V_STATUS', 'V_AMOUNT', 'V_ID', 'V_NAME', 'V_TIE', 'V_DATE', 'V_CODE', 'H_NOTE'];
    // kind: NEW = the server read the sort by place and sorted by another column than the page (red on live);
    // GUARD = the same answer before and after (green on live too). page: false = the page and the server differ
    // for reasons of their own, before and after (a pivot sorts the pivot, a sort that is not a list): only "as
    // before" is checked. stub: false = not a stub's case (a ?state= link). The page's own answer is in plan.
    var FX = [
      // ---- the same result: as before
      { id: 'same', saved: BASE, now: BASE, sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'same2', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], kind: 'GUARD' },
      { id: 'hidden', saved: BASE, now: BASE, sort: [['H_NOTE', 'desc']], vis: BASE.slice(0, 5), kind: 'GUARD' },
      { id: 'oldsame', saved: BASE, now: BASE, sort: [['V_DATE', 'desc']], names: false, kind: 'GUARD' },
      { id: 'dup', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_TIE', 'desc'], ['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'hashlast', saved: BASE, now: BASE, sort: [['V_TIE', 'desc'], ['#', 'asc']], kind: 'GUARD' },
      { id: 'casesame', saved: CASE, now: CASE, sort: [['v_amount', 'desc']], kind: 'GUARD' },
      { id: 'numlast', saved: BASE, now: BASE.concat(['2021']), sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      // ---- renamed in place (nothing came or went): its place still holds it, as always
      { id: 'renamed', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'renamed2', saved: BASE, now: renamed(BASE, 'V_AMOUNT', 'V_AMT'), sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], kind: 'GUARD' },
      // an old save that named the SQL's own column (mattpinsbycollege: PER_Last_Name, aliased 'Last Name')
      { id: 'oldname', saved: BASE, now: BASE, sort: [['V_NAME', 'asc']], kind: 'GUARD', edit: function (st) { st.sortCriteria[0].colIdentifier = 'PER_Last_Name'; } },
      // the sorted column gone and one more at the end: nothing came or went by count - its place holds the next
      { id: 'gonecount', saved: BASE, now: without(BASE, ['V_CODE']).concat(['V_NEW']), sort: [['V_CODE', 'asc']], kind: 'GUARD' },
      // '#' and the journal's entries in the column order are not places
      { id: 'coextra', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'desc']], kind: 'GUARD',
        edit: function (st) { st.columnOrder.splice(1, 0, '#', '__JOURNAL_NOTES', '__JOURNAL_TOGGLE__k1'); } },
      // ---- the SQL put a column in front, moved or dropped one: by name
      { id: 'front', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW' },
      { id: 'frontmulti', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], kind: 'NEW' },
      { id: 'moved', saved: BASE, now: SHUF, sort: [['V_TIE', 'desc'], ['V_NAME', 'asc']], kind: 'NEW' },
      { id: 'oldmoved', saved: BASE, now: SHUF, sort: [['V_DATE', 'asc']], names: false, kind: 'NEW' },
      { id: 'dropped', saved: BASE, now: without(BASE, ['V_ID']).concat(['V_X1', 'V_X2']), sort: [['V_NAME', 'asc']], kind: 'NEW' },
      { id: 'hiddenfront', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['H_NOTE', 'desc']], vis: BASE.slice(0, 5), kind: 'NEW' },
      // a name gone (the count changed too): the page drops that level, and the next one sorts
      { id: 'gone', saved: BASE, now: without(BASE, ['V_CODE']), sort: [['V_CODE', 'asc']], kind: 'NEW' },
      { id: 'gonepartial', saved: BASE, now: without(BASE, ['V_CODE']), sort: [['V_CODE', 'asc'], ['V_NAME', 'desc']], kind: 'NEW' },
      { id: 'renamedfront', saved: BASE, now: ['V_NEW'].concat(renamed(BASE, 'V_NAME', 'V_FULLNAME')), sort: [['V_NAME', 'asc']], kind: 'NEW' },
      { id: 'oldnamefront', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW',
        edit: function (st) { st.sortCriteria[0].colIdentifier = 'PER_Last_Name'; } },
      // a name gone whose place another level names now: dropped (only one level on a column)
      { id: 'namedplace', saved: BASE, now: ['V_ID', 'V_X1', 'V_AMOUNT', 'V_DATE', 'V_NAME', 'V_STATUS', 'V_TIE', 'H_NOTE'],
        sort: [['V_CODE', 'asc'], ['V_NAME', 'desc']], kind: 'NEW' },
      // ---- a column named like a number: the page's places put it first; PHP keeps it where the SQL put it
      { id: 'num2021', saved: BASE.concat(['2021']), now: BASE.concat(['2021']), sort: [['V_NAME', 'asc']], kind: 'NEW' },
      { id: 'num2021sort', saved: BASE.concat(['2021']), now: BASE.concat(['2021']), sort: [['2021', 'desc']], kind: 'NEW' },
      { id: 'nummany', saved: NUMS, now: ['4294967294', 'Y', '01', 'X', '-5', '7', 'NEW', '0', '4294967295', '2021'],
        sort: [['-5', 'asc'], ['7', 'desc']], vis: NUMS.slice(0, 5), kind: 'NEW' },
      { id: 'numrenamed', saved: ['A_ID', 'A_NAME', '2021', 'A_AMT'], now: ['A_ID', 'A_NAME2', '2021', 'A_AMT'], sort: [['A_NAME', 'asc']],
        vis: ['A_ID', 'A_NAME', '2021'], kind: 'NEW' },
      // ---- two columns named alike but for the case: a level stays at its place while its name is there
      { id: 'casemoved', saved: CASE, now: ['V_NEW'].concat(CASE), sort: [['v_amount', 'desc'], ['V_TIE', 'asc']], kind: 'NEW' },
      { id: 'caseswap', saved: CASE, now: ['V_ID', 'V_AMOUNT', 'V_NAME', 'v_amount', 'V_TIE', 'V_DATE', 'V_CODE', 'H_NOTE'], sort: [['V_AMOUNT', 'asc']], kind: 'GUARD' },
      // ---- '#' and the journal's levels pass as they are (the journal's: before its names are mapped)
      { id: 'hashfront', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'desc'], ['#', 'asc']], kind: 'NEW' },
      { id: 'journal', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['__J', 'desc'], ['V_NAME', 'asc']], journal: ['Done', 'Done by'], kind: 'NEW' },
      // (the toggle's 1/0 ties, so the renamed level decides within them; the journal's columns are not the page's: not counted)
      { id: 'journalren', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['__J', 'asc'], ['V_NAME', 'desc']],
        journal: ['Done', 'Done by', 'Notes'], kind: 'GUARD' },
      { id: 'journalby', saved: BASE, now: BASE, sort: [['__JBY', 'desc'], ['V_NAME', 'asc']], journal: ['Done', 'Done by'], kind: 'GUARD' },
      // ---- the report's calculated columns (at the END of the page's rows and the API's; a stub has none)
      { id: 'calc', saved: BASE, savedCalc: ['MARGIN'], now: BASE, sort: [['MARGIN', 'desc']], kind: 'GUARD' },
      { id: 'calcren', saved: BASE, savedCalc: ['MARGIN'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc'], ['MARGIN', 'desc']], kind: 'GUARD' },
      { id: 'calcfront', saved: BASE, savedCalc: ['MARGIN'], now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW' },
      { id: 'calcfront2', saved: BASE, savedCalc: ['MARGIN'], now: ['V_NEW'].concat(BASE), sort: [['MARGIN', 'desc'], ['V_TIE', 'asc']], kind: 'NEW' },
      // ...one named like a real column (the page leaves it out), one whose name is no column name: never columns
      { id: 'calcclash', saved: BASE, calcDefs: [{ name: 'V_STATUS' }, { name: '9X' }, { name: 'net margin' }], savedCalc: ['NET_MARGIN'],
        now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'calcnoformula', saved: BASE, calcDefs: [{ name: 'MARGIN', formula: '  ' }], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      // ...one whose formula names a column the SQL has since renamed: the page leaves it out now (nowCalc), so
      // the count that decides a renamed level is the query's alone (review, 2026-10-24)
      { id: 'calcgone', saved: ['V_ID', 'V_NAME', 'V_CODE'], calcDefs: [{ name: 'X', formula: '{V_NAME} * 2' }], savedCalc: ['X'], nowCalc: [],
        now: ['V_ID', 'V_NAME2', 'V_D', 'V_F'], sort: [['V_CODE', 'desc']], vis: ['V_ID', 'V_NAME', 'V_CODE'], kind: 'GUARD' },
      { id: 'calcgone2', saved: ['V_ID', 'V_NAME', 'V_CODE'], calcDefs: [{ name: 'X', formula: '{V_NAME} * 2' }], savedCalc: ['X'], nowCalc: [],
        now: ['V_ID', 'V_NAME2', 'V_CODE'], sort: [['V_NAME', 'desc']], vis: ['V_ID', 'V_NAME', 'V_CODE'], kind: 'NEW' },
      // ...one that uses another that went (a chain), two that use each other (never worked out), an adjustable
      // value another column carries and one nothing carries, the same name twice (the later one, in the earlier's
      // place), braces inside quoted text (no column)
      { id: 'calcchain', saved: ['V_ID', 'V_NAME', 'V_CODE'], calcDefs: [{ name: 'X', formula: '{V_NAME} * 2' }, { name: 'Y', formula: '{x} + 1' }],
        savedCalc: ['X', 'Y'], nowCalc: [], now: ['V_ID', 'V_NAME2', 'V_D', 'V_F', 'V_G'], sort: [['V_CODE', 'desc']], vis: ['V_ID', 'V_NAME', 'V_CODE'], kind: 'GUARD' },
      { id: 'calcloop', saved: BASE, calcDefs: [{ name: 'X', formula: '{Y} + 1' }, { name: 'Y', formula: '{ X } + 1' }], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'),
        sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'calcinput', saved: BASE, calcDefs: [{ name: 'R', formula: '{V_AMOUNT}', input: { name: 'rate', value: 2 } }, { name: 'X', formula: '{V_AMOUNT} * {@ RATE }' }],
        savedCalc: ['R', 'X'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'calcnoinput', saved: BASE, calcDefs: [{ name: 'X', formula: '{V_AMOUNT} * {@RATE}' }], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'),
        sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'calcdup', saved: BASE, calcDefs: [{ name: 'MARGIN', formula: '{V_GONE} * 2' }, { name: 'Z', formula: '{V_TIE}' }, { name: 'margin', formula: '{V_AMOUNT} * 2' }],
        savedCalc: ['MARGIN', 'Z'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      { id: 'calcquote', saved: BASE, calcDefs: [{ name: 'Q', formula: '"{V_GONE}" & {V_AMOUNT}' }], savedCalc: ['Q'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'),
        sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      // the viewer's own calculated column (not the report's): the page leaves it out of the count; the API never has it
      { id: 'viewercalc', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), pageOnly: ['MYCALC'], sort: [['V_NAME', 'asc']], kind: 'GUARD' },
      // ---- a ?state= link (no report): its calculated columns are the viewer's own there - the page's count
      // leaves them out of the result's side only, so a renamed level is dropped (stub: false - a stub is a report's)
      { id: 'link', link: true, saved: BASE, savedCalc: ['MARGIN'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'NEW', stub: false },
      { id: 'linkfront', link: true, saved: BASE, savedCalc: ['MARGIN'], now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'desc']], kind: 'NEW', stub: false },
      // ...but only the ones the page worked out: one named like a real column never was, so it counts (review)
      { id: 'linkclash', link: true, saved: ['V_ID', 'V_AMOUNT', 'V_CODE'], calcDefs: [{ name: 'V_AMOUNT', formula: '{V_ID} * 2' }], now: ['V_ID', 'V_AMOUNT', 'V_CODE'],
        sort: [['V_CODE', 'desc']], vis: ['V_ID', 'V_AMOUNT', 'V_CODE'], kind: 'GUARD', stub: false, edit: function (st) { st.sortCriteria[0].colIdentifier = 'OLDC'; } },
      // ...a name gone whose place holds such a column (hand-edited place: one past the saved ones): not kept on it
      { id: 'linkmine', link: true, saved: BASE, savedCalc: ['MARGIN'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME').concat(['V_NEW']), sort: [['V_NAME', 'asc']],
        kind: 'NEW', stub: false, edit: function (st) { st.sortCriteria = [{ colIdentifier: 'V_GONE', colIndex: 9, direction: 'asc' }, st.sortCriteria[0]]; } },
      // ---- a pivot's chain names the pivot's own headings: as saved (by place, as before)
      { id: 'pivot', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'GUARD', page: false,
        edit: function (st) { st.pivot = { rows: ['V_STATUS'], cols: [], vals: [{ field: 'V_AMOUNT', agg: 'sum' }] }; } },
      { id: 'pivotempty', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'GUARD', page: false, edit: function (st) { st.pivot = {}; } },
      { id: 'pivotnull', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW', edit: function (st) { st.pivot = null; } },
      { id: 'pivotfalse', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW', edit: function (st) { st.pivot = false; } },
      // ---- shapes only a hand edit writes
      { id: 'nolist', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'GUARD', page: false,
        edit: function (st) { st.sortCriteria = { first: st.sortCriteria[0] }; } },
      { id: 'emptysort', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [], kind: 'GUARD' },
      { id: 'nosort', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [], kind: 'GUARD', edit: function (st) { delete st.sortCriteria; } },
      { id: 'noident', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_NAME', 'desc']], kind: 'NEW',
        edit: function (st) { delete st.sortCriteria[0].colIdentifier; } },
      { id: 'blankident', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_NAME', 'desc']], kind: 'NEW',
        edit: function (st) { st.sortCriteria[0].colIdentifier = ''; st.sortCriteria.unshift(null, 'V_ID', 5, [3]); } },
      { id: 'coabsent', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'NEW', edit: function (st) { delete st.columnOrder; } },
      { id: 'weird', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], kind: 'NEW',
        edit: function (st) { st.sortCriteria[0].colIndex = ' 6'; st.sortCriteria[1].colIndex = [2]; } },
      { id: 'weird2', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], kind: 'GUARD',
        edit: function (st) { st.sortCriteria[0].colIndex = '01'; } },
      { id: 'dirupper', saved: BASE, now: BASE, sort: [['V_NAME', 'asc']], kind: 'NEW', edit: function (st) { st.sortCriteria[0].direction = 'DESC'; } },
      { id: 'dirnone', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW', edit: function (st) { delete st.sortCriteria[0].direction; } },
      // ---- names of every kind
      { id: 'lowerident', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], kind: 'NEW', edit: function (st) { st.sortCriteria[0].colIdentifier = 'v_name'; } },
      { id: 'unicode', saved: ['Montant_é', 'straße', 'Ünïcode', 'V_ID', 'V_TIE'], now: ['V_ID', 'Ünïcode', 'V_NEW', 'straße', 'Montant_é', 'V_TIE'],
        sort: [['straße', 'asc'], ['Ünïcode', 'desc']], kind: 'NEW', mb: true },
      { id: 'proto', saved: ['__proto__', 'constructor', 'toString', 'V_ID', 'hasOwnProperty'], now: ['hasOwnProperty', 'V_ID', 'toString', 'constructor', '__proto__'],
        sort: [['__proto__', 'asc'], ['toString', 'desc']], kind: 'NEW' },
      { id: 'wide', saved: WIDE, now: ['W0'].concat(without(WIDE, ['W40'])), sort: [['W20', 'desc'], ['W70', 'asc']], vis: WIDE.slice(0, 9), kind: 'NEW' }
    ];
    // ---- fuzz (kind FUZZ: compared in every half, left out of the live control): seeded, so a red names its case.
    // A save against a random result (1-3 levels, sometimes '#'; sometimes a calculated column), then the SQL
    // changes it - drops, new columns (in front, between, at the end), a rename in place, a shuffle - over names that
    // include case duplicates, number-like keys and prototype names; now and then a ?state= link
    var seed = 20261024;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function ri(n) { return Math.floor(rnd() * n); }
    function shuffled(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = ri(i + 1), t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
    var POOL = ['A_ID', 'B_NAME', 'C_AMT', 'D_DATE', 'E_CODE', 'F_FLAG', 'G_TEXT', 'H_NUM', 'a_id', 'b_name', '2021', '0', '7', '01', '-5',
                '4294967294', '4294967295', '__proto__', 'constructor', 'Ünï', 'straße', 'X_1', 'Y_2', 'Z_3'];
    var fresh = 0;
    for (var z = 0; z < 200; z++) {
      var saved = shuffled(POOL).slice(0, 3 + ri(9));
      var calc = rnd() < 0.25 ? ['CALC_' + (1 + ri(3))] : [];
      var pick = shuffled(saved.concat(calc)), sort = [];
      for (var q = 0, nl = 1 + ri(3); q < nl && q < pick.length; q++) sort.push([pick[q], rnd() < 0.5 ? 'asc' : 'desc']);
      if (rnd() < 0.15) sort.push(['#', 'asc']);
      var now = saved.slice(), op = ri(8);
      if (op === 0 || op === 5) { var nd = 1 + ri(2); for (var d = 0; d < nd && now.length > 1; d++) now.splice(ri(now.length), 1); }
      if (op === 1 || op === 5 || op === 6) { var ni = 1 + ri(2); for (var e = 0; e < ni; e++) { var nn = POOL.filter(function (n) { return now.indexOf(n) < 0; }); now.splice(ri(now.length + 1), 0, nn.length && rnd() < 0.5 ? nn[ri(nn.length)] : 'N' + (++fresh)); } }
      if (op === 2) { var at = ri(now.length); now[at] = 'R' + (++fresh); }
      if (op === 3 || op === 6) now = shuffled(now);
      if (op === 4) { var a2 = ri(now.length), b2 = ri(now.length), t2 = now[a2]; now[a2] = now[b2]; now[b2] = t2; }
      var all = saved.concat(now), lk = rnd() < 0.1;
      FX.push({ id: 'fz' + z, saved: saved, savedCalc: calc, now: now, sort: sort, order: shuffled(saved), vis: shuffled(saved).slice(0, 1 + ri(saved.length)),
                names: rnd() < 0.85, link: lk, stub: !lk, kind: 'FUZZ', mb: /[^\x20-\x7e]/.test(all.join('')) });
    }
    var SS = window.__SS, LOAD = window.__LOADSORT;
    if (!SS || !LOAD) throw new Error('lifted.js did not load: ' + (window.__LIFT_ERR || '?'));
    var str = function (v) { return v === undefined ? '__undefined__' : String(v); };
    FX.forEach(function (f) {
      var pageCalc = f.nowCalc || f.savedCalc || [];
      var o = { id: f.id, kind: f.kind, page: f.page !== false, stub: f.stub !== false, mb: !!f.mb, link: !!f.link,
                journal: f.journal || [], calc: pageCalc, pageOnly: f.pageOnly || [] };
      try {
        var st = save(f);
        if (f.edit) f.edit(st);
        o.state = JSON.parse(JSON.stringify(st));         // as the server and the page decode it
        o.rowNow = rowJson(f.now);                         // the query's row now
        // the page's row: the query's, then its calculated columns (the report's - or the link's - and the viewer's own)
        var pageRow = JSON.parse(rowJson(f.now.concat(pageCalc, o.pageOnly)));
        var mine = Object.create(null);
        (f.link ? pageCalc : []).concat(o.pageOnly).forEach(function (n) { mine[String(n).toUpperCase()] = true; });
        var isCalc = function (n) { return mine[String(n || '').toUpperCase()] === true; };
        var ds = JSON.parse(JSON.stringify(st));
        // the state load: sortCriteria = decodedState.sortCriteria when it is an array (main.js), a pivot pending
        var sc = (ds.sortCriteria && Array.isArray(ds.sortCriteria)) ? ds.sortCriteria : [];
        var pg = LOAD([pageRow], ds, sc, ds.pivot ? ds.pivot : null, isCalc);
        o.pageNames = pg.names;
        o.notices = pg.notices;
        // the columns the page sorts by, in order: a place -> the column there; '#' and a journal heading's as they are
        o.plan = (Array.isArray(pg.sortCriteria) ? pg.sortCriteria : []).map(function (c) {
          var dir = (c && c.direction === 'asc') ? 'asc' : 'desc';       // sortRows: crit.direction === 'asc' ? 1 : -1
          if (c && typeof c.colIndex === 'number') return { col: pg.names[c.colIndex], dir: dir };
          return { virt: c ? str(c.colIndex) : '__null__', dir: dir };
        });
        o.planRaw = JSON.parse(JSON.stringify(pg.sortCriteria || []));
        // _pnbStateSortByName itself, for the twin entry for entry (savedCount as the load's block works it out)
        var co = Array.isArray(ds.columnOrder) ? ds.columnOrder.filter(function (x) { return /^\d+$/.test(String(x)); }).length : -1;
        o.savedCount = co;
        if (Array.isArray(ds.sortCriteria) && ds.sortCriteria.length) {
          var r = SS(JSON.parse(JSON.stringify(ds.sortCriteria)), pg.nameToIdx, co, isCalc);
          o.direct = { kept: r.kept.map(function (c) { return { id: str(c.colIdentifier), at: typeof c.colIndex === 'number' ? c.colIndex : 'V:' + str(c.colIndex), dir: str(c.direction) }; }),
                       dropped: r.dropped.map(str) };
        } else { o.direct = null; }
      } catch (e) { o.error = String(e && e.stack || e); }
      R.fx.push(o);
    });
  } catch (e) { R.errors.push(String(e && e.stack || e)); }
  window.__PARITY = R;
  window.__HCDONE = true;
})();
