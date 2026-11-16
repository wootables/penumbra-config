<?php
// pvdelim (2026-11-15): the scheduled runner's pivot with a field split by a delimiter (PI_LIST:dsemi).
//   php -n ..\pivotparity\extract_mirror.php <webroot>\schedule_runner.php mirror.php
//   php -d date.timezone=America/New_York -d memory_limit=512M php_pivot_test.php mirror.php <webroot>
// <mirror.php> = the runner's pure functions (never the runner itself: it SENDS EMAIL).
require $argv[1];
$app = isset($argv[2]) ? $argv[2] : '';
if ($app && is_file($app . '/themes_config.php')) { require $app . '/themes_config.php'; $theme_styles = penumbra_build_theme_styles(); }
if (!function_exists('_search_get_virtual_columns') && $app && is_file($app . '/penumbra_search.php')) require $app . '/penumbra_search.php';
if (!function_exists('penumbra_sched_toggle_cols')) { function penumbra_sched_toggle_cols() { return array(); } }
$P = 0; $F = 0; $LOG = array();
function ok($n, $c, $x = '') { global $P, $F, $LOG; if ($c) { $P++; $LOG[] = "PASS  $n"; } else { $F++; $LOG[] = "FAIL  $n" . ($x !== '' ? "   >> $x" : ''); } }
function eqv($n, $g, $w) { ok($n, $g === $w, 'got=' . json_encode($g) . ' want=' . json_encode($w)); }

$T = 'PI_LIST:dsemi';
$rows = array(
    array('AWARD_ID' => 'A1', 'DEPT' => 'X', 'PI_LIST' => 'Smith; Jones', 'AMT' => '100'),
    array('AWARD_ID' => 'A2', 'DEPT' => 'Y', 'PI_LIST' => 'Smith', 'AMT' => '10'),
    array('AWARD_ID' => 'A3', 'DEPT' => 'X', 'PI_LIST' => 'Lee;Smith;Smith', 'AMT' => '1'),
    array('AWARD_ID' => 'A4', 'DEPT' => 'Y', 'PI_LIST' => '', 'AMT' => '5'),
    array('AWARD_ID' => 'A5', 'DEPT' => 'X', 'PI_LIST' => 'R&amp;D Group; Jones', 'AMT' => '1000'),
);

// the collector
$pd = pivot_process_data($rows, array($T), array('DEPT'), 'AMT', null, null, array('sum'));
$d = $pd['data'];
$cnt = function ($r, $c) use ($d) { return isset($d[$r][$c]) ? $d[$r][$c]['count'] : null; };
$sum = function ($r, $c) use ($d) { return isset($d[$r][$c]) ? $d[$r][$c]['sum'] : null; };
eqv('collect: Smith in X (A1, A3: a repeat counts once)', array($cnt('Smith', 'X'), $sum('Smith', 'X')), array(2, 101.0));
eqv('collect: Smith in Y (A2)', $cnt('Smith', 'Y'), 1);
eqv('collect: Jones in X (A1, A5), the full amounts', array($cnt('Jones', 'X'), $sum('Jones', 'X')), array(2, 1100.0));
eqv('collect: an entity decodes as the search reads it', $cnt('R&D Group', 'X'), 1);
eqv('collect: a cell listing nothing: [Blank]', $cnt('[Blank]', 'Y'), 1);
ok('collect: no row keyed by the whole cell', !isset($d['Smith; Jones']) && !isset($d['Lee;Smith;Smith']), implode(',', array_keys($d)));
$pc = pivot_process_data($rows, array('DEPT'), array($T), 'AMT', null, null, array('count'));
eqv('collect: the field in Columns works the same', isset($pc['data']['X']['Jones']) ? $pc['data']['X']['Jones']['count'] : null, 2);
$pn = pivot_process_data($rows, array($T, 'DEPT'), array(), 'AMT', null, null, array('sum'));
eqv('collect: first of two in Rows: Smith|||X', isset($pn['data']['Smith|||X']) ? $pn['data']['Smith|||X']['']['count'] : null, 2);

