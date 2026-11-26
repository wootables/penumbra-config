<?php
// php -n tailcheck.php <penumbra_layout.php> <penumbra_calc.php>: the stub's tail (pnb_sort_calc_tail) names the calculated
// columns the page appends, in their order - custom groups ones included - as penumbra_calc's plan does.
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require $argv[1];
require $argv[2];
$pass = 0; $fail = 0;
function ok($c, $n, $i = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $n\n"; } else { $fail++; echo "  FAIL  $n  $i\n"; } }
$keys = array('ID', 'SPONSOR', 'PI_LIST', 'AMOUNT');
$row = array('ID' => '1', 'SPONSOR' => 'NIH', 'PI_LIST' => 'Smith; Jones', 'AMOUNT' => '5');
$cases = array(
  'groupsMid' => array(array('name' => 'A', 'formula' => '{AMOUNT} + 1'), array('name' => 'SP_GRP', 'groups' => array('col' => 'sponsor', 'sets' => array(array('name' => 'F', 'values' => array('NIH'))))), array('name' => 'B', 'formula' => '{SP_GRP} & "!"', 'format' => 'text')),
  'groupsOfCalc' => array(array('name' => 'G2', 'groups' => array('col' => 'A2', 'sets' => array())), array('name' => 'A2', 'formula' => '{AMOUNT} * 2')),
  'groupsMissingCol' => array(array('name' => 'G3', 'groups' => array('col' => 'NOPE', 'sets' => array())), array('name' => 'C', 'formula' => '{ID}')),
  'groupsBad' => array(array('name' => 'G4', 'groups' => array('col' => ''), 'formula' => '{ID}'), array('name' => 'G5', 'groups' => array(1, 2)), array('name' => 'G6', 'groups' => array('col' => 'A}B')), array('name' => 'D', 'formula' => '{ID}')),
  'groupsLoop' => array(array('name' => 'L1', 'groups' => array('col' => 'L2')), array('name' => 'L2', 'groups' => array('col' => 'L1')), array('name' => 'E', 'formula' => '{ID}')),
  'groupsNullFallsBack' => array(array('name' => 'N1', 'groups' => null, 'formula' => '{ID} + 1')),
);
foreach ($cases as $id => $defs) {
    $tail = pnb_sort_calc_tail(array('calcColumns' => $defs), $keys);
    $out = pnb_calc_apply_rows(array($row), $defs);
    $plan = array_values(array_diff(array_keys($out[0]), $keys));
    $plan = array_map('strtoupper', $plan);
    ok(is_array($tail) && $tail === $plan, "T-$id the tail names what the plan appends", json_encode($tail) . ' vs ' . json_encode($plan));
}
echo "TOTAL pass=$pass fail=$fail\n" . ($fail ? "RESULT: RED\n" : "RESULT: GREEN\n");
