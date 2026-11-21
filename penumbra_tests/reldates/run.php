<?php
/**
 * Rolling dates: TWO grammars, on purpose.
 *
 *   _sr_resolve_keyword_date()   SEARCH.  TODAY / NOW / SYSDATE [+-N] only.
 *   _sr_resolve_relative_date()  PROMPTS. The above PLUS English phrases.
 *
 * The split was made 2026-08-31. English phrases had briefly been readable in
 * search too, and they were a silent-zero trap there: the search bar tokenizes
 * on whitespace, so `LOG_DATE >= first day of this month` shattered into a value
 * of "first" plus four stray terms and returned nothing with no warning.
 * Requiring quotes to avoid silently wrong results was not a trade worth making
 * for a live search. A keyword is one token and cannot shatter, so it stayed.
 *
 * A prompt default is a whole field, never tokenized, so it keeps the full
 * grammar - which is where it lived before any of this and still works.
 *
 * mirror.php is extract_mirror.php's lift of schedule_runner.php. NEVER require
 * schedule_runner.php from a test - its top level opens Oracle and SENDS EMAIL.
 *   php ../pivotparity/extract_mirror.php <webroot>/schedule_runner.php mirror.php
 */
require __DIR__ . '/mirror.php';
// 2026-09-05: the search engine and the keyword-date resolvers live in
// penumbra_search.php (pure declarations, safe to require directly). A mirror
// lifted from an older runner still carries them, hence the guard.
$PNB_SEARCH_FILE = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_search.php';
if (!function_exists('php_apply_search_filter')) {
    require_once $PNB_SEARCH_FILE;
}
// (2026-11-20, promptfix4 Z1) Oracle literals go through shared_logic.php's penumbraOracleDateLiteral / penumbraOracleRRYear
// (four digits only when Oracle's RR rule would misread two). penumbra_search.php falls back to the old d-M-y without them,
// so lift them by name from the shared_logic.php beside the search file, when present (a build before Z1 has neither).
$PNB_ORACLE_HELPERS = array();
$sharedSrc = @file_get_contents(dirname($PNB_SEARCH_FILE) . DIRECTORY_SEPARATOR . 'shared_logic.php');
foreach (array('penumbraOracleRRYear', 'penumbraOracleDateLiteral') as $fn) {
    if (!function_exists($fn) && $sharedSrc && preg_match('/\nfunction ' . $fn . '\(.*?\n\}\n/s', $sharedSrc, $m)) { eval($m[0]); }
    if (function_exists($fn)) $PNB_ORACLE_HELPERS[] = $fn;
}
unset($sharedSrc);

$pass = 0; $fail = 0;
function check($label, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $label\n"; }
    else { $fail++; echo "  FAIL $label\n         got:  " . var_export($got, true) . "\n         want: " . var_export($want, true) . "\n"; }
}
function d($offsetDays) { return strtoupper(date('d-M-y', strtotime("$offsetDays days"))); }

echo "=== SEARCH grammar: _sr_resolve_keyword_date - keywords ONLY ===\n";
check('TODAY',         _sr_resolve_keyword_date('TODAY'),         d(0));
check('today (lower)', _sr_resolve_keyword_date('today'),         d(0));
check('TODAY-30',      _sr_resolve_keyword_date('TODAY-30'),      d(-30));
check('TODAY+7',       _sr_resolve_keyword_date('TODAY+7'),       d(7));
check('SYSDATE()-365', _sr_resolve_keyword_date('SYSDATE()-365'), d(-365));
check('SYSDATE-1',     _sr_resolve_keyword_date('SYSDATE-1'),     d(-1));
check('NOW-1',         _sr_resolve_keyword_date('NOW-1'),         d(-1));

// The rollback itself: every English phrase must be INERT for search.
foreach (array(
    'yesterday', 'tomorrow', '1 year ago', '3 months ago', 'last friday',
    'first day of this month', 'first day of last month', 'last day of last month',
    'first day of this quarter', 'first day of this year',
    'this fiscal year', 'last fiscal year', 'first day of last fiscal year',
) as $phrase) {
    check("english '$phrase' is NOT a search date", _sr_resolve_keyword_date($phrase), null);
}

// Values that were never dates and still are not.
foreach (array('May', 'Friday', 'Day', 'Smith', 'Water Resources', '', '01-JAN-24', '2025') as $t) {
    check("literal " . var_export($t, true) . " stays text", _sr_resolve_keyword_date($t), null);
}