// the gate
$g = pivot_active_gate(array('rows' => array($T), 'cols' => array('DEPT'), 'agg' => array('sum')));
eqv('gate: in Rows: the footer off, the Grand Total column kept', array($g['refuse'], $g['noFooter'], isset($g['settings']['totalRowAggs'])), array('', true, false));
ok('gate: ...and says so', strpos($g['note'], 'Totals across PI_LIST are off') === 0, $g['note']);
$g2 = pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T), 'agg' => array('sum')));
eqv('gate: in Columns: the Grand Total column off, the footer kept', array($g2['refuse'], $g2['settings']['totalRowAggs'], $g2['noFooter']), array('', array(), false));
eqv('gate: first in Rows with a field after it: allowed', pivot_active_gate(array('rows' => array($T, 'DEPT'), 'cols' => array(), 'agg' => array('sum')))['refuse'], '');
ok('gate: a field before it: refused', strpos(pivot_active_gate(array('rows' => array('DEPT', $T), 'cols' => array(), 'agg' => array('sum')))['refuse'], 'Put PI_LIST (split by ;) first in Rows') === 0);
ok('gate: two splits: refused', strpos(pivot_active_gate(array('rows' => array($T), 'cols' => array('DEPT_LIST:dpipe'), 'agg' => array('sum')))['refuse'], 'A pivot splits ONE field') === 0);
ok('gate: a split and an active field: refused', strpos(pivot_active_gate(array('rows' => array($T), 'cols' => array('START_DATE:fy@END_DATE'), 'agg' => array('sum')))['refuse'], 'A pivot splits ONE field') === 0);
ok('gate: % of column total with it in Rows: refused', strpos(pivot_active_gate(array('rows' => array($T), 'cols' => array('DEPT'), 'agg' => array('pct_col_total')))['refuse'], 'pct col total') !== false);
ok('gate: % of grand total: refused', strpos(pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T), 'agg' => array('sum', 'pct_grand_total:down')))['refuse'], 'pct grand total') !== false);
eqv('gate: % of row total with it in Rows stays (a value is one row)', pivot_active_gate(array('rows' => array($T), 'cols' => array('DEPT'), 'agg' => array('pct_row_total')))['refuse'], '');
eqv('gate: a plain pivot is untouched', pivot_active_gate(array('rows' => array('PI_LIST'), 'cols' => array('DEPT'), 'agg' => array('sum')))['note'], '');
ok('gate: the active field keeps its own words', strpos(pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array('START_DATE:fy@END_DATE', 'STATUS'), 'agg' => array('sum')))['refuse'], 'alone in Columns') !== false);

// (pvdelim fix) the gate by direction, the rank, a refused pivot's row count
$gr = function ($rows, $cols, $agg, $extra = array()) { return pivot_active_gate(array_merge(array('rows' => $rows, 'cols' => $cols, 'agg' => $agg), $extra)); };
$dir = array(
    $gr(array('DEPT'), array($T), array('sum', 'pct_cum'))['refuse'] !== '',
    $gr(array('DEPT'), array($T), array('sum', 'pct_cum:down'))['refuse'] !== '',
    $gr(array($T), array('DEPT'), array('sum', 'pct_cum'))['refuse'] !== '',
    $gr(array($T), array('DEPT'), array('sum', 'pct_cum:down'))['refuse'] !== '',
    $gr(array($T), array('DEPT'), array('sum', 'running_total:down'))['refuse'] !== '',
    $gr(array('DEPT'), array($T), array('sum', 'running_count'))['refuse'] !== '',
    $gr(array($T), array('DEPT'), array('sum', 'index'))['refuse'] !== '');
