<?php
/**
 * Per-value-column currency formatting - PHP side.
 *
 * The pivot used to carry ONE currency flag for the whole table, sniffed from
 * the PRIMARY value field alone and then applied to every aggregation column
 * that was not count-like. A pivot mixing units - Sum(SUBAWARD_COUNT) beside
 * Sum(AMOUNT_TOTAL) - therefore printed a plain tally as "$2". The mirror-image
 * was just as wrong: with a plain column as `vals`, a money OVERRIDE column
 * lost its "$".
 *
 * Neither broad harness can see this. pivotparity diffs AGGREGATION functions,
 * not formatting; builder_diff's fixture has a single value column, so its three
 * builders always agreed about a flag that was uniform by construction.
 *
 *   php verify_pivot_currency.php
 */
require_once __DIR__ . '/pivot_mirror.php';
require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
$theme_styles = penumbra_build_theme_styles();

$pass = 0; $fail = 0; $failures = array();
function ok($cond, $label) {
    global $pass, $fail, $failures;
    if ($cond) { $pass++; } else { $fail++; $failures[] = $label; }
}

// ---------------------------------------------------------------- fixture ---
// MONEY carries a literal '$' in the SOURCE (that is the only thing either
// engine sniffs); WIDGETS is a plain integer count. Magnitudes are chosen so no
// MONEY subtotal can ever equal a WIDGETS subtotal - that is what lets the
// assertions below key off the printed number alone.
// The grid keeps a HOLE (Arts has no 2024) so the empty-cell path is rendered,
// per the lesson recorded in the parity-harness notes.
$rows = array(
    array('COLLEGE'=>'Engineering','FY'=>'2024','MONEY'=>'$1,000','WIDGETS'=>'3'),
    array('COLLEGE'=>'Engineering','FY'=>'2024','MONEY'=>'$9,000','WIDGETS'=>'4'),
    array('COLLEGE'=>'Engineering','FY'=>'2025','MONEY'=>'$10',   'WIDGETS'=>'5'),
    array('COLLEGE'=>'Engineering','FY'=>'2025','MONEY'=>'$10',   'WIDGETS'=>'6'),
    array('COLLEGE'=>'Sciences',   'FY'=>'2024','MONEY'=>'$100',  'WIDGETS'=>'13'),
    array('COLLEGE'=>'Sciences',   'FY'=>'2025','MONEY'=>'$9,900','WIDGETS'=>'17'),
    array('COLLEGE'=>'Arts',       'FY'=>'2025','MONEY'=>'$5',    'WIDGETS'=>'19'),
);
// Per-cell and column-footer money subtotals. The GRAND-TOTAL COLUMN's money
// value (20025) is checked in section E: CSV and XLSX printed the wrong NUMBER in
// that column until 2026-09-25, so it was kept out of these lists.
$MONEY_SUMS   = array(10000, 20, 100, 9900, 5);
$WIDGET_SUMS  = array(7, 11, 13, 17, 19, 67);

function settings($vals, $aggs, $overrides = null) {
    $s = array('rows'=>array('COLLEGE'), 'cols'=>array('FY'), 'vals'=>$vals,
               'agg'=>$aggs, 'rowLayout'=>'flat', 'colLayout'=>'flat', 'sortOrder'=>'asc');
    if ($overrides !== null) { $s['aggColOverrides'] = $overrides; }
    return $s;
}

// Render one fixture through all three builders and return DELIMITED cell text.
// The delimiter is load-bearing: a bare strip_tags() butts one cell against the
// next, so "$10,000" followed by a "7" cell reads as "$10,0007" and the
// end-of-number assertion below rejects a value that was in fact formatted
// correctly. First run of this file reported 16 such phantom failures - all of
// them "money is missing its $", none of them the direction that matters.
// Keep every cell separated.
function render_all($rows, $set) {
    global $theme_styles;
    $out = array();

    $html = generate_pivot_html($rows, $set, 'theme-default', true);
    $html = preg_replace('/<\/(?:td|th|tr)>/i', ' | ', $html);
    $out['HTML'] = strip_tags($html);

    $cells = array();
    foreach (explode("\n", generate_pivot_csv_string($rows, $set)) as $line) {
        if (trim($line) === '') { continue; }
        foreach (str_getcsv($line) as $c) { $cells[] = (string)$c; }
    }
    $out['CSV'] = implode(' | ', $cells);

    $x = pivot_build_xlsx_rows($rows, $set);
    $flat = array();
    foreach ($x['dataRows'] as $r) { foreach ($r as $c) { $flat[] = (string)$c; } }
    if (!empty($x['footerRow'])) { foreach ($x['footerRow'] as $c) { $flat[] = (string)$c; } }
    $out['XLSX'] = implode(' | ', $flat);
    return $out;
}

