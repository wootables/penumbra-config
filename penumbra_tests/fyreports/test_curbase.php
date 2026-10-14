<?php
/**
 * A derived value takes its BASE's currency (2026-09-26) - the scheduled-email /
 * export half: pivot_currency_flags and the three builders that route through
 * it, generate_pivot_html, generate_pivot_csv_string and pivot_build_xlsx_rows
 * (which also feeds PDF).
 *
 * The '$' flag was decided per aggregation slot from aggColOverrides[slot], else
 * the primary value field. A derived slot has no override of its own, so a
 * Running Total right after Sum(AWARDS) took the PRIMARY field's '$' ("$6"
 * awards on ?id=fycompawd), and under a plain primary a Running Total of a money
 * override lost its '$'. Now a derived type that reports in its base's units
 * (pivot_inherits_base_units: Running Total, Change, YTD, rolling, prior year)
 * is judged by its base's column - the column its numbers come from.
 *
 * schedule_runner.php is NEVER required (it opens Oracle and sends mail); its
 * functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_curbase.php                     live runner
 *   php -n test_curbase.php --runner=<path>     a staged copy
 *   php -n test_curbase.php --mutant=curbase    the fix undone (must turn exactly
 *                                               the non-guard checks red)
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_curbase.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }
$src = file_get_contents($runner);
// The fix undone by exact text; the anchor must occur the stated number of times
// or the suite refuses to run (a stale anchor reads as GREEN).
$MUTANTS = array(
    'curbase' => array("? pivot_find_base_agg_idx(\$aggTypes, \$i) : \$i;", "? \$i : \$i;", 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_curbase.php';
file_put_contents($tmp, $src);
exec(escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmp) . ' ' . escapeshellarg($mirror), $exOut, $exCode);
@unlink($tmp);
if ($exCode !== 0 || !file_exists($mirror)) { fwrite(STDERR, "extract_mirror failed: " . implode("\n", $exOut) . "\n"); exit(2); }
require_once $mirror;
$themesCfg = dirname($runner) . '/themes_config.php';
if (!file_exists($themesCfg)) $themesCfg = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
require_once $themesCfg;
$GLOBALS['theme_styles'] = penumbra_build_theme_styles();

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $detail = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  PASS  $label\n"; return; }
    $FAIL++; echo "  FAIL  $label" . ($detail !== '' ? "\n        $detail" : '') . "\n";
}

// The FY comparison fixture (same as test_gtvalues.php): AMOUNT carries a literal
// '$' (all either engine sniffs), AWARDS is a plain count. FY 2025 Jul/Aug/Sep =
// $100/$200/$300 and 1/2/3 awards, FY 2026 Jul/Sep = $110/$330 and 1/3 (no Aug),
// FY 2027 Jul = $120 and 1.
function fx() {
    $r = array();
    foreach (array(array('FY 2025','01 Jul','$100',1), array('FY 2025','02 Aug','$200',2), array('FY 2025','03 Sep','$300',3),
                   array('FY 2026','01 Jul','$110',1), array('FY 2026','03 Sep','$330',3),
                   array('FY 2027','01 Jul','$120',1)) as $x) {
        $r[] = array('FY' => $x[0], 'MONTH' => $x[1], 'AMOUNT' => $x[2], 'AWARDS' => (string)$x[3]);
    }
    return $r;
}
function settings($vals, $aggs, $overrides, $labels) {
    return array('v' => 2, 'rows' => array('MONTH'), 'cols' => array('FY'), 'vals' => $vals, 'agg' => $aggs,
        'aggLabels' => $labels, 'aggColOverrides' => $overrides,
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalRowAggs' => null, 'totalColAggs' => null);
}
function cells_html($html) {
    $g = array(); $last = null;
    preg_match_all('/<tr\b[^>]*>(.*?)<\/tr>/is', $html, $trs);
    foreach ($trs[1] as $tr) {
        if (!preg_match_all('/<t[dh]\b[^>]*>(.*?)<\/t[dh]>/is', $tr, $cs)) continue;
        $cells = array();
        foreach ($cs[1] as $c) { $cells[] = trim(html_entity_decode(strip_tags($c), ENT_QUOTES, 'UTF-8')); }
        $g[$cells[0]] = $cells; $last = $cells;
    }
    $g['FOOT'] = $last; return $g;
}
function cells_csv($csv) {
    $g = array(); $last = null;
    foreach (explode("\n", str_replace("\r", '', $csv)) as $ln) {
        if (trim($ln) === '') continue;
        $cells = str_getcsv($ln); $cells[0] = preg_replace('/^\xEF\xBB\xBF/', '', $cells[0]);
        $g[$cells[0]] = $cells; $last = $cells;
    }
    $g['FOOT'] = $last; return $g;
}
function cells_xlsx($x) {
    $g = array();
    foreach ($x['dataRows'] as $r) { $g[(string)$r[0]] = array_map('strval', $r); }
    $g['FOOT'] = empty($x['footerRow']) ? null : array_map('strval', $x['footerRow']);
    return $g;
}
function grids($s) {
    $rows = fx();
    return array('HTML' => cells_html(generate_pivot_html($rows, $s, 'theme-default', true)),
                 'CSV'  => cells_csv(generate_pivot_csv_string($rows, $s)),
                 'XLSX' => cells_xlsx(pivot_build_xlsx_rows($rows, $s)));
}
function show($v) { return $v === null ? 'NULL' : '[' . implode(' | ', $v) . ']'; }
function at($g, $label, $i) { return isset($g[$label][$i]) ? $g[$label][$i] : 'MISSING'; }
function last_of($g, $label) { return isset($g[$label]) && is_array($g[$label]) ? end($g[$label]) : 'MISSING'; }
function plain_number($v) { return (bool)preg_match('/^\d[\d,]*$/', (string)$v); }

$RUN = array('sum', 'running_total:down', 'sum', 'running_total:down');

echo "A. pivot_currency_flags: a derived slot is judged by its base's column\n";
$f = pivot_currency_flags(fx(), 'AMOUNT', array('AMOUNT', null, 'AWARDS', null), $RUN);
ok($f === array(true, true, false, false), 'A1 Amount, its Running Total, Awards, ITS Running Total', show(array_map('json_encode', $f)));
$f = pivot_currency_flags(fx(), 'AWARDS', array('AWARDS', null, 'AMOUNT', null), $RUN);
ok($f === array(false, false, true, true), 'A2 mirror: a plain primary no longer strips a money Running Total of its $', show(array_map('json_encode', $f)));
$f = pivot_currency_flags(fx(), 'AMOUNT', array('AMOUNT', 'AWARDS', null, null, null), array('sum', 'sum', 'diff', 'ytd', 'prioryear'));
ok($f === array(true, false, false, false, false), 'A3 Change, YTD and prior year follow their base too', show(array_map('json_encode', $f)));
$f = pivot_currency_flags(fx(), 'AMOUNT', array('AMOUNT', 'AWARDS', null, null), array('sum', 'sum', 'pct_change', 'formula'));
ok($f === array(true, false, true, true), 'A4 guard: % and formula slots keep the old rule', show(array_map('json_encode', $f)));
$f1 = pivot_currency_flags(fx(), 'AMOUNT', null, array('sum', 'running_total'));
$f2 = pivot_currency_flags(fx(), 'AWARDS', null, array('sum', 'running_total'));
ok($f1 === array(true, true) && $f2 === array(false, false), 'A5 guard: no overrides = one flag for every slot, as before',
   show(array_map('json_encode', $f1)) . ' ' . show(array_map('json_encode', $f2)));

// Row cells: label, per FY [Amount, Run, Awards, Run awards], then the Grand Total four.
echo "B. Running Total down after Sum(AWARDS): cells, Grand Total row, Grand Total column\n";
$g3 = grids(settings('AMOUNT', $RUN, array('AMOUNT', null, 'AWARDS', null), array('Amount', 'Run', 'Awards', 'Run awards')));
foreach ($g3 as $b => $g) {
    ok(at($g, '03 Sep', 4) === '6' && at($g, '03 Sep', 8) === '4', "B $b: the Running Total of Awards prints 6 and 4, not \$6 and \$4",
       at($g, '03 Sep', 4) . ' / ' . at($g, '03 Sep', 8));
    ok(at($g, '03 Sep', 2) === '$600' && at($g, '03 Sep', 6) === '$440', "B $b: the Running Total of Amount keeps its \$",
       at($g, '03 Sep', 2) . ' / ' . at($g, '03 Sep', 6));
    // Only the '$' is asserted here: WHICH number the scheduled builders put in a
    // running total's Grand Total row (they add the running values up) is a
    // separate matter from its currency.
    ok(plain_number(at($g, 'FOOT', 4)) && plain_number(at($g, 'FOOT', 8)) && substr(at($g, 'FOOT', 2), 0, 1) === '$',
       "B $b: the Grand Total row: the Running Total of Awards has no \$, of Amount keeps it", show($g['FOOT']));
    ok(plain_number(last_of($g, '03 Sep')) && plain_number(last_of($g, 'FOOT')), "B $b: the Grand Total column's Running Total of Awards has no \$ (Sep, corner)",
       show(isset($g['03 Sep']) ? array_slice($g['03 Sep'], -4) : null) . ' ' . show(isset($g['FOOT']) ? array_slice($g['FOOT'], -4) : null));
}

echo "C. mirror image: Awards primary, a money override's Running Total keeps its \$\n";
$gm = grids(settings('AWARDS', $RUN, array('AWARDS', null, 'AMOUNT', null), array('Awards', 'Run awards', 'Amount', 'Run')));
foreach ($gm as $b => $g) {
    ok(at($g, '03 Sep', 4) === '$600' && at($g, '03 Sep', 8) === '$440', "C $b: the Running Total of Amount prints \$600 and \$440",
       at($g, '03 Sep', 4) . ' / ' . at($g, '03 Sep', 8));
    ok(at($g, '03 Sep', 2) === '6', "C $b: the Running Total of Awards stays plain", at($g, '03 Sep', 2));
}

echo "D. across: a Running Total of Awards along the years\n";
$ga = grids(settings('AMOUNT', array('sum', 'sum', 'running_total'), array('AMOUNT', 'AWARDS', null), array('Amount', 'Awards', 'Run awards')));
// Row cells: label, per FY [Amount, Awards, Run awards], then the Grand Total three.
foreach ($ga as $b => $g) {
    ok(at($g, '01 Jul', 3) === '1' && at($g, '01 Jul', 6) === '2' && at($g, '01 Jul', 9) === '3', "D $b: Jul runs 1, 2, 3 awards (no \$)",
       at($g, '01 Jul', 3) . ' / ' . at($g, '01 Jul', 6) . ' / ' . at($g, '01 Jul', 9));
}

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
