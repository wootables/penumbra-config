<?php
/**
 * "% Change (to date)" and running totals that stop at their last period with
 * data (2026-09-26) - the scheduled-email / export half: generate_pivot_html,
 * generate_pivot_csv_string and pivot_build_xlsx_rows (which also feeds PDF).
 *
 * pct_change_td compares only what the newer column has reached: a cell whose
 * column has no rows is blank (not -100%), the Grand Total row and the corner
 * total only the rows the newer column has, the Grand Total column is blank
 * where the last column has no rows. Running totals (-> and down) show blank
 * after their last row / column with data - between data they still carry.
 *
 * schedule_runner.php is NEVER required (it opens Oracle and sends mail); its
 * functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_todate.php                     live runner
 *   php -n test_todate.php --runner=<path>     a staged copy
 *   php -n test_todate.php --mutant=<name>     cell | totals | gtcol | corner | flags | trail
 *                                              (each must turn exactly its own checks red)
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_todate.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }

$src = file_get_contents($runner);
// One behaviour undone per mutant, by exact text; the anchor must occur the stated
// number of times or the suite refuses to run (a stale anchor reads as GREEN).
$MUTANTS = array(
    // the email body's cell blank (HTML's A checks only)
    'cell'   => array("                    if (!empty(\$_pctTd[\$aggIdx]) && !pivot_cell_has_rows(\$cellData, \$_aggFilterIdx(\$aggIdx))) {\r\n                        \$values[] = null;",
                      "                    if (false) {\r\n                        \$values[] = null;", 1),
    // the to-date totals compare every row, as plain % Change does (B, and C's corner, everywhere)
    'totals' => array("        if (pivot_cell_has_rows(isset(\$data[\$rk][\$newColKey]) ? \$data[\$rk][\$newColKey] : null, \$filterIdx)) \$keys[] = \$rk;",
                      "        \$keys[] = \$rk;", 1),
    // the email body's Grand Total column blank (HTML's C Sep check only)
    'gtcol'  => array("                        if (!empty(\$_pctTd[\$idx]) && !pivot_cell_has_rows(isset(\$data[\$rowKey][\$_gtLastCk]) ? \$data[\$rowKey][\$_gtLastCk] : null, \$_aggFilterIdx(\$idx))) {",
                      "                        if (false) {", 1),
    // the email body's to-date corner (HTML's C corner check only)
    'corner' => array("                        if (!empty(\$_pctTd[\$idx]) && count(\$sortedColKeys) > 1) {",
                      "                        if (false) {", 1),
    // nothing is ever "to date" (A, B and C in every builder; D still passes)
    'flags'  => array("    foreach (\$aggTypes as \$i => \$t) { \$f[\$i] = (\$t === 'pct_change_td'); }",
                      "    foreach (\$aggTypes as \$i => \$t) { \$f[\$i] = false; }", 1),
    // running totals never trail (E in every builder)
    'trail'  => array("function pivot_run_trail_blank(\$trail, \$idx, \$rowKey, \$colKey, \$colIndex) {\r\n    if (!isset(\$trail[\$idx])) return false;",
                      "function pivot_run_trail_blank(\$trail, \$idx, \$rowKey, \$colKey, \$colIndex) {\r\n    return false;", 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_todate.php';
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
// FY 2027 Jul = $120 only (the current year).
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
function grids($aggs) {
    $rows = fx(); $s = settings($aggs);
    return array('HTML' => cells_html(generate_pivot_html($rows, $s, 'theme-default', true)),
                 'CSV'  => cells_csv(generate_pivot_csv_string($rows, $s)),
                 'XLSX' => cells_xlsx(pivot_build_xlsx_rows($rows, $s)));
}
function show($v) { return $v === null ? 'NULL' : '[' . implode(' | ', $v) . ']'; }
// The % (second value) cell of a row for FY index $fy (0,1,2), and the GT/corner % cell.
// Row layout: label, then per FY [Amount, %], then GT [Amount, %].
function pct($g, $label, $fy) { return isset($g[$label]) ? (isset($g[$label][2 + 2 * $fy]) ? $g[$label][2 + 2 * $fy] : 'MISSING') : 'NOROW'; }
function gtpct($g, $label) { return isset($g[$label]) ? end($g[$label]) : 'NOROW'; }
// XLSX blanks what the email body and CSV print as '-' (N/A): accept either there.
function na($b) { return $b === 'XLSX' ? array('', '-') : array('-'); }

echo "A. % Change (to date): cells\n";
$td = grids(array('sum', 'pct_change_td'));
foreach ($td as $b => $g) {
    ok(pct($g, '01 Jul', 1) === '10.0%' && pct($g, '01 Jul', 2) === '9.1%', "A $b: reached months compute as % Change (10.0%, 9.1%)", pct($g, '01 Jul', 1) . ' / ' . pct($g, '01 Jul', 2));
    ok(pct($g, '02 Aug', 1) === '', "A $b: FY 2026 Aug (no rows) is blank, not -100.0%", "got '" . pct($g, '02 Aug', 1) . "'");
    ok(pct($g, '03 Sep', 2) === '', "A $b: FY 2027 Sep (not reached) is blank, not -100.0%", "got '" . pct($g, '03 Sep', 2) . "'");
    ok(in_array(pct($g, '01 Jul', 0), na($b), true), "A $b: the first year still has no comparison", "got '" . pct($g, '01 Jul', 0) . "'");
}

echo "B. % Change (to date): the Grand Total row compares like for like\n";
foreach ($td as $b => $g) {
    $f = $g['FOOT'];
    ok(isset($f[4]) && $f[4] === '10.0%', "B $b: FY 2026 = Jul+Sep \$440 vs \$400 = 10.0% (plain: -26.7%)", show($f));
    ok(isset($f[6]) && $f[6] === '9.1%', "B $b: FY 2027 = Jul \$120 vs \$110 = 9.1% (plain: -72.7%)", show($f));
}

echo "C. % Change (to date): Grand Total column and corner\n";
foreach ($td as $b => $g) {
    ok(gtpct($g, '01 Jul') === '20.0%', "C $b: Jul GT = \$120 vs \$100 = 20.0%", "got '" . gtpct($g, '01 Jul') . "'");
    ok(gtpct($g, '03 Sep') === '', "C $b: Sep GT blank - the last year has not reached it (plain: -100.0%)", "got '" . gtpct($g, '03 Sep') . "'");
    ok(gtpct($g, 'FOOT') === '20.0%', "C $b: corner = Jul \$120 vs \$100 = 20.0% (plain: -80.0%)", "got '" . gtpct($g, 'FOOT') . "'");
}

echo "D. regression guard: plain % Change is unchanged\n";
$pc = grids(array('sum', 'pct_change'));
foreach ($pc as $b => $g) {
    ok(pct($g, '03 Sep', 2) === '-100.0%', "D $b: plain % Change still reads -100.0% for FY 2027 Sep", "got '" . pct($g, '03 Sep', 2) . "'");
    ok(isset($g['FOOT'][4]) && $g['FOOT'][4] === '-26.7%', "D $b: plain footer FY 2026 = -26.7%", show($g['FOOT']));
}

echo "E. running totals stop at their last period with data\n";
$rd = grids(array('sum', 'running_total:down'));
foreach ($rd as $b => $g) {
    ok(pct($g, '01 Jul', 2) === '$120', "E $b: FY 2027 Jul running total \$120", "got '" . pct($g, '01 Jul', 2) . "'");
    ok(pct($g, '02 Aug', 2) === '' && pct($g, '03 Sep', 2) === '', "E $b: FY 2027 Aug/Sep blank after the last month with data (was \$120)", pct($g, '02 Aug', 2) . ' / ' . pct($g, '03 Sep', 2));
    ok(pct($g, '02 Aug', 1) === '$110', "E $b: FY 2026 Aug still carries \$110 (data resumes in Sep)", "got '" . pct($g, '02 Aug', 1) . "'");
    ok(pct($g, '03 Sep', 1) === '$440', "E $b: FY 2026 Sep \$440", "got '" . pct($g, '03 Sep', 1) . "'");
}
$rh = grids(array('sum', 'running_total'));
foreach ($rh as $b => $g) {
    ok(pct($g, '02 Aug', 1) === '' && pct($g, '02 Aug', 2) === '', "E $b: across: Aug blank after FY 2025 (its last year with data)", pct($g, '02 Aug', 1) . ' / ' . pct($g, '02 Aug', 2));
    ok(pct($g, '01 Jul', 2) === '$330', "E $b: across: Jul runs to \$330", "got '" . pct($g, '01 Jul', 2) . "'");
}

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
