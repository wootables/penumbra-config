<?php
/**
 * php_side.php <penumbra_search.php> <runner mirror.php> <corpus.json>   (fbucket, 2026-11-06)
 * The server halves: every corpus query through the REAL php_apply_search_filter (the engine behind a scheduled
 * task's filter, the ?json=1 lane, dashboards and subscription conditions); every label case through the search
 * engine's own bucket labels (_search_bucket_of + _search_bucket_labels) and through the RUNNER's grouping labels
 * (pivot_split_bucket_label, pivot_bin_bucket_label, pivot_bins_bucket_label, penumbra_group_delim_pieces - the
 * twins pivotparity holds to main.js), lifted out of schedule_runner.php by pivotparity\extract_mirror.php. NEVER
 * require the runner itself: it opens Oracle and sends email. Prints ONE JSON object {q, tok, lbl, run}.
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
if (!is_array($c) || !isset($c['rows'], $c['queries'], $c['columns'], $c['labels'])) {
    fwrite(STDERR, "corpus.json is not a corpus\n");
    exit(2);
}
$q = array();
$tok = array();
$cols = array_merge($c['columns'], array('#'));
foreach ($c['queries'] as $qq) {
    $ids = array();
    foreach (php_apply_search_filter($c['rows'], 'standard', $qq['q']) as $r) $ids[] = (int)$r['ID'];
    $q[$qq['slug']] = $ids;
    $t = array();
    foreach (php_parse_search_query($qq['q'], $cols) as $p) {
        if (isset($p['type']) && $p['type'] === 'condition') $t[] = isset($p['bucket']) ? $p['bucket']['token'] : null;
    }
    $tok[$qq['slug']] = $t;
}
$map = array('D' => 'D', 'A' => 'A', 'L' => 'L');
$lbl = array();
$run = array();
$have = function_exists('_search_bucket_of');
foreach ($c['labels'] as $lc) {
    $b = $have ? _search_bucket_of($lc['tok'], $map) : null;
    $lbl[] = ($b !== null) ? _search_bucket_labels($b, $lc['text']) : null;
    // The runner's own grouping labels of the same text (a list: its pieces; else one label, '' = none)
    if ($lc['kind'] === 'date') $one = pivot_split_bucket_label($lc['split'], $lc['text']);
    elseif ($lc['kind'] === 'bins') { $e = pivot_normalize_bin_edges(explode('_', substr($lc['split'], 4))); $one = pivot_bins_bucket_label($lc['text'], $e); }
    elseif ($lc['kind'] === 'bin') $one = pivot_bin_bucket_label($lc['split'] === 'binlog' ? 'binlog' : 'bin', $lc['text'], isset($lc['width']) ? $lc['width'] : null);
    else $one = null;
    $run[] = ($lc['kind'] === 'list') ? penumbra_group_delim_pieces($lc['split'], $lc['text']) : (((string)$one === '') ? array() : array((string)$one));
}
$out = json_encode(array('q' => $q, 'tok' => $tok, 'lbl' => $lbl, 'run' => $run));
if ($out === false) {
    fwrite(STDERR, 'json_encode: ' . json_last_error_msg() . "\n");
    exit(3);
}
echo $out, "\n";
