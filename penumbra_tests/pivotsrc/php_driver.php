<?php
/**
 * pivotsrc PHP side (2026-09-28): what a SCHEDULED EMAIL does with the fixture's filters.
 *
 *   php php_driver.php <penumbra_search.php> <runner mirror.php> <fixture.json>
 *
 * The mirror is extract_mirror.php's lift of schedule_runner.php (function declarations
 * only - the runner itself opens Oracle and SENDS EMAIL and is never required). Prints one
 * line: RESULTS_JSON:{ emailCounts, strip, group }.
 *   emailCounts  rows php_apply_search_filter keeps per query - run.ps1 compares them with
 *                the browser's countMatchingRows(q, { email: true }) (the task form's hint)
 *   strip        penumbraStripSrcModifier() unit cases
 *   group        the runner's grouped-summary path (_cf_apply_group_summary_filter through
 *                apply_search_filter_via_raw) with and without a leading __SRC
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');
if ($argc < 4) { fwrite(STDERR, "usage: php_driver.php <penumbra_search.php> <mirror.php> <fixture.json>\n"); exit(2); }
require $argv[2];
if (!function_exists('php_apply_search_filter')) { require $argv[1]; }
$fx = json_decode(file_get_contents($argv[3]), true);
$rows = $fx['rows'];
$out = array('emailCounts' => array(), 'infoCounts' => array(), 'strip' => array(), 'group' => array(), 'searchFile' => realpath($argv[1]));

foreach ($fx['emailQueries'] as $q) {
    $out['emailCounts'][$q] = count(php_apply_search_filter($rows, 'standard', $q));
}
foreach ($fx['infoQueries'] as $q) {
    $out['infoCounts'][$q] = count(php_apply_search_filter($rows, 'standard', $q));
}

$cases = array(
    array('__SRC AMOUNT > 1', 'AMOUNT > 1'),
    array('__src amount > 1', 'amount > 1'),
    array('__ALL __SRC AMOUNT > 1', '__ALL AMOUNT > 1'),
    array('__SRC __ROW AMOUNT > 1', '__ROW AMOUNT > 1'),
    array('__ROW __ALL __SRC X', '__ROW __ALL X'),
    array('AMOUNT = __SRC', 'AMOUNT = __SRC'),
    array('__SRCX AMOUNT > 1', '__SRCX AMOUNT > 1'),
    array('__SRC', '__SRC'),
    array('TITLE = "__SRC " and __SRC X', 'TITLE = "__SRC " and __SRC X'),
);
$have = function_exists('penumbraStripSrcModifier');
foreach ($cases as $c) {
    $got = $have ? penumbraStripSrcModifier($c[0]) : '(penumbraStripSrcModifier missing)';
    $out['strip'][] = array('in' => $c[0], 'want' => $c[1], 'got' => $got);
}

// Grouped report with a per-group summary ("Sum of AMOUNT"): the runner narrows rows by the
// row conditions, regroups, then drops groups whose recomputed summary fails.
function pivotsrc_group($rows, $filter) {
    $api = array('rawData' => $rows, 'data' => $rows, 'groupBy' => 'FUNDER', 'viewMode' => 'grouped',
                 'groupAgg' => array('column' => 'AMOUNT', 'type' => 'sum', 'groupByCol' => 'FUNDER'));
    $res = apply_search_filter_via_raw($api, $filter);
    $groups = (isset($res['data']) && is_array($res['data'])) ? array_keys($res['data']) : array();
    sort($groups);
    return array('rows' => isset($res['rawData']) ? count($res['rawData']) : -1, 'groups' => implode(',', $groups));
}
if (function_exists('apply_search_filter_via_raw')) {
    $f = 'Sum of AMOUNT > 100 and TRANSACTION_TYPE = New';
    $out['group'] = array('plain' => pivotsrc_group($rows, $f), 'src' => pivotsrc_group($rows, '__SRC ' . $f));
} else {
    $out['group'] = array('error' => 'apply_search_filter_via_raw not in the mirror');
}
echo 'RESULTS_JSON:' . json_encode($out) . "\n";
