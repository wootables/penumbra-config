<?php
/**
 * coverage_help.php - the coverage map: is everything the code exposes named in the help?
 *
 *   php -n coverage_help.php --app=<stage> [--live=<webroot>] --out=<report.md>
 *
 * Report only (exit 0). Each probe reads a list straight out of the code and says
 * which items the help never names, so "nothing missing" becomes a checklist the
 * rewrite phases tick off instead of a reading pass. Heuristic by design: a miss
 * means "go look", not "wrong".
 *
 *   C1  snippet functions (PENUMBRA_SNIPPET_FN_NAMES) vs Custom Code h4 anchors,
 *       the hover module's signatures and the AI prompt's reference
 *   C2  action() types (PENUMBRA_ACTION_TYPES) vs the same three surfaces
 *   C3  URL parameters read by index.php / dashboard.php / main.js vs Power Features
 *   C4  single-key shortcuts (PNB_SINGLE_KEYS) vs <kbd> mentions
 *   C5  View Options controls (labels in #view-options-tab) vs the View Options topic
 *   C6  scheduler form labels vs the scheduler family of topics
 *   C7  chart types (#vizTypeSelector) vs the Data Visualization topic and the AI prompt
 *   C8  pivot aggregation types (the label map in main.js) vs the Pivot topic
 *   C9  prompt attributes (builder tip keys) vs the SQL Editor's Query Prompts section
 *   C10 hover-tip keys: consumed-but-undefined and defined-but-unconsumed
 *   C11 topics with no "?" entry point in index.php (reachable only by TOC or search)
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'live:', 'out:'));
if (empty($o['app']) || empty($o['out'])) { fwrite(STDERR, "usage: --app=<stage> [--live=<webroot>] --out=<report.md>\n"); exit(2); }
$app  = rtrim(str_replace('\\', '/', $o['app']), '/');
$live = isset($o['live']) ? rtrim(str_replace('\\', '/', $o['live']), '/') : '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$outPath = $o['out'];

define('PNB_HELP_V2_FORCE', true);
require_once $app . '/help/manifest.php';
$topics = pnb_help_v2_topics(); $tips = pnb_help_v2_tips();
$frag = array(); $allHelp = '';
foreach ($topics as $id => $t) { $p = "$app/help/topics/$id.php"; if (is_file($p)) { $frag[$id] = hv_html_only(hv_read($p)); $allHelp .= $frag[$id]; } }
foreach ($tips as $id)         { $p = "$app/help/tips/$id.php";   if (is_file($p)) { $frag[$id] = hv_html_only(hv_read($p)); $allHelp .= $frag[$id]; } }
$text = function ($html) { return strtolower(html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8')); };

$indexPath = hv_locate('index.php', $app, $live);           $index  = $indexPath ? hv_read($indexPath) : '';
$mainPath  = hv_locate('js/main.js', $app, $live);          $main   = $mainPath ? hv_read($mainPath) : '';
$dashPath  = hv_locate('dashboard.php', $app, $live);       $dash   = $dashPath ? hv_read($dashPath) : '';
$dashJs    = hv_locate('js/penumbra_dashboard.js', $app, $live); $dashJs = $dashJs ? hv_read($dashJs) : '';
$snipPath  = hv_locate('js/penumbra_snippet_help.js', $app, $live); $snip = $snipPath ? hv_read($snipPath) : '';
$aiPath    = hv_locate('ai_system_prompt.php', $app, $live); $ai     = $aiPath ? hv_read($aiPath) : '';

$md = "# Help coverage map\n\nGenerated " . date('Y-m-d H:i') . " from `$app` (code read from the stage, falling back to `$live`).\n"
    . "A listed item is something the code exposes that the help does not name where a reader would look. Heuristic: confirm before acting.\n\n";
$summary = array();
function tbl(array $rows, array $head) { if (!$rows) return "_nothing missing_\n\n"; $s = '| ' . implode(' | ', $head) . " |\n|" . str_repeat(' --- |', count($head)) . "\n"; foreach ($rows as $r) $s .= '| ' . implode(' | ', array_map(function ($c) { return str_replace('|', '\\|', (string)$c); }, $r)) . " |\n"; return $s . "\n"; }

// ---------------------------------------------------------------- C1 snippet functions
$fns = array();
if ($main !== '' && preg_match('/PENUMBRA_SNIPPET_FN_NAMES\s*=\s*\[(.*?)\];/s', $main, $m)) {
    $body = preg_replace('#//[^\n]*#', '', $m[1]);
    if (preg_match_all("/'([a-z_]+)'/", $body, $mm)) $fns = array_values(array_unique($mm[1]));
}
$opt = isset($frag['optionsHelpLightbox']) ? $frag['optionsHelpLightbox'] : '';
$mathHelpers = array('abs', 'floor', 'ceil', 'mod');
$rows = array();
foreach ($fns as $fn) {
    $anchor = in_array($fn, $mathHelpers, true) ? 'mathhelpers' : $fn;
    $inHelp = preg_match('/<h4 id="' . preg_quote($anchor, '/') . '"/', $opt) === 1;
    $inSnip = preg_match("/^\\s*'?" . preg_quote($fn, '/') . "'?\\s*:\\s*_wrap\\(/m", $snip) === 1;
    $inAi   = preg_match('/^###[^\n]*\b' . preg_quote($fn, '/') . '\(/m', $ai) === 1;
    if (!$inHelp || !$inSnip || !$inAi) $rows[] = array($fn, $inHelp ? 'yes' : 'NO', $inSnip ? 'yes' : 'NO', $inAi ? 'yes' : 'NO');
}
$md .= "## C1 Snippet functions (" . count($fns) . " in PENUMBRA_SNIPPET_FN_NAMES)\n\nOne row per function missing from any of the three documentation surfaces.\n\n" . tbl($rows, array('function', 'Custom Code h4', 'hover module', 'AI prompt'));
$summary['C1 snippet functions'] = count($fns) . ' functions, ' . count($rows) . ' with a gap';

// ---------------------------------------------------------------- C2 action types
$types = array();
if ($main !== '' && preg_match('/PENUMBRA_ACTION_TYPES\s*=\s*\[(.*?)\]/s', $main, $m) && preg_match_all("/'([a-z_]+)'/", $m[1], $mm)) $types = $mm[1];
$rows = array();
foreach ($types as $ty) {
    $inHelp = preg_match('/action\(\s*' . $ty . '\b/i', $opt) === 1;
    $inSnip = strpos($snip, "'action:$ty'") !== false;
    $aiSec = preg_match('/### action\(.*?(?=\n### )/s', $ai, $am) ? $am[0] : '';
    $inAi = preg_match('/\b' . $ty . '\b/i', $aiSec) === 1;
    if (!$inHelp || !$inSnip || !$inAi) $rows[] = array($ty, $inHelp ? 'yes' : 'NO', $inSnip ? 'yes' : 'NO', $inAi ? 'yes' : 'NO');
}
$md .= "## C2 action() types (" . implode(', ', $types) . ")\n\n" . tbl($rows, array('type', 'Custom Code', 'hover module', 'AI prompt'));
$summary['C2 action types'] = count($types) . ' types, ' . count($rows) . ' with a gap';

// ---------------------------------------------------------------- C3 URL parameters
$params = array();
foreach (array('index.php' => $index, 'dashboard.php' => $dash) as $src => $s) if ($s !== '' && preg_match_all("/\\\$_GET\\['([a-zA-Z_]+)'\\]/", $s, $m)) foreach ($m[1] as $p) $params[$p][] = $src;
foreach (array('main.js' => $main, 'penumbra_dashboard.js' => $dashJs) as $src => $s) if ($s !== '' && preg_match_all("/(?:urlParams|searchParams|params|qs)\\.get\\('([a-zA-Z_]+)'\\)/", $s, $m)) foreach ($m[1] as $p) $params[$p][] = $src;
ksort($params);
$pf = isset($frag['powerFeaturesHelpLightbox']) ? $frag['powerFeaturesHelpLightbox'] : '';
$rows = array();
foreach ($params as $p => $srcs) {
    $inPf  = preg_match('/<code>[?&]?' . preg_quote($p, '/') . '\b|[?&]' . preg_quote($p, '/') . '=/', $pf) === 1;
    $inAny = preg_match('/<code>[?&]?' . preg_quote($p, '/') . '\b|[?&]' . preg_quote($p, '/') . '=/', $allHelp) === 1;
    if (!$inPf) $rows[] = array($p, implode(', ', array_unique($srcs)), $inAny ? 'elsewhere in the help' : 'NOT in the help');
}
$md .= "## C3 URL parameters (" . count($params) . " read by the code)\n\nParameters the Power Features topic does not name.\n\n" . tbl($rows, array('parameter', 'read by', 'documented'));
$summary['C3 URL parameters'] = count($params) . ' read, ' . count($rows) . ' not in Power Features';

// ---------------------------------------------------------------- C4 single keys
$keys = array();
if ($main !== '' && preg_match('/PNB_SINGLE_KEYS\s*=\s*\{(.*?)\n\s*\};/s', $main, $m) && preg_match_all("/^\\s*'(.)':\\s*\\{([^\\n]*)/m", $m[1], $mm, PREG_SET_ORDER)) foreach ($mm as $k) $keys[$k[1]] = (strpos($k[2], 'admin: true') !== false);
$rows = array();
foreach ($keys as $k => $adminOnly) {
    $re = '/<kbd>\s*' . preg_quote($k, '/') . '\s*<\/kbd>/i';
    if (!preg_match($re, $allHelp)) $rows[] = array($k, $adminOnly ? 'writers' : 'everyone', 'no <kbd>' . $k . '</kbd> anywhere in the help');
}
$md .= "## C4 Single-key shortcuts (" . count($keys) . " in PNB_SINGLE_KEYS)\n\n" . tbl($rows, array('key', 'audience', 'finding'));
$summary['C4 single keys'] = count($keys) . ' keys, ' . count($rows) . ' never shown in <kbd>';

// ---------------------------------------------------------------- C5 view options
$rows = array(); $nvo = 0;
if ($index !== '' && preg_match('/<div id="view-options-tab">(.*?)<div id="(?:scheduler-tab|schedule-tab|auditor-tab)"/s', $index, $m)) {
    $vo = $m[1];
    $voHelp = isset($frag['viewoptionsHelpLightbox']) ? $text($frag['viewoptionsHelpLightbox']) : '';
    $labels = array();
    // <label for="id">text</label>
    if (preg_match_all('/<label[^>]*for="([^"]+)"[^>]*>(.*?)<\/label>/s', $vo, $mm, PREG_SET_ORDER)) foreach ($mm as $lab) $labels[] = array($lab[1], $lab[2]);
    // <label><input id="id"> <strong>Name</strong><small>...</small></label> (the checkbox rows)
    if (preg_match_all('/<label[^>]*>\s*<input[^>]*id="([^"]+)"[^>]*>.*?<strong>(.*?)<\/strong>/s', $vo, $mm, PREG_SET_ORDER)) foreach ($mm as $lab) $labels[] = array($lab[1], $lab[2]);
    // <label><input type="radio" name="x" value="v"> <strong>Name</strong> (the header layout options)
    if (preg_match_all('/<label[^>]*>\s*<input type="radio" name="([^"]+)" value="([^"]+)"[^>]*>\s*<strong>(.*?)<\/strong>/s', $vo, $mm, PREG_SET_ORDER)) foreach ($mm as $lab) $labels[] = array($lab[1] . '=' . $lab[2], $lab[3]);
    foreach ($labels as $lab) {
        $nvo++;
        $t = trim(preg_replace('/\s+/', ' ', strtolower(html_entity_decode(strip_tags($lab[1]), ENT_QUOTES, 'UTF-8'))));
        if ($t === '') continue;
        $probe = substr(preg_replace('/\s*\(.*$/', '', $t), 0, 24);
        $slash = function ($x) { return preg_replace('/\s*\/\s*/', '/', $x); };   // "Export/Download" (a <wbr> label) = "Export / Download"
        if ($probe === '' || strpos($slash($voHelp), $slash($probe)) === false) $rows[] = array($lab[0], $t, 'label text not found in the View Options topic');
    }
    $md .= "## C5 View Options controls ($nvo labelled controls in #view-options-tab)\n\n" . tbl($rows, array('control id', 'label', 'finding'));
} else {
    $md .= "## C5 View Options controls\n\n_#view-options-tab block not found in index.php_\n\n";
}
$summary['C5 view options'] = "$nvo labels, " . count($rows) . ' not found in the topic';