echo "\n=== PROMPT grammar: _sr_resolve_relative_date - still the FULL vocabulary ===\n";
// The rollback must not have taken anything away from prompt defaults.
check('keyword still works',     _sr_resolve_relative_date('TODAY-30'),  d(-30));
check('yesterday',               _sr_resolve_relative_date('yesterday'), d(-1));
check('tomorrow',                _sr_resolve_relative_date('tomorrow'),  d(1));
// (2026-11-19, promptfix2 A3/C7) N years ago is clamped to the target month's last day (moment's rule), so
// on a 29-FEB it is 28-FEB, not strtotime's 01-MAR: expect the clamped date, whatever day the suite runs.
$ly = (int)date('Y') - 1; $lm = (int)date('n');
check('1 year ago',              _sr_resolve_relative_date('1 year ago'),
      strtoupper(date('d-M-y', mktime(0,0,0,$lm,min((int)date('j'),(int)date('t', mktime(0,0,0,$lm,1,$ly))),$ly))));
check('first day of this month', _sr_resolve_relative_date('first day of this month'),
      strtoupper(date('d-M-y', mktime(0,0,0,(int)date('n'),1,(int)date('Y')))));

// NC State FY runs Jul 1 -> Jun 30, LABELLED BY THE YEAR IT ENDS. Derived, not
// hardcoded, so these stay correct whenever the suite is run.
$fyStart = ((int)date('n') >= 7) ? (int)date('Y') : (int)date('Y') - 1;
check('this fiscal year (number)',     _sr_resolve_relative_date('this fiscal year'), (string)($fyStart + 1));
check('last fiscal year (number)',     _sr_resolve_relative_date('last fiscal year'), (string)$fyStart);
check('first day of this fiscal year', _sr_resolve_relative_date('first day of this fiscal year'),
      strtoupper(date('d-M-y', mktime(0,0,0,7,1,$fyStart))));
// (2026-11-20, promptfix4 Z1) a date the RR rule would misread in two digits is written in four; recent dates keep two.
if (count($PNB_ORACLE_HELPERS) === 2 && function_exists('_sr_oracle_date')) {
    $cy = (int)date('Y') - 100; $cm = (int)date('n');
    $c100 = mktime(0,0,0,$cm,min((int)date('j'),(int)date('t', mktime(0,0,0,$cm,1,$cy))),$cy);
    check('100 years ago is four-digit',  _sr_resolve_relative_date('100 years ago'), strtoupper(date('d-M-', $c100)) . date('Y', $c100));
    $c36500 = strtotime('-36500 days');
    check('TODAY-36500 is four-digit',    _sr_resolve_relative_date('TODAY-36500'), strtoupper(date('d-M-', $c36500)) . date('Y', $c36500));
    check('TODAY-36500 search keyword too', _sr_resolve_keyword_date('TODAY-36500'), strtoupper(date('d-M-', $c36500)) . date('Y', $c36500));
    check('1 year ago stays two-digit',   strlen((string)_sr_resolve_relative_date('1 year ago')), 9);
    check('TODAY-30 stays two-digit',     _sr_resolve_relative_date('TODAY-30'), d(-30));
} else {
    echo "  note four-digit century checks skipped: no penumbraOracleDateLiteral / _sr_oracle_date in this build\n";
}
// Still not a blanket strtotime: a surname or bare weekday is text.
check('prompt: literal May stays text',    _sr_resolve_relative_date('May'), null);
check('prompt: literal Friday stays text', _sr_resolve_relative_date('Friday'), null);

echo "\n=== end to end through the scheduled-email search filter ===\n";
$rows = array();
foreach (array(-400, -200, -45, -20, -5, 5) as $i => $off) {
    $rows[] = array('ID' => (string)($i + 1), 'LOG_DATE' => strtoupper(date('d-M-y', strtotime("$off days"))), 'NOTE' => 'today');
}
function ids($res) { $o = array(); foreach ($res as $r) { $o[] = $r['ID']; } sort($o); return implode(',', $o); }

check('LOG_DATE > TODAY-30  (rolling window)',
    ids(php_apply_search_filter($rows, 'flat', 'LOG_DATE > TODAY-30')), '4,5,6');
check('LOG_DATE > TODAY-100 keeps more',
    ids(php_apply_search_filter($rows, 'flat', 'LOG_DATE > TODAY-100')), '3,4,5,6');
check('LOG_DATE < TODAY excludes the future row',
    ids(php_apply_search_filter($rows, 'flat', 'LOG_DATE < TODAY')), '1,2,3,4,5');
check('SYSDATE()-30 is the same window as TODAY-30',
    ids(php_apply_search_filter($rows, 'flat', 'LOG_DATE > SYSDATE()-30')), '4,5,6');

// The guard that keeps a text column safe.
check('NOTE = today matches the literal word, not a date',
    ids(php_apply_search_filter($rows, 'flat', 'NOTE = today')), '1,2,3,4,5,6');

// Negative control: an unresolvable expression still matches nothing. This is
// what the whole feature looked like before it existed - if it ever starts
// matching, the fixture stopped being representative.
check('CONTROL an unresolvable expression matches nothing',
    ids(php_apply_search_filter($rows, 'flat', 'LOG_DATE > NOTADATE-30')), '');

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
