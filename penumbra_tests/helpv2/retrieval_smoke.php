<?php
/**
 * retrieval_smoke.php - the AI help retrieval builds from the v2 fragments.
 *
 *   php -n retrieval_smoke.php --app=<stage dir> --orig=<dir with v1 help_content.php> --out=<scratch dir>
 *
 *   R1 v2 build: chunks > 900, every chunk carries an audience, writer and admin chunks exist
 *   R2 v1 build from the original file still works and lands within 10% of the v2 chunk count
 *   R3 "how do I schedule an email report" retrieves the Scheduler topic first (v2 index)
 *   R4 a pure SQL question retrieves nothing (the precision gate still holds)
 *   R5 the two builds write to DIFFERENT cache files (switching versions never serves the other index)
 * Exit = failures.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'orig:', 'out:'));
if (empty($o['app']) || empty($o['orig']) || empty($o['out'])) { fwrite(STDERR, "usage: --app=<stage> --orig=<orig> --out=<dir>\n"); exit(2); }
$app = rtrim(str_replace('\\', '/', $o['app']), '/'); $orig = rtrim(str_replace('\\', '/', $o['orig']), '/'); $out = rtrim(str_replace('\\', '/', $o['out']), '/');
if (!is_dir($out)) mkdir($out, 0777, true);
$R = new HvReport();
$php = PHP_BINARY;

// Each build runs in a child so the version switch (a constant) can differ.
function build($php, $app, $orig, $out, $v2) {
    $script = $out . '/_build_' . ($v2 ? 'v2' : 'v1') . '.php';
    $code = "<?php\n"
        . "define('PNB_HELP_V2_FORCE', " . ($v2 ? 'true' : 'false') . ");\n"
        . "define('PNB_HELP_SRC', " . var_export($orig . '/help_content.php', true) . ");\n"
        . "define('PNB_HELP_CACHE', " . var_export($out . '/help_chunks.json', true) . ");\n"
        . "define('PNB_HELP_CACHE_ALT', " . var_export($out . '/help_chunks_alt.json', true) . ");\n"
        . "define('PNB_HELP_CACHE_V2', " . var_export($out . '/help_chunks_v2.json', true) . ");\n"
        . "define('PNB_HELP_CACHE_V2_ALT', " . var_export($out . '/help_chunks_v2_alt.json', true) . ");\n"
        . "require " . var_export($app . '/help_retrieval.php', true) . ";\n"
        . "\$c = pnb_help_build();\n"
        . "\$auds = array(); foreach (\$c['chunks'] as \$ch) { \$a = isset(\$ch['a']) ? \$ch['a'] : '(none)'; \$auds[\$a] = isset(\$auds[\$a]) ? \$auds[\$a] + 1 : 1; }\n"
        . "\$titles = array(); foreach (\$c['chunks'] as \$ch) { \$titles[\$ch['t']] = isset(\$titles[\$ch['t']]) ? \$titles[\$ch['t']] + 1 : 1; }\n"
        . "\$q1 = pnb_help_retrieve('how do I schedule an email report to go out every monday');\n"
        . "\$q2 = pnb_help_retrieve(\"select award_id, amount\\nfrom awards where amount > 500000\");\n"
        . "\$q3 = function_exists('pnb_help_retrieve_chunks') ? pnb_help_retrieve_chunks('how do i hide a column', 5, null, 'ask') : array();\n"
        . "\$q3ids = array(); foreach (\$q3 as \$ch) \$q3ids[] = isset(\$ch['id']) ? \$ch['id'] : \$ch['t'];\n"
        . "\$q3a = pnb_help_retrieve('how do i hide a column');\n"
        . "echo json_encode(array('n' => \$c['n'], 'sig' => \$c['src_mtime'], 'auds' => \$auds, 'titles' => count(\$titles), 'q1' => substr(\$q1, 0, 400), 'q1topic' => (preg_match('/\\\\[Topic: ([^\\\\]]+)\\\\]/', \$q1, \$m) ? \$m[1] : ''), 'q2len' => strlen(\$q2), 'q3ids' => \$q3ids, 'q3alen' => strlen(\$q3a), 'files' => array_map('basename', pnb_help_src_files()), 'cache' => pnb_help_cache_paths()));\n";
    file_put_contents($script, $code);
    $outp = (string)shell_exec(escapeshellarg($php) . ' -n ' . escapeshellarg($script) . ' 2>&1');
    $j = json_decode(trim($outp), true);
    if (!$j) { echo "  build output: " . substr($outp, 0, 400) . "\n"; }
    return $j;
}

$v2 = build($php, $app, $orig, $out, true);
$v1 = build($php, $app, $orig, $out, false);

$R->check('R1', $v2 && $v2['n'] > 900 && !isset($v2['auds']['(none)']) && !empty($v2['auds']['writer']) && !empty($v2['auds']['admin']),
    $v2 ? ('v2: ' . $v2['n'] . ' chunks from ' . count($v2['files']) . ' files, audiences ' . json_encode($v2['auds']) . ', ' . $v2['titles'] . ' titles') : 'v2 build failed');
$R->check('R2', $v1 && $v2 && $v1['n'] > 900 && abs($v1['n'] - $v2['n']) <= 0.10 * $v2['n'],
    ($v1 ? ('v1: ' . $v1['n'] . ' chunks from ' . implode(',', $v1['files'])) : 'v1 build failed') . ($v2 ? (' vs v2 ' . $v2['n']) : ''));
$R->check('R3', $v2 && stripos($v2['q1topic'], 'Scheduler') !== false, 'v2 retrieval for a scheduling question lands on: ' . ($v2 ? json_encode($v2['q1topic']) : '?'));
$R->check('R4', $v2 && $v2['q2len'] === 0, 'a pasted SQL statement retrieves nothing (len ' . ($v2 ? $v2['q2len'] : '?') . ')');
$R->check('R5', $v1 && $v2 && $v1['cache'][0] !== $v2['cache'][0] && is_file($v1['cache'][0]) && is_file($v2['cache'][0]) && $v1['sig'] != $v2['sig'],
    'separate caches: ' . ($v1 ? basename($v1['cache'][0]) : '?') . ' / ' . ($v2 ? basename($v2['cache'][0]) : '?') . ', signatures ' . ($v1 ? json_encode($v1['sig']) : '?') . ' / ' . ($v2 ? json_encode($v2['sig']) : '?'));

// R6 / R7 (2026-10-15 evening): the Ask page's recall mode answers a one-term question; the assistant keeps its precision gate.
$okCol = array('userSettingsHelpLightbox', 'viewoptionsHelpLightbox', 'columnSummariesHelpLightbox');
$R->check('R6', $v2 && !empty($v2['q3ids']) && in_array($v2['q3ids'][0], $okCol, true), 'ask mode: "how do i hide a column" lands on ' . ($v2 ? json_encode(array_slice((array)$v2['q3ids'], 0, 3)) : '?'));
$R->check('R7', $v2 && isset($v2['q3alen']) && (int)$v2['q3alen'] === 0, 'assist mode keeps its precision gate for the same words (len ' . ($v2 ? $v2['q3alen'] : '?') . ')');

$failed = $R->failed();
echo $failed ? ('retrieval RED: ' . implode(' ', $failed) . "\n") : "retrieval GREEN\n";
exit(count($failed));
