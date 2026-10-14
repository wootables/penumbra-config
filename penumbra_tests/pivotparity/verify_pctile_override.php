<?php
/**
 * Can a PERCENTILE be used as a row-total override, in every PHP builder?
 *
 * The override engine has always had a percentile branch, but the builder menu
 * never offered one, so the path had no coverage. Before widening the menu we
 * need three things to be true on the PHP side, because a menu entry the runner
 * cannot compute becomes a browser/email divergence:
 *
 *   1. both override routes return a real percentile, not the `default` sum
 *      fall-through that sits underneath them;
 *   2. the emailed HTML, the CSV and the XLSX all print the SAME number;
 *   3. the total column is LABELLED as a percentile ("Overall P90"), because a
 *      percentile printed under a "Grand Total" heading is a wrong answer even
 *      when the arithmetic is right.
 *
 *   php verify_pctile_override.php
 */
require_once __DIR__ . '/pivot_mirror.php';
require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
$theme_styles = penumbra_build_theme_styles();

$GLOBALS['__warn'] = array();
$GLOBALS['__where'] = 'setup';
set_error_handler(function ($no, $str, $file, $line) {
    if (strpos($file, 'pivot_mirror.php') === false) { return true; }
    $key = $GLOBALS['__where'] . ' | ' . $str;
    if (!isset($GLOBALS['__warn'][$key])) { $GLOBALS['__warn'][$key] = 0; }
    $GLOBALS['__warn'][$key]++;
    return true;
}, E_ALL);

$pass = 0; $fail = 0;
function ok($name, $cond, $detail = null) {
    global $pass, $fail;
    if ($cond) { $pass++; printf("  PASS  %s\n", $name); }
    else { $fail++; printf("  FAIL  %s%s\n", $name, $detail !== null ? "   [$detail]" : ''); }
}

// The builder_diff fixture, hole included (Arts has 2025 only).
$rows = array(
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '10', 'AMOUNT' => '1000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '20', 'AMOUNT' => '9000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '50', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '60', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Sciences',    'FY' => '2024', 'RATE' => '5',  'AMOUNT' => '100'),
    array('COLLEGE' => 'Sciences',    'FY' => '2025', 'RATE' => '80', 'AMOUNT' => '9900'),
    array('COLLEGE' => 'Arts',        'FY' => '2025', 'RATE' => '0',  'AMOUNT' => '5'),
);

echo "########## 1. the two override routes, driven directly ##########\n\n";

// Route A - over PER-CELL values. This is the route a percentile override
// actually takes when the base agg differs (base sum, override pNN).
// Engineering cells with base=sum: 2024 = 30, 2025 = 110.
$cellValuesMap = array(
    'Engineering' => array('2024' => array(30.0), '2025' => array(110.0)),
    'Sciences'    => array('2024' => array(5.0),  '2025' => array(80.0)),
    'Arts'        => array('2025' => array(0.0)),
);
$cols = array('2024', '2025');
// Linear interpolation between closest ranks over [30,110]:
//   rank = p/100 * (n-1) = p/100, so value = 30 + (p/100)*80
$expectA = array('p10' => 38.0, 'p25' => 50.0, 'p50' => 70.0, 'p90' => 102.0, 'p99' => 109.2);
foreach ($expectA as $agg => $exp) {
    $GLOBALS['__where'] = "cellvalues/$agg";
    $got = pivot_compute_override_total_from_cell_values('row', 'Engineering', $cols, $cellValuesMap, 0, $agg);
    ok(sprintf('cell-values route: %-4s of [30,110] = %.4g', $agg, $exp),
       is_numeric($got) && abs($got - $exp) < 0.0001, "got $got");
}
// The fall-through underneath is a plain sum (140). Prove we are NOT hitting it.
$sumOfCells = 140.0;
$p50 = pivot_compute_override_total_from_cell_values('row', 'Engineering', $cols, $cellValuesMap, 0, 'p50');
ok('cell-values route: p50 is a percentile, not the sum fall-through',
   abs($p50 - $sumOfCells) > 0.0001, "p50=$p50 sum=$sumOfCells");

// Route B - over the merged RAW values. Reached when the override equals the
// base agg. Engineering rates are {10,20,50,60}; rank = p/100 * 3.
$data = pivot_process_data($rows, array('COLLEGE'), array('FY'), 'RATE', null, null, array('p50'));
$data = isset($data['data']) ? $data['data'] : $data;
$expectB = array('p10' => 13.0, 'p50' => 35.0, 'p90' => 57.0);
foreach ($expectB as $agg => $exp) {
    $GLOBALS['__where'] = "rawvalues/$agg";
    $got = pivot_compute_override_total('row', 'Engineering', $cols, $data, $agg, null, null);
    ok(sprintf('raw-values route: %-4s of [10,20,50,60] = %.4g', $agg, $exp),
       is_numeric($got) && abs($got - $exp) < 0.0001, "got $got");
}
// The two routes answer DIFFERENT questions on purpose - if they ever coincide
// this file has stopped testing what it claims to.
ok('the two routes are genuinely different (percentile of cells != percentile of rows)',
   abs($expectA['p90'] - $expectB['p90']) > 1.0);

echo "\n########## 2. the header label ##########\n\n";
foreach (array('p10' => 'Overall P10', 'p50' => 'Overall P50', 'p90' => 'Overall P90') as $agg => $want) {
    ok("total label for $agg is \"$want\"", pivot_agg_total_label($agg) === $want, pivot_agg_total_label($agg));
}
ok('a percentile total is NOT labelled "Grand Total"', pivot_agg_total_label('p90') !== 'Grand Total');

echo "\n########## 3. all three builders, end to end ##########\n\n";

