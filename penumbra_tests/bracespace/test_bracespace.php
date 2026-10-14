<?php
/**
 * bracespace - "{ DEPT }" is "{DEPT}" in every Search Filter engine (2026-09-23).
 *
 *   php -n test_bracespace.php <app dir> <engine-C extract>
 *
 * run.ps1 makes the extract with parity\extract_engine_c.php (every function the runner
 * DECLARES, function_exists-guarded; schedule_runner.php itself is NEVER required - it would
 * open Oracle and start sending). This file covers the two PHP engines; tests.js covers the
 * browser engine (main.js parseAdvancedQuery / evaluateParsedQuery) in headless Edge.
 *
 *   B = penumbra_search.php  php_parse_search_query / php_evaluate_search_row (the runner's
 *       Search Filter, php_apply_search_filter, the subscription condition)
 *   C = schedule_runner.php  parse_format_condition / evaluate_format_condition (formatting,
 *       snippets, the group summary filter)
 *
 * WHAT BROKE. Each engine stripped "{" "}" (and an optional quote) from a column name but
 * never the spaces inside, so "{ DEPT } = x" looked up the column " DEPT " and silently
 * matched nothing; a value-side reference "> { BUDGET }" did the same. THE HAZARD the fix
 * had to handle: a scheduled per-recipient filter substitutes the EXACT token {DEPT}, so a
 * spaced one was never substituted - once the parsers read "{ DEPT }" as the column DEPT,
 * "DEPT_NAME = { DEPT }" would compare the row against itself and send every recipient
 * every row. penumbraCanonicalBraceTokens() collapses "{ DEPT }" to "{DEPT}" before any
 * substitution (runner options decode, php_apply_search_filter, the group-summary resolver).
 *
 * Tail: "PASS: N   FAIL: 0" then "RESULT: GREEN".
 */
$app = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
$extract = isset($argv[2]) ? $argv[2] : '';
if (!is_file($app . '/penumbra_search.php') || !is_file($extract)) {
    echo "usage: php -n test_bracespace.php <app dir> <engine-C extract>\nRESULT: RED\n";
    return;
}
date_default_timezone_set('America/New_York');
// journal_export.php is not loaded here; the toggle normalizers only need its contract.
function journalToggleWantExport($v) {
    $v = trim((string)$v);
    if ($v === "\xE2\x98\x91" || $v === '1' || strtolower($v) === 'yes') return true;
    if ($v === "\xE2\x98\x90" || $v === '0' || strtolower($v) === 'no') return false;
    return null;
}
function penumbra_resolve_css_vars($css) { return $css; }   // themes_config.php (as parity's harness)
require $app . '/penumbra_search.php';
require $extract;

$PASS = 0; $FAIL = 0;
function ok($cond, $label) { global $PASS, $FAIL; if ($cond) { $PASS++; echo "  ok   $label\n"; } else { $FAIL++; echo "  FAIL $label\n"; } }
function eq($got, $want, $label) {
    global $PASS, $FAIL;
    if ($got === $want) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label\n       want: " . var_export($want, true) . "\n       got:  " . var_export($got, true) . "\n"; }
}

$row  = array('DEPT' => 'Chemistry', 'AWARD AMOUNT' => '500', 'BUDGET' => '400', 'STATUS' => 'Active', 'DONE' => '1', 'DEPT2' => 'Chemistry');
$cols = array('DEPT', 'AWARD AMOUNT', 'BUDGET', 'STATUS', 'DONE', 'DEPT2');
// query => expected match for $row (tests.js holds the SAME table for the browser engine)
$cases = array(
    array('{DEPT} = Chemistry',                             true,  'control: {DEPT}'),
    array('DEPT = Chemistry',                               true,  'control: bare name'),
    array("'Award Amount' > 100",                           true,  'control: quoted name'),
    array('{ DEPT } = Chemistry',                           true,  '{ DEPT }'),
    array('{DEPT } = Chemistry',                            true,  '{DEPT }'),
    array('{ dept} = Chemistry',                            true,  '{ dept} (lower case)'),
    array("{ 'Award Amount' } > 100",                       true,  "{ 'Award Amount' } (quoted, spaced)"),
    array('{ "STATUS" } != Closed',                         true,  '{ "STATUS" } !='),
    array('{ Award Amount } > 100',                         true,  '{ Award Amount } (multi-word, no quotes)'),
    array('{ DEPT } = Physics',                             false, 'negative: a spaced column still COMPARES (not match-all)'),
    array('{ AWARD AMOUNT } > { BUDGET }',                  true,  'column vs column, spaced on BOTH sides'),
    array('{AWARD AMOUNT} < { BUDGET }',                    false, 'column vs column, negative'),
    array('{ DEPT } = Physics OR { STATUS } = Active',      true,  'OR across spaced columns'),
    array('{ DEPT } = Chemistry AND { STATUS } = Closed',   false, 'AND across spaced columns'),
    // Equality against a duplicate column: an unresolved reference reads '' and CANNOT pass
    // by accident (a ">" against '' may compare as text and come out true).
    array('{ DEPT } = { DEPT2 }',                           true,  'column = column, spaced'),
    array('{DEPT} != { DEPT2 }',                            false, 'column != column, spaced value side'),
    // Grammar aligned with the browser (2026-09-23 night): {COLUMN} VALUE = implicit contains in
    // ALL three engines (penumbra_search.php had two global terms), and `contains` is a word
    // operator after a column (neither PHP engine had it) - a bare `contains` stays a search term.
    array('{ DEPT } Chem',                                  true,  '{COLUMN} VALUE = implicit contains'),
    array('{DEPT} Phys',                                    false, '{COLUMN} VALUE, negative'),
    // Discriminating: read as two GLOBAL terms, "{ STATUS }" resolves to 'Active' (found in the
    // row) and 'Chem' is found in DEPT - true. {COLUMN} VALUE tests STATUS only - false.
    // ("{ DEPT } Chem" above cannot tell the two readings apart: both come out true.)
    array('{ STATUS } Chem',                                false, '{COLUMN} VALUE tests THAT column, not the whole row'),
    array('DEPT CONTAINS chem',                             true,  'the word operator, any case'),
    array('{ STATUS } contains act',                        true,  '{ COLUMN } contains VALUE'),
    array('DEPT contains Chem AND STATUS = Active',         true,  'contains inside AND'),
    array('contains',                                       false, 'a bare "contains" is a search term (no cell holds that word)'),
    array('contains Chem',                                  false, '"contains Chem" = two search terms, not an operator-led search'),
    array('Chemistry contains mist',                        false, 'after a NON-column word, contains is not a literal comparison (three terms, "contains" matches nothing)'),
);

