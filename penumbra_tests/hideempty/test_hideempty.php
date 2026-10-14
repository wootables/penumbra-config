<?php
/**
 * "Hide empty rows and columns" - scheduled-send (engine C) unit tests.
 * Added 2026-09-05 with the feature.
 *
 * WHAT IS UNDER TEST. pivot_agg_value_is_empty() / pivot_empty_key_sets() /
 * pivot_apply_hide_empty() in schedule_runner.php, and the four consumers that
 * call the applier: generate_pivot_html(), generate_pivot_csv_string(),
 * pivot_build_xlsx_rows() and pivot_count_after_rank(). The browser drops the
 * same rows and columns in generatePivotTable(); if these two disagree the
 * emailed pivot silently shows a different grid than the screen, which is the
 * failure mode the group-mode hidden-column bug already cost us once.
 *
 * schedule_runner.php is NEVER require()d - it is a CLI entry point that opens
 * Oracle, claims tasks and SENDS MAIL. The mirror is lifted by tokenizer with
 * pivotparity/extract_mirror.php, exactly as the pivot parity harness does.
 *
 * FIXTURE SHAPE (deliberate holes - a grid with no empty cells cannot see this
 * feature at all, the lesson from the 2026-08-29 blank-vs-zero bug):
 *
 *            C1     C2      C3
 *      R1    10     0       (no rows)
 *      R2    0      0       0            <- empty ROW
 *      R3    (none) 0       5
 *                   ^ empty COLUMN
 *
 * So R2 must vanish, C2 must vanish, and R1/R3/C1/C3 must survive UNCHANGED.
 * Both flavours of empty are present: a real 0 from rows that exist, and a cell
 * with no source rows at all.
 *
 *   php -n test_hideempty.php            normal run
 *   php -n test_hideempty.php --control  deliberately broken expectation
 *   php -n test_hideempty.php --mutant   feature neutered; headline must FAIL
 */

$CONTROL = in_array('--control', $argv, true);
$MUTANT  = in_array('--mutant', $argv, true);
$MUTANT2 = in_array('--mutant2', $argv, true);

$here    = __DIR__;
$runner  = 'C:/inetpub/wwwroot/sponsor_migration/penumbra/schedule_runner.php';
if (!file_exists($runner)) {
    $runner = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\schedule_runner.php';
}
$extract = $here . '/../pivotparity/extract_mirror.php';
$mirror  = $here . '/mirror_hideempty.php';

if (!file_exists($runner))  { fwrite(STDERR, "cannot find schedule_runner.php\n"); exit(2); }
if (!file_exists($extract)) { fwrite(STDERR, "cannot find extract_mirror.php\n"); exit(2); }

