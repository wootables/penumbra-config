<?php
/**
 * Pivot RANK vs per-aggregation FILTER - scheduled-send (engine C) unit tests.
 * Added 2026-09-05 with the fix.
 *
 * THE BUG. pivot_apply_rank() computed each row's rank value with
 * pivot_extract_agg_value($cell, $rankAgg, $_rankCol) - no filter index - so on a
 * pivot whose ranking aggregation carries a filter ("Sum where ROLE = in") the
 * leaderboard was built from the UNFILTERED total. Top N could therefore keep a
 * row on the strength of dollars its own displayed cell excludes, and the order
 * disagreed with the column it claimed to sort by.
 *
 * It was NOT a browser/email divergence: js/main.js had the identical omission at
 * its single rank-value site, which is exactly why a differential harness could
 * never see it - both engines agreed, and agreement is all a differential test
 * checks. Fixed in both on 2026-09-05 ($_rankFlt / _rankFlt).
 *
 * TWO MORE DEFECTS IN THE SAME FUNCTION, found while fixing that one and fixed
 * with it (both engines, both in the synthetic "(Other)" rollup):
 *   - it dropped `_filteredBuckets`, so a filtered aggregation on the (Other) row
 *     fell back to the UNFILTERED bucket and printed a total under a column header
 *     that says it is filtered;
 *   - it dropped `wpairs`, so wavg@COL on an (Other) row read 0 - the very failure
 *     extractAggregationValue documents at its own filtered-bucket read.
 *
 * FIXTURE (the whole point is that filtered and unfiltered ranking DISAGREE):
 *
 *   row   ROLE=in    ROLE=out    unfiltered total   filtered total
 *   A       10          0               10                10
 *   B        1        900              901                 1
 *   C        5          0                5                 5
 *
 * Ranking Top 2 by "Sum where ROLE = in" must keep A and C. Before the fix it
 * kept B (901) and A (10) - B is second-to-last by the number on screen.
 *
 *   php -n test_rankfilter.php            normal run
 *   php -n test_rankfilter.php --control  deliberately broken expectation
 *   php -n test_rankfilter.php --mutant   restores the pre-fix rank read; the
 *                                         rank assertions must FAIL
 *   php -n test_rankfilter.php --mutant2  restores the pre-fix (Other) rollup;
 *                                         only the (Other) assertions may FAIL
 */

$CONTROL = in_array('--control', $argv, true);
$MUTANT  = in_array('--mutant', $argv, true);
$MUTANT2 = in_array('--mutant2', $argv, true);
$MUTANT3 = in_array('--mutant3', $argv, true);

