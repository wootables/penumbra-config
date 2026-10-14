<?php
/**
 * Grand Total COLUMN numbers and currency in the scheduled builders (2026-09-25).
 *
 * With no row-total override, the Grand Total column repeats the pivot's values
 * one for one: slot i totals value i, from its own column and filter, in its own
 * currency. The email body (generate_pivot_html) always did. The CSV and XLSX
 * builders printed the FIRST value in every slot - Amount + Awards read
 * "$330 | $330" where the body read "$330 | 3" - because their value map was
 * empty without an override and every slot fell back to value 0. The XLSX
 * descriptor also feeds the PDF attachments.
 * With an override, a total cell takes the currency of the value it totals, as
 * the browser does since this afternoon: all three builders printed "$3" on a
 * count beside an amount.
 *
 * schedule_runner.php is NEVER required - it opens Oracle, claims tasks and
 * sends mail. Its functions are LIFTED by tokenizer (..\pivotparity\extract_mirror.php).
 *
 *   php -n test_gtvalues.php                     live runner
 *   php -n test_gtvalues.php --runner=<path>     a staged copy
 *   php -n test_gtvalues.php --mutant=<name>     map | curcsv | curxlsx | curhtml | corner | curfoot
 *                                                | cornerov | cornercol | colcrfmt (2026-09-26)
 *                                                (each must turn exactly its own checks red)
 *
 * 2026-09-26: under an override (or a column-total override) the CORNER of the
 * email body - and of the browser - totalled the first value's column in every
 * slot (both engines merged the main bucket). Fixed in both; C, D, G and H
 * assert it here, the browser half is harness.html's C3-C6.
 */
$MUTANT = null;
$runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
foreach ($argv as $a) {
    if (strpos($a, '--runner=') === 0) $runner = substr($a, 9);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
$here    = __DIR__;
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_gtvalues.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find runner: $runner\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }

$src = file_get_contents($runner);
// Each mutant undoes ONE part of the fix by exact text; the anchor must occur
// the stated number of times or the suite refuses to run (a stale anchor would
// otherwise read as a GREEN mutant).
$MUTANTS = array(
    // the default-case value map, in the CSV and XLSX builders (both copies)
    'map'     => array("if (\$_gtNoOverride) { \$rowTotalBaseMap = array_keys(\$aggTypes); }",
                       "/* MUTANT map */", 2),
    // the CSV row-total cell's unit + currency index
    'curcsv'  => array("strip_tags(pivot_format_value(\$totalVal, isset(\$_csvRtFmtType) ? \$_csvRtFmtType : \$at, \$isCurrency, \$sourceMaxDecimals, true, \$_csvRtUnit, \$_csvRtCur))",
                       "strip_tags(pivot_format_value(\$totalVal, isset(\$_csvRtFmtType) ? \$_csvRtFmtType : \$at, \$isCurrency, \$sourceMaxDecimals, true))", 1),
    // the XLSX row-total cells' unit + currency index (derived and base)
    'curxlsx' => array("\$xlsxFormatVal(\$totalVal, \$_xlsRtFmtType, \$_xlsRtUnitIdx, \$_xlsRtCur)",
                       "\$xlsxFormatVal(\$totalVal, \$_xlsRtFmtType)", 1),
    // the email body's override row-total cell currency
    'curhtml' => array("pivot_format_value(\$overrideRowTotal, \$_rtFormatType, \$isCurrency, \$sourceMaxDecimals, true, null, \$_rtCurIdx)",
                       "pivot_format_value(\$overrideRowTotal, \$_rtFormatType, \$isCurrency, \$sourceMaxDecimals, true)", 1),
    // the CSV corner's per-slot base (it read a stale or undefined index on derived slots)
    'corner'  => array("\$_csvCrBaseIdx = (isset(\$rowTotalBaseMap[\$rtIdx]) && \$rowTotalBaseMap[\$rtIdx] >= 0) ? \$rowTotalBaseMap[\$rtIdx] : false; // per slot",
                       "\$_csvCrBaseIdx = false;", 1),
    // the email body's column-total override cells (the footer ROW)
    'curfoot' => array("pivot_format_value(\$overrideVal, \$_ftFmtType, \$isCurrency, \$sourceMaxDecimals, true, null, \$idx)",
                       "pivot_format_value(\$overrideVal, \$_ftFmtType, \$isCurrency, \$sourceMaxDecimals, true)", 1),
    // 2026-09-26: the email body's override corner back on the main bucket
    'cornerov'  => array("\$_crVals = (\$_crBaseIdx === false) ? \$allValuesCorner : \$_cornerBucketValues(\$_crBaseIdx);",
                         "\$_crVals = \$allValuesCorner;", 1),
    // the email body's column-total override corner back on the main bucket
    'cornercol' => array("if (!pivot_is_derived_agg(\$aggTypes[\$idx])) { \$allValsForPos = \$_cornerBucketValues(\$idx); } else {",
                         "if (false) { } else {", 1),
    // that corner's format back to the override type and the first value's '$'
    'colcrfmt'  => array("pivot_format_value(\$cornerVal, \$_colCrFmtType, \$isCurrency, \$sourceMaxDecimals, true, null, \$idx)",
                         "pivot_format_value(\$cornerVal, \$effectiveCornerAgg, \$isCurrency, \$sourceMaxDecimals, true)", 1),
);
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant: $MUTANT\n"); exit(2); }
    list($from, $to, $times) = $MUTANTS[$MUTANT];
    $n = substr_count($src, $from);
    if ($n !== $times) { fwrite(STDERR, "MUTANT ANCHOR '$MUTANT' found $n times, expected $times - fix this suite.\n"); exit(2); }
    $src = str_replace($from, $to, $src);
}
$tmp = $here . '/_src_gtvalues.php';
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

