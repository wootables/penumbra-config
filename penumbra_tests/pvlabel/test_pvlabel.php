<?php
// pvlabel suite - email half (2026-10-22). The scheduler's generate_pivot_html writes the same
// tag-shaped labels as TEXT (a guard: it already escaped them when the page did not), from a
// side-effect-free mirror of schedule_runner.php (pivotparity's extract_mirror.php; never
// require the runner: it connects and SENDS MAIL).
//   php -n test_pvlabel.php <mirror.php> <themes_config.php>
require_once $argv[1];
require_once $argv[2];
if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
set_error_handler(function () { return true; }, E_ALL);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }

$A1 = '<img src=x onerror="window.__pwn=1">';
$T1 = '<svg onload="window.__pwn=2"></svg>';
$V1 = '<img src=x onerror="window.__pwn=4">';
$rows = array();
foreach (array('North', 'South') as $g) {
    foreach (array('Open', 'Closed') as $s) {
        foreach (array('Y', 'N') as $f) {
            $rows[] = array('GRP' => $g, 'STATUS' => $s, 'FLAG' => $f, 'AMT' => '10', $V1 => '3');
        }
    }
}
// The Grand Total's own types differ from the values' (written before the by-VALUE === compare
// was fixed; E-gteq-* below covers equal types).
$base = array('rows' => array('GRP'), 'cols' => array('STATUS'), 'vals' => 'AMT', 'agg' => array('sum', 'count'),
              'aggLabels' => array($A1, 'R&D'), 'aggColOverrides' => array('AMT', 'AMT'),
              'totalRowAggs' => array('count', 'sum'), 'totalRowAggLabels' => array($T1, 'Total <b>bold</b>'),
              'totalRowAggBaseIdx' => array(1, 0), 'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc');
$e = function ($s) { return htmlspecialchars($s); };
$raw = function ($h) { return preg_match('/<(img|svg|b)\b/i', $h); };

$h = (string)generate_pivot_html($rows, $base, 'theme-default', true, array());
ok(strpos($h, $e($A1)) !== false && strpos($h, $e($T1)) !== false && strpos($h, 'R&amp;D') !== false && !$raw($h),
   'E-flat the one-level header writes every label as text', substr($h, 0, 300));

$h = (string)generate_pivot_html($rows, array_merge($base, array('cols' => array('STATUS', 'FLAG'), 'colLayout' => 'nested')), 'theme-default', true, array());
ok(strpos($h, $e($A1)) !== false && strpos($h, $e($T1)) !== false && !$raw($h), 'E-nest the nested header writes every label as text', substr($h, 0, 300));

$h = (string)generate_pivot_html($rows, array_merge($base, array('cols' => array(), 'vals' => $V1, 'aggLabels' => array('Amt', 'N'),
    'totalRowAggs' => null, 'totalRowAggLabels' => null, 'totalRowAggBaseIdx' => null)), 'theme-default', true, array());
ok(strpos($h, $e($V1)) !== false && !$raw($h), 'E-val the heading over the values is the field name as text', substr($h, 0, 300));

// ---- Grand Total sub-labels, all three builders (2026-10-22, parity, not security) ------------------
// The page (generatePivotTable) tests the Grand Total override by IDENTITY: an override shows its own
// labels (totalRowAggLabels, else each type's default) even when it lists the values' types in the
// values' order. The builders compared `$rowTotalAggTypes === $aggTypes` BY VALUE, so an equal override
// took the values' labels in the email, the .csv and the .xlsx and never read totalRowAggLabels.
// E-gteq-* / E-gtdef are red on the pre-fix runner; E-gtnone / E-gtdiff guard what it already did.
function gt_html($h, $n) {        // the last $n cells of the header's 2nd row, as written (still escaped)
    if (!preg_match('#<thead>(.*?)</thead>#s', $h, $m) || !preg_match_all('#<tr[^>]*>(.*?)</tr>#s', $m[1], $tr) || count($tr[1]) < 2) return array('NO 2-ROW HEADER');
    preg_match_all('#<th[^>]*>(.*?)</th>#s', $tr[1][1], $th);
    return array_slice($th[1], -$n);
}
function gt_csv($c) {             // "Grand Total (<label>)" headers -> the labels
    $lines = preg_split('/\r\n|\n/', trim($c));
    $out = array();
    foreach (str_getcsv(preg_replace('/^\xEF\xBB\xBF/', '', $lines[0])) as $hd) {
        if (preg_match('/^Grand Total \((.*)\)$/s', $hd, $m)) $out[] = $m[1];
    }
    return $out;
}
function gt_xlsx($x, $n) {        // the last $n cells of header row 2
    return (isset($x['headerRows'][1]) && is_array($x['headerRows'][1])) ? array_slice($x['headerRows'][1], -$n) : array('NO HEADER ROW 2');
}
$GT2 = 'Gt <b>Y</b>';
$gt = array('rows' => array('GRP'), 'cols' => array('STATUS'), 'vals' => 'AMT', 'agg' => array('sum', 'count'),
            'aggLabels' => array('ValA', 'ValB'), 'totalRowAggs' => array('sum', 'count'), 'totalRowAggLabels' => array('GtX', $GT2),
            'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc');
$three = function ($set, $want, $name, $what) use ($rows, $e) {
    $h = (string)generate_pivot_html($rows, $set, 'theme-default', true, array());
    $hv = gt_html($h, count($want));
    ok($hv === array_map($e, $want), "$name-html $what (email, escaped)", json_encode($hv));
    $cv = gt_csv((string)generate_pivot_csv_string($rows, $set));
    ok($cv === $want, "$name-csv $what (.csv)", json_encode($cv));
    $xv = gt_xlsx(pivot_build_xlsx_rows($rows, $set), count($want));
    ok($xv === $want, "$name-xlsx $what (.xlsx)", json_encode($xv));
};
$three($gt, array('GtX', $GT2), 'E-gteq', 'an override with the values\' types in their order shows ITS labels');
$three(array_merge($gt, array('totalRowAggLabels' => null)), array('Sum', 'Count'), 'E-gtdef', 'the same override without labels shows the types\' defaults, not the values\' labels');
$three(array_merge($gt, array('totalRowAggs' => null, 'totalRowAggLabels' => null)), array('ValA', 'ValB'), 'E-gtnone', 'no override: the values\' labels');
$three(array_merge($gt, array('totalRowAggs' => array('count', 'sum'), 'totalRowAggBaseIdx' => array(1, 0))), array('GtX', $GT2), 'E-gtdiff', 'an override with other types shows its labels');
// the page's nested header shape (not email: email forces flat), the second Grand Total heading writer
$h = (string)generate_pivot_html($rows, array_merge($gt, array('cols' => array('STATUS', 'FLAG'), 'colLayout' => 'nested')), 'theme-default', false, array());
ok(strpos($h, '>GtX<') !== false && strpos($h, '>' . $e($GT2) . '<') !== false && !$raw($h), 'E-gteq-nest the nested header shows the override\'s labels too', substr($h, 0, 300));

echo "TOTAL pass=$pass fail=$fail\n";