$here   = __DIR__;
$runner = 'C:/inetpub/wwwroot/sponsor_migration/penumbra/schedule_runner.php';
if (!file_exists($runner)) {
    $runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
}
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_rankfilter.php';
if (!file_exists($runner))  { fwrite(STDERR, "cannot find schedule_runner.php\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }

$src = file_get_contents($runner);
if ($MUTANT) {
    // TARGETED MUTANT 1: put the filter-blind rank read back.
    $needle = 'pivot_extract_agg_value($data[$rk][$ck], $rankAgg, $_rankCol, $_rankFlt)';
    if (strpos($src, $needle) === false) {
        fwrite(STDERR, "MUTANT ANCHOR NOT FOUND - the rank read changed shape; fix this suite.\n"); exit(2);
    }
    $src = str_replace($needle, 'pivot_extract_agg_value($data[$rk][$ck], $rankAgg, $_rankCol)', $src);
}
if ($MUTANT2) {
    // TARGETED MUTANT 2: make the (Other) rollup drop the filtered buckets again.
    $needle2 = "if (isset(\$cellData['_filteredBuckets']) && is_array(\$cellData['_filteredBuckets'])) {";
    if (strpos($src, $needle2) === false) {
        fwrite(STDERR, "MUTANT2 ANCHOR NOT FOUND - the (Other) rollup changed shape; fix this suite.\n"); exit(2);
    }
    $src = str_replace($needle2, "if (false) {", $src);
}
if ($MUTANT3) {
    // TARGETED MUTANT 3, for the wpairs half of the merge. Mutants 1 and 2 leave
    // the wavg assertion passing whether or not wpairs merge, so it needs one of
    // its own - the rule "every must-NOT-change assertion gets its own mutant".
    $needle3 = "    if (isset(\$src['wpairs']) && is_array(\$src['wpairs'])) {";
    if (strpos($src, $needle3) === false) {
        fwrite(STDERR, "MUTANT3 ANCHOR NOT FOUND - the merge helper changed shape; fix this suite.\n"); exit(2);
    }
    $src = str_replace($needle3, "    if (false) {", $src);
}
$tmpSrc = $here . '/_src_rankfilter.php';
file_put_contents($tmpSrc, $src);
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmpSrc) . ' ' . escapeshellarg($mirror);
exec($cmd, $exOut, $exCode);
if ($exCode !== 0 || !file_exists($mirror)) {
    fwrite(STDERR, "extract_mirror failed (exit $exCode): " . implode("\n", $exOut) . "\n"); exit(2);
}
require_once $mirror;
@unlink($tmpSrc);

// penumbra_search.php (2026-09-26). Since 2026-09-23 the pivot's per-aggregation
// filter runs on the format-condition engine, whose _cf_test_condition() calls
// _sr_resolve_keyword_date() - a penumbra_search.php function the mirror cannot
// carry (extract_mirror.php lifts only what schedule_runner.php DECLARES; the
// runner requires the file itself). Without it this suite died with "Call to
// undefined function" at its first filtered aggregation, before any check ran.
// Same fix as pivotparity\php_driver.php. Pure declarations: required from the
// runner's own tree when it has one (a staged copy may not), else the live app.
$searchPhp = dirname($runner) . '/penumbra_search.php';
if (!file_exists($searchPhp)) {
    $searchPhp = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_search.php';
}
if (!function_exists('_sr_resolve_keyword_date')) { require_once $searchPhp; }

$themesCfg = dirname($runner) . '/themes_config.php';
if (file_exists($themesCfg)) { require_once $themesCfg; }
if (function_exists('penumbra_build_theme_styles')) {
    $GLOBALS['theme_styles'] = penumbra_build_theme_styles();
}

$PASS = 0; $FAIL = 0;
function ok($cond, $label) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; return; }
    $FAIL++; echo "  FAIL: $label\n";
}
function eqi($actual, $expected, $label) {
    ok($actual === $expected, $label . " (expected " . var_export($expected, true) . ", got " . var_export($actual, true) . ")");
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
function rf_rows() {
    return array(
        array('R' => 'A', 'C' => 'K', 'AMT' => '10',  'ROLE' => 'in'),
        array('R' => 'B', 'C' => 'K', 'AMT' => '1',   'ROLE' => 'in'),
        array('R' => 'B', 'C' => 'K', 'AMT' => '900', 'ROLE' => 'out'),
        array('R' => 'C', 'C' => 'K', 'AMT' => '5',   'ROLE' => 'in'),
    );
}
function rf_settings($extra = array()) {
    return array_merge(array(
        'rows' => array('R'), 'cols' => array('C'), 'vals' => 'AMT',
        'agg' => array('sum'), 'aggFilters' => array("ROLE = in"),
        'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc',
    ), $extra);
}
// Build the collected grid the way the three builders do - WITH the filters, so
// the per-aggregation buckets exist.
function rf_build($settings) {
    $pd = pivot_process_data(rf_rows(), $settings['rows'], $settings['cols'], $settings['vals'],
                             array(), $settings['aggFilters'], $settings['agg']);
    return $pd['data'];
}

// ---------------------------------------------------------------------------
// 1. Control: the fixture really does make the two rankings disagree, so a
//    passing rank assertion below cannot be passing by accident.
// ---------------------------------------------------------------------------
$data = rf_build(rf_settings());
$unf = array(); $flt = array();
foreach (array('A','B','C') as $rk) {
    $unf[$rk] = pivot_extract_agg_value($data[$rk]['K'], 'sum', null, null);
    $flt[$rk] = pivot_extract_agg_value($data[$rk]['K'], 'sum', null, 0);
}
eqi((float)$unf['B'], 901.0, 'control: B unfiltered sum is 901');
eqi((float)$flt['B'], 1.0,   'control: B FILTERED sum is 1');
ok($unf['B'] > $unf['A'] && $flt['B'] < $flt['A'], 'control: the two rankings genuinely disagree on B vs A');
eqi((float)$flt['A'], 10.0, 'control: A filtered sum is 10');
eqi((float)$flt['C'], 5.0,  'control: C filtered sum is 5');

// ---------------------------------------------------------------------------
// 2. THE HEADLINE: Top 2 by the filtered Sum keeps A and C, not B.
// ---------------------------------------------------------------------------
$s = rf_settings(array('rankDir' => 'top', 'rankN' => 2, 'rankAgg' => 'sum', 'rankOther' => false));
$rowKeys = array('A','B','C');
$colKeys = array('K');
$d = rf_build($s);
pivot_apply_rank($rowKeys, $d, $s, $colKeys, $s['agg']);
sort($rowKeys, SORT_STRING);
eqi($rowKeys, array('A','C'), 'Top 2 by a FILTERED Sum keeps A and C (pre-fix kept B)');

// Bottom 2 is the mirror image: B (1) and C (5), not A.
$s2 = rf_settings(array('rankDir' => 'bottom', 'rankN' => 2, 'rankAgg' => 'sum', 'rankOther' => false));
$rowKeys2 = array('A','B','C'); $colKeys2 = array('K'); $d2 = rf_build($s2);
pivot_apply_rank($rowKeys2, $d2, $s2, $colKeys2, $s2['agg']);
sort($rowKeys2, SORT_STRING);
eqi($rowKeys2, array('B','C'), 'Bottom 2 by a FILTERED Sum keeps B and C');

// An UNfiltered pivot is untouched by the fix - the regression guard.
$s3 = array('rows' => array('R'), 'cols' => array('C'), 'vals' => 'AMT', 'agg' => array('sum'),
            'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc',
            'rankDir' => 'top', 'rankN' => 2, 'rankAgg' => 'sum', 'rankOther' => false);
$pd3 = pivot_process_data(rf_rows(), array('R'), array('C'), 'AMT', array(), null, array('sum'));
$rowKeys3 = array('A','B','C'); $colKeys3 = array('K'); $d3 = $pd3['data'];
pivot_apply_rank($rowKeys3, $d3, $s3, $colKeys3, array('sum'));
sort($rowKeys3, SORT_STRING);
eqi($rowKeys3, array('A','B'), 'NO filter: Top 2 by Sum still keeps A and B (unchanged)');

// ---------------------------------------------------------------------------
// 3. The "(Other)" row carries the FILTERED bucket, not the unfiltered total.
//    Top 1 with rollup: A is kept; B + C roll into (Other), whose filtered Sum
//    must be 1 + 5 = 6, NOT the unfiltered 901 + 5 = 906.
// ---------------------------------------------------------------------------
$s4 = rf_settings(array('rankDir' => 'top', 'rankN' => 1, 'rankAgg' => 'sum', 'rankOther' => true));
$rowKeys4 = array('A','B','C'); $colKeys4 = array('K'); $d4 = rf_build($s4);
pivot_apply_rank($rowKeys4, $d4, $s4, $colKeys4, $s4['agg']);
$otherKey = null;
foreach ($rowKeys4 as $rk) { if (strpos($rk, 'Other') !== false) { $otherKey = $rk; break; } }
ok($otherKey !== null, '(Other) row was created');
if ($otherKey !== null) {
    $otherCell = $d4[$otherKey]['K'];
    eqi((float)pivot_extract_agg_value($otherCell, 'sum', null, 0), 6.0,
        '(Other) FILTERED sum is 1 + 5 = 6 (pre-fix read the unfiltered 906)');
    eqi((float)pivot_extract_agg_value($otherCell, 'sum', null, null), 906.0,
        '(Other) unfiltered sum is still 901 + 5 = 906');
    ok(isset($otherCell['_filteredBuckets'][0]), '(Other) carries a _filteredBuckets entry');
}

// ---------------------------------------------------------------------------
// 4. wpairs survive the (Other) merge, so wavg@COL is not 0 there.
//    Weights: A w=1 v=10, B w=1 v=1(+out), C w=3 v=5 -> (Other) over B,C
//    = (1*1 + 3*5) / (1 + 3) = 16/4 = 4.
// ---------------------------------------------------------------------------
function rf_wrows() {
    return array(
        array('R' => 'A', 'C' => 'K', 'AMT' => '10', 'W' => '1', 'ROLE' => 'in'),
        array('R' => 'B', 'C' => 'K', 'AMT' => '1',  'W' => '1', 'ROLE' => 'in'),
        array('R' => 'C', 'C' => 'K', 'AMT' => '5',  'W' => '3', 'ROLE' => 'in'),
    );
}
$sw = array('rows' => array('R'), 'cols' => array('C'), 'vals' => 'AMT',
            'agg' => array('wavg@W'), 'rowLayout' => 'flat', 'colLayout' => 'flat',
            'sortOrder' => 'asc', 'rankDir' => 'top', 'rankN' => 1,
            'rankAgg' => 'wavg@W', 'rankOther' => true);
$pdw = pivot_process_data(rf_wrows(), array('R'), array('C'), 'AMT', array('W'), null, array('wavg@W'));
$rkw = array('A','B','C'); $ckw = array('K'); $dw = $pdw['data'];
pivot_apply_rank($rkw, $dw, $sw, $ckw, array('wavg@W'));
$otherW = null;
foreach ($rkw as $rk) { if (strpos($rk, 'Other') !== false) { $otherW = $rk; break; } }
ok($otherW !== null, 'wavg: (Other) row was created');
if ($otherW !== null) {
    $wv = pivot_extract_agg_value($dw[$otherW]['K'], 'wavg@W', null, null);
    eqi((float)$wv, 4.0, 'wavg@W on (Other) is (1*1 + 3*5)/4 = 4, not 0 (pre-fix dropped wpairs)');
}

// ---------------------------------------------------------------------------
// 5. The merge helper itself.
// ---------------------------------------------------------------------------
$dst = pivot_rank_new_bucket();
$src1 = array('sum' => 5, 'numericCount' => 1, 'min' => 5, 'max' => 5,
              'values' => array(5), 'distinct' => array('x' => true),
              'wpairs' => array('W' => array('w' => 2, 'wv' => 10)));
$src2 = array('sum' => 3, 'numericCount' => 1, 'min' => 3, 'max' => 3,
              'values' => array(3), 'distinct' => array('y' => true),
              'wpairs' => array('W' => array('w' => 1, 'wv' => 3)));
pivot_rank_merge_bucket($dst, $src1);
pivot_rank_merge_bucket($dst, $src2);
eqi((float)$dst['sum'], 8.0, 'merge: sums add');
eqi((float)$dst['min'], 3.0, 'merge: min is the smaller');
eqi((float)$dst['max'], 5.0, 'merge: max is the larger');
eqi(count($dst['values']), 2, 'merge: values concatenate');
eqi(count($dst['distinct']), 2, 'merge: distinct unions');
eqi((float)$dst['wpairs']['W']['w'], 3.0, 'merge: wpairs w accumulates');
eqi((float)$dst['wpairs']['W']['wv'], 13.0, 'merge: wpairs wv accumulates');
$empty = pivot_rank_new_bucket();
pivot_rank_merge_bucket($empty, array());
eqi((float)$empty['sum'], 0.0, 'merge: an empty source is a no-op');
eqi((float)$empty['min'], 1e308, 'merge: the empty sentinel survives an empty merge');

if ($CONTROL) {
    eqi($rowKeys, array('B','C'), 'CONTROL: this must FAIL');
}

echo "\n";
echo "PASS $PASS   FAIL $FAIL\n";
exit($FAIL === 0 ? 0 : 1);
