<?php
/**
 * grouprow PHP side (2026-09-28): what a SCHEDULED EMAIL keeps for each fixture case -
 * apply_search_filter_via_raw() on a grouped report with a per-group summary, i.e. the
 * runner's _cf_apply_group_summary_filter (which reads __ROW).
 *
 *   php email.php <runner mirror.php> <penumbra_search.php> <fixture.json>
 *
 * The mirror is extract_mirror.php's lift of schedule_runner.php (never require the runner
 * itself: it opens Oracle and SENDS EMAIL). Prints RESULTS_JSON:{ cases: [{ id, names }] }.
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');
require $argv[1];
if (!function_exists('php_apply_search_filter')) { require $argv[2]; }
$fx = json_decode(file_get_contents($argv[3]), true);
$rows = array();
foreach ($fx['rows'] as $r) {
    $row = array();
    foreach ($fx['cols'] as $i => $c) { if ($c !== '#') $row[$c] = $r[$i]; }
    $rows[] = $row;
}
$out = array('cases' => array());
foreach ($fx['cases'] as $c) {
    $api = array('rawData' => $rows, 'data' => $rows, 'groupBy' => 'COLLEGE', 'viewMode' => 'grouped',
                 'groupAgg' => array('column' => 'AMOUNT', 'type' => 'sum', 'groupByCol' => 'COLLEGE'));
    $res = apply_search_filter_via_raw($api, $c['q']);
    $names = (isset($res['data']) && is_array($res['data'])) ? array_map('strval', array_keys($res['data'])) : array();
    sort($names);
    $out['cases'][] = array('id' => $c['id'], 'names' => implode(',', $names));
}
echo 'RESULTS_JSON:' . json_encode($out) . "\n";