// ---------------------------------------------------------------- C6 scheduler labels
$rows = array(); $nsl = 0;
$schedHelp = '';
foreach (array('schedulerHelpLightbox', 'schedOnCompletionHelpLightbox', 'schedulerPromptHelpLightbox', 'customConditionHelpLightbox', 'searchFilterHelpLightbox') as $id) if (isset($frag[$id])) $schedHelp .= $text($frag[$id]);
if ($index !== '' && preg_match_all('/<label[^>]*for="(sched[A-Za-z_]+)"[^>]*>(.*?)<\/label>/s', $index, $mm, PREG_SET_ORDER)) {
    foreach ($mm as $lab) {
        $nsl++;
        $t = trim(preg_replace('/\s+/', ' ', strtolower(html_entity_decode(strip_tags($lab[2]), ENT_QUOTES, 'UTF-8'))));
        $t = preg_replace('/[:*?]+$/', '', $t);
        $t = rtrim(trim(preg_replace('/\s*\(.*$/', '', $t)), ' :*?');   // "Header line (optional; ...)" -> "header line"; "Subject Line: ?" -> "subject line"
        if (strlen($t) < 3) continue;
        if (strpos($schedHelp, substr($t, 0, 22)) === false) $rows[] = array($lab[1], $t, 'label text not found in the scheduler topics');
    }
}
$md .= "## C6 Scheduler form labels ($nsl labelled fields)\n\n" . tbl($rows, array('field id', 'label', 'finding'));
$summary['C6 scheduler labels'] = "$nsl labels, " . count($rows) . ' not found';

