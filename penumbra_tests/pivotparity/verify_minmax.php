<?php
// Prove the WHOLE chain after the min/max mirror fix, not just the return value:
//   1. an empty cell yields the sentinel
//   2. pivot_format_value() blanks it (the path all three builders use)
//   3. a GENUINE min of 0 still prints "0" (no over-correction)
//   4. the row/column total merge guard now SKIPS empty cells instead of
//      dragging a spurious 0 into the Min
require_once __DIR__ . '/pivot_mirror.php';

function b($sum,$nc,$min,$max,$vals){ return array('sum'=>$sum,'numericCount'=>$nc,'min'=>$min,'max'=>$max,
    'distinct'=>array_values(array_unique($vals)),'values'=>$vals,'wpairs'=>array()); }

$empty  = array_merge(array('count'=>3), b(0,0,1e308,-1e308,array('a','b','c')));
$real   = array_merge(array('count'=>2), b(5,2,0,5,array('0','5')));      // genuine min 0
$pos    = array_merge(array('count'=>2), b(30,2,10,20,array('10','20')));

$pass = 0; $fail = 0;
function t($name, $got, $want) {
    global $pass, $fail;
    $ok = (is_string($want) ? $got === $want : $got == $want);
    if ($ok) { $pass++; echo "  PASS  $name\n"; }
    else { $fail++; echo "  FAIL  $name\n        got " . var_export($got, true) . " want " . var_export($want, true) . "\n"; }
}

echo "1. empty cell -> sentinel, not 0\n";
t('min of an all-text cell is the sentinel', pivot_extract_agg_value($empty,'min'), 1e308);
t('max of an all-text cell is the sentinel', pivot_extract_agg_value($empty,'max'), -1e308);

echo "\n2. the formatter every builder uses blanks it\n";
t('format(min sentinel) is blank',  pivot_format_value(pivot_extract_agg_value($empty,'min'), 'min', false, 0, true), '');
t('format(max sentinel) is blank',  pivot_format_value(pivot_extract_agg_value($empty,'max'), 'max', false, 0, true), '');
t('format(min sentinel) blank w/ currency too', pivot_format_value(pivot_extract_agg_value($empty,'min'), 'min', true, 0, true), '');

echo "\n3. no over-correction: a GENUINE 0 still prints\n";
t('min of {0,5} is 0',              pivot_extract_agg_value($real,'min'), 0);
t('format(genuine 0) prints "0"',   pivot_format_value(pivot_extract_agg_value($real,'min'), 'min', false, 0, true), '0');
t('min of {10,20} is 10',           pivot_extract_agg_value($pos,'min'), 10);

echo "\n4. total merge now SKIPS empty cells (the `< 1e308` guard finally fires)\n";
// Mirror the accumulator in generate_pivot_html: seed with the sentinel, merge
// each cell's value through the same guard the builders use.
$cells = array($empty, $pos, $empty, $empty);   // sparse: 3 of 4 have no numbers
$rowMin = 1e308; $rowMax = -1e308;
foreach ($cells as $c) {
    $v = pivot_extract_agg_value($c, 'min');
    if ($v < 1e308) { $rowMin = min($rowMin, $v); }
    $w = pivot_extract_agg_value($c, 'max');
    if ($w > -1e308) { $rowMax = max($rowMax, $w); }
}
t('row Min over a sparse row is 10, not 0', $rowMin, 10);
t('row Max over a sparse row is 20, not 0', $rowMax, 20);

// A row where every cell is empty must stay blank, not collapse to 0.
$allEmpty = array($empty, $empty);
$m = 1e308;
foreach ($allEmpty as $c) { $v = pivot_extract_agg_value($c,'min'); if ($v < 1e308) { $m = min($m,$v); } }
t('all-empty row Min stays the sentinel', $m, 1e308);
t('all-empty row Min formats blank', pivot_format_value($m, 'min', false, 0, true), '');

echo "\n$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
