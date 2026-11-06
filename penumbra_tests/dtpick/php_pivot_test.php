<?php
// Round D1 (dtpick D, 2026-11-05): the scheduled runner's pivot with an active field (START:<period>@END).
//   php -d date.timezone=America/New_York -d memory_limit=512M php_pivot_test.php <mirror.php> <webroot>
// <mirror.php> = pivotparity\extract_mirror.php of the runner under test (never the runner itself: it SENDS EMAIL);
// <webroot> for themes_config.php (the HTML builder's theme) and penumbra_search.php, required live as groupmode does.
require $argv[1];
$app = isset($argv[2]) ? $argv[2] : '';
if ($app && is_file($app . '/themes_config.php')) { require $app . '/themes_config.php'; $theme_styles = penumbra_build_theme_styles(); }
if (!function_exists('_search_get_virtual_columns') && $app && is_file($app . '/penumbra_search.php')) require $app . '/penumbra_search.php';
if (!function_exists('penumbra_sched_toggle_cols')) { function penumbra_sched_toggle_cols() { return array(); } }
$P = 0; $F = 0; $LOG = array();
function ok($n, $c, $x = '') { global $P, $F, $LOG; if ($c) { $P++; $LOG[] = "PASS  $n"; } else { $F++; $LOG[] = "FAIL  $n" . ($x !== '' ? "   >> $x" : ''); } }
function eqv($n, $g, $w) { ok($n, $g === $w, 'got=' . json_encode($g) . ' want=' . json_encode($w)); }

$T = 'START_DATE:fy@END_DATE';
$rows = array(
    array('AWARD_ID' => 'A1', 'DEPT' => 'X', 'START_DATE' => '2023-07-01', 'END_DATE' => '2025-06-30', 'AMT' => '731'),
    array('AWARD_ID' => 'A2', 'DEPT' => 'Y', 'START_DATE' => '2024-06-30', 'END_DATE' => '2024-07-01', 'AMT' => '10'),
    array('AWARD_ID' => 'A3', 'DEPT' => 'X', 'START_DATE' => '2025-03-01', 'END_DATE' => '', 'AMT' => '100'),
    array('AWARD_ID' => 'A4', 'DEPT' => 'Y', 'START_DATE' => '2024-03-01', 'END_DATE' => '2100-01-01', 'AMT' => '5'),
    array('AWARD_ID' => 'A5', 'DEPT' => 'X', 'START_DATE' => '', 'END_DATE' => '2025-01-01', 'AMT' => '1'),
);
$fyNow = 'FY' . substr((string)((int)date('n') >= 7 ? (int)date('Y') + 1 : (int)date('Y')), -2);

// the collector
$pd = pivot_process_data($rows, array('DEPT'), array($T), 'AMT', null, null, array('sum'));
$d = $pd['data'];
$cnt = function ($r, $c) use ($d) { return isset($d[$r][$c]) ? $d[$r][$c]['count'] : null; };
$sum = function ($r, $c) use ($d) { return isset($d[$r][$c]) ? $d[$r][$c]['sum'] : null; };
eqv('collect: X in FY24 (A1)', $cnt('X', 'FY24'), 1);
eqv('collect: X in FY25 (A1, A3), the full amounts', array($cnt('X', 'FY25'), $sum('X', 'FY25')), array(2, 831.0));
eqv('collect: Y in FY24 (A2, A4) and FY25 (A2, A4)', array($cnt('Y', 'FY24'), $cnt('Y', 'FY25')), array(2, 2));
eqv('collect: an open end and a placeholder end run to today', array($cnt('X', $fyNow), $cnt('Y', $fyNow)), array(1, 1));
ok('collect: no period past today (no FY99, no FY00)', !isset($d['Y']['FY99']) && !isset($d['Y']['FY00']), implode(',', array_keys($d['Y'])));
eqv('collect: no start date: [Blank]', $cnt('X', '[Blank]'), 1);
$pp = pivot_process_data($rows, array('DEPT'), array($T . ':prorate'), 'AMT', null, null, array('sum'));
eqv('prorate: A1 is 366 + 365 days', array($pp['data']['X']['FY24']['sum'], round($pp['data']['X']['FY25']['sum'] - 0, 6) >= 365.0), array(366.0, true));
$tx = 0; foreach ($pp['data']['X'] as $c) $tx += $c['sum'];
ok('prorate: the shares add back up to the amounts (X: 832)', abs($tx - 832) < 1e-6, (string)$tx);
$pr = pivot_process_data($rows, array($T), array('DEPT'), 'AMT', null, null, array('count'));
eqv('collect: the field in Rows works the same', array(isset($pr['data']['FY25']['X']) ? $pr['data']['FY25']['X']['count'] : null), array(2));