// The FY comparison fixture: FY 2027 has only Jul. Row totals across the years:
// Jul $330 / 3, Aug $200 / 2, Sep $630 / 6; corner $1,160 / 11.
function fx() {
    $r = array();
    foreach (array(array('FY 2025','01 Jul','$100',1), array('FY 2025','02 Aug','$200',2), array('FY 2025','03 Sep','$300',3),
                   array('FY 2026','01 Jul','$110',1), array('FY 2026','03 Sep','$330',3),
                   array('FY 2027','01 Jul','$120',1)) as $x) {
        $r[] = array('FY' => $x[0], 'MONTH' => $x[1], 'AMOUNT' => $x[2], 'AWARDS' => (string)$x[3]);
    }
    return $r;
}
// $cols = the value columns in order; $aggs = their aggregations.
function settings($cols, $aggs, $totalRowAggs = null, $baseIdx = null) {
    $labels = array();
    foreach ($cols as $c) { $labels[] = ucfirst(strtolower($c)); }
    return array('v' => 2, 'rows' => array('MONTH'), 'cols' => array('FY'), 'vals' => $cols[0],
        'agg' => $aggs, 'aggLabels' => $labels, 'aggColOverrides' => (count($cols) > 1 ? $cols : null),
        'rowLayout' => 'flat', 'colLayout' => 'nested', 'sortOrder' => 'asc', 'totalColAggs' => null,
        'totalRowAggs' => $totalRowAggs, 'totalRowAggLabels' => null, 'totalRowAggBaseIdx' => $baseIdx);
}

// ---- cell grids: array(label => array(cells...)) plus 'FOOT' => footer cells ----
function grid_html($html) {
    $out = array();
    if (!preg_match_all('/<tr\b[^>]*>(.*?)<\/tr>/is', $html, $trs)) return $out;
    $lastFoot = null;
    foreach ($trs[1] as $tr) {
        if (!preg_match_all('/<t[dh]\b[^>]*>(.*?)<\/t[dh]>/is', $tr, $cs)) continue;
        $cells = array();
        foreach ($cs[1] as $c) { $cells[] = trim(html_entity_decode(strip_tags($c), ENT_QUOTES, 'UTF-8')); }
        $out[$cells[0]] = $cells;
        $lastFoot = $cells;
    }
    $out['FOOT'] = $lastFoot;   // the column-totals row is the table's last row
    return $out;
}
function grid_csv($csv) {
    $out = array(); $last = null;
    foreach (explode("\n", str_replace("\r", '', $csv)) as $ln) {
        if (trim($ln) === '') continue;
        $cells = str_getcsv($ln);
        $cells[0] = preg_replace('/^\xEF\xBB\xBF/', '', $cells[0]);
        $out[$cells[0]] = $cells; $last = $cells;
    }
    $out['FOOT'] = $last;
    return $out;
}
function grid_xlsx($x) {
    $out = array();
    foreach ($x['dataRows'] as $r) { $out[(string)$r[0]] = array_map('strval', $r); }
    $out['FOOT'] = empty($x['footerRow']) ? null : array_map('strval', $x['footerRow']);
    return $out;
}
// The last $n cells of a row = its Grand Total cells.
function gt($grid, $label, $n = 2) {
    if (!isset($grid[$label]) || !is_array($grid[$label])) return null;
    return array_slice($grid[$label], -$n);
}
function show($v) { return $v === null ? 'NULL' : '[' . implode(' | ', $v) . ']'; }

function grids($settings) {
    $rows = fx();
    return array(
        'HTML' => grid_html(generate_pivot_html($rows, $settings, 'theme-default', true)),
        'CSV'  => grid_csv(generate_pivot_csv_string($rows, $settings)),
        'XLSX' => grid_xlsx(pivot_build_xlsx_rows($rows, $settings)),
    );
}
// $want = array(label => array(expected GT cells)), 'FOOT' = the corner cells.
function check_case($tag, $what, $settings, $want) {
    foreach (grids($settings) as $b => $g) {
        foreach ($want as $label => $cells) {
            $got = gt($g, $label, count($cells));
            $name = ($label === 'FOOT') ? 'corner' : $label;
            ok($got === $cells, "$tag $b $what: $name = " . show($cells), 'got ' . show($got));
        }
    }
}

