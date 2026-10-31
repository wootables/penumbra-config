<?php
/**
 * php_side.php <penumbra_search.php> <runner mirror.php> <corpus.json>   (parens, 2026-10-30)
 * The server halves: every corpus query through the REAL php_apply_search_filter (the engine
 * behind scheduled sends' Search Filter, the ?json=1 lane, dashboards and subscription
 * conditions) and, unless the query is marked noFormat, through the scheduler's
 * parse_format_condition + evaluate_format_condition (email custom conditions, format rules)
 * lifted out of schedule_runner.php by extract_mirror.php - NEVER require the runner itself,
 * it opens Oracle and sends email. Prints ONE JSON object {q: {slug: ids}, f: {slug: ids}}.
 */
if ($argc < 4 || !is_file($argv[1]) || !is_file($argv[2]) || !is_file($argv[3])) {
    fwrite(STDERR, "usage: php php_side.php <penumbra_search.php> <mirror.php> <corpus.json>\n");
    exit(2);
}
require_once $argv[2];
if (!function_exists('php_apply_search_filter')) {
    require_once $argv[1];
}
$c = json_decode(file_get_contents($argv[3]), true);
if (!is_array($c) || !isset($c['rows'], $c['queries'], $c['columns'])) {
    fwrite(STDERR, "corpus.json is not a corpus\n");
    exit(2);
}
$q = array();
$f = array();
foreach ($c['queries'] as $qq) {
    $ids = array();
    foreach (php_apply_search_filter($c['rows'], 'standard', $qq['q']) as $r) $ids[] = $r['ID'];
    $q[$qq['slug']] = $ids;
    if (empty($qq['noFormat'])) {
        $parsed = parse_format_condition($qq['q'], $c['columns']);
        $fids = array();
        foreach ($c['rows'] as $row) {
            if (evaluate_format_condition($row, $parsed)) $fids[] = $row['ID'];
        }
        $f[$qq['slug']] = $fids;
    }
}
$out = json_encode(array('q' => $q, 'f' => $f));
if ($out === false) {
    fwrite(STDERR, 'json_encode: ' . json_last_error_msg() . "\n");
    exit(3);
}
echo $out, "\n";
