// bracespace - the browser engine (main.js parseAdvancedQuery / evaluateParsedQuery /
// splitGroupSummaryQuery / _pnbCanonBraceTokens), exported by run.ps1's patch as
// window.__BS at the ready closure's first statement. The case and canon tables are the
// SAME as test_bracespace.php's, so the three engines are held to one answer.
(function () {
  function report(txt) { document.getElementById('out').textContent = txt; }
  var results = [];
  function eq(got, want, label) {
    var same = JSON.stringify(got) === JSON.stringify(want);
    var r = { ok: same, label: label };
    if (!same) { r.want = want; r.got = got; }
    results.push(r);
  }

  function run() {
    var BS = window.__BS;
    if (!BS) {
      report('BS_UNAVAILABLE err=' + (window.__BS_ERR || 'n/a') + ' pageErrors=' + JSON.stringify((window.__errors || []).slice(0, 3)));
      return;
    }
    var cols = ['DEPT', 'AWARD AMOUNT', 'BUDGET', 'STATUS', 'DONE', 'DEPT2'];
    // main.js upper-cases row-map keys at ingestion; mirror that.
    var map = new Map([['DEPT', 'Chemistry'], ['AWARD AMOUNT', '500'], ['BUDGET', '400'], ['STATUS', 'Active'], ['DONE', '1'], ['DEPT2', 'Chemistry']]);
    var cases = [
      ['{DEPT} = Chemistry',                             true,  'control: {DEPT}'],
      ['DEPT = Chemistry',                               true,  'control: bare name'],
      ["'Award Amount' > 100",                           true,  'control: quoted name'],
      ['{ DEPT } = Chemistry',                           true,  '{ DEPT }'],
      ['{DEPT } = Chemistry',                            true,  '{DEPT }'],
      ['{ dept} = Chemistry',                            true,  '{ dept} (lower case)'],
      ["{ 'Award Amount' } > 100",                       true,  "{ 'Award Amount' } (quoted, spaced)"],
      ['{ "STATUS" } != Closed',                         true,  '{ "STATUS" } !='],
      ['{ Award Amount } > 100',                         true,  '{ Award Amount } (multi-word, no quotes)'],
      ['{ DEPT } = Physics',                             false, 'negative: a spaced column still COMPARES (not match-all)'],
      ['{ AWARD AMOUNT } > { BUDGET }',                  true,  'column vs column, spaced on BOTH sides'],
      ['{AWARD AMOUNT} < { BUDGET }',                    false, 'column vs column, negative'],
      ['{ DEPT } = Physics OR { STATUS } = Active',      true,  'OR across spaced columns'],
      ['{ DEPT } = Chemistry AND { STATUS } = Closed',   false, 'AND across spaced columns'],
      // Equality against a duplicate column: an unresolved reference reads '' and CANNOT pass
      // by accident (a ">" against '' may compare as text and come out true).
      ['{ DEPT } = { DEPT2 }',                           true,  'column = column, spaced'],
      ['{DEPT} != { DEPT2 }',                            false, 'column != column, spaced value side'],
      // Grammar aligned with the browser (2026-09-23 night) - the SAME rows as test_bracespace.php.
      ['{ DEPT } Chem',                                  true,  '{COLUMN} VALUE = implicit contains'],
      ['{DEPT} Phys',                                    false, '{COLUMN} VALUE, negative'],
      ['{ STATUS } Chem',                                false, '{COLUMN} VALUE tests THAT column, not the whole row'],
      ['DEPT CONTAINS chem',                             true,  'the word operator, any case'],
      ['{ STATUS } contains act',                        true,  '{ COLUMN } contains VALUE'],
      ['DEPT contains Chem AND STATUS = Active',         true,  'contains inside AND'],
      ['contains',                                       false, 'a bare "contains" is a search term (no cell holds that word)'],
      ['contains Chem',                                  false, '"contains Chem" = two search terms, not an operator-led search'],
      ['Chemistry contains mist',                        false, 'after a NON-column word, contains is not a literal comparison (three terms, "contains" matches nothing)']
    ];
    cases.forEach(function (c) {
      var got;
      try { got = !!BS.epq(map, BS.paq(c[0], cols), cols); } catch (e) { got = 'THREW ' + String(e && e.message ? e.message : e); }
      eq(got, c[1], 'A match: ' + c[2] + '   [' + c[0] + ']');
    });
    try {
      var p = BS.paq('{ DEPT } = Chemistry', cols);
      eq([p[0].type, p[0].column], ['condition', 'DEPT'], 'A parse: "{ DEPT }" -> column DEPT');
      p = BS.paq("{ 'Award Amount' } > 100", cols);
      eq(p[0].column, 'AWARD AMOUNT', "A parse: \"{ 'Award Amount' }\" -> AWARD AMOUNT");
      eq(!!BS.epq(map, [{ type: 'condition', column: '{ DEPT }', op: '=', value: 'Chemistry' }], cols), true,
         'A evaluator: a hand-built condition carrying "{ DEPT }" (getCellValue strip)');
      var s = BS.sgsq([{ type: 'condition', column: '{ COUNT }', op: '>', value: '5' }], 'COUNT');
      eq(s.summaryConds.length, 1, 'A group summary split: "{ COUNT } > 5" is the summary condition');
    } catch (e) {
      eq('THREW ' + String(e && e.message ? e.message : e), 'no throw', 'A parse / evaluator / split');
    }
    var canon = [
      ['{ DEPT } = x',                    '{DEPT} = x'],
      ['A = {  EMPL_ID4  } AND {OUC}',    'A = {EMPL_ID4} AND {OUC}'],
      ['A = "{ DEPT }"',                  'A = "{DEPT}"'],
      ["A = '{ DEPT }'",                  "A = '{DEPT}'"],
      ['A = //{ DEPT }//',                'A = //{DEPT}//'],
      ['LEAD_UNIT = /^{ OUCS2D }/',       'LEAD_UNIT = /^{OUCS2D}/'],
      ['A = /\\{ DEPT \\}/',              'A = /\\{ DEPT \\}/'],
      ['A = /x{2}/ AND B = /y{ 2,3 }/',   'A = /x{2}/ AND B = /y{ 2,3 }/'],
      ['{ Award Amount } > 1',            '{ Award Amount } > 1'],
      ['no braces at all',                'no braces at all']
    ];
    canon.forEach(function (c) {
      var got;
      try { got = BS.canon(c[0]); } catch (e) { got = 'THREW ' + String(e && e.message ? e.message : e); }
      eq(got, c[1], 'canon (browser twin): ' + c[0]);
    });
    report('RESULTS_JSON:' + JSON.stringify({ pageErrors: (window.__errors || []).slice(0, 6), results: results }));
  }

  var tries = 0;
  (function wait() {
    tries++;
    if (window.__BS || tries > 60) { setTimeout(run, 400); }
    else { setTimeout(wait, 100); }
  })();
})();