// ---------------------------------------------------------------- C7 chart types
$ctypes = array();
if ($index !== '' && ($vs = strpos($index, 'id="vizTypeSelector"')) !== false) {
    $ve = strpos($index, 'id="vizTypeNoOptions"', $vs);
    $region = substr($index, $vs, ($ve !== false ? $ve - $vs : 40000));
    if (preg_match_all('/role="option"[^>]*data-type="([a-z_-]+)"/', $region, $mm)) $ctypes = array_values(array_unique($mm[1]));
}
$vizHelp = isset($frag['visualizationBuilderHelpLightbox']) ? $text($frag['visualizationBuilderHelpLightbox']) : '';
$aiVis = preg_match('/### vis\(.*?(?=\n### )/s', $ai, $am) ? strtolower($am[0]) : '';
$rows = array();
foreach ($ctypes as $ct) {
    $word = str_replace(array('_', '-'), ' ', $ct);
    $inHelp = preg_match('/\b' . preg_quote($word, '/') . '\b/', $vizHelp) === 1;
    $inAi = preg_match('/\b' . preg_quote($ct, '/') . '\b/', $aiVis) === 1;
    if (!$inHelp || !$inAi) $rows[] = array($ct, $inHelp ? 'yes' : 'NO', $inAi ? 'yes' : 'NO');
}
$md .= "## C7 Chart types (" . count($ctypes) . " in #vizTypeSelector)\n\n" . tbl($rows, array('type', 'Data Visualization topic', 'AI prompt vis()'));
$summary['C7 chart types'] = count($ctypes) . ' types, ' . count($rows) . ' with a gap';