eqv('fix: the gate reads the direction (pct_cum across, :down down); an index stays', $dir, array(true, false, false, true, true, true, false));
$rk = array('rankDir' => 'top', 'rankN' => 2, 'rankAgg' => 'sum');
ok('fix: rank with the split in Columns: refused', strpos($gr(array('DEPT'), array($T), array('sum'), $rk)['refuse'], 'Rank is not offered with PI_LIST (split by ;) in Columns') === 0);
$gO = $gr(array($T), array('DEPT'), array('sum'), $rk);
eqv('fix: an Overall rank with it in Rows: (Other) off, said', array($gO['refuse'], $gO['settings']['rankOther'], strpos($gO['note'], 'The (Other) row is off too') !== false), array('', false, true));
$gS = $gr(array($T, 'DEPT'), array(), array('sum'), $rk + array('rankScope' => 'pi_list:DSEMI'));
eqv('fix: a rank within each value keeps its (Other)', array(isset($gS['settings']['rankOther']), strpos($gS['note'], '(Other)') === false), array(false, true));
eqv('fix: a refused pivot counts no rows', pivot_count_after_rank($rows, array('rows' => array('DEPT', $T), 'cols' => array(), 'vals' => 'AMT', 'agg' => array('sum'))), 0);
$cR3 = pivot_count_after_rank($rows, array('rows' => array($T), 'cols' => array(), 'vals' => 'AMT', 'agg' => array('sum'), 'rankDir' => 'top', 'rankN' => 2, 'rankAgg' => 'sum'));
eqv('fix: the count of a ranked split: the top 2, no (Other)', $cR3, 2);
if (isset($theme_styles)) {
    $hO = generate_pivot_html($rows, array('rows' => array($T), 'cols' => array(), 'vals' => 'AMT', 'agg' => array('sum'), 'rankDir' => 'top', 'rankN' => 2, 'rankAgg' => 'sum'), 'theme-default', true);
    ok('fix: html: no (Other) row under an Overall rank', strpos($hO, '(Other)') === false || strpos($hO, '(Other) row is off') !== false && substr_count($hO, '(Other)') === 1, substr_count($hO, '(Other)'));
}

// the comparator: the column's own order
$cmp = pivot_build_field_comparators(array($T), array('PI_LIST' => array('values' => array('Smith', 'Lee', 'Jones'))));
$ks = array('Jones', 'Lee', 'Smith'); usort($ks, $cmp[0]);
eqv('sort: a split reads its column\'s custom order', $ks, array('Smith', 'Lee', 'Jones'));

// the three builders
$sR = array('rows' => array($T), 'cols' => array('DEPT'), 'vals' => 'AMT', 'agg' => array('sum'));
$sC = array('rows' => array('DEPT'), 'cols' => array($T), 'vals' => 'AMT', 'agg' => array('sum'));
$sP = array('rows' => array('PI_LIST'), 'cols' => array('DEPT'), 'vals' => 'AMT', 'agg' => array('sum'));
if (isset($theme_styles)) {
    $hP = generate_pivot_html($rows, $sP, 'theme-default', true);
    $hR = generate_pivot_html($rows, $sR, 'theme-default', true);
    $hC = generate_pivot_html($rows, $sC, 'theme-default', true);
    ok('html: (a plain pivot has its footer)', strpos($hP, '<tfoot>') !== false);
    ok('html: split in Rows: a row per value, no footer, the note', strpos($hR, '>Jones<') !== false && strpos($hR, 'Smith; Jones') === false && strpos($hR, '<tfoot>') === false && strpos($hR, 'Totals across PI_LIST are off') !== false);
    ok('html: split in Columns: no Grand Total column, the footer kept', substr_count($hC, 'Grand Total') < substr_count($hP, 'Grand Total') && strpos($hC, '<tfoot>') !== false, substr_count($hC, 'Grand Total') . ' vs ' . substr_count($hP, 'Grand Total'));
    ok('html: refused: the reason, no table', strpos(generate_pivot_html($rows, array('rows' => array('DEPT', $T), 'cols' => array(), 'vals' => 'AMT', 'agg' => array('sum')), 'theme-default', true), 'first in Rows') !== false);
} else { ok('html: themes_config.php loaded (pass the webroot)', false); }
$cR = generate_pivot_csv_string($rows, $sR);
ok('csv: split in Rows: each value a line', preg_match('/^"?Jones"?,/m', $cR) && preg_match('/^"?Lee"?,/m', $cR), $cR);
$xR = pivot_build_xlsx_rows($rows, $sR); $xC = pivot_build_xlsx_rows($rows, $sC);
eqv('xlsx: split in Rows: no footer; in Columns: no Grand Total column', array($xR['footerRow'], $xC['hasGrandTotalCol']), array(null, false));

echo "pass=$P fail=$F\n" . implode("\n", $LOG) . "\n";
exit($F ? 1 : 0);