// Does "$<n>" appear, not as the prefix of a longer number?
function has_dollar($text, $n) {
    return (bool)preg_match('/\$' . preg_quote(number_format($n), '/') . '(?![\d,])/', $text);
}

echo "=== A. pivot_format_value unit contract ===\n";
ok(pivot_format_value(5, 'sum', array(true, false), 0, true, null, 0) === '$5',  'A1 array flag idx0 -> $');
ok(pivot_format_value(5, 'sum', array(true, false), 0, true, null, 1) === '5',   'A2 array flag idx1 -> plain');
ok(pivot_format_value(5, 'sum', array(true, false), 0, true, null, null) === '$5','A3 null idx falls back to idx0');
ok(pivot_format_value(5, 'sum', true,  0, true) === '$5', 'A4 legacy bool true still works');
ok(pivot_format_value(5, 'sum', false, 0, true) === '5',  'A5 legacy bool false still works');
ok(pivot_format_value(5, 'count', array(true, true), 0, true, null, 0) === '5', 'A6 count-like never gets $');
ok(pivot_format_value(5, 'sum', array(), 0, true, null, 0) === '5', 'A7 empty flag array -> plain');
echo "  $pass passed so far\n\n";

echo "=== B. mixed units, MONEY is the primary value field ===\n";
$r = render_all($rows, settings('MONEY', array('sum','sum'), array('MONEY','WIDGETS')));
foreach ($r as $builder => $text) {
    foreach ($MONEY_SUMS as $m)  { ok(has_dollar($text, $m),  "B $builder: money $m should carry \$"); }
    foreach ($WIDGET_SUMS as $w) { ok(!has_dollar($text, $w), "B $builder: widgets $w must NOT carry \$"); }
}
echo "  $pass passed so far\n\n";

echo "=== C. mirror image - WIDGETS primary, MONEY as the override ===\n";
$r = render_all($rows, settings('WIDGETS', array('sum','sum'), array('WIDGETS','MONEY')));
foreach ($r as $builder => $text) {
    foreach ($MONEY_SUMS as $m)  { ok(has_dollar($text, $m),  "C $builder: money $m should carry \$"); }
    foreach ($WIDGET_SUMS as $w) { ok(!has_dollar($text, $w), "C $builder: widgets $w must NOT carry \$"); }
}
echo "  $pass passed so far\n\n";

echo "=== D. regression guards - uniform pivots behave exactly as before ===\n";
$r = render_all($rows, settings('MONEY', array('sum')));
foreach ($r as $builder => $text) {
    ok(has_dollar($text, 10000), "D $builder: all-money pivot keeps \$");
    ok(has_dollar($text, 20025), "D $builder: all-money grand total keeps \$");
}
$r = render_all($rows, settings('WIDGETS', array('sum')));
foreach ($r as $builder => $text) {
    ok(!has_dollar($text, 7),  "D $builder: all-plain pivot has no \$");
    ok(!has_dollar($text, 67), "D $builder: all-plain grand total has no \$");
}
$r = render_all($rows, settings('MONEY', array('count')));
foreach ($r as $builder => $text) {
    ok(!has_dollar($text, 2), "D $builder: count on a money column stays unprefixed");
}
echo "\n";

echo "=== E. Grand Total column with aggColOverrides (FIXED 2026-09-25, now asserted) ===\n";
// With aggColOverrides in play and no row-total override, generate_pivot_csv_string()
// and pivot_build_xlsx_rows() printed the FIRST aggregation's value in BOTH slots
// of the Grand Total column pair, where generate_pivot_html() computes each one.
// For the case-C fixture HTML gives 19 / $5, 18 / $10,020, 30 / $10,000,
// 67 / $20,025 while CSV and XLSX gave 19 / 19, 18 / 18, 30 / 30, 67 / 67 (their
// value map was empty without an override, so every slot fell back to value 0).
// Reported-only from 09-01 until the 09-25 fix; fyreports\test_gtvalues.php holds
// the cell-by-cell checks, this keeps the original symptom pinned.
$r = render_all($rows, settings('WIDGETS', array('sum','sum'), array('WIDGETS','MONEY')));
$gt = number_format(20025);
foreach ($r as $builder => $text) {
    ok(has_dollar($text, 20025), "E $builder: grand-total money \$$gt present (not the first value repeated)");
}
echo "\n";

echo str_repeat('=', 62) . "\n";
echo "PASS $pass   FAIL $fail\n";
foreach ($failures as $f) { echo "  FAILED: $f\n"; }