$AMT_AWD = array('01 Jul' => array('$330', '3'), '02 Aug' => array('$200', '2'), '03 Sep' => array('$630', '6'), 'FOOT' => array('$1,160', '11'));
$AWD_AMT = array('01 Jul' => array('3', '$330'), '02 Aug' => array('2', '$200'), '03 Sep' => array('6', '$630'), 'FOOT' => array('11', '$1,160'));
// With an override, the email body's CORNER totalled the first value's column in
// every slot ("1,160" under Awards) - the browser too: both engines merged the
// main bucket there. Fixed in both 2026-09-26; asserted below.
$AMT_AWD_ROWS = $AMT_AWD; unset($AMT_AWD_ROWS['FOOT']);

echo "A. no override, Amount then Awards (the FY comparison reports)\n";
check_case('A', 'no override', settings(array('AMOUNT', 'AWARDS'), array('sum', 'sum')), $AMT_AWD);

echo "B. no override, mirror image: Awards then Amount\n";
check_case('B', 'mirror', settings(array('AWARDS', 'AMOUNT'), array('sum', 'sum')), $AWD_AMT);

// An override: every builder's rows and corner.
function check_override($tag, $what, $settings, $rowsWant, $cornerWant) {
    check_case($tag, $what, $settings, $rowsWant);
    foreach (grids($settings) as $b => $g) {
        $got = gt($g, 'FOOT', count($cornerWant));
        ok($got === $cornerWant, "$tag $b $what: corner = " . show($cornerWant), 'got ' . show($got));
    }
}

echo "C. an override naming both values (the builder's own base indices)\n";
check_override('C', 'override', settings(array('AMOUNT', 'AWARDS'), array('sum', 'sum'), array('sum', 'sum'), array(0, 1)), $AMT_AWD_ROWS, $AMT_AWD['FOOT']);

echo "D. the same override written in a snippet (no base indices: matched by type)\n";
check_override('D', 'snippet override', settings(array('AMOUNT', 'AWARDS'), array('sum', 'sum'), array('sum', 'sum')), $AMT_AWD_ROWS, $AMT_AWD['FOOT']);

echo "E. no override with a derived value first (running total of Amount, then Awards)\n";
// Jul: running total across the years ends at $330; Awards 3. The derived slot
// must not borrow a stale base from another slot.
$e = grids(settings(array('AMOUNT', 'AMOUNT', 'AWARDS'), array('sum', 'running_total', 'sum')));
foreach ($e as $b => $g) {
    $got = gt($g, '01 Jul', 3);
    ok(is_array($got) && $got[0] === '$330' && $got[2] === '3', "E $b: Jul sum + Awards = \$330 ... 3", 'got ' . show($got));
    $foot = gt($g, 'FOOT', 3);
    ok(is_array($foot) && $foot[0] === '$1,160' && $foot[2] === '11', "E $b: corner sum + Awards = \$1,160 ... 11", 'got ' . show($foot));
}

echo "F. regression guard: one value, no override (unchanged)\n";
check_case('F', 'single value', settings(array('AMOUNT'), array('sum')),
    array('01 Jul' => array('$330'), '02 Aug' => array('$200'), '03 Sep' => array('$630'), 'FOOT' => array('$1,160')));

echo "G. a column-total override (the footer ROW): each year's cells, and the corner, keep their own value\n";
// FY 2025 $600 / 6, FY 2026 $440 / 4, FY 2027 $120 / 1; corner $1,160 / 11 (the
// email body's corner summed the first value's column here too, fixed 2026-09-26).
$gs = settings(array('AMOUNT', 'AWARDS'), array('sum', 'sum'));
$gs['totalColAggs'] = array('sum', 'sum');
foreach (grids($gs) as $b => $g) {
    $f = isset($g['FOOT']) ? $g['FOOT'] : null;
    $got = is_array($f) ? array_slice($f, 1, 6) : null;
    $want = array('$600', '6', '$440', '4', '$120', '1');
    ok($got === $want, "G $b: footer per year = " . show($want), 'got ' . show($got));
    $corner = gt($g, 'FOOT', 2);
    ok($corner === array('$1,160', '11'), "G $b: corner = [\$1,160 | 11]", 'got ' . show($corner));
}

echo "H. a column-total override that differs from the value's own aggregation (Max over the Awards sum)\n";
// The largest monthly Awards total = 3. The email body formatted it as the
// override type with the FIRST value's currency ("$3"); the browser uses the
// base type and the value's own '$'. (A count override would not show it: a
// count never takes a '$'.)
$hs = settings(array('AMOUNT', 'AWARDS'), array('sum', 'sum'));
$hs['totalColAggs'] = array(null, 'max');
$hh = grids($hs);
$hc = gt($hh['HTML'], 'FOOT', 2);
ok(is_array($hc) && $hc[1] === '3', "H HTML: max-override corner = 3, no \$", 'got ' . show($hc));

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