// the gate
$g = pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T), 'agg' => array('sum')));
eqv('gate: in Columns: the Grand Total column off, the footer kept', array($g['refuse'], $g['settings']['totalRowAggs'], $g['noFooter']), array('', array(), false));
ok('gate: ...and says so', strpos($g['note'], 'Totals across the fiscal year periods are off') === 0, $g['note']);
$g2 = pivot_active_gate(array('rows' => array($T), 'cols' => array('DEPT'), 'agg' => array('sum')));
eqv('gate: in Rows: the footer off, the Grand Total column kept', array($g2['noFooter'], isset($g2['settings']['totalRowAggs'])), array(true, false));
ok('gate: another field beside it: refused', strpos(pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T, 'STATUS'), 'agg' => array('sum')))['refuse'], 'alone in Columns') !== false);
ok('gate: % of row total across the periods: refused', strpos(pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T), 'agg' => array('pct_row_total')))['refuse'], 'pct row total') !== false);
eqv('gate: % of column total stays (a period is one column)', pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T), 'agg' => array('pct_col_total')))['refuse'], '');
$g3 = pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array($T . ':prorate'), 'agg' => array('sum')));
eqv('gate: a Sum split by days keeps every total', array($g3['note'], isset($g3['settings']['totalRowAggs']), $g3['noFooter']), array('', false, false));
eqv('gate: a plain pivot is untouched', pivot_active_gate(array('rows' => array('DEPT'), 'cols' => array('START_DATE:fy'), 'agg' => array('sum')))['note'], '');

// the three builders
$sC = array('rows' => array('DEPT'), 'cols' => array($T), 'vals' => 'AMT', 'agg' => array('sum'));
$sR = array('rows' => array($T), 'cols' => array('DEPT'), 'vals' => 'AMT', 'agg' => array('sum'));
$sP = array('rows' => array('DEPT'), 'cols' => array('START_DATE:fy'), 'vals' => 'AMT', 'agg' => array('sum'));
if (isset($theme_styles)) {
    $hP = generate_pivot_html($rows, $sP, 'theme-default', true);
    $hC = generate_pivot_html($rows, $sC, 'theme-default', true);
    $hR = generate_pivot_html($rows, $sR, 'theme-default', true);
    ok('html: (a plain pivot has its Grand Total column and footer)', strpos($hP, 'Grand Total') !== false && strpos($hP, '<tfoot>') !== false);
    ok('html: active in Columns: no Grand Total column, the footer kept, the note', substr_count($hC, 'Grand Total') < substr_count($hP, 'Grand Total') && strpos($hC, '<tfoot>') !== false && strpos($hC, 'Totals across the fiscal year periods are off') !== false, substr_count($hC, 'Grand Total') . ' vs ' . substr_count($hP, 'Grand Total'));
    ok('html: active in Rows: no footer, the note', strpos($hR, '<tfoot>') === false && strpos($hR, '</table>') !== false && strpos($hR, 'Totals across the fiscal year periods are off') !== false);
    ok('html: refused: the reason, no table', strpos(generate_pivot_html($rows, array('rows' => array('DEPT'), 'cols' => array($T, 'STATUS'), 'vals' => 'AMT', 'agg' => array('sum')), 'theme-default', true), 'alone in Columns') !== false);
} else { ok('html: themes_config.php loaded (pass the webroot)', false); }
$cP = generate_pivot_csv_string($rows, $sP); $cC = generate_pivot_csv_string($rows, $sC); $cR = generate_pivot_csv_string($rows, $sR);
$lastLine = function ($s) { $l = array_values(array_filter(explode("\n", trim($s)))); return $l ? $l[count($l) - 1] : ''; };
$firstLine = function ($s) { $l = explode("\n", trim($s)); return $l[0]; };
ok('csv: active in Columns: no Grand Total column (a plain one has it)', strpos($firstLine($cC), 'Grand Total') === false && strpos($firstLine($cP), 'Grand Total') !== false, $firstLine($cC) . ' | ' . $firstLine($cP));
$cPR = generate_pivot_csv_string($rows, array('rows' => array('START_DATE:fy'), 'cols' => array('DEPT'), 'vals' => 'AMT', 'agg' => array('sum')));
$ftLab = explode(',', $lastLine($cPR)); $ftLab = trim($ftLab[0], '"');
ok('csv: active in Rows: no totals line (a plain one ends with "' . $ftLab . '")', !preg_match('/^"?' . preg_quote($ftLab, '/') . '/m', $cR) && $ftLab !== '' && !preg_match('/^(FY|\[)/', $ftLab), $lastLine($cR));
$xC = pivot_build_xlsx_rows($rows, $sC); $xR = pivot_build_xlsx_rows($rows, $sR); $xP = pivot_build_xlsx_rows($rows, $sP);
eqv('xlsx: active in Columns: no Grand Total column, a footer', array($xC['hasGrandTotalCol'], $xC['footerRow'] !== null, $xP['hasGrandTotalCol']), array(false, true, true));
eqv('xlsx: active in Rows: no footer', $xR['footerRow'], null);

echo "pass=$P fail=$F\n" . implode("\n", $LOG) . "\n";
exit($F ? 1 : 0);
