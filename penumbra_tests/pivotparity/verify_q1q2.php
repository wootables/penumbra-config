<?php
// Q2 verification for the PHP twin. Its JS counterpart
// (computeOverrideTotalFromCellValues) is nested inside generatePivotTable and
// cannot be exported, so it is covered by code symmetry + the pivot_trigger
// suite rather than executed here - stated plainly rather than implied.
require_once __DIR__ . '/pivot_mirror.php';

$pass = 0; $fail = 0;
function t($name, $got, $want) {
    global $pass, $fail;
    $ok = is_string($want) ? ($got === $want) : ($got == $want);
    if ($ok) { $pass++; echo "  PASS  $name\n"; }
    else { $fail++; echo "  FAIL  $name\n        got " . var_export($got, true) . " want " . var_export($want, true) . "\n"; }
}

// row R1 has numbers; R2 is all non-numeric (an "empty" row for these purposes)
$map = array(
    'R1' => array('C1' => array(0 => 10), 'C2' => array(0 => 20), 'C3' => array(0 => 5)),
    'R2' => array('C1' => array(0 => 'x'), 'C2' => array(0 => null), 'C3' => array(0 => '')),
);
$keys = array('C1','C2','C3');
function ov($map, $rk, $keys, $agg) {
    return pivot_compute_override_total_from_cell_values('row', $rk, $keys, $map, 0, $agg);
}

echo "Q2: an all-empty override total reports the sentinel, not 0\n";
t('empty row min is the sentinel',  ov($map,'R2',$keys,'min'), 1e308);
t('empty row max is the sentinel',  ov($map,'R2',$keys,'max'), -1e308);
t('empty row min formats blank',    pivot_format_value(ov($map,'R2',$keys,'min'), 'min', false, 0, true), '');
t('empty row max formats blank',    pivot_format_value(ov($map,'R2',$keys,'max'), 'max', false, 0, true), '');

echo "\nno over-correction: a populated row is unchanged\n";
t('populated row min is 5',         ov($map,'R1',$keys,'min'), 5);
t('populated row max is 20',        ov($map,'R1',$keys,'max'), 20);
t('populated row sum is 35',        ov($map,'R1',$keys,'sum'), 35);
t('populated row min formats "5"',  pivot_format_value(ov($map,'R1',$keys,'min'), 'min', false, 0, true), '5');

echo "\nother aggs still return 0 on an empty row (renderer blanks those)\n";
foreach (array('sum','count','avg','stddev','range','count_filled') as $agg) {
    t("empty row $agg is 0", ov($map,$keys ? 'R2' : 'R2',$keys,$agg), 0);
}

echo "\nQ3: compute_agg_from_values reports the sentinel, not 0, on an empty list\n";
// both guards: no values at all, and values present but none numeric
t('no values, min',        pivot_compute_agg_from_values(array(), 'min'), 1e308);
t('no values, max',        pivot_compute_agg_from_values(array(), 'max'), -1e308);
t('all-text, min',         pivot_compute_agg_from_values(array('a','b'), 'min'), 1e308);
t('all-text, max',         pivot_compute_agg_from_values(array('a','b'), 'max'), -1e308);
t('all-text min blanks',   pivot_format_value(pivot_compute_agg_from_values(array('a','b'),'min'), 'min', false, 0, true), '');
t('no values, sum stays 0',   pivot_compute_agg_from_values(array(), 'sum'), 0);
t('no values, range stays 0', pivot_compute_agg_from_values(array(), 'range'), 0);
t('populated min is 2',    pivot_compute_agg_from_values(array('5','2','9'), 'min'), 2);
t('populated max is 9',    pivot_compute_agg_from_values(array('5','2','9'), 'max'), 9);
t('a GENUINE min of 0',    pivot_compute_agg_from_values(array('0','7'), 'min'), 0);
t('genuine 0 prints "0"',  pivot_format_value(pivot_compute_agg_from_values(array('0','7'),'min'), 'min', false, 0, true), '0');

echo "\nthe shared rule now has ONE definition per engine\n";
t('helper: min',   pivot_empty_agg_value('min'), 1e308);
t('helper: max',   pivot_empty_agg_value('max'), -1e308);
t('helper: sum',   pivot_empty_agg_value('sum'), 0);
t('helper: range', pivot_empty_agg_value('range'), 0);
t('extract_agg_value(null) routes through it', pivot_extract_agg_value(null, 'min'), 1e308);

echo "\nQ1: PHP min()/max() have no argument ceiling (the JS side must loop)\n";
$big = range(0, 129999);
t('min over 130k is 0',      min($big), 0);
t('max over 130k is 129999', max($big), 129999);

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
