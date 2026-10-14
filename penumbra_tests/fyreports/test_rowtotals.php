<?php
/**
 * No Grand Total COLUMN in the scheduled-email / export builders (2026-09-25).
 *
 * The browser drops the Grand Total column when a pivot's row-total override is
 * EMPTY (totalRowAggs = [], trigger RowTotals = hide - the builder writes it when
 * every value's box is cleared). The three runner builders must agree, or an
 * emailed / downloaded pivot shows a column the screen does not:
 *   generate_pivot_html()      email + scheduled HTML
 *   generate_pivot_csv_string() CSV attachments / drops
 *   pivot_build_xlsx_rows()    XLSX attachments (descriptor)
 * null (no override) and a non-empty override must keep the column exactly as before.
 *
 * schedule_runner.php is NEVER required - it opens Oracle, claims tasks and sends
 * mail. Its functions are LIFTED by tokenizer with ..\pivotparity\extract_mirror.php.
 *
 *   php -n test_rowtotals.php                        live runner
 *   php -n test_rowtotals.php --runner=<path>        a staged copy
 *   php -n test_rowtotals.php --mutant               the HTML builder's [] check removed:
 *                                                    the H assertions must FAIL, the C and X ones pass
 */
$MUTANT = in_array('--mutant', $argv, true);
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) { if (strpos($a, '--runner=') === 0) $runner = substr($a, 9); }
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_rowtotals.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }

$src = file_get_contents($runner);
if ($MUTANT) {
    // Only the HTML builder's definition (the one that carries the long comment).
    $needle = "        && !(is_array(\$totalRowAggs) && count(\$totalRowAggs) === 0);";
    $at = strpos($src, "Every Grand Total emission in this");
    $pos = ($at === false) ? false : strpos($src, $needle, $at);
    if ($pos === false) { fwrite(STDERR, "MUTANT ANCHOR NOT FOUND - fix this suite.\n"); exit(2); }
    $src = substr_replace($src, "        && true; // MUTANT", $pos, strlen($needle));
}
$tmp = $here . '/_src_rowtotals.php';
file_put_contents($tmp, $src);
exec(escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmp) . ' ' . escapeshellarg($mirror), $exOut, $exCode);
@unlink($tmp);
if ($exCode !== 0 || !file_exists($mirror)) { fwrite(STDERR, "extract_mirror failed: " . implode("\n", $exOut) . "\n"); exit(2); }
require_once $mirror;
$themesCfg = dirname($runner) . '/themes_config.php';
if (file_exists($themesCfg)) { require_once $themesCfg; }
if (function_exists('penumbra_build_theme_styles')) { $GLOBALS['theme_styles'] = penumbra_build_theme_styles(); }

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $detail = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  PASS  $label\n"; return; }
    $FAIL++; echo "  FAIL  $label" . ($detail !== '' ? "\n        $detail" : '') . "\n";
}

// Same fixture as the browser harness: FY 2027 has only Jul (the current year).
function fx() {
    $r = array();
    foreach (array(array('FY 2025','01 Jul','$100',1), array('FY 2025','02 Aug','$200',2), array('FY 2025','03 Sep','$300',3),
                   array('FY 2026','01 Jul','$110',1), array('FY 2026','03 Sep','$330',3),
                   array('FY 2027','01 Jul','$120',1)) as $x) {
        $r[] = array('FY' => $x[0], 'MONTH' => $x[1], 'AMOUNT' => $x[2], 'AWARDS' => (string)$x[3]);
    }
    return $r;
}
function settings($totalRowAggs, $baseIdx = null) {
    return array('v' => 2, 'rows' => array('MONTH'), 'cols' => array('FY'), 'vals' => 'AMOUNT',
        'agg' => array('sum', 'sum'), 'aggLabels' => array('Amount', 'Awards'), 'aggColOverrides' => array('AMOUNT', 'AWARDS'),
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalColAggs' => null,
        'totalRowAggs' => $totalRowAggs, 'totalRowAggLabels' => null, 'totalRowAggBaseIdx' => $baseIdx);
}
function first_body_row_cells($html) {
    $body = strpos($html, '<tbody');
    $tr = ($body === false) ? false : strpos($html, '<tr', $body);
    $end = ($tr === false) ? false : strpos($html, '</tr>', $tr);
    if ($end === false) return -1;
    return substr_count(substr($html, $tr, $end - $tr), '<td');
}
function head_part($html) { $e = strpos($html, '<tbody'); return $e === false ? $html : substr($html, 0, $e); }
function foot_part($html) { $s = strpos($html, '<tfoot'); if ($s === false) { $s = strrpos($html, '<tr'); } return $s === false ? '' : substr($html, $s); }

