<?php
/**
 * php_side.php <penumbra_search.php> <corpus.json>  (srchent, 2026-10-26)
 * The server half: every corpus cell through _search_get_cell_value(), every row's
 * nested values through _search_get_virtual_columns() and
 * _search_get_structured_virtual_data(), every query through the REAL
 * php_apply_search_filter (the engine the scheduler, the ?json=1 lane and a
 * dashboard's data tiles use). Prints ONE JSON object. penumbra_search.php is pure
 * declarations (no requires, no database), so it is required as it is.
 * A read that is not UTF-8 is flagged (utf8 = false) and sent with U+FFFD in its
 * place, so the comparison never passes on a byte string JSON could not carry.
 */
if ($argc < 3 || !is_file($argv[1]) || !is_file($argv[2])) {
    fwrite(STDERR, "usage: php php_side.php <penumbra_search.php> <corpus.json>\n");
    exit(2);
}
require_once $argv[1];
$c = json_decode(file_get_contents($argv[2]), true);
if (!is_array($c) || !isset($c['rows'], $c['queries'], $c['columns'])) {
    fwrite(STDERR, "corpus.json is not a corpus\n");
    exit(2);
}
$reads = array();
$virt = array();
$struct = array();
$bad = array();
foreach ($c['rows'] as $row) {
    $up = array();
    foreach ($row as $k => $v) $up[strtoupper($k)] = $v;
    $r = array();
    foreach ($c['columns'] as $col) {
        $r[$col] = _search_get_cell_value($col, $up);
        if (preg_match('//u', $r[$col]) !== 1) $bad[] = $row['RID'] . '.' . $col;
    }
    $reads[$row['RID']] = $r;
    $virt[$row['RID']] = (object)_search_get_virtual_columns($row);
    $struct[$row['RID']] = _search_get_structured_virtual_data($row);
}
$q = array();
foreach ($c['queries'] as $qq) {
    $ids = array();
    foreach (php_apply_search_filter($c['rows'], 'standard', $qq['q']) as $r) $ids[] = $r['RID'];
    $q[$qq['slug']] = $ids;
}
$out = json_encode(array('reads' => $reads, 'virt' => $virt, 'struct' => $struct, 'q' => $q, 'notutf8' => $bad),
    JSON_INVALID_UTF8_SUBSTITUTE);
if ($out === false) {
    fwrite(STDERR, 'json_encode: ' . json_last_error_msg() . "\n");
    exit(3);
}
echo $out, "\n";
