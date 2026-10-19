<?php
/**
 * patch_shorttok.php - D1 of E2E_2026-10-17: the help retrieval keeps a short allow-list of two-letter tokens.
 *
 *   php -n patch_shorttok.php --from=<dir holding the live help_retrieval.php> --to=<stage dir>
 *
 * Copies help_retrieval.php from --from to --to and applies four exact-anchor edits (each anchor must occur exactly
 * once, else nothing is written): PNB_HELP_VER 5 -> 6 (both chunk caches rebuild), the two-tier PNB_HELP_SHORT
 * allow-list before pnb_help_tokenize() (1 = feature names for both modes, 2 = data-domain abbreviations for the Ask
 * page only), the tokenizer's length test consulting it, and the assist-mode filter in pnb_help_retrieve_chunks()
 * that drops tier 2 from the assistant's question. Re-run against a fresh copy of live at deploy time if live moved.
 * Prints the sha256 of the input and the output.
 */
$o = getopt('', array('from:', 'to:'));
if (empty($o['from']) || empty($o['to'])) { fwrite(STDERR, "usage: --from=<dir> --to=<dir>\n"); exit(2); }
$from = rtrim(str_replace(chr(92), '/', $o['from']), '/') . '/help_retrieval.php';   // chr(92) = backslash (a '\\' literal survives neither Bash heredocs nor this file's history)
$to   = rtrim(str_replace(chr(92), '/', $o['to']), '/') . '/help_retrieval.php';
$s = @file_get_contents($from);
if ($s === false) { fwrite(STDERR, "cannot read $from\n"); exit(2); }
$eol = (strpos($s, "\r\n") !== false) ? "\r\n" : "\n";

$edits = array(
    array(
        "define('PNB_HELP_VER', 5); // bump to force a chunk-cache rebuild after logic changes (5 = chunks carry their topic id, 2026-10-15)",
        "define('PNB_HELP_VER', 6); // bump to force a chunk-cache rebuild after logic changes (6 = two-letter tokens on the allow-list are indexed, 2026-10-17; 5 = chunks carry their topic id, 2026-10-15)",
    ),
    array(
        'function pnb_help_tokenize($text) {',
        '// Two-letter tokens worth indexing (2026-10-17, E2E_2026-10-17 D1): the tokenizer drops anything shorter than three' . $eol
        . '// characters, so "IP", "S3" and "DB" never reached the index or the question and "is the IP address list enforced"' . $eol
        . '// found no passage. The same function tokenizes the chunks and the question, so the list applies to both sides.' . $eol
        . '//   1 = a feature name: indexed, and queried by the assistant and the Ask page alike.' . $eol
        . '//   2 = a data-domain abbreviation (like the stopped "investigator", "fiscal", "year"): indexed, and queried by the' . $eol
        . '//       Ask page only, where recall is wanted; the assistant never queries on it, so a data question such as' . $eol
        . '//       "awards by PI and FY" keeps pulling no help into its prompt (pnb_help_retrieve_chunks, assist mode).' . $eol
        . "\$GLOBALS['PNB_HELP_SHORT'] = array('ip' => 1, 's3' => 1, 'db' => 1, 'ui' => 1, 'ai' => 1, 'pi' => 2, 'id' => 2, 'fy' => 2);" . $eol
        . $eol
        . 'function pnb_help_tokenize($text) {',
    ),
    array(
        '        if (strlen($w) < 3) continue;',
        '        if (strlen($w) < 3 && !isset($GLOBALS[\'PNB_HELP_SHORT\'][$w])) continue;   // two-letter tokens only from the allow-list',
    ),
    array(
        '        $qTerms = pnb_help_tokenize($query);' . $eol . '        if (!$qTerms) return array();',
        '        $qTerms = pnb_help_tokenize($query);' . $eol
        . '        if ($mode !== \'ask\') {   // the assistant answers data questions: an Ask-only short token (PI, ID, FY) is no how-to cue there' . $eol
        . '            $qTerms = array_values(array_filter($qTerms, function($t) { return !(isset($GLOBALS[\'PNB_HELP_SHORT\'][$t]) && $GLOBALS[\'PNB_HELP_SHORT\'][$t] === 2); }));' . $eol
        . '        }' . $eol
        . '        if (!$qTerms) return array();',
    ),
);
$bad = 0;
foreach ($edits as $i => $e) {
    $n = substr_count($s, $e[0]);
    if ($n !== 1) { fwrite(STDERR, "edit " . ($i + 1) . ": anchor found $n times (expected 1)\n"); $bad++; }
}
if ($bad) { fwrite(STDERR, "nothing written\n"); exit(1); }
$out = $s;
foreach ($edits as $e) $out = str_replace($e[0], $e[1], $out);
if (!is_dir(dirname($to))) mkdir(dirname($to), 0777, true);
if (file_put_contents($to, $out) === false) { fwrite(STDERR, "cannot write $to\n"); exit(2); }
echo "from " . hash('sha256', $s) . "  $from\n";
echo "to   " . hash('sha256', $out) . "  $to\n";
echo "edits applied: " . count($edits) . ", eol " . ($eol === "\r\n" ? 'CRLF' : 'LF') . "\n";