$rows = fx();
echo "HTML (email / scheduled)\n";
$hNull = generate_pivot_html($rows, settings(null), 'theme-default', true);
$hHide = generate_pivot_html($rows, settings(array()), 'theme-default', true);
$hOver = generate_pivot_html($rows, settings(array('sum', 'sum'), array(0, 1)), 'theme-default', true);
ok(strpos(head_part($hNull), 'Grand Total') !== false, 'C1 control: no override keeps the Grand Total header');
ok(strpos(head_part($hHide), 'Grand Total') === false, 'H1 [] drops the Grand Total header', substr(strip_tags(head_part($hHide)), 0, 300));
$cNull = first_body_row_cells($hNull); $cHide = first_body_row_cells($hHide); $cOver = first_body_row_cells($hOver);
ok($cNull === 9, 'C2 control: a body row is MONTH + 6 values + 2 totals', "cells=$cNull");
ok($cHide === 7, 'H2 [] body row is MONTH + 6 values, nothing on the right', "cells=$cHide");
ok($cOver === 9, 'C3 a non-empty override keeps its two total cells', "cells=$cOver");
ok(strpos(foot_part($hHide), 'Grand Total') !== false, 'H3 the footer ROW (column totals) stays', substr(strip_tags(foot_part($hHide)), 0, 200));
ok(strpos($hHide, '$120') !== false && strpos($hHide, '$330') !== false, 'H4 the data itself is unchanged');

echo "CSV\n";
$csvNull = generate_pivot_csv_string($rows, settings(null));
$csvHide = generate_pivot_csv_string($rows, settings(array()));
$l1n = strtok($csvNull, "\n"); $l1h = strtok($csvHide, "\n");
ok(strpos($csvNull, 'Grand Total') !== false, 'C4 control: CSV keeps its Grand Total columns');
$hideHead = implode("\n", array_slice(explode("\n", str_replace("\r", '', $csvHide)), 0, 3));
ok(strpos($hideHead, 'Grand Total') === false, 'X1 [] CSV header has no Grand Total column', $hideHead);
$maxCols = function ($csv) { $m = 0; foreach (explode("\n", str_replace("\r", '', $csv)) as $ln) { if ($ln === '') continue; $m = max($m, count(str_getcsv($ln))); } return $m; };
ok($maxCols($csvNull) - $maxCols($csvHide) === 2, 'X2 [] CSV is exactly two columns narrower', 'null=' . $maxCols($csvNull) . ' hide=' . $maxCols($csvHide));

echo "XLSX descriptor\n";
$xNull = pivot_build_xlsx_rows($rows, settings(null));
$xHide = pivot_build_xlsx_rows($rows, settings(array()));
ok(!empty($xNull['hasGrandTotalCol']), 'C5 control: XLSX has the Grand Total column');
ok(empty($xHide['hasGrandTotalCol']), 'X3 [] XLSX has no Grand Total column');
$w = function ($x) { return empty($x['dataRows']) ? -1 : count($x['dataRows'][0]); };
ok($w($xNull) - $w($xHide) === 2, 'X4 [] XLSX data rows are two cells narrower', 'null=' . $w($xNull) . ' hide=' . $w($xHide));
ok(isset($xHide['colTypes']) && count($xHide['colTypes']) === $w($xHide), 'X5 [] XLSX colTypes still match the row width',
   'colTypes=' . (isset($xHide['colTypes']) ? count($xHide['colTypes']) : 'n/a') . ' row=' . $w($xHide));

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