// Re-extract every run: a stale mirror would test yesterday's runner and pass
// while the live file is broken.
$src = file_get_contents($runner);
if ($MUTANT) {
    // TARGETED MUTANT: neuter the applier's guard so it returns before doing
    // anything. The headline hide assertions must fail; the pure-predicate
    // assertions must still pass (they do not go through the applier), which is
    // what proves the mutant is targeted rather than a blanket break.
    $needle = 'function pivot_apply_hide_empty(&$allRowKeys, &$sortedColKeys, $data, $aggTypes, $pivotSettings) {';
    if (strpos($src, $needle) === false) {
        fwrite(STDERR, "MUTANT ANCHOR NOT FOUND - the applier was renamed; fix this suite.\n");
        exit(2);
    }
    $src = str_replace($needle, $needle . "\n    return; // MUTANT", $src);
}
if ($MUTANT2) {
    // SECOND TARGETED MUTANT, for the "never blank the whole grid" guard.
    // --mutant leaves that assertion passing VACUOUSLY (with the applier gutted
    // the keys survive for the wrong reason), so the guard needs a mutant of its
    // own: drop the count() checks and an all-zero grid erases itself. ONLY the
    // two all-zero assertions may fail under this one.
    $needle2 = "    if (count(\$keptRows) > 0) \$allRowKeys = \$keptRows;\r\n    if (count(\$keptCols) > 0) \$sortedColKeys = \$keptCols;";
    if (strpos($src, $needle2) === false) {
        $needle2 = "    if (count(\$keptRows) > 0) \$allRowKeys = \$keptRows;\n    if (count(\$keptCols) > 0) \$sortedColKeys = \$keptCols;";
    }
    if (strpos($src, $needle2) === false) {
        fwrite(STDERR, "MUTANT2 ANCHOR NOT FOUND - the blank-grid guard changed shape; fix this suite.\n");
        exit(2);
    }
    $src = str_replace($needle2, "    \$allRowKeys = \$keptRows;\n    \$sortedColKeys = \$keptCols; // MUTANT2", $src);
}
$tmpSrc = $here . '/_src_hideempty.php';
file_put_contents($tmpSrc, $src);
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extract) . ' ' . escapeshellarg($tmpSrc) . ' ' . escapeshellarg($mirror);
exec($cmd, $exOut, $exCode);
if ($exCode !== 0 || !file_exists($mirror)) {
    fwrite(STDERR, "extract_mirror failed (exit $exCode): " . implode("\n", $exOut) . "\n");
    exit(2);
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

// The HTML builder reads $theme_styles as a global and does ARITHMETIC on
// fontSize - a hand-stubbed array is a fatal TypeError there (pivotparity note),
// so pull the REAL builder in from themes_config.php. Without it every styled
// string interpolates off a null and the run drowns in "array offset on null"
// warnings, which is exactly the noise the runner would log at E_ALL.
$themesCfg = dirname($runner) . '/themes_config.php';
if (file_exists($themesCfg)) { require_once $themesCfg; }
if (function_exists('penumbra_build_theme_styles')) {
    $GLOBALS['theme_styles'] = penumbra_build_theme_styles();
}

$PASS = 0; $FAIL = 0; $FAILED = array();
function ok($cond, $label) {
    global $PASS, $FAIL, $FAILED;
    if ($cond) { $PASS++; return; }
    $FAIL++; $FAILED[] = $label;
    echo "  FAIL: $label\n";
}
function eqi($actual, $expected, $label) {
    ok($actual === $expected, $label . " (expected " . var_export($expected, true) . ", got " . var_export($actual, true) . ")");
}

// ---------------------------------------------------------------------------
// 1. pivot_agg_value_is_empty() - the ONE predicate, twin of
//    penumbraPivotAggValueIsEmpty() in js/main.js.
// ---------------------------------------------------------------------------
$emptyCases = array(
    array(null,     true,  'null'),
    array(0,        true,  'int 0'),
    array(0.0,      true,  'float 0.0'),
    array(-0.0,     true,  'float -0.0'),
    array('',       true,  'empty string'),
    array('   ',    true,  'whitespace string'),
    array('N/A',    true,  'N/A marker'),
    array(1e308,    true,  'min sentinel +1e308'),
    array(-1e308,   true,  'max sentinel -1e308'),
    array(INF,      true,  'INF'),
    array(-INF,     true,  '-INF'),
    array(NAN,      true,  'NAN'),
    array(false,    true,  'boolean false'),
    array(5,        false, 'int 5'),
    array(-3.5,     false, 'negative float'),
    array(0.0001,   false, 'small non-zero'),
    array('5',      false, 'numeric string'),
    array('Pending',false, 'text label (mode over a text column)'),
    array('0',      false, 'STRING zero is a label, not a measurement'),
    array(true,     false, 'boolean true'),
);
foreach ($emptyCases as $c) {
    eqi(pivot_agg_value_is_empty($c[0]), $c[1], 'is_empty: ' . $c[2]);
}

// ---------------------------------------------------------------------------
// 2. Fixture + settings
// ---------------------------------------------------------------------------
function fixture_rows() {
    return array(
        array('ROWF' => 'R1', 'COLF' => 'C1', 'AMT' => '10', 'ROLE' => 'keep'),
        array('ROWF' => 'R1', 'COLF' => 'C2', 'AMT' => '0',  'ROLE' => 'keep'),
        array('ROWF' => 'R2', 'COLF' => 'C1', 'AMT' => '0',  'ROLE' => 'keep'),
        array('ROWF' => 'R2', 'COLF' => 'C2', 'AMT' => '0',  'ROLE' => 'keep'),
        array('ROWF' => 'R2', 'COLF' => 'C3', 'AMT' => '0',  'ROLE' => 'keep'),
        array('ROWF' => 'R3', 'COLF' => 'C2', 'AMT' => '0',  'ROLE' => 'keep'),
        array('ROWF' => 'R3', 'COLF' => 'C3', 'AMT' => '5',  'ROLE' => 'keep'),
    );
}
function settings_base() {
    return array(
        'rows' => array('ROWF'),
        'cols' => array('COLF'),
        'vals' => 'AMT',
        'agg'  => array('sum'),
        'rowLayout' => 'flat',
        'colLayout' => 'flat',
        'sortOrder' => 'asc',
    );
}
$rows = fixture_rows();
$off  = settings_base();
$on   = settings_base(); $on['hideEmpty'] = true;

// ---------------------------------------------------------------------------
// 3. pivot_empty_key_sets() directly - the axes are judged INDEPENDENTLY.
// ---------------------------------------------------------------------------
$pd = pivot_process_data($rows, array('ROWF'), array('COLF'), 'AMT', array());
$data = $pd['data'];
$rowKeys = array_keys($data);
$colKeysSet = array();
foreach ($data as $cols) { foreach (array_keys($cols) as $ck) $colKeysSet[$ck] = true; }
$colKeys = array_keys($colKeysSet);
sort($rowKeys, SORT_STRING);
sort($colKeys, SORT_STRING);
eqi($rowKeys, array('R1','R2','R3'), 'fixture builds 3 row keys');
eqi($colKeys, array('C1','C2','C3'), 'fixture builds 3 col keys');

$sets = pivot_empty_key_sets($data, $rowKeys, $colKeys, array('sum'), null, null);
eqi(array_keys($sets['rows']), array('R2'), 'only R2 is an empty row');
eqi(array_keys($sets['cols']), array('C2'), 'only C2 is an empty column');

// A grid of ONLY derived aggregations suppresses nothing (no base number to
// judge) - the guard that stops a percentage-only pivot from erasing itself.
$derivedOnly = pivot_empty_key_sets($data, $rowKeys, $colKeys, array('pct_row_total'), null, null);
eqi($derivedOnly['rows'], array(), 'derived-only aggs suppress no rows');
eqi($derivedOnly['cols'], array(), 'derived-only aggs suppress no cols');

// ---------------------------------------------------------------------------
// 4. pivot_apply_hide_empty() - the shared applier all four consumers call.
// ---------------------------------------------------------------------------
$rk = $rowKeys; $ck = $colKeys;
pivot_apply_hide_empty($rk, $ck, $data, array('sum'), $off);
eqi($rk, array('R1','R2','R3'), 'option OFF leaves rows untouched');
eqi($ck, array('C1','C2','C3'), 'option OFF leaves cols untouched');

$rk = $rowKeys; $ck = $colKeys;
pivot_apply_hide_empty($rk, $ck, $data, array('sum'), $on);
eqi($rk, array('R1','R3'), 'option ON drops the empty row');
eqi($ck, array('C1','C3'), 'option ON drops the empty column');

// Never blank the whole grid: an all-zero pivot keeps its shape.
$zeroRows = array(
    array('ROWF' => 'Z1', 'COLF' => 'K1', 'AMT' => '0'),
    array('ROWF' => 'Z2', 'COLF' => 'K1', 'AMT' => '0'),
);
$zpd = pivot_process_data($zeroRows, array('ROWF'), array('COLF'), 'AMT', array());
$zrk = array_keys($zpd['data']); sort($zrk, SORT_STRING);
$zck = array('K1');
pivot_apply_hide_empty($zrk, $zck, $zpd['data'], array('sum'), $on);
eqi($zrk, array('Z1','Z2'), 'an all-zero grid is NOT blanked (rows survive)');
eqi($zck, array('K1'), 'an all-zero grid is NOT blanked (cols survive)');

// ---------------------------------------------------------------------------
// 5. The four consumers.
// ---------------------------------------------------------------------------
eqi(pivot_count_after_rank($rows, $off), 3, 'count_after_rank OFF = 3 rows');
eqi(pivot_count_after_rank($rows, $on),  2, 'count_after_rank ON  = 2 rows');

$htmlOff = generate_pivot_html($rows, $off, 'theme-default', true);
$htmlOn  = generate_pivot_html($rows, $on,  'theme-default', true);
ok(strpos($htmlOff, '>R2<') !== false, 'HTML OFF contains the empty row R2');
ok(strpos($htmlOff, '>C2<') !== false, 'HTML OFF contains the empty column C2');
ok(strpos($htmlOn,  '>R2<') === false, 'HTML ON drops the empty row R2');
ok(strpos($htmlOn,  '>C2<') === false, 'HTML ON drops the empty column C2');
ok(strpos($htmlOn,  '>R1<') !== false, 'HTML ON keeps R1');
ok(strpos($htmlOn,  '>R3<') !== false, 'HTML ON keeps R3');
ok(strpos($htmlOn,  '>C1<') !== false, 'HTML ON keeps C1');
ok(strpos($htmlOn,  '>C3<') !== false, 'HTML ON keeps C3');
// Suppression is display-only: the surviving numbers must not move.
ok(strpos($htmlOff, '10') !== false && strpos($htmlOn, '10') !== false, 'HTML keeps the 10 either way');
ok(strpos($htmlOff, '5') !== false && strpos($htmlOn, '5') !== false, 'HTML keeps the 5 either way');

$csvOff = generate_pivot_csv_string($rows, $off);
$csvOn  = generate_pivot_csv_string($rows, $on);
ok(strpos($csvOff, 'R2') !== false, 'CSV OFF contains R2');
ok(strpos($csvOff, 'C2') !== false, 'CSV OFF contains C2');
ok(strpos($csvOn,  'R2') === false, 'CSV ON drops R2');
ok(strpos($csvOn,  'C2') === false, 'CSV ON drops C2');
ok(strpos($csvOn,  'R1') !== false && strpos($csvOn, 'R3') !== false, 'CSV ON keeps R1 and R3');
ok(strpos($csvOn,  'C1') !== false && strpos($csvOn, 'C3') !== false, 'CSV ON keeps C1 and C3');

// pivot_build_xlsx_rows returns a DESCRIPTOR (headerRows / dataRows / colTypes /
// footerRow / ...), not a list of rows - count() on the descriptor is the number
// of KEYS and never moves. Assert on the parts that carry the grid.
$xlsOff = pivot_build_xlsx_rows($rows, $off);
$xlsOn  = pivot_build_xlsx_rows($rows, $on);
$flat = function ($grid) {
    $out = array();
    foreach ($grid as $r) { foreach ((array)$r as $c) { $out[] = is_array($c) ? json_encode($c) : (string)$c; } }
    return implode('|', $out);
};
$fOff = $flat($xlsOff); $fOn = $flat($xlsOn);
ok(strpos($fOff, 'R2') !== false, 'XLSX OFF contains R2');
ok(strpos($fOff, 'C2') !== false, 'XLSX OFF contains C2');
ok(strpos($fOn,  'R2') === false, 'XLSX ON drops R2');
ok(strpos($fOn,  'C2') === false, 'XLSX ON drops C2');
ok(strpos($fOn,  'R1') !== false && strpos($fOn, 'R3') !== false, 'XLSX ON keeps R1 and R3');
eqi(count($xlsOff['dataRows']), 3, 'XLSX OFF has 3 data rows');
eqi(count($xlsOn['dataRows']),  2, 'XLSX ON has 2 data rows');
eqi(count($xlsOff['colTypes']), 5, 'XLSX OFF has 5 columns (label + 3 + grand total)');
eqi(count($xlsOn['colTypes']),  4, 'XLSX ON has 4 columns (label + 2 + grand total)');
// THE invariant: suppression is display-only, so the grand total is untouched.
$gtOff = end($xlsOff['footerRow']);
$gtOn  = end($xlsOn['footerRow']);
eqi((string)$gtOn, (string)$gtOff, 'XLSX grand total is IDENTICAL with the option on');
eqi((string)$gtOn, '15', 'XLSX grand total is 10 + 5 = 15');

// ---------------------------------------------------------------------------
// 6. Per-aggregation FILTER is honoured by the sweep. Without the filter, every
//    row has content; with it, only the rows whose ROLE matches survive - so a
//    sweep that ignored filters would hide nothing here. This is the PHP half
//    of the _aggFiltersLocal hoist made in js/main.js for the same reason.
// ---------------------------------------------------------------------------
$fRows = array(
    array('ROWF' => 'F1', 'COLF' => 'K1', 'AMT' => '10', 'ROLE' => 'in'),
    array('ROWF' => 'F2', 'COLF' => 'K1', 'AMT' => '10', 'ROLE' => 'out'),
);
$fOffS = array('rows' => array('ROWF'), 'cols' => array('COLF'), 'vals' => 'AMT',
    'agg' => array('sum'), 'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc',
    'aggFilters' => array("ROLE = in"));
$fOnS = $fOffS; $fOnS['hideEmpty'] = true;
eqi(pivot_count_after_rank($fRows, $fOffS), 2, 'filtered fixture OFF = 2 rows');
eqi(pivot_count_after_rank($fRows, $fOnS),  1, 'filtered fixture ON  = 1 row (filter respected)');

// ---------------------------------------------------------------------------
// 7. A settings array with no hideEmpty key behaves exactly like OFF - every
//    report and preset saved before this option existed.
// ---------------------------------------------------------------------------
$legacy = settings_base();
eqi(array_key_exists('hideEmpty', $legacy), false, 'legacy settings carry no hideEmpty key');
eqi(pivot_count_after_rank($fRows, $legacy), 2, 'absent hideEmpty key = OFF');

if ($CONTROL) {
    // Deliberately wrong expectation - proves the harness can report FAIL.
    eqi(pivot_count_after_rank($rows, $on), 999, 'CONTROL: this must FAIL');
}

echo "\n";
echo "PASS $PASS   FAIL $FAIL\n";
exit($FAIL === 0 ? 0 : 1);
