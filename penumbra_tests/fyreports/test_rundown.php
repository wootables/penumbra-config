<?php
/**
 * The Grand Total ROW of a running column in the scheduled builders
 * (2026-09-26) - generate_pivot_html, generate_pivot_csv_string and
 * pivot_build_xlsx_rows (which also feeds PDF), against what the browser's
 * generatePivotTable shows (fyreports harness M7 and R4).
 *
 * A DOWN type (running_total:down, running_count:down, ytd:down) totals to its
 * LAST row's accumulated value. The builders added every row's running value
 * up instead ($1,000 for $100 / $200 / $300; a running count over twelve months
 * read 78, not 12). The across types keep the sum - there a column's footer is
 * the running grand total, which a sum is. One helper, pivot_running_col_footer,
 * serves all three builders.
 *
 * schedule_runner.php is NEVER required (it opens Oracle and sends mail); its
 * functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_rundown.php                     live runner
 *   php -n test_rundown.php --runner=<path>     a staged copy
 *   php -n test_rundown.php --mutant=rundown    the down rule undone (must turn
 *                                               exactly the A and B checks red)
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_rundown.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }
$src = file_get_contents($runner);
$MUTANTS = array(
    'rundown' => array("if (pivot_is_running_down(\$t) && count(\$allRowKeys) > 0) {", "if (false) {", 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_rundown.php';
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

// FY 2025 Jul/Aug/Sep = $100/$200/$300, FY 2026 Jul/Sep = $110/$330 (no Aug),
// FY 2027 Jul = $120 only (same fixture as test_todate.php and the harness).
function fx() {
    $r = array();
    foreach (array(array('FY 2025','01 Jul','$100'), array('FY 2025','02 Aug','$200'), array('FY 2025','03 Sep','$300'),
                   array('FY 2026','01 Jul','$110'), array('FY 2026','03 Sep','$330'),
                   array('FY 2027','01 Jul','$120')) as $x) {
        $r[] = array('FY' => $x[0], 'MONTH' => $x[1], 'AMOUNT' => $x[2]);
    }
    return $r;
}
function settings($aggs) {
    return array('v' => 2, 'rows' => array('MONTH'), 'cols' => array('FY'), 'vals' => 'AMOUNT', 'agg' => $aggs,
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalRowAggs' => null, 'totalColAggs' => null);
}
function cells_html($html) {
    $last = null;
    preg_match_all('/<tr\b[^>]*>(.*?)<\/tr>/is', $html, $trs);
    foreach ($trs[1] as $tr) {
        if (!preg_match_all('/<t[dh]\b[^>]*>(.*?)<\/t[dh]>/is', $tr, $cs)) continue;
        $cells = array();
        foreach ($cs[1] as $c) { $cells[] = trim(html_entity_decode(strip_tags($c), ENT_QUOTES, 'UTF-8')); }
        $last = $cells;
    }
    return $last;
}
function cells_csv($csv) {
    $last = null;
    foreach (explode("\n", str_replace("\r", '', $csv)) as $ln) {
        if (trim($ln) === '') continue;
        $last = str_getcsv($ln);
    }
    return $last;
}
function cells_xlsx($x) { return empty($x['footerRow']) ? null : array_map('strval', $x['footerRow']); }
// The Grand Total ROW of each builder: label, then per FY [Amount, running], then the Grand Total pair.
function feet($aggs) {
    $rows = fx(); $s = settings($aggs);
    return array('HTML' => cells_html(generate_pivot_html($rows, $s, 'theme-default', true)),
                 'CSV'  => cells_csv(generate_pivot_csv_string($rows, $s)),
                 'XLSX' => cells_xlsx(pivot_build_xlsx_rows($rows, $s)));
}
function run3($f) { return is_array($f) ? array(isset($f[2]) ? $f[2] : 'MISSING', isset($f[4]) ? $f[4] : 'MISSING', isset($f[6]) ? $f[6] : 'MISSING') : array('NOFOOT'); }
function show($v) { return '[' . implode(' | ', $v) . ']'; }

echo "A. Running Total down: the Grand Total row is each year's final running figure\n";
foreach (feet(array('sum', 'running_total:down')) as $b => $f) {
    ok(run3($f) === array('$600', '$440', '$120'), "A $b: \$600 / \$440 / \$120 (was \$1,000 / \$660 / \$360)", show(run3($f)));
}
echo "B. Running Count down: the Grand Total row is each year's final count\n";
foreach (feet(array('sum', 'running_count:down')) as $b => $f) {
    ok(run3($f) === array('3', '2', '1'), "B $b: 3 / 2 / 1 (was 6 / 4 / 3)", show(run3($f)));
}
echo "C. guard: across types keep the sum - each column's running grand total\n";
foreach (feet(array('sum', 'running_total')) as $b => $f) {
    ok(run3($f) === array('$600', '$1,040', '$1,160'), "C $b: Running Total across \$600 / \$1,040 / \$1,160", show(run3($f)));
}
foreach (feet(array('sum', 'running_count')) as $b => $f) {
    ok(run3($f) === array('3', '5', '6'), "C $b: Running Count across 3 / 5 / 6", show(run3($f)));
}

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
