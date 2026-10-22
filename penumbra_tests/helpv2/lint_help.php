<?php
/**
 * lint_help.php - structural lint for the Help Center v2 fragments and their consumers.
 *
 *   php -n lint_help.php --app=<stage dir> [--live=<webroot>] [--php=<php.exe>]
 *
 * Files not present under --app (index.php, main.js, the dashboard files) are read
 * from --live, so a stage holding only the help files can be linted on its own.
 *
 *   L1  manifest <-> fragment files, both directions, topics and tip stores
 *   L2  every fragment starts with the PNB_HELP_V2 guard
 *   L3  one .help-topic div per topic fragment, data-audience = the manifest audience
 *   L4  element ids unique across all fragments (they share one DOM)
 *   L5  every data-jump-to (fragments + index.php icons) resolves to exactly one id;
 *       an icon's jump target lives in the topic its data-target names (or an extra of it)
 *   L6  every data-target / openHelpCenter(...) / #help= topic reference resolves
 *   L7  every data-tip KEY consumed in index.php / main.js has a definition in a tip store
 *   L8  block tags balanced per fragment
 *   L9  php -l clean: fragments, loader, manifest, help_content.php, help_manifest.php, help_retrieval.php
 *   L10 line endings consistent within each fragment (CRLF files keep every CR)
 *   L11 manifest sanity: unique ids, aliases never collide with ids, extras exist
 *   L12 data-canonical keys unique (one canonical section per concept)
 *   L13 the two shims (help_content.php, help_manifest.php) hand over to help/, loader reachable
 *   W1  budgets (warnings only, for the rewrite phases): paragraphs over 80 words,
 *       bullets over 50 words, em-dashes, emoji headings; tip definitions nobody consumes
 * Exit code = number of failed checks.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'live:', 'php:'));
if (empty($o['app'])) { fwrite(STDERR, "usage: --app=<stage> [--live=<webroot>] [--php=<php.exe>]\n"); exit(2); }
$app  = rtrim(str_replace('\\', '/', $o['app']), '/');
$live = isset($o['live']) ? rtrim(str_replace('\\', '/', $o['live']), '/') : '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$php  = isset($o['php']) ? $o['php'] : PHP_BINARY;
$R = new HvReport();

define('PNB_HELP_V2_FORCE', true);
require_once $app . '/help/manifest.php';
$topics = pnb_help_v2_topics();
$tips   = pnb_help_v2_tips();
$helpDir = $app . '/help';
echo "lint: $app\n";

// ---------------------------------------------------------------- L1
$missing = array(); $orphans = array();
foreach ($topics as $id => $t) if (!is_file("$helpDir/topics/$id.php")) $missing[] = "topics/$id";
foreach (glob("$helpDir/topics/*.php") as $f) { $id = basename($f, '.php'); if (!isset($topics[$id])) $orphans[] = "topics/$id"; }
foreach ($tips as $id) if (!is_file("$helpDir/tips/$id.php")) $missing[] = "tips/$id";
foreach (glob("$helpDir/tips/*.php") as $f) { $id = basename($f, '.php'); if (!in_array($id, $tips, true)) $orphans[] = "tips/$id"; }
$R->check('L1', !$missing && !$orphans, 'manifest<->files: ' . count($topics) . ' topics + ' . count($tips) . ' tip stores'
    . ($missing ? ' MISSING ' . implode(',', $missing) : '') . ($orphans ? ' ORPHAN ' . implode(',', $orphans) : ''));

// load fragments
$frag = array();
foreach ($topics as $id => $t) { $p = "$helpDir/topics/$id.php"; if (is_file($p)) { $raw = hv_read($p); $frag[$id] = array('raw' => $raw, 'html' => hv_html_only($raw), 'tips' => false, 'file' => "help/topics/$id.php"); } }
foreach ($tips as $id)         { $p = "$helpDir/tips/$id.php";   if (is_file($p)) { $raw = hv_read($p); $frag[$id] = array('raw' => $raw, 'html' => hv_html_only($raw), 'tips' => true,  'file' => "help/tips/$id.php"); } }

// ---------------------------------------------------------------- L2
$bad = array();
foreach ($frag as $id => $f) if (strpos($f['raw'], "if (!defined('PNB_HELP_V2')) { http_response_code(404); exit; }") === false) $bad[] = $id;
$R->check('L2', !$bad, $bad ? 'no guard: ' . implode(',', $bad) : 'every fragment carries the PNB_HELP_V2 guard');

// ---------------------------------------------------------------- L3
$bad = array();
$valid = pnb_help_audiences();
foreach ($topics as $id => $t) {
    if (!isset($frag[$id])) continue;
    $n = preg_match_all('/<div id="' . preg_quote($id, '/') . '" class="help-topic"(?: data-audience="([a-z]+)")?>/', $frag[$id]['html'], $m);
    if ($n !== 1) { $bad[] = "$id: $n topic divs"; continue; }
    $aud = isset($m[1][0]) ? $m[1][0] : '';
    if ($aud === '') $bad[] = "$id: no data-audience";
    elseif (!in_array($aud, $valid, true)) $bad[] = "$id: audience '$aud' not in " . implode('/', $valid);
    elseif ($aud !== $t['audience']) $bad[] = "$id: fragment says $aud, manifest says {$t['audience']}";
}
foreach ($frag as $id => $f) {
    if (strpos($f['raw'], '$isAdmin') !== false) $bad[] = "$id: still reads \$isAdmin";
    if (preg_match_all("/pnb_help_show\\('([a-z]*)'\\)/", $f['raw'], $m)) foreach ($m[1] as $a) if (!in_array($a, $valid, true)) $bad[] = "$id: pnb_help_show('$a')";
}
$R->check('L3', !$bad, $bad ? implode(' | ', $bad) : 'one topic div each, audiences match the manifest, inner gates valid');

// ---------------------------------------------------------------- L4 ids
$owner = array(); $dups = array();
foreach ($frag as $id => $f) {
    if (preg_match_all('/\sid="([^"]+)"/', $f['html'], $m)) {
        foreach ($m[1] as $x) { if (isset($owner[$x])) $dups[] = "$x ({$owner[$x]} + $id)"; else $owner[$x] = $id; }
    }
}
$R->check('L4', !$dups, $dups ? 'duplicate ids: ' . implode(', ', array_slice($dups, 0, 8)) : count($owner) . ' ids, all unique');

// ---------------------------------------------------------------- L5 jump links
// Every data-jump-to must name an id that exists exactly once. A target in ANOTHER topic is
// fine since the 2026-10-14 main.js patch (the hub activates the owning topic); those are
// counted and listed as information, because they are the cross-references phase 1 added.
$bad = array(); $cross = array(); $njump = 0;
$sameSet = function ($from, $host) use ($topics) {
    if ($host === $from) return true;
    if (isset($topics[$from]['extra']) && in_array($host, $topics[$from]['extra'], true)) return true;
    if (isset($topics[$host]['extra_of']) && $topics[$host]['extra_of'] === $from) return true;
    if (isset($topics[$from]['extra_of']) && isset($topics[$host]['extra_of']) && $topics[$from]['extra_of'] === $topics[$host]['extra_of']) return true;
    if (isset($topics[$from]['extra_of']) && $topics[$from]['extra_of'] === $host) return true;
    return false;
};
foreach ($frag as $id => $f) {
    if (!preg_match_all('/data-jump-to="([^"]+)"/', $f['html'], $m)) continue;
    foreach ($m[1] as $j) {
        $njump++;
        if (!isset($owner[$j])) { $bad[] = "$id -> #$j (no such id)"; continue; }
        if (!$sameSet($id, $owner[$j])) $cross[] = "$id -> #$j (" . $owner[$j] . ")";
    }
}
// index.php icons: data-target + data-jump-to on the same element
$indexPath = hv_locate('index.php', $app, $live);
$indexHtml = $indexPath ? hv_html_only(hv_read($indexPath)) : '';
$icons = array(); $iconCross = array();
if ($indexHtml !== '' && preg_match_all('/<[a-z]+\b[^>]*data-target="#([A-Za-z0-9_-]+)"[^>]*>/', $indexHtml, $mm, PREG_SET_ORDER)) {
    foreach ($mm as $tag) {
        $jump = preg_match('/data-jump-to="([^"]+)"/', $tag[0], $jm) ? $jm[1] : '';
        $icons[] = array('target' => $tag[1], 'jump' => $jump);
    }
}
foreach ($icons as $ic) {
    if ($ic['jump'] === '') continue;
    $njump++;
    if (!isset($owner[$ic['jump']])) { $bad[] = "index.php #{$ic['target']} -> #{$ic['jump']} (no such id)"; continue; }
    $t = pnb_help_v2_resolve($ic['target']);
    if ($t && !$sameSet($t['id'], $owner[$ic['jump']])) $iconCross[] = "#{$ic['target']} -> #{$ic['jump']} (now in {$owner[$ic['jump']]})";
}
$R->check('L5', !$bad, $bad ? implode(' | ', array_slice($bad, 0, 6)) : "$njump jump links resolve (" . count($cross) . ' cross-topic in the help, ' . count($iconCross) . ' icons whose section moved)');
if ($cross) echo "        info: cross-topic jump links: " . implode(' | ', array_slice($cross, 0, 12)) . (count($cross) > 12 ? ' ...' : '') . "\n";
if ($iconCross) echo "        info: index.php icons landing in a moved section: " . implode(' | ', $iconCross) . "\n";

// ---------------------------------------------------------------- L6 topic references
$bad = array(); $nref = 0;
foreach ($icons as $ic) { $nref++; if (!pnb_help_v2_resolve($ic['target']) && !isset($frag[$ic['target']])) $bad[] = "index.php data-target #{$ic['target']}"; }
$mainPath = hv_locate('js/main.js', $app, $live);
if ($mainPath) {
    $mainJs = hv_read($mainPath);
    if (preg_match_all("/openHelpCenter\\('([A-Za-z0-9_-]+)'/", $mainJs, $m)) foreach ($m[1] as $x) { $nref++; if (!pnb_help_v2_resolve($x)) $bad[] = "main.js openHelpCenter('$x')"; }
} else { $mainJs = ''; }
foreach (array('dashboard.php', 'js/penumbra_dashboard.js', 'js/penumbra_tiles.js') as $rel) {
    $p = hv_locate($rel, $app, $live); if (!$p) continue;
    if (preg_match_all('/#help=([A-Za-z0-9_-]+)/', hv_read($p), $m)) foreach ($m[1] as $x) { $nref++; if (!pnb_help_v2_resolve($x)) $bad[] = "$rel #help=$x"; }
    if (preg_match_all("/openHelpPanel\\('([A-Za-z0-9_-]+)'/", hv_read($p), $m)) foreach ($m[1] as $x) { $nref++; if (!pnb_help_v2_resolve($x)) $bad[] = "$rel openHelpPanel('$x')"; }
}
$R->check('L6', !$bad, $bad ? 'unresolved topic references: ' . implode(', ', $bad) : "$nref topic references resolve (data-target, openHelpCenter, #help=, openHelpPanel)");

// ---------------------------------------------------------------- L7 tip keys
$defs = array();
foreach ($frag as $id => $f) if ($f['tips'] && preg_match_all('/data-tip="([^"]+)"/', $f['html'], $m)) foreach ($m[1] as $k) $defs[$k] = $id;
$consumers = hv_tip_consumers($app, $live);
$bad = array();
foreach ($consumers as $k => $src) if (!isset($defs[$k])) $bad[] = "$k ($src)";
$R->check('L7', !$bad, $bad ? 'consumed tip keys with no definition: ' . implode(', ', $bad) : count($consumers) . ' consumed tip keys (index.php + js/*.js) all defined (' . count($defs) . ' definitions)');
$unused = array_diff(array_keys($defs), array_keys($consumers));
if ($unused) $R->warn('W1t', count($unused) . ' tip definitions have no static consumer (built from a variable, or dead copy): ' . implode(', ', array_slice($unused, 0, 20)) . (count($unused) > 20 ? ' ...' : ''));

// ---------------------------------------------------------------- L8 tag balance
$tagsToCheck = array('div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'section', 'pre', 'h3', 'h4', 'h5', 'details', 'summary', 'p', 'strong', 'em', 'code', 'span', 'a', 'button', 'kbd');
$bad = array();
foreach ($frag as $id => $f) {
    foreach ($tagsToCheck as $tag) {
        $open = preg_match_all('/<' . $tag . '\b[^>]*(?<!\/)>/i', $f['html']);
        $close = preg_match_all('/<\/' . $tag . '\s*>/i', $f['html']);
        if ($open !== $close) $bad[] = "$id <$tag> $open/$close";
    }
}
$R->check('L8', !$bad, $bad ? 'unbalanced: ' . implode(', ', array_slice($bad, 0, 10)) : 'block and inline tags balanced in every fragment');

// ---------------------------------------------------------------- L9 php -l
$bad = array(); $nl = 0;
$lintFiles = array_merge(
    array("$app/help_content.php", "$app/help_manifest.php", "$app/help_retrieval.php", "$helpDir/loader.php", "$helpDir/manifest.php", "$app/help_ask.php", "$helpDir/ask.php"),
    glob("$helpDir/topics/*.php"), glob("$helpDir/tips/*.php"));
foreach ($lintFiles as $f) { if (!is_file($f)) continue; $nl++; $msg = hv_php_lint($php, $f); if ($msg !== '') $bad[] = basename($f) . ': ' . preg_replace('/\s+/', ' ', substr($msg, 0, 120)); }
$R->check('L9', !$bad, $bad ? implode(' | ', array_slice($bad, 0, 5)) : "php -l clean on $nl files");

// ---------------------------------------------------------------- L10 line endings
$bad = array();
foreach ($frag as $id => $f) {
    $cr = substr_count($f['raw'], "\r"); $lf = substr_count($f['raw'], "\n");
    if ($cr !== 0 && $cr !== $lf) $bad[] = "$id CR=$cr LF=$lf";
}
foreach (array('help_content.php' => true, 'help_manifest.php' => false, 'help_retrieval.php' => false, 'help/manifest.php' => false, 'help/loader.php' => false) as $rel => $crlf) {
    $p = "$app/$rel"; if (!is_file($p)) continue; $s = hv_read($p); $cr = substr_count($s, "\r"); $lf = substr_count($s, "\n");
    if ($crlf && $cr !== $lf) $bad[] = "$rel CR=$cr LF=$lf (must stay CRLF)";
    if (!$crlf && $cr !== 0) $bad[] = "$rel has $cr CRs (LF file)";
}
$R->check('L10', !$bad, $bad ? implode(', ', $bad) : 'line endings consistent (fragments + help_content.php CRLF, the PHP modules LF)');

// ---------------------------------------------------------------- L11 manifest sanity
$bad = array(); $seen = array();
foreach (pnb_help_v2_manifest() as $g) {
    foreach ($g['topics'] as $t) {
        if (isset($seen[$t['id']])) $bad[] = "duplicate topic id {$t['id']}"; $seen[$t['id']] = 1;
        if (trim(isset($t['keywords']) ? $t['keywords'] : '') === '') $bad[] = "{$t['id']} has no keywords";
        if (!in_array(isset($t['audience']) ? $t['audience'] : 'viewer', $valid, true)) $bad[] = "{$t['id']} audience";
        foreach (isset($t['aliases']) ? $t['aliases'] : array() as $a) { if (isset($topics[$a])) $bad[] = "alias $a of {$t['id']} is also a live id"; if (isset($seen['alias:' . $a])) $bad[] = "alias $a used twice"; $seen['alias:' . $a] = 1; }
        foreach (isset($t['extra']) ? $t['extra'] : array() as $x) if (!is_file("$helpDir/topics/$x.php")) $bad[] = "extra $x of {$t['id']} has no file";
    }
}
$R->check('L11', !$bad, $bad ? implode(', ', $bad) : count($seen) . ' manifest entries sane (ids, aliases, extras, keywords)');

// ---------------------------------------------------------------- L12 canonical
$canon = array(); $dupc = array();
foreach ($frag as $id => $f) if (preg_match_all('/data-canonical="([^"]+)"/', $f['html'], $m)) foreach ($m[1] as $k) { if (isset($canon[$k])) $dupc[] = "$k ($canon[$k] + $id)"; else $canon[$k] = $id; }
$R->check('L12', !$dupc, $dupc ? 'canonical key claimed twice: ' . implode(', ', $dupc) : count($canon) . ' canonical sections, none claimed twice');

// ---------------------------------------------------------------- L13 shims
$hc = is_file("$app/help_content.php") ? hv_read("$app/help_content.php") : '';
$hm = is_file("$app/help_manifest.php") ? hv_read("$app/help_manifest.php") : '';
// Since 2026-10-19 the two files are shims only (the v1 body is gone): help_content.php requires help/manifest.php
// and then help/loader.php; help_manifest.php requires help/manifest.php. No v1 guard, no switch marker.
$okShim = strpos($hc, "require __DIR__ . '/help/loader.php';") !== false && strpos($hc, "require_once __DIR__ . '/help/manifest.php';") !== false
       && strpos($hm, "require_once __DIR__ . '/help/manifest.php';") !== false
       && is_file("$helpDir/loader.php");
$R->check('L13', $okShim, $okShim ? 'both shims in place, loader present' : 'shim missing in help_content.php / help_manifest.php');

// ---------------------------------------------------------------- L14 canonical references
$refs = array(); $badRef = array();
foreach ($frag as $id => $f) {
    if (!preg_match_all('/<a\b[^>]*data-canonical-ref="([^"]+)"[^>]*>/', $f['html'], $m, PREG_SET_ORDER)) continue;
    foreach ($m as $hit) {
        $key = $hit[1]; $refs[$key] = isset($refs[$key]) ? $refs[$key] + 1 : 1;
        if (!isset($canon[$key])) { $badRef[] = "$id -> $key (no canonical)"; continue; }
        if (!preg_match('/data-jump-to="([^"]+)"/', $hit[0], $jm)) { $badRef[] = "$id -> $key (pointer has no data-jump-to)"; continue; }
        if (!isset($owner[$jm[1]])) { $badRef[] = "$id -> $key (anchor #{$jm[1]} missing)"; continue; }
        // the anchor must sit in the canonical's own topic (or its folded set)
        if (!$sameSet($canon[$key], $owner[$jm[1]])) $badRef[] = "$id -> $key: anchor #{$jm[1]} is in {$owner[$jm[1]]}, canonical lives in {$canon[$key]}";
    }
}
$R->check('L14', !$badRef, $badRef ? implode(' | ', array_slice($badRef, 0, 6)) : array_sum($refs) . ' pointers to ' . count($refs) . ' canonical keys all resolve');

// ---------------------------------------------------------------- L15 topic shells
$bad = array();
foreach ($topics as $id => $t) {
    if (!isset($frag[$id])) continue;
    $n = preg_match_all('/<h3\b/', $frag[$id]['html']);
    if ($n !== 1) $bad[] = "$id: $n h3 headings";
    if (preg_match_all('/class="close-lightbox"/', $frag[$id]['html']) !== 1) $bad[] = "$id: close button count";
}
$R->check('L15', !$bad, $bad ? implode(', ', $bad) : count($topics) . ' topic shells each have one h3 and one close button');

// ---------------------------------------------------------------- L16 the tier standard, enforced on rewritten topics
$standard = function_exists('pnb_help_v2_standard') ? pnb_help_v2_standard() : array();
$bad = array();
foreach ($standard as $id) {
    if (!isset($frag[$id])) { $bad[] = "$id: no fragment"; continue; }
    $h = $frag[$id]['html'];
    if (preg_match_all('/<p\b[^>]*>(.*?)<\/p>/s', $h, $m)) foreach ($m[1] as $x) { $w = hv_words($x); if ($w > 80) $bad[] = "$id: paragraph of $w words (" . substr(trim(strip_tags($x)), 0, 40) . "...)"; }
    if (preg_match_all('/<li\b[^>]*>(.*?)<\/li>/s', $h, $m)) foreach ($m[1] as $x) { $w = hv_words($x); if ($w > 50) $bad[] = "$id: bullet of $w words (" . substr(trim(strip_tags($x)), 0, 40) . "...)"; }
    if (preg_match('/&mdash;|\xE2\x80\x94/', $h)) $bad[] = "$id: em-dash";
    if (preg_match_all('/<h[34]\b[^>]*>(.*?)<\/h[34]>/s', $h, $m)) foreach ($m[1] as $x) if (preg_match('/&#1[2-9]\d{4};|[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]/u', $x)) $bad[] = "$id: emoji heading (" . substr(trim(strip_tags($x)), 0, 30) . ")";
    if (preg_match_all('/<td\b[^>]*>(.*?)<\/td>/s', $h, $m)) foreach ($m[1] as $x) { $w = hv_words($x); if ($w > 70) $bad[] = "$id: table cell of $w words"; }
    // Every prose run, a <div> callout's included (2026-10-22, fnpop 5): the rules above read only <p>, <li>
    // and <td>, and the Custom Code reference had 100-350 word runs inside div callouts that passed.
    $pr = preg_replace('#<pre\b[^>]*>.*?</pre>#s', "\x01", $h);
    $pr = preg_replace('#</?(p|div|li|td|th|h[1-6]|ul|ol|table|tr|thead|tbody|br|hr)\b[^>]*>#i', "\x01", $pr);
    foreach (explode("\x01", $pr) as $x) { $w = hv_words($x); if ($w > 80) $bad[] = "$id: prose run of $w words (" . substr(trim(preg_replace('/\s+/', ' ', strip_tags($x))), 0, 40) . "...)"; }
}
$R->check('L16', !$bad, $bad ? implode(' | ', array_slice($bad, 0, 8)) : count($standard) . ' rewritten topics meet the tier standard (paragraphs and every other prose run, div callouts included, <= 80 words, bullets <= 50, cells <= 70, no em-dashes, no emoji headings)');

// ---------------------------------------------------------------- L17 / L18 the Custom Code reference (phase 4, 2026-10-15)
// L17: help/topics/optionsHelpLightbox.php is the current render of help/snippets.php (the generator's --check
//      re-renders in memory and compares). L18: the registry's function names are exactly the editor's list
//      (PENUMBRA_SNIPPET_FN_NAMES in js/main.js); the hover cards and the AI prompt are reported, not failed.
if (is_file($app . '/help/snippets.php')) {
    $phpBin = isset($o['php']) ? $o['php'] : PHP_BINARY;
    $gen = __DIR__ . '/gen_snippets_help.php';
    $outp = (string)shell_exec(escapeshellarg($phpBin) . ' -n ' . escapeshellarg($gen) . ' --app ' . escapeshellarg($app) . ' --check 2>&1');
    $fresh = (strpos($outp, 'FRESH:') === 0);
    $R->check('L17', $fresh, $fresh ? 'help/topics/optionsHelpLightbox.php is the current render of help/snippets.php' : 'help/topics/optionsHelpLightbox.php is STALE or the generator refused: ' . trim(substr($outp, 0, 220)));
    if (!defined('PNB_HELP_V2')) define('PNB_HELP_V2', 2);
    $reg = include $app . '/help/snippets.php';
    $regNames = array();
    foreach ((array)$reg['functions'] as $rid => $rf) foreach ((array)$rf['names'] as $nm) $regNames[] = $nm;
    $mjPath = is_file($app . '/js/main.js') ? $app . '/js/main.js' : $live . '/js/main.js';
    $mj = (string)@file_get_contents($mjPath);
    $edNames = array();
    if (preg_match('/PENUMBRA_SNIPPET_FN_NAMES\s*=\s*\[(.*?)\];/s', $mj, $em) && preg_match_all("/'([a-z_]+)'/", $em[1], $en)) $edNames = $en[1];
    $regOnly = array_values(array_diff($regNames, $edNames)); $edOnly = array_values(array_diff($edNames, $regNames));
    $compNames = array(); foreach ((array)$reg['functions'] as $rid => $rf) if ($rf['category'] === 'components') foreach ((array)$rf['names'] as $nm) $compNames[] = $nm;
    $regOnly = array_values(array_diff($regOnly, $compNames));   // components are not editor functions
    $ok18 = $edNames && !$regOnly && !$edOnly;
    $R->check('L18', $ok18, $ok18 ? count($edNames) . ' editor function names = the registry (' . count($reg['functions']) . ' entries, ' . count($compNames) . ' components)' : 'registry vs js/main.js names: only in registry [' . implode(' ', $regOnly) . '] only in main.js [' . implode(' ', $edOnly) . ']' . ($edNames ? '' : ' (PENUMBRA_SNIPPET_FN_NAMES not found in ' . $mjPath . ')'));
    $sh = (string)@file_get_contents((is_file($app . '/js/penumbra_snippet_help.js') ? $app : $live) . '/js/penumbra_snippet_help.js');
    $hover = preg_match_all("/^\s+'([a-z_]+)': _wrap\(/m", $sh, $hm) ? $hm[1] : array();
    $ai = (string)@file_get_contents((is_file($app . '/ai_system_prompt.php') ? $app : $live) . '/ai_system_prompt.php');   // the stage may carry a staged copy
    $aiNames = array();
    if (preg_match_all('/^#{2,3} +(.+)$/m', $ai, $am)) foreach ($am[1] as $line) if (preg_match_all('/\b([a-z_]+)\(/', $line, $fn)) foreach ($fn[1] as $nm) $aiNames[] = $nm;
    $aiNames = array_values(array_unique($aiNames));
    $d1 = array_values(array_diff($edNames, $hover)); $d2 = array_values(array_diff($hover, $edNames));
    $d3 = array_values(array_diff($edNames, $aiNames));
    if ($d1 || $d2) $R->warn('W2h', 'hover cards (js/penumbra_snippet_help.js) vs the editor list: missing [' . implode(' ', $d1) . '] extra [' . implode(' ', $d2) . ']');
    if ($d3) $R->warn('W2a', 'ai_system_prompt.php has no heading for: ' . implode(' ', $d3));
    if (!$d1 && !$d2 && !$d3) echo "        info: hover cards and ai_system_prompt.php name every editor function\n";
}

// ---------------------------------------------------------------- L19 no flex-div pseudo-tables in standard topics (phase 4b, 2026-10-15)
// A row built from <div style="display: flex ..."> cells is a table that escapes L16's cell budget and the
// panel-safe cell style; the rewrites turned every one into a real <table>.
$flexBad = array();
foreach ($standard as $id) {
    if (!isset($frag[$id])) continue;
    $n = preg_match_all('/<div style="display: flex;[^"]*">\s*<div style="flex: 0 0 \d+px/', $frag[$id]['html']);
    if ($n) $flexBad[] = "$id: $n flex-div row" . ($n > 1 ? 's' : '');
}
$R->check('L19', !$flexBad, $flexBad ? implode(' | ', $flexBad) : 'no flex-div pseudo-table rows in the ' . count($standard) . ' standard topics (every table is a <table>)');

// ---------------------------------------------------------------- L20 the Ask page (phase 6, 2026-10-15)
// The Ask fragment is the only fragment that carries a script, and that script is js/penumbra_help_ask.js (so the
// behaviour rides in with Help Center v2 and nothing else executes out of the help content); the file must exist.
if (isset($frag['askHelpLightbox'])) {
    $bad20 = array();
    foreach ($frag as $fid => $f) {
        $n = preg_match_all('/<script\b/i', $f['raw']);
        if ($fid === 'askHelpLightbox') {
            if ($n !== 1 || !preg_match('#<script src="js/penumbra_help_ask\.js(\?[^"]*)?"></script>#', $f['raw'])) $bad20[] = "askHelpLightbox: expected exactly one script tag for js/penumbra_help_ask.js, found $n";
        } elseif ($n > 0) $bad20[] = "$fid: $n script tag(s) in a help fragment";
    }
    $askJs = hv_locate('js/penumbra_help_ask.js', $app, $live);
    if (!$askJs) $bad20[] = 'js/penumbra_help_ask.js not found under --app or --live';
    if (!is_file("$app/help_ask.php")) $bad20[] = 'help_ask.php (the endpoint) not found under --app';
    if (!is_file("$helpDir/ask.php")) $bad20[] = 'help/ask.php (the library) not found';
    $R->check('L20', !$bad20, $bad20 ? implode(' | ', $bad20) : 'the Ask fragment alone carries a script, and it is js/penumbra_help_ask.js; endpoint and library present');
}

// ---------------------------------------------------------------- W1 budgets
echo "  budgets (warnings for the rewrite phases):\n";
printf("  %-34s %6s %6s %6s %6s %6s\n", 'fragment', 'words', 'p>80w', 'li>50w', 'emdash', 'emojiH');
$totals = array(0, 0, 0, 0, 0);
foreach ($frag as $id => $f) {
    $h = $f['html'];
    $words = hv_words($h);
    $longP = 0; if (preg_match_all('/<p\b[^>]*>(.*?)<\/p>/s', $h, $m)) foreach ($m[1] as $x) if (hv_words($x) > 80) $longP++;
    $longLi = 0; if (preg_match_all('/<li\b[^>]*>(.*?)<\/li>/s', $h, $m)) foreach ($m[1] as $x) if (hv_words($x) > 50) $longLi++;
    $emd = preg_match_all('/&mdash;|\xE2\x80\x94/', $h);
    $emoji = 0; if (preg_match_all('/<h4\b[^>]*>(.*?)<\/h4>/s', $h, $m)) foreach ($m[1] as $x) if (preg_match('/&#1[2-9]\d{4};|[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]/u', $x)) $emoji++;
    printf("  %-34s %6d %6d %6d %6d %6d\n", $id, $words, $longP, $longLi, $emd, $emoji);
    $totals[0] += $words; $totals[1] += $longP; $totals[2] += $longLi; $totals[3] += $emd; $totals[4] += $emoji;
}
printf("  %-34s %6d %6d %6d %6d %6d\n", 'TOTAL', $totals[0], $totals[1], $totals[2], $totals[3], $totals[4]);

$failed = $R->failed();
echo $failed ? ('lint RED: ' . implode(' ', $failed) . "\n") : "lint GREEN\n";
exit(count($failed));
