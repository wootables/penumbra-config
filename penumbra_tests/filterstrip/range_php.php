<?php
/**
 * range_php.php <penumbra_search.php> <range_corpus.json>  (2026-09-30)
 * The server half of the range-field engine agreement: every corpus query through
 * the REAL php_apply_search_filter (the engine the scheduler and the ?json=1 lane
 * use, so a dashboard's data tiles too). Prints ONE line of JavaScript for
 * harness.html: window.RANGE = { rows, columns, queries, php: { query: count } }.
 * penumbra_search.php is pure declarations (no requires, no database), so it is
 * required as it is.
 */
if ($argc < 3 || !is_file($argv[1]) || !is_file($argv[2])) {
    fwrite(STDERR, "usage: php range_php.php <penumbra_search.php> <range_corpus.json>\n");
    exit(2);
}
require_once $argv[1];
$c = json_decode(file_get_contents($argv[2]), true);
if (!is_array($c) || !isset($c['rows'], $c['queries'])) {
    fwrite(STDERR, "range_corpus.json is not a corpus\n");
    exit(2);
}
$php = array();
foreach ($c['queries'] as $q) {
    $php[$q['q']] = count(php_apply_search_filter($c['rows'], 'standard', $q['q']));
}
$c['php'] = $php;
echo 'window.RANGE = ' . json_encode($c) . ";\n";