// ---------------------------------------------------------------- C8 pivot aggregations
$aggs = array();
if ($main !== '' && ($pos = strpos($main, "'wavg': 'Weighted Avg'")) !== false) {
    $start = strrpos(substr($main, 0, $pos), '= {');
    $end = strpos($main, '};', $pos);
    if ($start !== false && $end !== false && preg_match_all("/'([a-z_]+(?::[a-z]+)?)'\\s*:\\s*'([^']*)'/", substr($main, $start, $end - $start), $mm, PREG_SET_ORDER)) {
        foreach ($mm as $a) { $key = preg_replace('/:down$/', '', $a[1]); $aggs[$key] = $a[2]; }
    }
}
$pivHelp = isset($frag['pivotBuilderHelpLightbox']) ? $text($frag['pivotBuilderHelpLightbox']) : '';
$pivRaw  = isset($frag['pivotBuilderHelpLightbox']) ? strtolower($frag['pivotBuilderHelpLightbox']) : '';
$rows = array();
foreach ($aggs as $key => $label) {
    $lab = strtolower(trim(preg_replace('/[^\p{L}\p{N}% ().-]/u', '', $label)));
    $inHelp = (strpos($pivRaw, '<code>' . $key) !== false) || ($lab !== '' && strpos($pivHelp, $lab) !== false) || preg_match('/\b' . preg_quote($key, '/') . '\b/', $pivHelp) === 1;
    $inCode = strpos(strtolower($opt), $key) !== false;
    $inAi = stripos($ai, $key) !== false;
    if (!$inHelp) $rows[] = array($key, $label, $inHelp ? 'yes' : 'NO', $inCode ? 'yes' : 'NO', $inAi ? 'yes' : 'NO');
}
$md .= "## C8 Pivot aggregation types (" . count($aggs) . " in the label map)\n\nOnly rows the Pivot topic itself does not name.\n\n" . tbl($rows, array('key', 'label', 'Pivot topic', 'Custom Code (trigger table)', 'AI prompt'));
$summary['C8 pivot aggregations'] = count($aggs) . ' types, ' . count($rows) . ' not in the Pivot topic';