// ---------------------------------------------------------------- B
echo "B. penumbra_search.php (the runner's Search Filter)\n";
foreach ($cases as $c) {
    $p = php_parse_search_query($c[0], $cols);
    eq(php_evaluate_search_row($row, $p, $cols), $c[1], 'B match: ' . $c[2] . '   [' . $c[0] . ']');
}
$p = php_parse_search_query('{ DEPT } = Chemistry', $cols);
eq(array($p[0]['type'], $p[0]['column']), array('condition', 'DEPT'), 'B parse: "{ DEPT }" -> column DEPT');
$p = php_parse_search_query("{ 'Award Amount' } > 100", $cols);
eq($p[0]['column'], 'AWARD AMOUNT', "B parse: \"{ 'Award Amount' }\" -> AWARD AMOUNT");
eq(php_evaluate_search_row($row, array(array('type' => 'condition', 'column' => '{ DEPT }', 'op' => '=', 'value' => 'Chemistry')), $cols), true,
    'B evaluator: a hand-built condition carrying "{ DEPT }" (its own brace strip)');
$t = _journal_normalize_toggle_conditions(array(array('type' => 'condition', 'column' => '{ DONE }', 'op' => '=', 'value' => "\xE2\x98\x91")), array('colNames' => array('Done')));
eq($t[0]['value'], '1', 'B toggle normalizer: "{ DONE } = [checked box]" -> 1');

// ---------------------------------------------------------------- canonicalizer
echo "N. penumbraCanonicalBraceTokens (\"{ DEPT }\" -> \"{DEPT}\" before any recipient substitution)\n";
$canon = array(   // input => expected (tests.js holds the SAME table for _pnbCanonBraceTokens)
    array('{ DEPT } = x',                    '{DEPT} = x'),
    array('A = {  EMPL_ID4  } AND {OUC}',    'A = {EMPL_ID4} AND {OUC}'),
    // Inside quotes and patterns TOO (2026-09-23 night): the substitution maps replace a token
    // there ("{DEPT}", /^{OUC2D}/), so skipping those spans let "{ DEPT }" escape substitution.
    array('A = "{ DEPT }"',                  'A = "{DEPT}"'),
    array("A = '{ DEPT }'",                  "A = '{DEPT}'"),
    array('A = //{ DEPT }//',                'A = //{DEPT}//'),
    array('LEAD_UNIT = /^{ OUCS2D }/',       'LEAD_UNIT = /^{OUCS2D}/'),
    array('A = /\\{ DEPT \\}/',              'A = /\\{ DEPT \\}/'),      // escaped braces are pattern text
    array('A = /x{2}/ AND B = /y{ 2,3 }/',   'A = /x{2}/ AND B = /y{ 2,3 }/'),   // quantifiers are not identifiers
    array('{ Award Amount } > 1',            '{ Award Amount } > 1'),
    array('no braces at all',                'no braces at all'),
);
foreach ($canon as $c) eq(penumbraCanonicalBraceTokens($c[0]), $c[1], 'canon: ' . $c[0]);
eq(penumbraCanonicalBraceTokens(null), null, 'canon: a non-string passes through');