function settings_pctile($overrideAgg) {
    return array('rows' => array('COLLEGE'), 'cols' => array('FY'), 'vals' => 'RATE',
                 'agg' => array('sum'), 'totalRowAggs' => array($overrideAgg),
                 'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc');
}
function html_row_total($html, $label) {
    if (!preg_match('#<tr[^>]*>(?:(?!</tr>).)*?>' . preg_quote($label, '#') . '</td>(?:(?!</tr>).)*?</tr>#s', $html, $m)) return 'ROW NOT FOUND';
    if (!preg_match_all('#<td[^>]*>(.*?)</td>#s', $m[0], $c)) return 'NO CELLS';
    return trim(strip_tags(end($c[1])));
}
function csv_row_total($csv, $label) {
    $lines = preg_split('/\r\n|\n/', trim($csv));
    $hdr = str_getcsv(preg_replace('/^\xEF\xBB\xBF/', '', $lines[0]));
    $gi = -1;
    foreach ($hdr as $i => $h) {
        if (stripos($h, 'Grand Total') !== false || stripos($h, 'Overall') === 0) { $gi = $i; }
    }
    if ($gi < 0) return 'NO TOTAL COLUMN';
    foreach (array_slice($lines, 1) as $ln) {
        $c = str_getcsv($ln);
        if (isset($c[0]) && trim($c[0]) === $label) return isset($c[$gi]) ? trim($c[$gi]) : 'MISSING';
    }
    return 'ROW NOT FOUND';
}
function xlsx_row_total($x, $label) {
    if (!is_array($x) || !isset($x['dataRows'])) return 'NO dataRows';
    $gi = -1;
    if (isset($x['colTypes'])) { foreach ($x['colTypes'] as $i => $t) { if ($t === 'grandTotal') { $gi = $i; } } }
    foreach ($x['dataRows'] as $r) {
        if (isset($r[0]) && trim((string)$r[0]) === $label) {
            if ($gi >= 0) return isset($r[$gi]) ? trim((string)$r[$gi]) : 'MISSING';
            return trim((string)end($r));
        }
    }
    return 'ROW NOT FOUND';
}
function numify($s) {
    $t = preg_replace('/[^0-9.\-]/', '', (string)$s);
    $n = _penumbra_summary_clean_number($t);
    return ($n === false) ? null : $n;
}

// Engineering is the oracle row (its cell values give whole numbers). Every
// college is still checked for three-way AGREEMENT, which needs no oracle.
$oracle = array('p10' => 38.0, 'p25' => 50.0, 'p50' => 70.0, 'p90' => 102.0);
foreach ($oracle as $agg => $exp) {
    $set = settings_pctile($agg);
    $GLOBALS['__where'] = "html/$agg";  $h = generate_pivot_html($rows, $set, 'theme-default', true);
    $GLOBALS['__where'] = "csv/$agg";   $c = generate_pivot_csv_string($rows, $set);
    $GLOBALS['__where'] = "xlsx/$agg";  $x = pivot_build_xlsx_rows($rows, $set);

    printf("\n  --- totalRowAggs = [%s], Engineering should read %.4g ---\n", $agg, $exp);
    $hv = html_row_total($h, 'Engineering');
    $cv = csv_row_total($c, 'Engineering');
    $xv = xlsx_row_total($x, 'Engineering');
    printf("      HTML=%-10s CSV=%-10s XLSX=%-10s\n", $hv, $cv, $xv);
    $hn = numify($hv); $cn = numify($cv); $xn = numify($xv);
    ok("  $agg: HTML is the percentile",  $hn !== null && abs($hn - $exp) < 0.01, $hv);
    ok("  $agg: CSV  is the percentile",  $cn !== null && abs($cn - $exp) < 0.01, $cv);
    ok("  $agg: XLSX is the percentile",  $xn !== null && abs($xn - $exp) < 0.01, $xv);
    ok("  $agg: the three builders agree",
       $hn !== null && $cn !== null && $xn !== null && abs($hn - $cn) < 0.01 && abs($hn - $xn) < 0.01,
       "$hv / $cv / $xv");

    // Every other row: agreement only.
    foreach (array('Sciences', 'Arts') as $lbl) {
        $a = numify(html_row_total($h, $lbl));
        $b = numify(csv_row_total($c, $lbl));
        $d = numify(xlsx_row_total($x, $lbl));
        ok("  $agg: $lbl agrees across all three",
           $a !== null && $b !== null && $d !== null && abs($a - $b) < 0.01 && abs($a - $d) < 0.01,
           html_row_total($h, $lbl) . ' / ' . csv_row_total($c, $lbl) . ' / ' . xlsx_row_total($x, $lbl));
    }

    // The heading has to say what the column is.
    ok("  $agg: CSV total column is headed \"Overall P" . pivot_percentile_p($agg) . "\"",
       strpos($c, 'Overall P' . pivot_percentile_p($agg)) !== false);
    ok("  $agg: HTML total column is headed \"Overall P" . pivot_percentile_p($agg) . "\"",
       strpos($h, 'Overall P' . pivot_percentile_p($agg)) !== false);
}

// A sum control, so a green run cannot be an artifact of the extractors.
$setC = settings_pctile('sum');
$GLOBALS['__where'] = 'html/control-sum';
$hc = generate_pivot_html($rows, $setC, 'theme-default', true);
ok("\n  CONTROL: a sum override still reads 140 for Engineering",
   abs(numify(html_row_total($hc, 'Engineering')) - 140.0) < 0.01, html_row_total($hc, 'Engineering'));

echo "\n########## warnings ##########\n";
if (empty($GLOBALS['__warn'])) { echo "  none\n"; }
else { foreach ($GLOBALS['__warn'] as $k => $n) { printf("  x%-4d %s\n", $n, $k); $fail++; } }

printf("\nRESULT: %d pass, %d fail\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);
