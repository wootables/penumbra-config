<?php
// palette round 7: build the "Functions and tags" JSON for the harness, or check its integrity.
//   php -n fn_index_build.php --index <help/functions_index.php under test> --help <the app's help dir> [--main <js/main.js>] [--check]
// Without --check: prints the JSON (the harness serves it as help_functions.json).
// With --check (the suite's S-fnIndex): every function of help/snippets.php is in the index with its names,
// signature, parameter names, category and where, and its anchor (the heading id) EXISTS in the generated
// topic; every tag the SQL formatter masks (penumbra_sqlfmt.js TAG_OPEN) is in the index, its anchor and
// options anchor exist in its topic, its options come from that topic's table, and its template is one of
// main.js's sql-master Ctrl+Space entries. Prints FNIDX: GREEN | RED <reasons>.
$o = getopt('', array('index:', 'help:', 'main:', 'check'));
if (empty($o['index']) || empty($o['help'])) { fwrite(STDERR, "usage: --index FILE --help DIR [--main FILE] [--check]\n"); exit(2); }
if (!defined('PNB_HELP_V2')) define('PNB_HELP_V2', 2);
require $o['index'];
$helpDir = rtrim(str_replace('\\', '/', $o['help']), '/');
$idx = pnb_help_functions_index($helpDir);
if (!isset($o['check'])) { echo json_encode($idx, JSON_UNESCAPED_SLASHES); exit(0); }

$bad = array();
$R = require $helpDir . '/snippets.php';
$byId = array(); foreach ($idx['functions'] as $f) { $byId[$f['id']] = $f; }
$topic = (string)@file_get_contents($helpDir . '/topics/optionsHelpLightbox.php');
foreach ((array)$R['functions'] as $id => $f) {
    if (!isset($byId[$id])) { $bad[] = "function $id missing"; continue; }
    $e = $byId[$id];
    if ($e['names'] !== array_values(array_map('strval', (array)$f['names']))) { $bad[] = "$id names"; }
    if (!empty($f['signature']) && $e['signature'] !== (string)$f['signature']) { $bad[] = "$id signature"; }
    $pn = array(); foreach ((array)(isset($f['params']) ? $f['params'] : array()) as $p) { if (!empty($p['name'])) $pn[] = (string)$p['name']; }
    if ($e['params'] !== $pn) { $bad[] = "$id params"; }
    if ($e['where'] !== (string)$f['where']) { $bad[] = "$id where"; }
    if ($e['topic'] !== 'optionsHelpLightbox' || strpos($topic, 'id="' . $e['anchor'] . '"') === false) { $bad[] = "$id anchor " . $e['anchor'] . " not in the topic"; }
    if ($e['summary'] === '' && !empty($f['summary'])) { $bad[] = "$id summary empty"; }
}
if (count($idx['functions']) !== count((array)$R['functions'])) { $bad[] = 'function count ' . count($idx['functions']) . ' vs ' . count((array)$R['functions']); }
// the tags: the formatter's list
$fmt = (string)@file_get_contents(dirname($helpDir) . '/js/penumbra_sqlfmt.js');
$want = array();
if (preg_match('/TAG_OPEN = \/\\\\\[\\\\s\*\(\?:([A-Z_|]+)\)/', $fmt, $m)) { $want = explode('|', $m[1]); } else { $bad[] = 'TAG_OPEN not read from penumbra_sqlfmt.js'; }
$tagsById = array(); foreach ($idx['tags'] as $t) { $tagsById[$t['id']] = $t; }
$main = isset($o['main']) && $o['main'] !== '' ? (string)@file_get_contents($o['main']) : (string)@file_get_contents(dirname($helpDir) . '/js/main.js');
foreach ($want as $name) {
    if (!isset($tagsById[$name])) { $bad[] = "tag $name missing"; continue; }
    $t = $tagsById[$name];
    $src = (string)@file_get_contents($helpDir . '/topics/' . $t['topic'] . '.php');
    if ($src === '') { $bad[] = "$name topic missing"; continue; }
    if (strpos($src, 'id="' . $t['anchor'] . '"') === false) { $bad[] = "$name anchor " . $t['anchor'] . " not in " . $t['topic']; }
    if (strpos($src, 'id="' . $t['optionsAnchor'] . '"') === false) { $bad[] = "$name options anchor " . $t['optionsAnchor'] . " not in " . $t['topic']; }
    if (!$t['options']) { $bad[] = "$name has no options"; }
    foreach ($t['options'] as $op) { if (strpos($src, '<code>' . htmlspecialchars($op['name'], ENT_QUOTES, 'UTF-8') . '</code>') === false && strpos($src, '<code>' . $op['name'] . '</code>') === false) { $bad[] = "$name option " . $op['name'] . " not in its topic"; } }
    if ($t['summary'] === '') { $bad[] = "$name summary empty"; }
    if ($name !== 'IMPORT' && strpos($main, "text: '" . $t['template'] . "'") === false) { $bad[] = "$name template is not a sql-master entry: " . $t['template']; }
    if ($name === 'IMPORT' && strpos($main, "text: '[IMPORT; name=' + name + ']'") === false) { $bad[] = 'IMPORT template shape is not the sql-master one'; }
}
if (count($idx['tags']) !== count($want)) { $bad[] = 'tag count ' . count($idx['tags']) . ' vs ' . count($want); }
echo $bad ? 'FNIDX: RED ' . implode('; ', array_slice($bad, 0, 8)) . "\n" : "FNIDX: GREEN functions " . count($idx['functions']) . " tags " . count($idx['tags']) . "\n";
exit($bad ? 1 : 0);
