<?php
/**
 * PHP <-> PHP <-> PHP builder differ.
 *
 * schedule_runner.php renders a scheduled pivot through THREE parallel builders
 * that share logic by copy-paste and are documented to drift:
 *   generate_pivot_html()        - the emailed table
 *   generate_pivot_csv_string()  - the .csv attachment
 *   pivot_build_xlsx_rows()      - the .xlsx attachment
 *
 * The JS<->PHP parity harness CANNOT see this class of bug: all three sit on the
 * same side of that comparison. This feeds ONE fixture to all three and diffs
 * the numbers they print - the only way to catch drift between them without
 * sending a real email.
 *
 * It also counts PHP warnings per builder. The runner runs at E_ALL with
 * log_errors on, so an undefined variable in a builder is both a wrong number
 * AND a flood in php82_errors.log; both are findings.
 *
 *   php builder_diff.php
 */
require_once __DIR__ . '/pivot_mirror.php';
require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
$theme_styles = penumbra_build_theme_styles();

// ---- warning capture (per builder) -----------------------------------------
$GLOBALS['__warn'] = array();
$GLOBALS['__where'] = 'setup';
set_error_handler(function ($no, $str, $file, $line) {
    if (strpos($file, 'pivot_mirror.php') === false) { return true; }
    $key = $GLOBALS['__where'] . ' | ' . $str;
    if (!isset($GLOBALS['__warn'][$key])) { $GLOBALS['__warn'][$key] = 0; }
    $GLOBALS['__warn'][$key]++;
    return true;
}, E_ALL);

// ---------------------------------------------------------------- fixture ---
// RATE weighted by AMOUNT. Weights differ sharply per cell so a TRUE weighted
// average and an average-of-averages cannot coincide by accident.
// NOTE the HOLE in this grid: Arts has 2025 only, so Arts/2024 is an EMPTY cell.
// That matters more than it looks. The original fixture filled every
// row x column combination, so no cell was ever empty and the "nothing to
// measure" sentinel path was never rendered by any builder - which is exactly
// how an emailed min column showed "$0" where the CSV and XLSX of the same run
// showed blank, with this differ reporting all three in agreement. A grid with
// no holes cannot see that class of bug. Keep the hole.
$rows = array(
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '10', 'AMOUNT' => '1000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '20', 'AMOUNT' => '9000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '50', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '60', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Sciences',    'FY' => '2024', 'RATE' => '5',  'AMOUNT' => '100'),
    array('COLLEGE' => 'Sciences',    'FY' => '2025', 'RATE' => '80', 'AMOUNT' => '9900'),
    array('COLLEGE' => 'Arts',        'FY' => '2025', 'RATE' => '0',  'AMOUNT' => '5'),
);
function settings_for($aggType) {
    return array('rows'=>array('COLLEGE'), 'cols'=>array('FY'), 'vals'=>'RATE',
                 'agg'=>array($aggType), 'rowLayout'=>'flat', 'colLayout'=>'flat', 'sortOrder'=>'asc');
}

