<?php
/**
 * Characterize the agg-filter divergence the collector comparison surfaced.
 *
 * Collector case6 (filter "AMT > 5") put a NON-NUMERIC value inside the
 * filtered bucket on the PHP side but not on the JS side:
 *     JS   count=1  values=[1,234.56]
 *     PHP  count=2  values=[notanum, 1,234.56]
 *
 * This isolates pivot_evaluate_filter() so the exact rule can be stated rather
 * than inferred from a bucket dump. The browser's answer is in the JS column of
 * the harness output; here we pin down what PHP does.
 */
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require_once __DIR__ . '/pivot_mirror.php';

function row($v) { return array('AMT' => $v, 'OTHER' => 'x'); }

$cases = array(
    'numeric above'      => array('10',        'AMT > 5'),
    'numeric below'      => array('1',         'AMT > 5'),
    'numeric equal'      => array('5',         'AMT > 5'),
    'currency above'     => array('$1,234.56', 'AMT > 5'),
    'accounting neg'     => array('(5)',       'AMT > 5'),
    'NON-NUMERIC text'   => array('notanum',   'AMT > 5'),
    'empty string'       => array('',          'AMT > 5'),
    'text vs <'          => array('notanum',   'AMT < 5'),
    'text vs >='         => array('notanum',   'AMT >= 5'),
    'text vs ='          => array('notanum',   'AMT = 5'),
    'text vs != '        => array('notanum',   'AMT != 5'),
    'sci notation'       => array('1e3',       'AMT > 5'),
);

printf("%-20s %-12s %-12s %s\n", 'case', 'value', 'filter', 'PHP keeps the row?');
echo str_repeat('-', 74) . "\n";
foreach ($cases as $name => $c) {
    list($val, $filter) = $c;
    $keep = pivot_evaluate_filter(row($val), $filter);
    printf("%-20s %-12s %-12s %s\n", $name, "'" . $val . "'", $filter, $keep ? 'YES' : 'no');
}

echo "\nThe question this answers: does a value that is NOT A NUMBER survive a\n";
echo "numeric comparison? If PHP says YES where the browser says no, then a\n";
echo "filtered aggregation counts different rows on screen and in email.\n";
