// ldsrv suite - the page's side (2026-10-24). The page's OWN code, lifted out of js/main.js by run.py into
// lifted.js - _pnbLayoutByName + _pnbLayoutMap + _pnbDenseNames as window.__LD, and the state load's layout block
// (the "HIGHEST priority" lines: _ldLay, finalColumnOrder, visibleColumnsSet) as window.__LOAD - over a corpus of
// saved states and results. Each fixture is saved the way buildStateObject saves (places = the saved result's
// Object.keys() places, layoutColumnNames = their names, upper case), then read against the result NOW. run.py hands
// the corpus and the page's answers to the PHP side: parity.php (the twin, penumbra_layout.php), hooks.php (?json=1
// and the scheduler) and stubhook.php (the stub of an encrypted report).
(function () {
  var R = { fx: [], errors: [] };
  try {
    var BASE = ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS',            // 0-5 shown
      'H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML', 'H_JSON', 'H_ENT',               // 6-12 hidden
      'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE'];             // 13-19 hidden
    var H = BASE.slice(6);
    var SIX = ['V_AMOUNT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'];
    function without(a, x) { return a.filter(function (n) { return x.indexOf(n) < 0; }); }
    function renamed(a, from, to) { return a.map(function (n) { return n === from ? to : n; }); }
    function swap(a, x, y) { return a.map(function (n) { return n === x ? y : (n === y ? x : n); }); }
    function rowJson(cols) {   // one row as query.php sends it: the keys in the SQL's order
      return '{' + cols.map(function (c) { return JSON.stringify(String(c)) + ':' + JSON.stringify('v_' + c); }).join(',') + '}';
    }
    function keysOf(cols) { return Object.keys(JSON.parse(rowJson(cols))); }
    // A save against the result `cols` (SQL order), as buildStateObject writes it: the headings in display order
    // (`order` first, the rest after it in place order), the shown ones (`vis`, '#' first unless hash === false),
    // each as its PLACE in the saved result's keys - and, unless names === false, the name at each place
    function save(cols, order, vis, hash, names) {
      var k = keysOf(cols);
      var place = function (n) { var i = k.indexOf(n); if (i < 0) throw new Error('fixture: no column ' + n); return i; };
      var ord = order.map(place);
      k.forEach(function (n, i) { if (ord.indexOf(i) < 0) ord.push(i); });
      var st = { query: 'SELECT V_ID, V_NAME FROM LD_FIXTURE', reportTitle: 'ldsrv fixture', theme: 'theme-default',
                 columnOrder: ord, visibleColumns: (hash === false ? [] : ['#']).concat(vis.map(place)) };
      if (names !== false) st.layoutColumnNames = k.map(function (n) { return String(n).toUpperCase(); });
      return st;
    }
    var CASE21 = BASE.slice(0, 3).concat(['v_amount'], BASE.slice(3));
    var WIDE = []; for (var w = 1; w <= 83; w++) WIDE.push('W' + w);
    var NUMS = ['X', '2021', '01', '-5', '0', '4294967295', '4294967294', '7', 'Y'];
    // kind: NEW = the server read it by place and showed other columns (red on live); GUARD = the same answer before
    // and after (green on live too). page: false = the page and the server differ for reasons of their own, before
    // and after (an empty shown list): only "old unchanged" is checked. want: the page's own answer, by hand.
    var FX = [
      { id: 'same', saved: BASE, now: BASE, kind: 'GUARD', want: SIX },
      { id: 'oldsame', saved: BASE, now: BASE, names: false, kind: 'GUARD' },
      { id: 'front', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'NEW', want: SIX },
      { id: 'oldfront', saved: BASE, now: ['V_NEW'].concat(BASE), names: false, kind: 'GUARD' },
      { id: 'moved', saved: BASE, now: ['V_STATUS', 'V_ID', 'H_GROUP', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK'].concat(without(H, ['H_GROUP'])), kind: 'NEW', want: SIX },
      { id: 'oldmoved', saved: BASE, now: ['V_STATUS', 'V_ID', 'H_GROUP', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK'].concat(without(H, ['H_GROUP'])), names: false, kind: 'GUARD' },
      { id: 'gone', saved: BASE, now: without(BASE, ['V_NAME']), kind: 'NEW', want: without(SIX, ['V_NAME']) },
      { id: 'gonenew', saved: BASE, now: without(BASE, ['V_NAME']).concat(['V_NEW']), kind: 'NEW', want: without(SIX, ['V_NAME']) },
      // two came in where V_STATUS went: not "nothing came or went", so its place does not pass to V_NEW
      { id: 'gonetwo', saved: BASE, now: BASE.slice(0, 5).concat(['V_NEW', 'V_NEW2'], H), kind: 'NEW', want: without(SIX, ['V_STATUS']) },
      // renamed in place: by place was right already, by name keeps it (nothing came or went)
      { id: 'renamed', saved: BASE, now: renamed(BASE, 'V_AMOUNT', 'V_AMT'), kind: 'GUARD', want: renamed(SIX, 'V_AMOUNT', 'V_AMT') },
      // a column named 2021 added LAST: the page's keys put it first; the server's places were right by luck
      { id: 'numlast', saved: BASE, now: BASE.concat(['2021']), kind: 'GUARD', want: SIX },
      // ...saved WITH it: the page's places put it first, the server read every place as the column after it
      { id: 'numsaved', saved: BASE.concat(['2021']), order: ['V_AMOUNT', '2021', 'V_ID', 'V_NAME'], vis: ['V_AMOUNT', '2021', 'V_ID', 'V_NAME'],
        now: BASE.concat(['2021']), kind: 'NEW', want: ['V_AMOUNT', '2021', 'V_ID', 'V_NAME'] },
      { id: 'oldnumsaved', saved: BASE.concat(['2021']), order: ['V_AMOUNT', '2021', 'V_ID', 'V_NAME'], vis: ['V_AMOUNT', '2021', 'V_ID', 'V_NAME'],
        now: BASE.concat(['2021']), names: false, kind: 'GUARD', page: false },
      // ...and a column renamed in place beside it: its place is the page's place (2021 first), not the row's
      { id: 'numrenamed', saved: ['A_ID', 'A_NAME', '2021', 'A_AMT'], order: ['A_AMT', 'A_NAME', '2021', 'A_ID'], vis: ['A_AMT', 'A_NAME', '2021'],
        now: ['A_ID', 'A_NAME2', '2021', 'A_AMT'], kind: 'NEW', want: ['A_AMT', 'A_NAME2', '2021'] },
      // every kind of number-like key: array indexes (0, 7, 2021, 4294967294) first, smallest first; '01', '-5' and
      // 4294967295 are not indexes (PHP still makes -5 and 4294967295 int keys)
      { id: 'nummany', saved: NUMS, order: ['Y', '7', '-5', '4294967295', '0', 'X', '01', '2021', '4294967294'], vis: ['Y', '7', '-5', '4294967295', '0', '01'],
        now: ['4294967294', 'Y', '01', 'X', '-5', '7', 'NEW', '0', '4294967295', '2021'], kind: 'NEW', want: ['Y', '7', '-5', '4294967295', '0', '01'] },
      // two columns named V_AMOUNT but for the case: they keep their order between them
      { id: 'casedup', saved: CASE21, order: ['v_amount', 'V_ID', 'V_NAME', 'V_AMOUNT'], vis: ['v_amount', 'V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE'],
        now: ['V_NEW'].concat(CASE21), kind: 'NEW', want: ['v_amount', 'V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE'] },
      { id: 'caseswap', saved: CASE21, order: ['v_amount', 'V_ID'], vis: ['v_amount', 'V_ID', 'V_NAME'],
        now: swap(CASE21, 'V_AMOUNT', 'v_amount'), kind: 'GUARD', want: ['V_AMOUNT', 'V_ID', 'V_NAME'] },
      // names written in another case (a hand edit): still matched upper case
      { id: 'lowernames', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'NEW', want: SIX,
        edit: function (st) { st.layoutColumnNames = st.layoutColumnNames.map(function (n) { return n.toLowerCase(); }); } },
      // names a save does not write: read by place, as before
      // a place past the names: in the order (as many places as names all the same), or in the shown list alone
      { id: 'badpast', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.columnOrder[19] = 20; } },
      { id: 'badpastvis', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.visibleColumns.push(20); } },
      { id: 'partial', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.columnOrder = [2, 0, 1]; st.visibleColumns = ['#', 2, 0]; } },
      { id: 'holey', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames[5] = ''; } },
      { id: 'nonstr', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames[5] = 5; } },
      { id: 'namesnull', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames = null; } },
      { id: 'namesempty', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames = []; } },
      { id: 'namesstr', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames = BASE.join(','); } },
      { id: 'namesobj', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames = { a: 'V_ID', b: 'V_NAME' }; } },
      { id: 'longer', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { st.layoutColumnNames.push('EXTRA'); } },
      { id: 'coabsent', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', edit: function (st) { delete st.columnOrder; } },
      // none of the shown ones left: read by place, as before
      { id: 'allgone', saved: BASE, vis: ['V_ID', 'V_NAME'], now: ['V_NEW'].concat(without(BASE, ['V_ID', 'V_NAME'])), kind: 'GUARD' },
      { id: 'hashoff', saved: BASE, now: ['V_NEW'].concat(BASE), hash: false, kind: 'NEW', want: SIX },
      // a journal heading in the saved order passes as it is
      { id: 'jrnentry', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'NEW', want: SIX, edit: function (st) { st.columnOrder.splice(2, 0, '__JOURNAL_NOTES'); } },
      // entries only a hand edit writes: what the page calls a place ('05', [3]) is one; what it does not (' 1', '1\n',
      // 2.5, -1, true, null, '') never is - though PHP's is_numeric() would read some of them as one
      { id: 'weird', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'NEW', want: ['V_AMOUNT', 'V_ID', 'V_DATE', 'V_LINK', 'V_STATUS'],
        edit: function (st) {
          st.columnOrder = [2, 0, 1, [3], 4, '05'].concat(st.columnOrder.slice(6), [' 1', '1\n', 2.5, -1, true, null, '', '2.0']);
          st.visibleColumns = ['#', 2, 0, [3], 4, '05', ' 1', '1\n', '2.5', 2.5, -1, true, null, ''];
        } },
      // no shown list: every column, in the saved order; an empty one: the page shows all, the server none (as before)
      { id: 'visabsent', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'NEW', edit: function (st) { delete st.visibleColumns; } },
      { id: 'visempty', saved: BASE, now: ['V_NEW'].concat(BASE), kind: 'GUARD', page: false, edit: function (st) { st.visibleColumns = []; } },
      { id: 'unicode', saved: ['Montant_é', 'straße', 'Ünïcode', 'V_ID'], order: ['straße', 'V_ID', 'Ünïcode', 'Montant_é'], vis: ['straße', 'V_ID', 'Montant_é'],
        now: ['V_ID', 'Ünïcode', 'V_NEW', 'straße', 'Montant_é'], kind: 'NEW', want: ['straße', 'V_ID', 'Montant_é'], mb: true },
      { id: 'proto', saved: ['__proto__', 'constructor', 'toString', 'V_ID', 'hasOwnProperty'], order: ['V_ID', 'toString', '__proto__', 'hasOwnProperty', 'constructor'],
        vis: ['V_ID', 'toString', '__proto__', 'hasOwnProperty'], now: ['hasOwnProperty', 'V_ID', 'toString', 'constructor', '__proto__'], kind: 'NEW',
        want: ['V_ID', 'toString', '__proto__', 'hasOwnProperty'] },
      { id: 'wide', saved: WIDE, order: WIDE.slice().reverse(), vis: ['W83', 'W70', 'W41', 'W40', 'W39', 'W2', 'W1'],
        now: ['W0'].concat(without(WIDE, ['W40'])), kind: 'NEW', want: ['W83', 'W70', 'W41', 'W39', 'W2', 'W1'] },
      // the report's own calculated column (state.calcColumns, appended at the END of the rows - the server works
      // it out too; a stub does not): renamed in place beside it, and a column put in front
      { id: 'calcren', saved: BASE.concat(['MARGIN']), vis: SIX.concat(['MARGIN']), now: renamed(BASE, 'V_AMOUNT', 'V_AMT').concat(['MARGIN']),
        calc: ['MARGIN'], kind: 'GUARD', want: renamed(SIX, 'V_AMOUNT', 'V_AMT').concat(['MARGIN']) },
      { id: 'calcfront', saved: BASE.concat(['MARGIN']), vis: SIX.concat(['MARGIN']), now: ['V_NEW'].concat(BASE, ['MARGIN']),
        calc: ['MARGIN'], kind: 'NEW', want: SIX.concat(['MARGIN']) },
      // ...one typed with a blank: its key on the row is its label, Net_Margin (penumbra_calc's name rule)
      { id: 'calcspace', saved: BASE.concat(['Net_Margin']), vis: SIX.concat(['Net_Margin']), now: renamed(BASE, 'V_AMOUNT', 'V_AMT').concat(['Net_Margin']),
        calc: [{ key: 'Net_Margin', name: 'Net Margin' }], kind: 'GUARD', want: renamed(SIX, 'V_AMOUNT', 'V_AMT').concat(['Net_Margin']) },
      // the journal's columns: the server adds them to the rows (the page's table never had them in its keys)
      { id: 'journal', saved: BASE, now: ['V_NEW'].concat(BASE), journal: ['Done', 'Done by', 'Notes'], kind: 'NEW', want: SIX },
      { id: 'journalren', saved: BASE, now: renamed(BASE, 'V_AMOUNT', 'V_AMT'), journal: ['Done', 'Done by', 'Notes'], kind: 'GUARD',
        want: renamed(SIX, 'V_AMOUNT', 'V_AMT') },
      // grouped by a hidden column: the scheduler and the stub show it for the grouping (after the shown ones)
      { id: 'group', saved: BASE, now: ['V_NEW'].concat(BASE), group: 'H_GROUP', kind: 'NEW', want: SIX }
    ];
    // ---- fuzz (kind FUZZ: compared in every half, left out of the live control): seeded, so a red names its case.
    // Saves against a random result, then the SQL changes it - drops, new columns (in front, between, at the end),
    // a rename in place, a shuffle - over names that include case duplicates, number-like keys and prototype names
    var seed = 20261024;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function ri(n) { return Math.floor(rnd() * n); }
    function shuffled(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = ri(i + 1), t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
    var POOL = ['A_ID', 'B_NAME', 'C_AMT', 'D_DATE', 'E_CODE', 'F_FLAG', 'G_TEXT', 'H_NUM', 'a_id', 'b_name', '2021', '0', '7', '01', '-5',
                '4294967294', '4294967295', '__proto__', 'constructor', 'Ünï', 'straße', 'X_1', 'Y_2', 'Z_3'];
    var fresh = 0;
    for (var z = 0; z < 160; z++) {
      var saved = shuffled(POOL).slice(0, 3 + ri(9));
      var order = shuffled(saved), vis = shuffled(saved).slice(0, 1 + ri(saved.length));
      var now = saved.slice(), op = ri(7);
      if (op === 0 || op === 5) { var nd = 1 + ri(2); for (var d = 0; d < nd && now.length > 1; d++) now.splice(ri(now.length), 1); }
      if (op === 1 || op === 5 || op === 6) { var ni = 1 + ri(2); for (var q = 0; q < ni; q++) { var nn = POOL.filter(function (n) { return now.indexOf(n) < 0; }); now.splice(ri(now.length + 1), 0, nn.length && rnd() < 0.5 ? nn[ri(nn.length)] : 'N' + (++fresh)); } }
      if (op === 2) { var at = ri(now.length); now[at] = 'R' + (++fresh); }
      if (op === 3 || op === 6) now = shuffled(now);
      if (op === 4) { var a2 = ri(now.length), b2 = ri(now.length), t2 = now[a2]; now[a2] = now[b2]; now[b2] = t2; }
      FX.push({ id: 'fz' + z, saved: saved, order: order, vis: vis, now: now, hash: rnd() < 0.8, names: rnd() < 0.85, kind: 'FUZZ',
                mb: /[^\x20-\x7e]/.test(saved.concat(now).join('')) });   // a non-ASCII name: upper case needs mbstring
    }
    var isIndexKey = function (k) { return /^(0|[1-9][0-9]*)$/.test(k) && +k <= 4294967294; };
    var L = window.__LD, LOAD = window.__LOAD;
    if (!L || !LOAD) throw new Error('lifted.js did not load: ' + (window.__LIFT_ERR || '?'));
    FX.forEach(function (f) {
      var calc = (f.calc || []).map(function (c) { return typeof c === 'string' ? { key: c, name: c } : c; });
      var o = { id: f.id, kind: f.kind, page: f.page !== false, mb: !!f.mb, journal: f.journal || [], group: f.group || null, want: f.want || null,
                calc: calc.map(function (c) { return c.key; }) };   // the calculated columns' keys on the row
      try {
        var st = save(f.saved, f.order || SIX.concat(H), f.vis || SIX, f.hash, f.names);
        if (f.edit) f.edit(st);
        if (f.group) st.groupBy = f.group;
        if (calc.length) st.calcColumns = calc.map(function (c) { return { name: c.name, formula: '{H_NUM} * 2', format: 'number' }; });
        o.state = JSON.parse(JSON.stringify(st));          // as the server and the page decode it
        o.rowJson = rowJson(f.now);                         // the query's row now (the calculated columns at its end)
        var keys = keysOf(f.now);
        o.jsKeys = keys;
        var lay = L.byName(JSON.parse(JSON.stringify(st)), keys, function () { return false; });
        var tok = function (list) {
          if (!Array.isArray(list)) return { notList: JSON.stringify(list === undefined ? '__undefined__' : list) };
          return list.map(function (x) { return (typeof x === 'number' && x >= 0 && x % 1 === 0) ? 'N:' + keys[x] : 'E:' + JSON.stringify(x); });
        };
        o.byName = lay === null ? null : { v: tok(lay.visibleColumns), o: tok(lay.columnOrder) };
        // read by place, the page's places and PHP's differ where a key is an array index (Object.keys puts it first)
        if (f.kind === 'FUZZ' && lay === null && keys.some(isIndexKey)) o.page = false;
        window.__Q = st.query;
        var pg = LOAD(JSON.parse(JSON.stringify(st)), keys);
        var shown = pg.order.filter(function (n) { return pg.vis.indexOf(n) >= 0 && n !== '#'; });
        o.shown = shown;
        o.numShown = pg.vis.indexOf('#') >= 0;
        o.pageOrder = pg.order;
      } catch (e) { o.error = String(e && e.stack || e); }
      R.fx.push(o);
    });
  } catch (e) { R.errors.push(String(e && e.stack || e)); }
  window.__PARITY = R;
  window.__HCDONE = true;
})();