echo "H. the hazard: a per-recipient filter with a SPACED recipient variable\n";
$data = array(
    array('DEPT_NAME' => 'Chemistry', 'DEPT' => 'Chemistry', 'AMT' => '1'),
    array('DEPT_NAME' => 'Physics',   'DEPT' => 'Physics',   'AMT' => '2'),
    array('DEPT_NAME' => 'Biology',   'DEPT' => 'Biology',   'AMT' => '3'),
);
$recip = array('dept' => 'Chemistry');
$got = php_apply_search_filter($data, 'standard', 'DEPT_NAME = { DEPT }', $recip);
eq(array_values(array_map(function ($r) { return $r['DEPT_NAME']; }, $got)), array('Chemistry'),
    'php_apply_search_filter: "DEPT_NAME = { DEPT }" for a Chemistry recipient = ONLY Chemistry (not every row)');
$got = php_apply_search_filter($data, 'standard', 'DEPT_NAME = {DEPT}', $recip);
eq(count($got), 1, '...the unspaced control: 1 row');
$got = php_apply_search_filter($data, 'standard', 'DEPT_NAME = "{ DEPT }"', $recip);
eq(array_values(array_map(function ($r) { return $r['DEPT_NAME']; }, $got)), array('Chemistry'),
    '...QUOTED too: "DEPT_NAME = \"{ DEPT }\"" = only Chemistry (a normalizer that skipped quotes left it to be read as the DEPT column)');
eq(_cf_resolve_filter_recipient_vars('DEPT_NAME = { DEPT } AND X = "{ DEPT }"', $recip), 'DEPT_NAME = Chemistry AND X = "Chemistry"',
    '_cf_resolve_filter_recipient_vars (group summary filter): spaced tokens are substituted, quoted ones included - like "{DEPT}" always was');

// ---------------------------------------------------------------- C
echo "C. schedule_runner.php parse_format_condition / evaluate_format_condition\n";
foreach ($cases as $c) {
    $p = parse_format_condition($c[0], $cols);
    eq((bool)evaluate_format_condition($row, $p), $c[1], 'C match: ' . $c[2] . '   [' . $c[0] . ']');
}
$p = parse_format_condition('{ DEPT } = Chemistry', $cols);
eq(array($p[0]['type'], $p[0]['column']), array('condition', 'DEPT'), 'C parse: "{ DEPT }" -> column DEPT');
$p = parse_format_condition("{ 'Award Amount' } > 100", $cols);
eq($p[0]['column'], 'AWARD AMOUNT', "C parse: \"{ 'Award Amount' }\" -> AWARD AMOUNT");
eq((bool)evaluate_format_condition($row, array(array('type' => 'condition', 'column' => '{ DEPT }', 'op' => '=', 'value' => 'Chemistry'))), true,
    'C evaluator: a hand-built "{ DEPT }" condition (_cf_get_cell_value strip)');
$s = _cf_split_group_summary_query(array(array('type' => 'condition', 'column' => '{ COUNT }', 'op' => '>', 'value' => '5')), 'COUNT');
eq(count($s['summaryConds']), 1, 'C group summary split: "{ COUNT } > 5" is the summary condition');
$t = _snippet_normalize_toggle_tree(array(array('type' => 'condition', 'column' => '{ DONE }', 'op' => '=', 'value' => "\xE2\x98\x91")), array('colNames' => array('Done')));
eq($t[0]['value'], '1', 'C toggle normalizer: "{ DONE } = [checked box]" -> 1');

// ---------------------------------------------------------------- wiring
echo "W. the runner normalizes a task's filter + skip condition ONCE, as it loads the options\n";
$r = file_get_contents($app . '/schedule_runner.php');
$dec = strpos($r, '$options = safe_json_decode($raw_options_str);');
$can = strpos($r, "foreach (array('search_filter', 'custom_condition_expr', 'custom_condition') as \$cbKey) {");
ok($dec !== false && $can !== false && $can > $dec && $can - $dec < 1200
    && strpos($r, '$options[$cbKey] = penumbraCanonicalBraceTokens($options[$cbKey]);', $can) !== false,
    'runner: right after the options decode, before anything reads them');
$mj = is_file($app . '/js/main.js') ? file_get_contents($app . '/js/main.js') : '';
ok(strpos($mj, "if (re.test(_pnbCanonBraceTokens(\$('#schedSearchFilter').val() || ''))) return true;") !== false
    && strpos($mj, "re.test(_pnbCanonBraceTokens(\$('#schedCustomConditionExpr').val() || ''))) return true;") !== false,
    'main.js schedTaskIsPerRecipient: the filter and the skip condition are tested normalized, like the runner');
ok(strpos($mj, "|EMPL_CLASS|EMPL_STATUS|PI_ELIGIBLE)\\}/i.test(_pnbCanonBraceTokens(expr))") !== false,
    'main.js skip-condition validator: "{ PI_ELIGIBLE } = 0" counts as a recipient variable');
ok(strpos($mj, "var hasVarTokens = /\\{[A-Z_][A-Z0-9_]*\\}/i.test(_pnbCanonBraceTokens(filterText));") !== false,
    'main.js scheduler filter hint: "{ DEPT }" reads as "varies per recipient", as the runner will treat it');

echo "\nPASS: $PASS   FAIL: $FAIL\n";
echo 'RESULT: ' . ($FAIL === 0 ? 'GREEN' : 'RED') . "\n";
