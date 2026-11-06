<?php
// Round C (dtpick C, 2026-11-05): the scheduled runner's twin of "active during" for Group by.
//   php -d date.timezone=America/New_York php_active_test.php <mirror.php>
// <mirror.php> = pivotparity\extract_mirror.php of the runner under test (its functions only: the runner
// itself must never be included - it opens Oracle and SENDS EMAIL).
require $argv[1];
$P = 0; $F = 0; $LOG = array();
function ok($n, $c, $x = '') { global $P, $F, $LOG; if ($c) { $P++; $LOG[] = "PASS  $n"; } else { $F++; $LOG[] = "FAIL  $n" . ($x !== '' ? "   >> $x" : ''); } }
function eqv($n, $g, $w) { ok($n, $g === $w, 'got=' . json_encode($g) . ' want=' . json_encode($w)); }
if (!function_exists('penumbra_sched_toggle_cols')) { function penumbra_sched_toggle_cols() { return array(); } }

// the token's shape - the JS parser's, key for key
$t = pivot_parse_field_token('START_DATE:fy@END_DATE');
eqv('parse: START, a period, END', array($t['base'], $t['split'], isset($t['end']) ? $t['end'] : null, isset($t['phase']) ? $t['phase'] : null, isset($t['prorate']) ? $t['prorate'] : null), array('START_DATE', 'fy', 'END_DATE', false, false));
eqv('parse: the JS shape, key for key', array_keys($t), array('base', 'split', 'fill', 'binWidth', 'binEdges', 'end', 'phase', 'prorate'));
$tp = pivot_parse_field_token('START_DATE:fy@END_DATE:phase:prorate');
eqv('parse: :phase and :prorate ride along', array($tp['phase'], $tp['prorate']), array(true, true));
ok('parse: a plain split gains no active keys', !array_key_exists('end', pivot_parse_field_token('START_DATE:fy')));
eqv('parse: a cycle is no active grouping', pivot_parse_field_token('START_DATE:month@END_DATE')['base'], 'START_DATE:month@END_DATE');
eqv('parse: nor an empty END', pivot_parse_field_token('START_DATE:fy@')['base'], 'START_DATE:fy@');
eqv('label: the display label', pivot_field_display_label('START_DATE:fy@END_DATE'), 'START_DATE to END_DATE (active per Fiscal Year)');

// the periods
$fyNow = 'FY' . substr((string)((int)date('n') >= 7 ? (int)date('Y') + 1 : (int)date('Y')), -2);
$fys = array(); for ($y = 25; $y < 60; $y++) { $fys[] = 'FY' . $y; if ('FY' . $y === $fyNow) break; }
eqv('periods: a two-year award', pivot_active_period_labels('fy', '2023-07-01', '2025-06-30'), array('FY24', 'FY25'));
eqv('periods: Jun 30 to Jul 1', pivot_active_period_labels('fy', '2024-06-30', '2024-07-01'), array('FY24', 'FY25'));
eqv('periods: a blank end runs to today', pivot_active_period_labels('fy', '2025-03-01', ''), $fys);
eqv('periods: a placeholder end (2100) runs to today', pivot_active_period_labels('fy', '2025-03-01', '2100-01-01'), $fys);
eqv('periods: ...an Oracle date too', pivot_active_period_labels('fy', '2025-03-01', '01-JAN-00') === $fys || pivot_active_period_labels('fy', '2025-03-01', '01-JAN-00') === array('FY25'), true);
eqv('periods: an end before its start: the start\'s period', pivot_active_period_labels('fy', '2025-05-01', '2024-01-01'), array('FY25'));
eqv('periods: no start: none', pivot_active_period_labels('fy', '', '2025-01-01'), array());
eqv('periods: Oracle DD-MON-YY dates', pivot_active_period_labels('fy', '19-JUL-23', '30-JUN-25'), array('FY24', 'FY25'));
eqv('periods: quarters', pivot_active_period_labels('yq', '2024-11-15', '2025-04-01'), array('2024 Q4', '2025 Q1', '2025 Q2'));
eqv('periods: at most 600', count(pivot_active_period_labels('ym', '1950-01-01', '2026-01-01')), 600);

// the Group by level
$rows = array(
    array('AWARD_ID' => 'A1', 'START_DATE' => '2023-07-01', 'END_DATE' => '2025-06-30'),
    array('AWARD_ID' => 'A2', 'START_DATE' => '2024-06-30', 'END_DATE' => '2024-07-01'),
    array('AWARD_ID' => 'A3', 'START_DATE' => '2024-03-01', 'END_DATE' => '2100-01-01'),
    array('AWARD_ID' => 'A5', 'START_DATE' => '', 'END_DATE' => '2025-01-01'),
);
$spec = penumbra_group_level_spec('START_DATE:fy@end_date', $rows[0], $rows, array());
ok('level: resolves (the END by any case)', is_array($spec) && $spec['key'] === 'START_DATE');
ok('level: multi (each row counted once in the totals)', is_array($spec) && $spec['multi'] === true);
$lab = $spec ? $spec['label'] : function ($r) { return ''; };
eqv('level: a row under each period it runs in', $lab($rows[0]), array('FY24', 'FY25'));
eqv('level: no start: [Blank]', $lab($rows[3]), array('[Blank]'));
ok('level: Started / continuing is no Group by level', penumbra_group_level_spec('START_DATE:fy@END_DATE:phase', $rows[0], $rows, array()) === null);
$out = array();
penumbra_group_rows_nested($rows, array($spec), array($spec['cmp']), 0, '', $out);
$per = array(); foreach ($out as $k => $g) { $per[$k] = array_map(function ($r) { return $r['AWARD_ID']; }, $g); }
eqv('group: FY25 holds every row active in it', isset($per['FY25']) ? $per['FY25'] : null, array('A1', 'A2', 'A3'));
eqv('group: FY24 too', isset($per['FY24']) ? $per['FY24'] : null, array('A1', 'A2', 'A3'));
ok('group: the placeholder end stops at today (no FY99, no FY00)', !isset($per['FY99']) && !isset($per['FY00']) && isset($per[$fyNow]), implode(',', array_keys($per)));
$keys = array_keys($per);
ok('group: in period order', array_search('FY24', $keys) < array_search('FY25', $keys), implode(',', $keys));

echo "pass=$P fail=$F\n" . implode("\n", $LOG) . "\n";
exit($F ? 1 : 0);