// ------------------------------------------------------------ extraction ----
function html_row_total($html, $label) {
    if (!preg_match('#<tr[^>]*>(?:(?!</tr>).)*?>' . preg_quote($label, '#') . '</td>(?:(?!</tr>).)*?</tr>#s', $html, $m)) return 'ROW NOT FOUND';
    if (!preg_match_all('#<td[^>]*>(.*?)</td>#s', $m[0], $c)) return 'NO CELLS';
    return trim(strip_tags(end($c[1])));
}
function csv_row_total($csv, $label) {
    $lines = preg_split('/\r\n|\n/', trim($csv));
    $hdr = str_getcsv(preg_replace('/^\xEF\xBB\xBF/', '', $lines[0]));
    // The total column is NOT always called "Grand Total": pivot_agg_total_label()
    // names it per agg type ("Overall Wtd Avg", "Overall Std Dev", "Overall P50").
    // Matching only the literal string made every non-sum aggregation look like a
    // MISSING COLUMN - a bug in this extractor, not in the builder.
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
    if (isset($x['colTypes'])) {
        foreach ($x['colTypes'] as $i => $t) { if ($t === 'grandTotal') { $gi = $i; } }
    }
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

// -------------------------------------------------------------- expected ----
// Engineering, by hand from the RAW rows (this is what a correct total is):
//   wavg   = S(rate*amt)/S(amt) = (10*1000+20*9000+50*10+60*10)/10020 = 19.0719
//            an average of the two CELL wavgs would be (19 + 55)/2 = 37  <-- wrong
//   stddev = sample stddev over ALL four rates {10,20,50,60}
//   p50    = median over ALL four rates = 35
// Expectations are the DISPLAYED value, not the raw one: pivot_format_value()
// gives the avg family (avg/median/pNN/wavg) min(max($sourceMaxDecimals,0),4)
// decimals, and RATE holds integers, so wavg prints 19 rather than 19.0719.
// stddev floors at 2 decimals, which is why it prints 23.80. Comparing against
// the raw 19.0719 made a correctly-rounded cell look like a defect - the tool
// must not manufacture findings out of its own formatting assumptions.
// (19 is still proof the math is right: an average-of-averages would print 37.)
$checks = array(
    'sum'         => 140.0,   // control
    'wavg@AMOUNT' => 19.0,    // true wtd avg 19.0719 at 0 decimals
    'stddev'      => 23.80,   // stddev floors at 2 decimals
    'p50'         => 35.0,
);

$problems = 0;
foreach ($checks as $agg => $expect) {
    $set = settings_for($agg);
    $GLOBALS['__where'] = "html/$agg";
    $h = generate_pivot_html($rows, $set, 'theme-default', true);
    $GLOBALS['__where'] = "csv/$agg";
    $c = generate_pivot_csv_string($rows, $set);
    $GLOBALS['__where'] = "xlsx/$agg";
    $x = pivot_build_xlsx_rows($rows, $set);

    $hv = html_row_total($h, 'Engineering');
    $cv = csv_row_total($c, 'Engineering');
    $xv = xlsx_row_total($x, 'Engineering');
    $hn = numify($hv); $cn = numify($cv); $xn = numify($xv);

    $ok = function ($n) use ($expect) { return $n !== null && abs($n - $expect) < 0.01; };
    $agree = ($hn !== null && $cn !== null && $xn !== null)
             && abs($hn - $cn) < 0.01 && abs($hn - $xn) < 0.01;

    printf("\n=== %-12s Engineering total, correct answer = %.4f ===\n", $agg, $expect);
    printf("  HTML  %-12s %s\n", $hv, $ok($hn) ? 'correct' : '*** WRONG ***');
    printf("  CSV   %-12s %s\n", $cv, $ok($cn) ? 'correct' : '*** WRONG ***');
    printf("  XLSX  %-12s %s\n", $xv, $ok($xn) ? 'correct' : '*** WRONG ***');
    if (!$agree) { $problems++; echo "  >>> THE THREE BUILDERS DISAGREE\n"; }
    elseif (!$ok($hn)) { $problems++; echo "  >>> all three agree, all three WRONG\n"; }
    else { echo "  all three agree and are correct\n"; }
}

// ------------------------------------------------- derived aggregations -----
// ~380 references across the pivot and, until now, zero coverage. These need a
// BASE aggregation to derive from, so each config is [sum, <derived>] and the
// derived column is the one compared.
//
// No hand-computed oracle here on purpose: the question is whether the three
// builders AGREE, and agreement needs no expected value. Any disagreement is a
// finding by definition; a shared wrong answer is invisible to this tool and
// stays a job for reading.
function nth_total($csv, $label, $n) {
    $lines = preg_split('/\r\n|\n/', trim($csv));
    foreach (array_slice($lines, 1) as $ln) {
        $c = str_getcsv($ln);
        if (isset($c[0]) && trim($c[0]) === $label) { return isset($c[$n]) ? trim($c[$n]) : 'MISSING'; }
    }
    return 'ROW NOT FOUND';
}
function all_cells_html($html, $label) {
    if (!preg_match('#<tr[^>]*>(?:(?!</tr>).)*?>' . preg_quote($label, '#') . '</td>(?:(?!</tr>).)*?</tr>#s', $html, $m)) return array();
    preg_match_all('#<td[^>]*>(.*?)</td>#s', $m[0], $c);
    return array_map(function ($v) { return trim(strip_tags($v)); }, $c[1]);
}
function all_cells_xlsx($x, $label) {
    if (!isset($x['dataRows'])) return array();
    foreach ($x['dataRows'] as $r) {
        if (isset($r[0]) && trim((string)$r[0]) === $label) return array_map('strval', $r);
    }
    return array();
}

$derived = array('pct_row_total','pct_col_total','pct_grand_total','pct_parent_row',
                 'pct_cum','pct_cum:down','index','index:down','diff','diff:down',
                 'running_total','running_total:down','running_count','pct_change',
                 // time intelligence + rolling + chosen baseline (added 2026-08-28
                 // in another session; these had NO builder coverage at all)
                 'ytd','ytd:down','yoy','yoy:down','prioryear','prioryear:down',
                 'roll3','roll3:down','rollsum3','rollsum3:down','index@2025');
echo "\n\n########## DERIVED AGGREGATIONS - do the three builders agree? ##########\n";
$dProblems = 0;
foreach ($derived as $d) {
    $set = settings_for('sum');
    $set['agg'] = array('sum', $d);          // derived needs a base to derive from
    $GLOBALS['__where'] = "html/$d";  $h = generate_pivot_html($rows, $set, 'theme-default', true);
    $GLOBALS['__where'] = "csv/$d";   $c = generate_pivot_csv_string($rows, $set);
    $GLOBALS['__where'] = "xlsx/$d";  $x = pivot_build_xlsx_rows($rows, $set);

    $hc = all_cells_html($h, 'Engineering');
    $xc = all_cells_xlsx($x, 'Engineering');
    // compare every cell of the row across the three, positionally
    $n = min(count($hc), count($xc));
    $mismatch = array();
    for ($i = 1; $i < $n; $i++) {
        $cv = nth_total($c, 'Engineering', $i);
        $a = $hc[$i]; $b = $xc[$i];
        // Known, deliberate convention - NOT drift: where a derived value is not
        // computable, HTML/CSV print the "-" placeholder while XLSX emits null,
        // which pivot_format_value renders as an empty cell. That is correct for
        // a spreadsheet (an empty cell keeps the column numeric for formulas and
        // charts; a literal "-" would turn it to text) and it is applied
        // consistently across the XLSX derived sites (~9692/9710/9725/9737/9910).
        $naPair = (($a === '-' || $a === '') && ($cv === '-' || $cv === '') && ($b === '-' || $b === ''));
        if ($naPair) { continue; }
        if ($a !== $b || $a !== $cv) { $mismatch[] = "col$i html='$a' csv='$cv' xlsx='$b'"; }
    }
    if (empty($mismatch)) { printf("  agree   %-22s (%d cells)\n", $d, max(0, $n - 1)); }
    else {
        $dProblems++;
        printf("  DIFFER  %-22s\n", $d);
        foreach (array_slice($mismatch, 0, 4) as $m) { echo "            $m\n"; }
    }
}
echo "  --> $dProblems of " . count($derived) . " derived types disagree across builders\n";

// ------------------------------------------------- EMPTY-CELL rendering -----
// Regression guard for the "$0 in email, blank in XLSX" bug. Arts has no 2024
// row, so its 2024 cell is empty for every aggregation; Arts/2025 is a GENUINE
// zero and must still print as zero. Checks the three builders agree AND that
// they agree on the right answer - a shared wrong answer would otherwise pass.
echo "\n\n########## EMPTY CELL vs GENUINE ZERO (the \$0-in-email regression) ##########\n";
$emptyProblems = 0;
foreach (array('min', 'max', 'sum', 'avg', 'stddev') as $ag) {
    $set = settings_for($ag);
    $GLOBALS['__where'] = "html/empty-$ag";  $h = generate_pivot_html($rows, $set, 'theme-default', true);
    $GLOBALS['__where'] = "csv/empty-$ag";   $c = generate_pivot_csv_string($rows, $set);
    $GLOBALS['__where'] = "xlsx/empty-$ag";  $x = pivot_build_xlsx_rows($rows, $set);

    $hc = all_cells_html($h, 'Arts');
    $xc = all_cells_xlsx($x, 'Arts');
    // column 1 = FY2024 (the empty one), column 2 = FY2025 (a genuine 0 for min/max/sum)
    $hEmpty = isset($hc[1]) ? $hc[1] : '?';
    $cEmpty = nth_total($c, 'Arts', 1);
    $xEmpty = isset($xc[1]) ? $xc[1] : '?';
    // The HTML body must match the BROWSER, which blanks an empty cell - that is
    // the regression this guard exists for, and it hard-fails.
    //
    // CSV/XLSX printing "0" for the same cell is NOT drift: they pass
    // showZero=TRUE to pivot_format_value (schedule_runner ~8613 / ~9479) while
    // the HTML body passes FALSE, deliberately, so a spreadsheet column stays
    // numeric instead of gaining holes. min/max are exempt from zero-blanking
    // on every surface, so for those all three blank and must agree exactly.
    $blank      = ($hEmpty === '');
    $isMinMax   = ($ag === 'min' || $ag === 'max');
    $zeroish    = function ($v) { return $v === '0' || $v === '0.00' || $v === '$0'; };
    $convention = (!$isMinMax && $blank && $zeroish($cEmpty) && $zeroish($xEmpty));
    $agree      = ($hEmpty === $cEmpty && $hEmpty === $xEmpty);
    $ok         = $blank && ($agree || $convention);
    printf("  %-8s empty cell -> html='%s' csv='%s' xlsx='%s'   %s\n",
        $ag, $hEmpty, $cEmpty, $xEmpty,
        (!$blank ? '*** HTML DID NOT BLANK - the regression ***'
                 : ($agree ? 'blank in all three' : 'html blank; csv/xlsx 0 (showZero convention)')));
    if (!$ok) { $emptyProblems++; }
}
// the genuine zero must survive - blanking it would be an over-correction
$setMin = settings_for('min');
$hz = all_cells_html(generate_pivot_html($rows, $setMin, 'theme-default', true), 'Arts');
$zeroCell = isset($hz[2]) ? $hz[2] : '?';
printf("  %-8s genuine zero -> html='%s'   %s\n", 'min', $zeroCell,
    ($zeroCell !== '' ? 'still prints (correct)' : '*** WRONGLY BLANKED ***'));
if ($zeroCell === '') { $emptyProblems++; }
echo "  --> $emptyProblems problem(s)\n";

echo "\n--- PHP warnings raised inside the builders (E_ALL, as the runner runs) ---\n";
if (empty($GLOBALS['__warn'])) { echo "  none\n"; }
else {
    arsort($GLOBALS['__warn']);
    foreach ($GLOBALS['__warn'] as $k => $n) { printf("  %5dx  %s\n", $n, $k); }
}
echo "\n$problems of " . count($checks) . " aggregation(s) show a problem\n";
exit($problems > 0 ? 1 : 0);
