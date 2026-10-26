// schedsort suite - the page's side (2026-10-24). srvsort's corpus (penumbra_tests\srvsort\parity.js, copied here
// with its saves and its page code as they are) and the scheduler's own cases. The page's OWN code, lifted out of
// js/main.js by run.py into lifted.js: _pnbStateSortByName as window.__SS, and the query success handler's own lines -
// the header map (newColumnNames -> columnNameToOriginalIndex) and the state load's by-name block (ldsort) - as
// window.__LOADSORT. Each fixture is saved the way the page saves (a sort level = a heading click: colIdentifier = its
// data('colname'), colIndex = its data('column'), the column's place in the page's result; columnOrder /
// visibleColumns / layoutColumnNames as buildStateObject writes them), then loaded against the result NOW. run.py hands
// the corpus and the page's answers to sched.php: schedule_runner.php's own functions (a mirror, never the runner)
// sort the rows a scheduled run has, through apply_state_logic, a custom template's source and a task filter.
// kind (the scheduler's): NEW = the scheduler sorted by another column than the page before schedsort (by the name
// as an exact row key: red on live); GUARD = the same rows before and after (green on live too). page: false = the
// page and the scheduler differ for reasons of their own (a pivot sorts the pivot; a sort that is not a list): only
// "as before" is checked. A ?state= link is not a scheduled report: link fixtures are left out (sched: false).
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
      var st = { query: 'SELECT V_ID, V_NAME FROM SCHEDSORT_FIXTURE', reportTitle: 'schedsort fixture', theme: 'theme-default',
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
      // a custom sort order, keyed as the page keys it (the heading's data-colname)
      if (f.custom) st.customSortOrders = f.custom;
      return st;
    }
    var CASE = ['V_ID', 'v_amount', 'V_NAME', 'V_AMOUNT', 'V_TIE', 'V_DATE', 'V_CODE', 'H_NOTE'];
    var WIDE = []; for (var w = 1; w <= 83; w++) WIDE.push('W' + w);
    var NUMS = ['X', '2021', '01', '-5', '0', '4294967295', '4294967294', '7', 'Y'];
    var SHUF = ['V_STATUS', 'V_AMOUNT', 'V_ID', 'V_NAME', 'V_TIE', 'V_DATE', 'V_CODE', 'H_NOTE'];
    // the scheduler's own: names as an MSSQL result or a quoted alias keeps them (mattpinsbycollege, alm-pivot)
    var MIX = ['ID', 'Last Name', 'First Name', 'Amount', 'Tie Group', 'Email', 'Record Type', 'Period'];
    var FX = [
      // ======== srvsort's corpus (its ids and saves), each with the SCHEDULER's kind (sk)
      // ---- the same result
      { id: 'same', saved: BASE, now: BASE, sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'same2', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], sk: 'GUARD' },
      { id: 'hidden', saved: BASE, now: BASE, sort: [['H_NOTE', 'desc']], vis: BASE.slice(0, 5), sk: 'GUARD' },
      { id: 'oldsame', saved: BASE, now: BASE, sort: [['V_DATE', 'desc']], names: false, sk: 'GUARD' },
      { id: 'dup', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_TIE', 'desc'], ['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'hashlast', saved: BASE, now: BASE, sort: [['V_TIE', 'desc'], ['#', 'asc']], sk: 'GUARD' },
      // (the heading of v_amount names V_AMOUNT: the page keeps its place; the name as a key was the other column)
      { id: 'casesame', saved: CASE, now: CASE, sort: [['v_amount', 'desc']], sk: 'NEW' },
      { id: 'numlast', saved: BASE, now: BASE.concat(['2021']), sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      // ---- renamed in place (nothing came or went): its place still holds it - a name the rows lack sorted nothing
      { id: 'renamed', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'renamed2', saved: BASE, now: renamed(BASE, 'V_AMOUNT', 'V_AMT'), sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], sk: 'NEW' },
      { id: 'oldname', saved: BASE, now: BASE, sort: [['V_NAME', 'asc']], sk: 'NEW', edit: function (st) { st.sortCriteria[0].colIdentifier = 'PER_Last_Name'; } },
      { id: 'gonecount', saved: BASE, now: without(BASE, ['V_CODE']).concat(['V_NEW']), sort: [['V_CODE', 'asc']], sk: 'NEW' },
      { id: 'coextra', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'desc']], sk: 'NEW',
        edit: function (st) { st.columnOrder.splice(1, 0, '#', '__JOURNAL_NOTES', '__JOURNAL_TOGGLE__k1'); } },
      // ---- the SQL put a column in front, moved or dropped one: the scheduler read the name already
      { id: 'front', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'frontmulti', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], sk: 'GUARD' },
      { id: 'moved', saved: BASE, now: SHUF, sort: [['V_TIE', 'desc'], ['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'oldmoved', saved: BASE, now: SHUF, sort: [['V_DATE', 'asc']], names: false, sk: 'GUARD' },
      { id: 'dropped', saved: BASE, now: without(BASE, ['V_ID']).concat(['V_X1', 'V_X2']), sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'hiddenfront', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['H_NOTE', 'desc']], vis: BASE.slice(0, 5), sk: 'GUARD' },
      { id: 'gone', saved: BASE, now: without(BASE, ['V_CODE']), sort: [['V_CODE', 'asc']], sk: 'GUARD' },
      { id: 'gonepartial', saved: BASE, now: without(BASE, ['V_CODE']), sort: [['V_CODE', 'asc'], ['V_NAME', 'desc']], sk: 'GUARD' },
      { id: 'renamedfront', saved: BASE, now: ['V_NEW'].concat(renamed(BASE, 'V_NAME', 'V_FULLNAME')), sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'oldnamefront', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD',
        edit: function (st) { st.sortCriteria[0].colIdentifier = 'PER_Last_Name'; } },
      { id: 'namedplace', saved: BASE, now: ['V_ID', 'V_X1', 'V_AMOUNT', 'V_DATE', 'V_NAME', 'V_STATUS', 'V_TIE', 'H_NOTE'],
        sort: [['V_CODE', 'asc'], ['V_NAME', 'desc']], sk: 'GUARD' },
      // ---- a column named like a number: a heading's data() reads it as a number, a PHP key is one too
      { id: 'num2021', saved: BASE.concat(['2021']), now: BASE.concat(['2021']), sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'num2021sort', saved: BASE.concat(['2021']), now: BASE.concat(['2021']), sort: [['2021', 'desc']], sk: 'GUARD' },
      { id: 'nummany', saved: NUMS, now: ['4294967294', 'Y', '01', 'X', '-5', '7', 'NEW', '0', '4294967295', '2021'],
        sort: [['-5', 'asc'], ['7', 'desc']], vis: NUMS.slice(0, 5), sk: 'GUARD' },
      { id: 'numrenamed', saved: ['A_ID', 'A_NAME', '2021', 'A_AMT'], now: ['A_ID', 'A_NAME2', '2021', 'A_AMT'], sort: [['A_NAME', 'asc']],
        vis: ['A_ID', 'A_NAME', '2021'], sk: 'NEW' },
      // ---- two columns named alike but for the case: a level stays at its place while its name is there
      { id: 'casemoved', saved: CASE, now: ['V_NEW'].concat(CASE), sort: [['v_amount', 'desc'], ['V_TIE', 'asc']], sk: 'GUARD' },
      { id: 'caseswap', saved: CASE, now: ['V_ID', 'V_AMOUNT', 'V_NAME', 'v_amount', 'V_TIE', 'V_DATE', 'V_CODE', 'H_NOTE'], sort: [['V_AMOUNT', 'asc']], sk: 'NEW' },
      // ---- '#' and the journal's levels pass as they are (the scheduler maps the journal's onto their labels first)
      { id: 'hashfront', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'desc'], ['#', 'asc']], sk: 'GUARD' },
      { id: 'journal', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['__J', 'desc'], ['V_NAME', 'asc']], journal: ['Done', 'Done by'], sk: 'GUARD' },
      { id: 'journalren', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['__J', 'asc'], ['V_NAME', 'desc']],
        journal: ['Done', 'Done by', 'Notes'], sk: 'NEW' },
      { id: 'journalby', saved: BASE, now: BASE, sort: [['__JBY', 'desc'], ['V_NAME', 'asc']], journal: ['Done', 'Done by'], sk: 'GUARD' },
      // ---- the report's calculated columns (at the END of the page's rows and the scheduler's: calcsrv)
      { id: 'calc', saved: BASE, savedCalc: ['MARGIN'], now: BASE, sort: [['MARGIN', 'desc']], sk: 'GUARD' },
      { id: 'calcren', saved: BASE, savedCalc: ['MARGIN'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc'], ['MARGIN', 'desc']], sk: 'NEW' },
      { id: 'calcfront', saved: BASE, savedCalc: ['MARGIN'], now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD' },
      { id: 'calcfront2', saved: BASE, savedCalc: ['MARGIN'], now: ['V_NEW'].concat(BASE), sort: [['MARGIN', 'desc'], ['V_TIE', 'asc']], sk: 'GUARD' },
      { id: 'calcclash', saved: BASE, calcDefs: [{ name: 'V_STATUS' }, { name: '9X' }, { name: 'net margin' }], savedCalc: ['NET_MARGIN'],
        now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'calcnoformula', saved: BASE, calcDefs: [{ name: 'MARGIN', formula: '  ' }], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'calcgone', saved: ['V_ID', 'V_NAME', 'V_CODE'], calcDefs: [{ name: 'X', formula: '{V_NAME} * 2' }], savedCalc: ['X'], nowCalc: [],
        now: ['V_ID', 'V_NAME2', 'V_D', 'V_F'], sort: [['V_CODE', 'desc']], vis: ['V_ID', 'V_NAME', 'V_CODE'], sk: 'NEW' },
      { id: 'calcgone2', saved: ['V_ID', 'V_NAME', 'V_CODE'], calcDefs: [{ name: 'X', formula: '{V_NAME} * 2' }], savedCalc: ['X'], nowCalc: [],
        now: ['V_ID', 'V_NAME2', 'V_CODE'], sort: [['V_NAME', 'desc']], vis: ['V_ID', 'V_NAME', 'V_CODE'], sk: 'GUARD' },
      { id: 'calcchain', saved: ['V_ID', 'V_NAME', 'V_CODE'], calcDefs: [{ name: 'X', formula: '{V_NAME} * 2' }, { name: 'Y', formula: '{x} + 1' }],
        savedCalc: ['X', 'Y'], nowCalc: [], now: ['V_ID', 'V_NAME2', 'V_D', 'V_F', 'V_G'], sort: [['V_CODE', 'desc']], vis: ['V_ID', 'V_NAME', 'V_CODE'], sk: 'NEW' },
      { id: 'calcloop', saved: BASE, calcDefs: [{ name: 'X', formula: '{Y} + 1' }, { name: 'Y', formula: '{ X } + 1' }], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'),
        sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'calcinput', saved: BASE, calcDefs: [{ name: 'R', formula: '{V_AMOUNT}', input: { name: 'rate', value: 2 } }, { name: 'X', formula: '{V_AMOUNT} * {@ RATE }' }],
        savedCalc: ['R', 'X'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'calcnoinput', saved: BASE, calcDefs: [{ name: 'X', formula: '{V_AMOUNT} * {@RATE}' }], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'),
        sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'calcdup', saved: BASE, calcDefs: [{ name: 'MARGIN', formula: '{V_GONE} * 2' }, { name: 'Z', formula: '{V_TIE}' }, { name: 'margin', formula: '{V_AMOUNT} * 2' }],
        savedCalc: ['MARGIN', 'Z'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'NEW' },
      { id: 'calcquote', saved: BASE, calcDefs: [{ name: 'Q', formula: '"{V_GONE}" & {V_AMOUNT}' }], savedCalc: ['Q'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'),
        sort: [['V_NAME', 'asc']], sk: 'NEW' },
      // the viewer's own calculated column: the page leaves it out of the count; a saved report (the scheduler's) never has it
      { id: 'viewercalc', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), pageOnly: ['MYCALC'], sort: [['V_NAME', 'asc']], sk: 'NEW' },
      // ---- a ?state= link: not a scheduled report
      { id: 'link', link: true, saved: BASE, savedCalc: ['MARGIN'], now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'GUARD', sched: false },
      // ---- a pivot's chain names the pivot's own headings: as saved (by the name, as before)
      { id: 'pivot', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD', page: false,
        edit: function (st) { st.pivot = { rows: ['V_STATUS'], cols: [], vals: [{ field: 'V_AMOUNT', agg: 'sum' }] }; } },
      { id: 'pivotempty', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD', page: false, edit: function (st) { st.pivot = {}; } },
      { id: 'pivotmixed', saved: MIX, now: MIX, sort: [['Last Name', 'asc']], sk: 'GUARD', page: false,
        edit: function (st) { st.pivot = { rows: ['Period'], cols: [], vals: [{ field: 'Amount', agg: 'sum' }] }; } },
      { id: 'pivotnull', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD', edit: function (st) { st.pivot = null; } },
      { id: 'pivotfalse', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD', edit: function (st) { st.pivot = false; } },
      // ---- shapes only a hand edit writes
      { id: 'nolist', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD', page: false,
        edit: function (st) { st.sortCriteria = { first: st.sortCriteria[0] }; } },
      { id: 'emptysort', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [], sk: 'GUARD' },
      { id: 'nosort', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [], sk: 'GUARD', edit: function (st) { delete st.sortCriteria; } },
      { id: 'noident', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_NAME', 'desc']], sk: 'GUARD',
        edit: function (st) { delete st.sortCriteria[0].colIdentifier; } },
      // (a level that is a string made the runner's sort throw: PHP 8 reads 'V_ID'['colIdentifier'] as a TypeError)
      { id: 'blankident', saved: BASE, now: BASE, sort: [['V_TIE', 'asc'], ['V_NAME', 'desc']], sk: 'NEW',
        edit: function (st) { st.sortCriteria[0].colIdentifier = ''; st.sortCriteria.unshift(null, 'V_ID', 5, [3]); } },
      { id: 'coabsent', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'GUARD', edit: function (st) { delete st.columnOrder; } },
      { id: 'weird', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_TIE', 'asc'], ['V_AMOUNT', 'desc']], sk: 'GUARD',
        edit: function (st) { st.sortCriteria[0].colIndex = ' 6'; st.sortCriteria[1].colIndex = [2]; } },
      { id: 'weird2', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_NAME', 'asc']], sk: 'NEW',
        edit: function (st) { st.sortCriteria[0].colIndex = '01'; } },
      // (ldsort reads only 'desc' as descending; the runner read 'DESC' so too)
      { id: 'dirupper', saved: BASE, now: BASE, sort: [['V_NAME', 'asc']], sk: 'NEW', edit: function (st) { st.sortCriteria[0].direction = 'DESC'; } },
      { id: 'dirnone', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'GUARD', edit: function (st) { delete st.sortCriteria[0].direction; } },
      // ---- names of every kind
      { id: 'lowerident', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'asc']], sk: 'NEW', edit: function (st) { st.sortCriteria[0].colIdentifier = 'v_name'; } },
      { id: 'unicode', saved: ['Montant_é', 'straße', 'Ünïcode', 'V_ID', 'V_TIE'], now: ['V_ID', 'Ünïcode', 'V_NEW', 'straße', 'Montant_é', 'V_TIE'],
        sort: [['straße', 'asc'], ['Ünïcode', 'desc']], sk: 'NEW', mb: true },
      { id: 'proto', saved: ['__proto__', 'constructor', 'toString', 'V_ID', 'hasOwnProperty'], now: ['hasOwnProperty', 'V_ID', 'toString', 'constructor', '__proto__'],
        sort: [['__proto__', 'asc'], ['toString', 'desc']], sk: 'NEW' },
      { id: 'wide', saved: WIDE, now: ['W0'].concat(without(WIDE, ['W40'])), sort: [['W20', 'desc'], ['W70', 'asc']], vis: WIDE.slice(0, 9), sk: 'GUARD' },
      // ======== the scheduler's own: a column whose name is not all upper case - the name as a key found nothing
      { id: 'mixed', saved: MIX, now: MIX, sort: [['Last Name', 'asc']], sk: 'NEW' },
      { id: 'mixed2', saved: MIX, now: MIX, sort: [['Tie Group', 'asc'], ['First Name', 'desc']], sk: 'NEW' },
      { id: 'mixeddesc', saved: MIX, now: MIX, sort: [['First Name', 'desc'], ['ID', 'asc']], sk: 'NEW' },
      { id: 'mixedmoved', saved: MIX, now: ['Email', 'Amount', 'ID', 'Tie Group', 'Last Name', 'Period', 'First Name', 'Record Type'], sort: [['Amount', 'desc']], sk: 'NEW' },
      { id: 'mixedfront', saved: MIX, now: ['New Col'].concat(MIX), sort: [['Record Type', 'asc'], ['Last Name', 'asc']], sk: 'NEW' },
      { id: 'mixeddropped', saved: MIX, now: without(MIX, ['Email']), sort: [['Period', 'desc']], sk: 'NEW' },
      { id: 'mixedhidden', saved: MIX, now: MIX, sort: [['Period', 'desc']], vis: ['ID', 'Last Name', 'Amount'], sk: 'NEW' },
      { id: 'mixedren', saved: MIX, now: renamed(MIX, 'Last Name', 'Surname'), sort: [['Last Name', 'asc']], sk: 'NEW' },
      // a name gone and the count changed: the page drops that level, and the next one sorts
      { id: 'mixedgone', saved: MIX, now: without(MIX, ['Last Name']), sort: [['Last Name', 'asc'], ['Amount', 'asc']], sk: 'NEW' },
      { id: 'mixeddirupper', saved: MIX, now: MIX, sort: [['Last Name', 'asc']], sk: 'NEW', edit: function (st) { st.sortCriteria[0].direction = 'DESC'; } },
      // mattpinsbycollege as saved (2026-10-24): PER_Last_Name at place 0, which its MSSQL query aliases 'Last Name'
      { id: 'mattpins', saved: ['Last Name', 'First Name', 'Email', 'Unity ID', 'OUC', 'Department', 'College'],
        now: ['Last Name', 'First Name', 'Email', 'Unity ID', 'OUC', 'Department', 'College'], sort: [['Last Name', 'asc']], sk: 'NEW',
        vis: [6, 5, 2, 1, 0, 4, 3], edit: function (st) { st.sortCriteria[0].colIdentifier = 'PER_Last_Name'; } },
      // alm-pivot as saved: AMOUNT desc, which its Oracle query aliases "Amount"
      { id: 'almpivot', saved: ['College', 'Record Type', 'Period', 'Amount', 'Awards 5-yr Avg', 'Proposals 5-yr Avg'],
        now: ['College', 'Record Type', 'Period', 'Amount', 'Awards 5-yr Avg', 'Proposals 5-yr Avg'], sort: [['Amount', 'desc']], sk: 'NEW' },
      { id: 'lowercase', saved: ['id', 'name', 'amount', 'tie_x'], now: ['id', 'name', 'amount', 'tie_x'], sort: [['tie_x', 'asc'], ['amount', 'desc']], sk: 'NEW' },
      // two columns named alike but for the case: by its place; the other by its own
      { id: 'mixeddup', saved: ['ID', 'Name', 'NAME', 'Tie Group'], now: ['ID', 'Name', 'NAME', 'Tie Group'], sort: [['Name', 'asc']], sk: 'NEW' },
      { id: 'mixeddup2', saved: ['ID', 'Name', 'NAME', 'Tie Group'], now: ['ID', 'Name', 'NAME', 'Tie Group'], sort: [['NAME', 'desc']], sk: 'GUARD' },
      { id: 'mixednum', saved: ['ID', '2021', 'Last Name', 'Tie Group'], now: ['New Col', 'ID', '2021', 'Last Name', 'Tie Group'],
        sort: [['Tie Group', 'asc'], ['2021', 'desc']], sk: 'NEW' },
      // a calculated column with a label (calcsrv keys it 'Net_Margin', as the page does)
      { id: 'mixedcalc', saved: MIX, savedCalc: ['Net_Margin'], now: MIX, sort: [['Net_Margin', 'desc']], sk: 'NEW' },
      { id: 'mixedcalcren', saved: MIX, savedCalc: ['Net_Margin'], now: renamed(MIX, 'Amount', 'Amt'), sort: [['Tie Group', 'asc'], ['Amount', 'asc'], ['Net_Margin', 'desc']], sk: 'NEW' },
      // a custom sort order (keyed by the heading's name) on a mixed-case column; one on an upper-case column, as before
      { id: 'mixedcustom', saved: MIX, now: ['New Col'].concat(MIX), sort: [['Last Name', 'asc']], custom: { 'LAST NAME': { values: ['a05', 'a01', 'a06'] } }, sk: 'NEW' },
      { id: 'mixedcustomren', saved: MIX, now: renamed(MIX, 'Last Name', 'Surname'), sort: [['Last Name', 'desc']], custom: { 'SURNAME': { values: ['a02', 'a07'] } }, sk: 'NEW' },
      { id: 'customupper', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['V_NAME', 'desc']], custom: { 'V_NAME': { values: ['a03', 'a00'] } }, sk: 'GUARD' },
      // (the review's finding 1: an order filed under a heading's name outside ASCII - the row's key does not find it)
      { id: 'customunicode', saved: ['ID', 'Année', 'Tie Group', 'Amount'], now: ['New Col', 'ID', 'Année', 'Tie Group', 'Amount'], sort: [['Année', 'asc']],
        custom: { 'ANNÉE': { values: ['a06', 'a02', 'a04'] } }, sk: 'NEW', mb: true },
      // a nested-table (@@JSON) column sorts by its tables' rows (nestsort)
      { id: 'mixednest', saved: ['ID', 'Nest Rows', 'Amount', 'Tie Group'], now: ['ID', 'Nest Rows', 'Amount', 'Tie Group'], sort: [['Nest Rows', 'desc']], nest: ['Nest Rows'], sk: 'NEW' },
      { id: 'nestupper', saved: ['V_ID', 'N_JSON', 'V_TIE'], now: ['V_NEW', 'V_ID', 'N_JSON', 'V_TIE'], sort: [['V_TIE', 'desc'], ['N_JSON', 'asc']], nest: ['N_JSON'], sk: 'GUARD' },
      // the journal's levels with the report's own (the toggle's 1/0 ties, so the next level decides within them)
      { id: 'mixedjournal', saved: MIX, now: MIX, sort: [['__J', 'desc'], ['Last Name', 'asc']], journal: ['Done', 'Done by'], sk: 'NEW' },
      { id: 'mixedjournalren', saved: MIX, now: renamed(MIX, 'Last Name', 'Surname'), sort: [['__J', 'asc'], ['Last Name', 'desc']], journal: ['Done', 'Done by', 'Notes'], sk: 'NEW' },
      { id: 'journalonly', saved: MIX, now: ['New Col'].concat(MIX), sort: [['__J', 'asc'], ['__JBY', 'desc']], journal: ['Done', 'Done by'], sk: 'GUARD' },
      { id: 'journalnotes', saved: BASE, now: renamed(BASE, 'V_NAME', 'V_FULLNAME'), sort: [['V_TIE', 'asc'], ['V_NAME', 'desc']], journal: ['Done', 'Done by', 'Notes'], sk: 'NEW' },
      // a toggle labelled like a number: mapped onto '1', its level must not read as a place
      { id: 'journalnum', saved: MIX, now: renamed(MIX, 'Last Name', 'Surname'), sort: [['__J', 'desc'], ['Last Name', 'asc']], journal: ['Done', 'Done by'], jlabel: '1', sk: 'NEW' },
      { id: 'journalnum2', saved: BASE, now: ['V_NEW'].concat(BASE), sort: [['__JBY', 'asc'], ['__J', 'desc'], ['V_NAME', 'asc']], journal: ['Done', 'Done by'], jlabel: '2021', sk: 'GUARD' }
    ];
    // ---- fuzz (kind FUZZ: checked against the page, left out of the live control): seeded, so a red names its case.
    // srvsort's (a save against a random result, then the SQL changes it - drops, new columns, a rename in place, a
    // shuffle - over case duplicates, number-like keys and prototype names), then the scheduler's: the same over names
    // an MSSQL result or a quoted alias keeps
    var seed = 20261024;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function ri(n) { return Math.floor(rnd() * n); }
    function shuffled(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = ri(i + 1), t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
    function fuzz(prefix, POOL, count) {
      var fresh = 0;
      for (var z = 0; z < count; z++) {
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
        FX.push({ id: prefix + z, saved: saved, savedCalc: calc, now: now, sort: sort, order: shuffled(saved), vis: shuffled(saved).slice(0, 1 + ri(saved.length)),
                  names: rnd() < 0.85, link: lk, sched: !lk, sk: 'FUZZ', mb: /[^\x20-\x7e]/.test(all.join('')) });
      }
    }
    fuzz('fz', ['A_ID', 'B_NAME', 'C_AMT', 'D_DATE', 'E_CODE', 'F_FLAG', 'G_TEXT', 'H_NUM', 'a_id', 'b_name', '2021', '0', '7', '01', '-5',
                '4294967294', '4294967295', '__proto__', 'constructor', 'Ünï', 'straße', 'X_1', 'Y_2', 'Z_3'], 200);
    fuzz('fm', ['ID', 'Last Name', 'First Name', 'Amount', 'Record Type', 'Period', 'College', 'Unity ID', 'Email', 'Tie Group', 'tie_lower',
                'NAME', 'Name', 'name', '2021', 'Net_Amt', 'Department', 'OUC'], 120);
    var SS = window.__SS, LOAD = window.__LOADSORT;
    if (!SS || !LOAD) throw new Error('lifted.js did not load: ' + (window.__LIFT_ERR || '?'));
    var str = function (v) { return v === undefined ? '__undefined__' : String(v); };
    FX.forEach(function (f) {
      var pageCalc = f.nowCalc || f.savedCalc || [];
      var o = { id: f.id, kind: f.sk, page: f.page !== false, sched: f.sched !== false && !f.link, mb: !!f.mb, link: !!f.link,
                journal: f.journal || [], jlabel: f.jlabel || 'Done', calc: pageCalc, pageOnly: f.pageOnly || [], nest: f.nest || [] };
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
      } catch (e) { o.error = String(e && e.stack || e); }
      R.fx.push(o);
    });
  } catch (e) { R.errors.push(String(e && e.stack || e)); }
  window.__PARITY = R;
  window.__HCDONE = true;
})();
