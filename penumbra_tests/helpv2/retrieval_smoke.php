<?php
/**
 * retrieval_smoke.php - the AI help retrieval builds from the v2 fragments.
 *
 *   php -n retrieval_smoke.php --app=<stage dir> --orig=<dir with v1 help_content.php> --out=<scratch dir>
 *
 *   R1 v2 build: chunks > 900, every chunk carries an audience, writer and admin chunks exist
 *   R2 retired 2026-10-19 with the v1 help (the v1 build)
 *   R3 "how do I schedule an email report" retrieves the Scheduler topic first (v2 index)
 *   R4 a pure SQL question retrieves nothing (the precision gate still holds)
 *   R5 retired 2026-10-19 with the v1 help (the two caches); --orig is accepted and ignored
 *   R6 ask mode: "how do i hide a column" lands on a column-management topic; R7 assist mode keeps its gate for it
 *   R8 ask mode: "is the IP address list enforced" lands on Security & Access with the IP Address List passage
 *      (two-letter tokens on PNB_HELP_SHORT reach the index and the question; E2E_2026-10-17 D1)
 *   R9 assist mode: data questions naming PI / ID / FY / DB still retrieve nothing (the Ask-only tier of the
 *      allow-list never reaches the assistant's question)
 *   R10 a cache stamped with the previous PNB_HELP_VER is rejected and rebuilt (a bump rebuilds both caches)
 *   R11 ask mode: "can you unpivot this current dataset" puts the Restore Transaction List passage first (a question
 *      word the help never uses is stood in for by its synonyms, 2026-10-20)
 * Exit = failures.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'orig:', 'out:'));
if (empty($o['app']) || empty($o['orig']) || empty($o['out'])) { fwrite(STDERR, "usage: --app=<stage> --orig=<orig> --out=<dir>\n"); exit(2); }
$app = rtrim(str_replace('\\', '/', $o['app']), '/'); $orig = rtrim(str_replace('\\', '/', $o['orig']), '/'); $out = rtrim(str_replace('\\', '/', $o['out']), '/');
if (!is_dir($out)) mkdir($out, 0777, true);
$R = new HvReport();
$php = PHP_BINARY;

// R9: data questions whose only how-to-looking words are two-letter data abbreviations (PI, ID, FY, DB). The assistant
// must keep retrieving nothing for them, as it did before the allow-list existed (those tokens were simply dropped).
// Pure data questions without such a word ("non-funded awards over 500k") are not listed: the assistant's own gate
// decides those, and did so before as well.
$DATA_BATTERY = array('awards by pi over 500k', 'list all awards for pi id 12345', 'award id and title for the engineering college',
    'unity id of the pi on award 123', 'ouc 06 awards by pi', 'lead pi vs co-pi counts', 'awards where the pi is in the db', 'pi id',
    'total by pi and fy', 'fy 2024 proposals by college', 'proposals submitted in fy26 by department', 'contracts ending this fy');

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
        // R8-R10 (2026-10-17): the two-letter allow-list, the assistant's data-question battery, the VER mechanism.
        . "\$q4 = function_exists('pnb_help_retrieve_chunks') ? pnb_help_retrieve_chunks('is the IP address list enforced', 5, null, 'ask') : array();\n"
        . "\$q4ids = array(); \$q4ip = false; foreach (\$q4 as \$ch) { \$q4ids[] = isset(\$ch['id']) ? \$ch['id'] : \$ch['t']; if (stripos(\$ch['x'], 'IP Address List') !== false) \$q4ip = true; }\n"
        . "\$q5 = function_exists('pnb_help_retrieve_chunks') ? pnb_help_retrieve_chunks('can you unpivot this current dataset', 6, null, 'ask') : array();\n"
        . "\$q5first = (\$q5 && stripos(\$q5[0]['x'], 'Restore Transaction List') !== false) ? 1 : 0;\n"
        . "\$short = array(); foreach (array('ip', 's3', 'db', 'ui', 'ai', 'pi', 'id', 'fy') as \$t) \$short[\$t] = isset(\$c['df'][\$t]) ? \$c['df'][\$t] : 0;\n"
        . "\$leak = array(); foreach (" . var_export($GLOBALS['DATA_BATTERY'], true) . " as \$q) { \$l = strlen(pnb_help_retrieve(\$q)); if (\$l) \$leak[\$q] = \$l; }\n"
        . "\$stale = \$c; \$stale['ver'] = PNB_HELP_VER - 1; \$cp = pnb_help_cache_paths(); file_put_contents(\$cp[0], json_encode(\$stale)); \$re = pnb_help_cache(); \$reVer = \$re ? \$re['ver'] : null; \$reN = (\$re && !empty(\$re['chunks'])) ? count(\$re['chunks']) : 0;\n"
        . "echo json_encode(array('n' => \$c['n'], 'sig' => \$c['src_mtime'], 'auds' => \$auds, 'titles' => count(\$titles), 'q1' => substr(\$q1, 0, 400), 'q1topic' => (preg_match('/\\\\[Topic: ([^\\\\]]+)\\\\]/', \$q1, \$m) ? \$m[1] : ''), 'q2len' => strlen(\$q2), 'q3ids' => \$q3ids, 'q3alen' => strlen(\$q3a), 'q4ids' => \$q4ids, 'q4ip' => \$q4ip, 'q5first' => \$q5first, 'short' => \$short, 'leak' => \$leak, 'ver' => PNB_HELP_VER, 'reVer' => \$reVer, 'reN' => \$reN, 'files' => array_map('basename', pnb_help_src_files()), 'cache' => pnb_help_cache_paths()));\n";
    file_put_contents($script, $code);
    $outp = (string)shell_exec(escapeshellarg($php) . ' -n ' . escapeshellarg($script) . ' 2>&1');
    $j = json_decode(trim($outp), true);
    if (!$j) { echo "  build output: " . substr($outp, 0, 400) . "\n"; }
    return $j;
}

$v2 = build($php, $app, $orig, $out, true);

$R->check('R1', $v2 && $v2['n'] > 900 && !isset($v2['auds']['(none)']) && !empty($v2['auds']['writer']) && !empty($v2['auds']['admin']),
    $v2 ? ('v2: ' . $v2['n'] . ' chunks from ' . count($v2['files']) . ' files, audiences ' . json_encode($v2['auds']) . ', ' . $v2['titles'] . ' titles') : 'v2 build failed');
$R->check('R3', $v2 && stripos($v2['q1topic'], 'Scheduler') !== false, 'v2 retrieval for a scheduling question lands on: ' . ($v2 ? json_encode($v2['q1topic']) : '?'));
$R->check('R4', $v2 && $v2['q2len'] === 0, 'a pasted SQL statement retrieves nothing (len ' . ($v2 ? $v2['q2len'] : '?') . ')');
// R6 / R7 (2026-10-15 evening): the Ask page's recall mode answers a one-term question; the assistant keeps its precision gate.
$okCol = array('userSettingsHelpLightbox', 'viewoptionsHelpLightbox', 'columnSummariesHelpLightbox');
$R->check('R6', $v2 && !empty($v2['q3ids']) && in_array($v2['q3ids'][0], $okCol, true), 'ask mode: "how do i hide a column" lands on ' . ($v2 ? json_encode(array_slice((array)$v2['q3ids'], 0, 3)) : '?'));
$R->check('R7', $v2 && isset($v2['q3alen']) && (int)$v2['q3alen'] === 0, 'assist mode keeps its precision gate for the same words (len ' . ($v2 ? $v2['q3alen'] : '?') . ')');

// R8 / R9 / R10 (2026-10-17, E2E_2026-10-17 D1): two-letter tokens on the allow-list reach the index and the Ask page's
// question; the assistant never queries on the Ask-only tier; a VER bump rebuilds a cache stamped with the old VER.
$R->check('R8', $v2 && !empty($v2['q4ids']) && $v2['q4ids'][0] === 'saveSecurityHelpLightbox' && !empty($v2['q4ip']),
    'ask mode: "is the IP address list enforced" lands on ' . ($v2 ? json_encode(array_slice((array)$v2['q4ids'], 0, 3)) : '?')
    . (($v2 && !empty($v2['q4ip'])) ? ' with the IP Address List passage' : ' WITHOUT the IP Address List passage') . '; short-token df ' . ($v2 ? json_encode($v2['short']) : '?'));
$R->check('R9', $v2 && isset($v2['leak']) && count($v2['leak']) === 0,
    'assist mode: ' . count($DATA_BATTERY) . ' data questions naming PI / ID / FY / DB retrieve nothing' . (($v2 && !empty($v2['leak'])) ? ' - LEAK ' . json_encode($v2['leak']) : ''));
$R->check('R11', $v2 && !empty($v2['q5first']), 'ask mode: "can you unpivot this current dataset" puts the Restore Transaction List passage first');
$R->check('R10', $v2 && isset($v2['reVer']) && (int)$v2['reVer'] === (int)$v2['ver'] && (int)$v2['reN'] > 900,
    'a cache stamped with the previous PNB_HELP_VER is rejected and rebuilt (ver ' . ($v2 ? $v2['reVer'] . ' = ' . $v2['ver'] : '?') . ', ' . ($v2 ? $v2['reN'] : '?') . ' chunks)');

$failed = $R->failed();
echo $failed ? ('retrieval RED: ' . implode(' ', $failed) . "\n") : "retrieval GREEN\n";
exit(count($failed));