// ---------------------------------------------------------------- C9 prompt attributes
$pkeys = array();
if (isset($frag['builder-tips-storage']) && preg_match_all('/data-tip="([^"]+)"/', $frag['builder-tips-storage'], $mm)) $pkeys = array_values(array_unique($mm[1]));
// Phase 1 moved Query Prompts into a topic of its own; before that it was a section of the SQL Editor.
if (isset($frag['promptsHelpLightbox'])) {
    $promptSec = $frag['promptsHelpLightbox'];
} else {
    $sqlHelp = isset($frag['sqlHelpLightbox']) ? $frag['sqlHelpLightbox'] : '';
    $promptSec = preg_match('/<h4 id="prompts".*?(?=<h4 id="uservars")/s', $sqlHelp, $pm) ? $pm[0] : $sqlHelp;
}
$rows = array();
// A tip's <h4> is the generator control's label; the topic that owns the generator (Query Prompts, or Cross-Database
// Subqueries for the sq-* tips) must name that control. The bare key is accepted too (older tips are keyed by the parameter name).
$sqSec = isset($frag['subqueriesHelpLightbox']) ? $frag['subqueriesHelpLightbox'] : $promptSec;
$tipStore = isset($frag['builder-tips-storage']) ? $frag['builder-tips-storage'] : '';
foreach ($pkeys as $k) {
    $title = '';
    if (preg_match('/data-tip="' . preg_quote($k, '/') . '"[^>]*>\s*<h4[^>]*>(.*?)<\/h4>/s', $tipStore, $tm)) $title = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($tm[1]), ENT_QUOTES, 'UTF-8')));
    $isSq = strpos($k, 'sq-') === 0;
    $plain = html_entity_decode(strip_tags($isSq ? $sqSec : $promptSec), ENT_QUOTES, 'UTF-8');
    $probe = $title !== '' ? trim(preg_replace('/\s*\(.*$/', '', $title)) : $k;
    $hit = ($probe !== '' && stripos($plain, $probe) !== false) || preg_match('/\b' . preg_quote($k, '/') . '\b/i', $plain) === 1;
    if (!$hit) $rows[] = array($k, $title, 'tip title not named in the ' . ($isSq ? 'Subqueries' : 'Query Prompts') . ' topic');
}
$md .= "## C9 Prompt builder tips (" . count($pkeys) . " keys in builder-tips-storage) vs the Query Prompts and Subqueries topics\n\n" . tbl($rows, array('tip key', 'tip title', 'finding'));
$summary['C9 prompt attributes'] = count($pkeys) . ' tip keys, ' . count($rows) . ' control labels absent from the topics';

// ---------------------------------------------------------------- C10 tips
$defs = array(); foreach ($tips as $id) if (isset($frag[$id]) && preg_match_all('/data-tip="([^"]+)"/', $frag[$id], $mm)) foreach ($mm[1] as $k) $defs[$k] = $id;
$cons = hv_tip_consumers($app, $live);
$rows = array();
foreach ($cons as $k => $src) if (!isset($defs[$k])) $rows[] = array($k, $src, 'consumed, no definition');
foreach ($defs as $k => $store) if (!isset($cons[$k])) $rows[] = array($k, $store, 'defined, no static consumer');
$md .= "## C10 Hover-tip keys (" . count($defs) . " defined, " . count($cons) . " consumed statically)\n\n" . tbl($rows, array('key', 'where', 'finding'));
$summary['C10 hover tips'] = count($defs) . ' defined / ' . count($cons) . ' consumed, ' . count($rows) . ' mismatches';

// ---------------------------------------------------------------- C11 entry points
$targets = array();
if ($index !== '' && preg_match_all('/data-target="#([A-Za-z0-9_-]+)"/', $index, $mm)) foreach ($mm[1] as $t) $targets[$t] = isset($targets[$t]) ? $targets[$t] + 1 : 1;
$rows = array();
foreach ($topics as $id => $t) if (empty($t['extra_of']) && !isset($targets[$id])) $rows[] = array($id, $t['title'], $t['audience']);
$md .= "## C11 Topics without a \"?\" entry point in index.php\n\nReachable only through the Help Center TOC, search, F1 or a #help= link.\n\n" . tbl($rows, array('topic', 'title', 'audience'));
$summary['C11 entry points'] = count($rows) . ' topics have no ? icon';

$md .= "## Summary\n\n" . tbl(array_map(function ($k, $v) { return array($k, $v); }, array_keys($summary), $summary), array('probe', 'result'));
file_put_contents($outPath, $md);
echo "coverage report: $outPath\n";
foreach ($summary as $k => $v) printf("  %-24s %s\n", $k, $v);
exit(0);
