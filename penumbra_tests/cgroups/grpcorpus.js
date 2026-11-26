// cgroups parity corpus: the rows and definitions both engines work out (the browser's side; grpparity.php the server's)
window.GRP_CORPUS = (function () {
  var V = ['NIH', 'nih', ' NIH ', 'NSF', 'Nsf', 'DOD', 'AT&amp;T', 'AT&T', '&lt;b&gt;bold&lt;/b&gt;', 'O&#039;Brien', 'O&#39;Brien', '&quot;Q&quot;',
    '', '   ', null, '@@HTML<a href="x?a=1&amp;b=2">Duke &amp; Co</a>', '@@HTML  <b>NC State</b>  ', '@@JSON[{"A":1}]', 'NC State', 'NCSU', 'nc state univ',
    'UNC Chapel Hill', 'State of NC', 'Ünïcode', 'éclair', 'ÉCLAIR', 'Smith; Jones', 'Jones;Smith;Jones', ' ; ', 'A|B|c', 'a, b, C', 'x;;y', ';',
    '__proto__', 'constructor', 'hasOwnProperty', '0123', '123', '1e3', '12.50', 'TRUE', 'false', 'Group 1', 'Other', 'other', 'R&amp;D', 'R&D Lab',
    'Health Sciences', 'Engineering', 'Arts &amp; Design', 'multi word value here', 'x'.repeat(250), 'tab\there', 'line\nbreak', '@@not html',
    123, 0, -1.5, 1e21, true, 'Ω omega', 'ﬁ ligature', 'İstanbul', 'straße', 'ß',
    // (cgroups sweep) a no-break space, a lone CR, a line separator, the ends trim keeps (U+0085, U+180E), pieces with ; < >
    'NC\u00a0State', 'cr\rlf', 'a\u2028b', '\u0085NEL\u0085', '\u180Emvs\u180E', 'a<b|c>d', 'x;y|z', 'p{L}'];
  function at(v) { return V.indexOf(v); }
  var rows = [];
  for (var i = 0; i < V.length; i++) rows.push({ SPONSOR: V[i], DEPT: V[(i * 7 + 3) % V.length], AMT: String(i), LIST: V[(i * 11 + 5) % V.length] });
  var seed = 20261125;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  for (var j = 0; j < 150; j++) rows.push({ SPONSOR: pick(V), DEPT: pick(V), AMT: String(j), LIST: pick(V) });
  var sets = [];
  // expect: [row, column, the cell] both engines must give (cgroups sweep) - the parity alone passes two engines alike wrong
  function G(id, defs, expect) { sets.push({ id: id, defs: defs, expect: expect || [] }); }
  G('grpBasic', [
    { name: 'SP_GRP', groups: { col: 'SPONSOR', sets: [{ name: 'Federal', values: ['NIH', 'NSF', 'DOD'] }, { name: 'Corporate', values: ['AT&T', 'R&D'] }], rest: 'other', other: 'Other' } },
    { name: 'SP_KEEP', groups: { col: 'sponsor', sets: [{ name: 'Federal', values: ['nih', 'NSF '] }], rest: 'keep' } },
    { name: 'SP_BLANK', groups: { col: 'SPONSOR', sets: [{ name: 'Federal', values: ['NIH'] }], rest: 'blank' } },
    { name: 'SP_DEFAULTREST', groups: { col: 'SPONSOR', sets: [{ name: 'F', values: ['NIH'] }] } },
    { name: 'SP_OTHERNAME', groups: { col: 'SPONSOR', sets: [{ name: 'F', values: ['NIH'] }], rest: 'other', other: '  Everything & else <x>  ' } }]);
  G('grpRules', [
    { name: 'R_CONTAINS', groups: { col: 'SPONSOR', sets: [{ name: 'Has state', values: [], rule: { op: 'contains', v: 'STATE' } }], rest: 'keep' } },
    { name: 'R_STARTS', groups: { col: 'SPONSOR', sets: [{ name: 'NC', values: [], rule: { op: 'starts', v: 'nc ' } }], rest: 'blank' } },
    { name: 'R_ENDS', groups: { col: 'SPONSOR', sets: [{ name: 'Hill', values: [], rule: { op: 'ends', v: 'HILL' } }, { name: 'brien', values: [], rule: { op: 'ends', v: "'brien" } }], rest: 'other' } },
    { name: 'R_MATCHES', groups: { col: 'SPONSOR', sets: [{ name: 'Starts N', values: [], rule: { op: 'matches', v: '^n[a-z]' } }, { name: 'Digits', values: [], rule: { op: 'matches', v: '^\\d+$' } }], rest: 'keep' } },
    { name: 'R_BADRX', groups: { col: 'SPONSOR', sets: [{ name: 'Bad', values: ['NIH'], rule: { op: 'matches', v: '([a-z' } }, { name: 'Good', values: [], rule: { op: 'matches', v: 'e' } }], rest: 'other' } },
    { name: 'R_ORDER', groups: { col: 'SPONSOR', sets: [{ name: 'Rule first', values: [], rule: { op: 'contains', v: 'n' } }, { name: 'Listed later', values: ['NIH', 'NSF'] }], rest: 'other' } },
    { name: 'R_LISTWINS', groups: { col: 'SPONSOR', sets: [{ name: 'Listed first', values: ['NCSU'] }, { name: 'Rule later', values: [], rule: { op: 'starts', v: 'NC' } }], rest: 'blank' } },
    { name: 'R_UNICODE', groups: { col: 'SPONSOR', sets: [{ name: 'Accents', values: ['ÉCLAIR'], rule: { op: 'contains', v: 'ünï' } }, { name: 'Omega', values: [], rule: { op: 'matches', v: '^ω' } }], rest: 'keep' } },
    { name: 'R_SPACEKEPT', groups: { col: 'SPONSOR', sets: [{ name: 'Word value', values: [], rule: { op: 'contains', v: ' value ' } }], rest: 'blank' } }]);
  G('grpBlank', [
    { name: 'B_LISTED', groups: { col: 'SPONSOR', sets: [{ name: 'Nothing', values: [''] }, { name: 'NIH', values: ['NIH'] }], rest: 'other' } },
    { name: 'B_RULEALL', groups: { col: 'SPONSOR', sets: [{ name: 'Anything', values: [], rule: { op: 'matches', v: '.*' } }], rest: 'keep' } },
    { name: 'B_NUMVALS', groups: { col: 'SPONSOR', sets: [{ name: 'Numbers', values: [123, 0, '0123', 1e21, 'true'] }], rest: 'blank' } }]);
  G('grpSplit', [
    { name: 'S_SEMI', groups: { col: 'LIST', split: 'dsemi', sets: [{ name: 'People', values: ['Smith', 'Jones'] }, { name: 'X or Y', values: ['x', 'y'] }], rest: 'other', other: 'Other' } },
    { name: 'S_PIPE', groups: { col: 'LIST', split: 'dpipe', sets: [{ name: 'AB', values: ['a', 'B'] }], rest: 'keep' } },
    { name: 'S_COMMA', groups: { col: 'LIST', split: 'dcomma', sets: [{ name: 'abc', values: ['a', 'b'] }], rest: 'blank' } },
    { name: 'S_BLANKGROUP', groups: { col: 'LIST', split: 'dsemi', sets: [{ name: 'Empty list', values: [''] }], rest: 'keep' } },
    { name: 'S_BADSPLIT', groups: { col: 'LIST', split: 'dtab', sets: [{ name: 'T', values: ['tab'] }], rest: 'keep' } },
    // a cell's groups in the groups' order, whatever order the cell lists them in (Jones;Smith reads S; J); kept values after, as listed
    { name: 'S_ORDER', groups: { col: 'LIST', split: 'dsemi', sets: [{ name: 'S', values: ['Smith'] }, { name: 'J', values: ['Jones'] }], rest: 'keep' } },
    { name: 'S_ORDEROTHER', groups: { col: 'LIST', split: 'dsemi', sets: [{ name: 'Y', values: ['y'] }, { name: 'X', values: ['x'] }], rest: 'other', other: 'Rest' } }]);
  G('grpClean', [
    { name: 'C_LABEL', label: 'C_label', groups: { col: 'SPONSOR', sets: [{ name: 'F', values: ['NIH'] }] }, hide: true },
    { name: 'C_BADNAMES', groups: { col: 'SPONSOR', sets: [{ name: '', values: ['NIH'] }, { name: '@@HTML<b>x</b>', values: ['NSF'] }, { name: 'ok', values: ['DOD', 'dod', ' DOD', '@@x', 'x'.repeat(201)] }, null, 'str', ['arr'], { name: 'N'.repeat(81), values: ['NIH'] }, { name: 'ctl\tname', values: ['NIH'] }, { name: 5, values: ['123'] }], rest: 'other' } },
    { name: 'C_BADRULES', groups: { col: 'SPONSOR', sets: [{ name: 'a', values: [], rule: { op: 'nope', v: 'x' } }, { name: 'b', values: [], rule: { op: 'contains', v: '   ' } }, { name: 'c', values: [], rule: { op: 'contains' } }, { name: 'd', values: [], rule: ['contains', 'x'] }, { name: 'e', values: [], rule: { op: 'starts', v: 7 } }], rest: 'keep' } },
    { name: 'C_NOCOL', groups: { sets: [{ name: 'F', values: ['NIH'] }] } },
    { name: 'C_BADCOL', groups: { col: 'A}B', sets: [] } },
    { name: 'C_MISSINGCOL', groups: { col: 'NOPE', sets: [{ name: 'F', values: ['NIH'] }] } },
    { name: 'C_LISTGROUPS', groups: [1, 2] },
    { name: 'C_EMPTYSETS', groups: { col: 'SPONSOR', sets: [], rest: 'other' } },
    { name: 'C_RESTJUNK', groups: { col: 'SPONSOR', sets: [{ name: 'F', values: ['NIH'] }], rest: 'whatever', other: '' } }]);
  // the order of groups is the order of the sets, and a calculated column reading a group column (and the reverse)
  G('grpChain', [
    { name: 'UPPER_SP', formula: '{SPONSOR} & "!"', format: 'text' },
    { name: 'G_OF_CALC', groups: { col: 'UPPER_SP', sets: [{ name: 'Bang NIH', values: ['NIH!'] }], rest: 'other' } },
    { name: 'CALC_OF_G', formula: 'IF({G_OF_CALC} = "Bang NIH", 1, 0)', format: 'number' },
    { name: 'G_SELF', groups: { col: 'G_SELF', sets: [{ name: 'x', values: ['y'] }] } },
    { name: 'G_LOOP_A', groups: { col: 'G_LOOP_B', sets: [{ name: 'x', values: ['y'] }] } },
    { name: 'G_LOOP_B', groups: { col: 'G_LOOP_A', sets: [{ name: 'x', values: ['y'] }] } }]);
  // (2026-11-25, cgroups sweep) values with a line break, a tab or @@ (kept now: they went in as nothing); only patterns
  // both engines read alike (the rest take nothing in either: \p, [^], a++, \A, [[:alpha:]], \u, (a+)+, a{2000}, (?<=,
  // x{,3}, \1); . and \s as the browser reads them; a split cell's pieces without ; < >; a calculated column of a real
  // column's name left out (and no order of its own); the trim's own set (U+0085 and U+180E kept); a Percent and a date
  // column grouped as the page's row holds them
  G('grpSweep', [
    { name: 'V_CTRL', groups: { col: 'SPONSOR', sets: [{ name: 'Ctrl', values: ['line\nbreak', 'tab\there', '@@not html'] }], rest: 'other' } },
    { name: 'R_SUBSET', groups: { col: 'SPONSOR', sets: [
      { name: 'Cls', values: [], rule: { op: 'matches', v: '^[\\s\\d]+$' } },
      { name: 'Word', values: [], rule: { op: 'matches', v: '^\\w+$' } },
      { name: 'P', values: [], rule: { op: 'matches', v: '\\p{L}' } },
      { name: 'AnyCls', values: [], rule: { op: 'matches', v: '[^]' } },
      { name: 'Poss', values: [], rule: { op: 'matches', v: 'a++' } },
      { name: 'Anch', values: [], rule: { op: 'matches', v: '\\Aéclair' } },
      { name: 'Posix', values: [], rule: { op: 'matches', v: '[[:alpha:]]+' } },
      { name: 'Uni', values: [], rule: { op: 'matches', v: '\\u0041' } },
      { name: 'Nest', values: [], rule: { op: 'matches', v: '(a+)+$' } },
      { name: 'Big', values: [], rule: { op: 'matches', v: 'a{2000}' } },
      { name: 'Look', values: [], rule: { op: 'matches', v: '(?<=N)I' } },
      { name: 'NoCount', values: [], rule: { op: 'matches', v: 'x{,3}' } },
      { name: 'Back', values: [], rule: { op: 'matches', v: '(N)\\1' } },
      { name: 'Sp', values: [], rule: { op: 'matches', v: '^nc\\sstate$' } },
      { name: 'CR', values: [], rule: { op: 'matches', v: '^cr.lf$' } },
      { name: 'LS', values: [], rule: { op: 'matches', v: '^a.b$' } },
      { name: 'NL', values: [], rule: { op: 'matches', v: '^line.break$' } },
      { name: 'Two', values: [], rule: { op: 'matches', v: '^\\S+\\s\\S+$' } },
      { name: 'Hex', values: [], rule: { op: 'matches', v: '^\\x41' } },
      { name: 'NotSp', values: [], rule: { op: 'matches', v: '^[^\\s]+ [^\\s]+ [^\\s]+$' } }], rest: 'keep' } },
    { name: 'S_SAFE', groups: { col: 'SPONSOR', split: 'dpipe', sets: [{ name: 'Semi;Name', values: ['z'] }], rest: 'keep' } },
    { name: 'S_SAFEOTHER', groups: { col: 'SPONSOR', split: 'dpipe', sets: [{ name: 'Zed', values: ['z'] }], rest: 'other', other: 'Rest <x>' } },
    { name: 'DEPT', groups: { col: 'SPONSOR', sets: [{ name: 'F', values: ['NIH'] }], rest: 'other' } },
    { name: 'T_TRIM', groups: { col: 'SPONSOR', sets: [{ name: 'Nel', values: ['NEL', 'mvs'] }], rest: 'keep' } },
    { name: 'PCT', formula: '{AMT} / 100', format: 'percent' },
    { name: 'G_PCT', groups: { col: 'PCT', sets: [{ name: 'Five pct', values: ['5%'] }], rest: 'keep' } },
    { name: 'DT', formula: '"2026-01-01" + {AMT}', format: 'date:MM/DD/YYYY' },
    { name: 'G_DT', groups: { col: 'DT', sets: [{ name: 'Jan 6', values: ['2026-01-06'] }], rest: 'blank' } }],
    [[at('line\nbreak'), 'V_CTRL', 'Ctrl'], [at('tab\there'), 'V_CTRL', 'Ctrl'], [at('@@not html'), 'V_CTRL', 'Ctrl'], [at('NIH'), 'V_CTRL', 'Other'],
     [at('éclair'), 'R_SUBSET', 'éclair'], [at('NC State'), 'R_SUBSET', 'Sp'], [at('NC\u00a0State'), 'R_SUBSET', 'Sp'], [at('cr\rlf'), 'R_SUBSET', 'Two'],
     [at('a\u2028b'), 'R_SUBSET', 'Two'], [at('NIH'), 'R_SUBSET', 'Word'], [at('0123'), 'R_SUBSET', 'Cls'], [at('p{L}'), 'R_SUBSET', 'p{L}'],
     [at('nc state univ'), 'R_SUBSET', 'NotSp'], [at('AT&T'), 'R_SUBSET', 'Hex'],
     [at('a<b|c>d'), 'S_SAFE', 'a\u2039b; c\u203Ad'], [at('x;y|z'), 'S_SAFE', 'Semi,Name; x,y'],
     [at('a<b|c>d'), 'S_SAFEOTHER', 'Rest \u2039x\u203A'], [at('x;y|z'), 'S_SAFEOTHER', 'Zed; Rest \u2039x\u203A'],
     [at('\u0085NEL\u0085'), 'T_TRIM', '\u0085NEL\u0085'], [at('\u180Emvs\u180E'), 'T_TRIM', '\u180Emvs\u180E'],
     [5, 'G_PCT', 'Five pct'], [6, 'G_PCT', '6%'], [5, 'G_DT', 'Jan 6'], [6, 'G_DT', '']]);
  var many = [];
  for (var q = 0; q < 55; q++) many.push({ name: 'G' + q, values: ['v' + q] });
  var vals = [];
  for (var w = 0; w < 2100; w++) vals.push('val' + w);
  G('grpLimits', [
    { name: 'L_SETS', groups: { col: 'SPONSOR', sets: many, rest: 'keep' } },
    { name: 'L_VALUES', groups: { col: 'SPONSOR', sets: [{ name: 'Big', values: vals.concat(['NIH']) }, { name: 'Late', values: ['NSF'] }], rest: 'other' } }]);
  return { rows: rows, sets: sets };
})();
