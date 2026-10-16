<?php
/**
 * equiv_help.php - v2 renders what v1 rendered (phase 0) or loses nothing of it (phase 1+),
 * and the audience gate does what it says.
 *
 *   php -n equiv_help.php --app=<stage dir> --orig=<dir holding the v1 files> [--php=<php.exe>]
 *
 * Always
 *   E0  the stage's v2 body is really v2 (carries data-audience) and keeps the sentinel
 *       main.js looks for ('searchHelpLightbox' = not a login page)
 *   E1c every v2 block closes at depth 0
 *   E3  gate on, viewer: only viewer topics, no "For Administrators" blocks, no stars
 *   E4  gate on, writer: viewer + writer topics, the inner writer blocks back, no admin topic
 *   E5  gate on, admin: everything, legend present
 *   E6  gate off, viewer TOC: every topic listed, the manifest's star count
 *   E7  v2 forced OFF on the stage: the body equals v1's (the rollback path works)
 * Phase 0 (pnb_help_v2_phase() == 0: a pure split)
 *   E1a/E1b v1 rendered as an admin == v2 rendered for a viewer with the gate off, block by block
 *   E2  the v1 TOC == the v2 TOC with the gate off
 * Phase 1+ (restructured content; the manifest lists the topics it touched)
 *   P1  every v1 topic / tip-store block id still renders in v2
 *   P2  every v1 element id still exists in v2 (deep links and jump anchors are a contract)
 *   P3  every v1 hover-tip key is still defined
 *   P5  every v1 TOC id is still a TOC item, an extra of one, or an alias
 *   P6  total words within 85%..105% of v1 (moves and pointers, not deletions or bloat)
 *   P7  every topic the manifest does NOT list as touched is identical to v1 after normalisation
 *   P8  every topic new in v2 has one .help-topic div, one h3, and at least 20 words
 * Exit code = number of failed checks.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'orig:', 'php:'));
if (empty($o['app']) || empty($o['orig'])) { fwrite(STDERR, "usage: --app=<stage> --orig=<orig> [--php=<php.exe>]\n"); exit(2); }
$app  = rtrim(str_replace('\\', '/', $o['app']), '/');
$orig = rtrim(str_replace('\\', '/', $o['orig']), '/');
$php  = isset($o['php']) ? $o['php'] : PHP_BINARY;
$R = new HvReport();

define('PNB_HELP_V2_FORCE', true);
require_once $app . '/help/manifest.php';
$phase   = function_exists('pnb_help_v2_phase') ? (int)pnb_help_v2_phase() : 0;
$touched = function_exists('pnb_help_v2_touched') ? pnb_help_v2_touched() : array();
$topics  = pnb_help_v2_topics();
$tips    = pnb_help_v2_tips();
$byAud   = array('viewer' => array(), 'writer' => array(), 'admin' => array());
foreach ($topics as $id => $t) $byAud[$t['audience']][] = $id;
$tocItems = array(); $tocStars = 0;
foreach (pnb_help_v2_manifest() as $g) foreach ($g['topics'] as $t) { $tocItems[] = $t['id']; if ($t['audience'] !== 'viewer') $tocStars++; }

echo "equivalence (phase $phase): v1 ($orig) vs v2 ($app)\n";

// --- renders ---
$v1Body      = hv_render($php, $orig, 'body', '--admin --v2=0');   // --v2=0 so --orig may be the live tree itself
$v2BodyOff   = hv_render($php, $app,  'body', '--v2=1');
$v1Toc       = hv_render($php, $orig, 'toc',  '--v2=0');
$v2TocOff    = hv_render($php, $app,  'toc',  '--v2=1');
$v2BodyGV    = hv_render($php, $app,  'body', '--v2=1 --gate');
$v2BodyGW    = hv_render($php, $app,  'body', '--v2=1 --gate --writer');
$v2BodyGA    = hv_render($php, $app,  'body', '--v2=1 --gate --admin');
$v2TocGV     = hv_render($php, $app,  'toc',  '--v2=1 --gate');
$v2TocGW     = hv_render($php, $app,  'toc',  '--v2=1 --gate --writer');
$v2TocGA     = hv_render($php, $app,  'toc',  '--v2=1 --gate --admin');
$stageV1Body = hv_render($php, $app,  'body', '--v2=0 --admin');

foreach (array('v1Body', 'v2BodyOff', 'v1Toc', 'v2TocOff', 'v2BodyGV', 'v2BodyGW', 'v2BodyGA', 'stageV1Body') as $name) {
    // A real PHP diagnostic names the file and line; the help prose also says "Warning:" on its own.
    if (preg_match('/^(?:PHP )?(Parse error|Fatal error|Warning|Notice|Deprecated):\s.*? in \S+\.php on line \d+/m', $$name, $m)) {
        $R->check('E-php', false, "$name: PHP $m[1] in render: " . substr(trim($m[0]), 0, 200));
    }
}

// --- E0 ---
$R->check('E0', strpos($v2BodyOff, 'data-audience="') !== false && strpos($v2BodyOff, 'searchHelpLightbox') !== false,
    'v2 body carries data-audience and the searchHelpLightbox sentinel');

$b1 = hv_blocks($v1Body); $b2 = hv_blocks($v2BodyOff);
$unclosed = array(); foreach ($b2 as $id => $blk) if (!$blk['closed']) $unclosed[] = $id;
$R->check('E1c', !$unclosed, $unclosed ? 'unclosed v2 blocks: ' . implode(',', $unclosed) : count($b2) . ' v2 blocks all close at depth 0');

if ($phase === 0) {
    // ----------------------------------------------------------- E1 / E2 (identity)
    $ids1 = array_keys($b1); $ids2 = array_keys($b2); sort($ids1); sort($ids2);
    $R->check('E1a', $ids1 === $ids2 && count($ids1) === 34, 'same block ids: v1=' . count($ids1) . ' v2=' . count($ids2)
        . ($ids1 !== $ids2 ? ' diff=' . implode(',', array_merge(array_diff($ids1, $ids2), array_diff($ids2, $ids1))) : ''));
    $mism = hv_block_mismatches($b1, $b2, array_keys($b1));
    $R->check('E1b', !$mism, $mism ? implode(' | ', array_slice($mism, 0, 4)) : 'every block identical after normalisation');
    $t1 = implode("\n", hv_normalise_lines(preg_split('/\r\n|\n|\r/', str_replace('><', ">\n<", $v1Toc))));
    $t2 = implode("\n", hv_normalise_lines(preg_split('/\r\n|\n|\r/', str_replace('><', ">\n<", $v2TocOff))));
    $R->check('E2', $t1 === $t2, $t1 === $t2 ? 'TOC identical after normalisation' : 'TOC differs: ' . substr(hv_first_diff($t1, $t2), 0, 160));
} else {
    // ----------------------------------------------------------- P1..P8 (nothing lost)
    $missingBlocks = array(); foreach ($b1 as $id => $blk) if (!isset($b2[$id])) $missingBlocks[] = $id;
    $R->check('P1', !$missingBlocks, $missingBlocks ? 'v1 blocks missing in v2: ' . implode(',', $missingBlocks) : count($b1) . ' v1 blocks all render in v2 (v2 has ' . count($b2) . ')');

    $ids1 = hv_ids(hv_html_only($v1Body)); $ids2 = hv_ids(hv_html_only($v2BodyOff));
    $lostIds = array_diff($ids1, $ids2);
    $R->check('P2', !$lostIds, $lostIds ? count($lostIds) . ' v1 ids gone: ' . implode(',', array_slice($lostIds, 0, 10)) : count($ids1) . ' v1 element ids all present (v2 has ' . count($ids2) . ')');

    $keys1 = hv_tip_keys($v1Body); $keys2 = hv_tip_keys($v2BodyOff);
    $lostKeys = array_diff($keys1, $keys2);
    $R->check('P3', !$lostKeys, $lostKeys ? 'tip keys gone: ' . implode(',', $lostKeys) : count($keys1) . ' v1 tip keys all defined');

    $toc1 = array(); if (preg_match_all('/data-topic="([^"]+)"/', $v1Toc, $m)) $toc1 = $m[1];
    $reach = array();
    if (preg_match_all('/data-topic="([^"]+)"|data-extra="([^"]*)"|data-aliases="([^"]*)"/', $v2TocOff, $m, PREG_SET_ORDER)) {
        foreach ($m as $hit) foreach (array(1, 2, 3) as $g) if (!empty($hit[$g])) foreach (preg_split('/\s+/', $hit[$g]) as $x) if ($x !== '') $reach[$x] = 1;
    }
    $lostToc = array(); foreach ($toc1 as $x) if (!isset($reach[$x])) $lostToc[] = $x;
    $R->check('P5', !$lostToc, $lostToc ? 'v1 TOC ids no longer reachable: ' . implode(',', $lostToc) : count($toc1) . ' v1 TOC ids still a TOC item, extra or alias (v2 TOC: ' . substr_count($v2TocOff, 'help-toc-item') . ' items)');

    $w1 = hv_words(hv_html_only($v1Body)); $w2 = hv_words(hv_html_only($v2BodyOff));
    $ratio = $w1 ? $w2 / $w1 : 0;
    $floor = ($phase >= 2) ? 0.60 : 0.85;   // phase 2 rewrites tighten the viewer topics; P9 guards the facts
    $R->check('P6', $ratio >= $floor && $ratio <= 1.05, sprintf('words v1=%d v2=%d (%.1f%%, floor %d%%)', $w1, $w2, $ratio * 100, $floor * 100));

    // P9: every fact-bearing token of a touched v1 topic (code examples, key names, numbers in
    // prose) still exists SOMEWHERE in v2 (a canonical may have moved it), unless the manifest
    // lists it as dropped on purpose.
    $dropped = function_exists('pnb_help_v2_dropped_tokens') ? pnb_help_v2_dropped_tokens() : array();
    $v2Tokens = hv_fact_tokens($v2BodyOff);
    $v2TokenSet = array_flip($v2Tokens);
    $v2TextLower = strtolower(html_entity_decode(strip_tags(hv_html_only($v2BodyOff)), ENT_QUOTES, 'UTF-8'));
    $lost = array(); $checked = 0;
    foreach ($touched as $tid) {
        if (!isset($b1[$tid])) continue;
        $html1 = implode("\n", $b1[$tid]['lines']);
        $allow = isset($dropped[$tid]) ? array_keys($dropped[$tid]) : array();
        foreach (hv_fact_tokens($html1) as $tok) {
            $checked++;
            if (isset($v2TokenSet[$tok])) continue;
            if (in_array($tok, $allow, true)) continue;
            // a token may survive as plain prose (e.g. a key name no longer in <kbd>)
            if (strlen($tok) >= 2 && strpos($v2TextLower, strtolower($tok)) !== false) continue;
            $lost[] = "$tid: " . json_encode($tok);
        }
    }
    $R->check('P9', !$lost, $lost ? count($lost) . ' fact tokens of touched topics missing in v2: ' . implode(' | ', array_slice($lost, 0, 12)) : "$checked fact tokens of touched topics all present in v2 (" . count($v2Tokens) . ' distinct in v2)');

    $untouched = array(); foreach ($b1 as $id => $blk) if (!in_array($id, $touched, true)) $untouched[] = $id;
    $mism = hv_block_mismatches($b1, $b2, $untouched);
    $R->check('P7', !$mism, $mism ? implode(' | ', array_slice($mism, 0, 4)) : count($untouched) . ' untouched blocks identical to v1 (' . count($touched) . ' listed as touched)');

    $newIds = array(); foreach ($b2 as $id => $blk) if (!isset($b1[$id])) $newIds[] = $id;
    $bad = array();
    foreach ($newIds as $id) {
        $html = implode("\n", $b2[$id]['lines']);
        if (preg_match_all('/<div id="' . preg_quote($id, '/') . '" class="help-topic"/', $html) !== 1) $bad[] = "$id: topic div";
        if (preg_match_all('/<h3\b/', $html) !== 1) $bad[] = "$id: h3 count " . preg_match_all('/<h3\b/', $html);
        if (hv_words($html) < 20) $bad[] = "$id: too short";
    }
    $R->check('P8', !$bad, $bad ? implode(', ', $bad) : count($newIds) . ' new topics well-formed (' . implode(',', $newIds) . ')');
}

// --- E3 / E4 / E5 ---
function hv_ids_present($html, $ids) { $p = array(); foreach ($ids as $id) if (strpos($html, '<div id="' . $id . '"') !== false) $p[] = $id; return $p; }
$v = hv_ids_present($v2BodyGV, array_keys($topics)); sort($v); $expV = $byAud['viewer']; sort($expV);
$R->check('E3a', $v === $expV, 'gate on, viewer: topics=' . count($v) . ' expected=' . count($expV)
    . ($v !== $expV ? ' diff=' . implode(',', array_merge(array_diff($v, $expV), array_diff($expV, $v))) : ''));
$R->check('E3b', count(hv_ids_present($v2BodyGV, $tips)) === 5, 'gate on, viewer: all 5 tip stores present');
$inner = array('pvh-admin', 'vbh-admin', 'snh-admin');
$innerV = array(); foreach ($inner as $x) if (strpos($v2BodyGV, 'id="' . $x . '"') !== false) $innerV[] = $x;
$R->check('E3c', !$innerV, $innerV ? 'viewer sees inner writer blocks: ' . implode(',', $innerV) : 'inner "For Administrators" blocks hidden from a viewer');
$viewerTocExpected = count(array_filter($byAud['viewer'], function ($id) use ($topics) { return empty($topics[$id]['extra_of']); }));
$R->check('E3d', strpos($v2TocGV, 'help-toc-admin-star') === false && substr_count($v2TocGV, 'help-toc-item') === $viewerTocExpected,
    'gate on, viewer TOC: no stars, ' . substr_count($v2TocGV, 'help-toc-item') . " items (expected $viewerTocExpected)");

$w = hv_ids_present($v2BodyGW, array_keys($topics)); sort($w); $expW = array_merge($byAud['viewer'], $byAud['writer']); sort($expW);
$R->check('E4a', $w === $expW, 'gate on, writer: topics=' . count($w) . ' expected=' . count($expW)
    . ($w !== $expW ? ' diff=' . implode(',', array_merge(array_diff($w, $expW), array_diff($expW, $w))) : ''));
$innerW = array(); foreach ($inner as $x) if (strpos($v2BodyGW, 'id="' . $x . '"') !== false) $innerW[] = $x;
$R->check('E4b', count($innerW) === 3 && strpos($v2BodyGW, '<div id="repositoryHelpLightbox"') === false, 'gate on, writer: inner blocks back (' . count($innerW) . '/3), admin topic absent');
$adminTocCount = count(array_filter($byAud['admin'], function ($id) use ($topics) { return empty($topics[$id]['extra_of']); }));
$R->check('E4c', substr_count($v2TocGW, 'help-toc-item') === count($tocItems) - $adminTocCount, 'gate on, writer TOC items=' . substr_count($v2TocGW, 'help-toc-item') . ' (expected ' . (count($tocItems) - $adminTocCount) . ')');

$a = hv_ids_present($v2BodyGA, array_keys($topics));
$R->check('E5', count($a) === count($topics) && substr_count($v2TocGA, 'help-toc-item') === count($tocItems) && strpos($v2TocGA, 'help-toc-legend') !== false,
    'gate on, admin: all ' . count($a) . ' topics, ' . substr_count($v2TocGA, 'help-toc-item') . ' TOC items, legend present');

// --- E6 ---
$starsOff = preg_match_all('/help-toc-admin-star" title=/', $v2TocOff);
$R->check('E6', substr_count($v2TocOff, 'help-toc-item') === count($tocItems) && $starsOff === $tocStars,
    'gate off TOC: ' . substr_count($v2TocOff, 'help-toc-item') . ' items, ' . $starsOff . " stars (manifest says $tocStars)");

// --- E7 ---
$s1 = hv_blocks($stageV1Body);
$same = (count($s1) === count($b1)); $why = 'blocks ' . count($s1) . ' vs ' . count($b1);
if ($same) { $mm = hv_block_mismatches($b1, $s1, array_keys($b1)); if ($mm) { $same = false; $why = $mm[0]; } }
$R->check('E7', $same && strpos($stageV1Body, 'data-audience="') === false, 'v2 forced off on the stage renders the v1 body (' . $why . ', no data-audience)');

$failed = $R->failed();
echo $failed ? ('equivalence RED: ' . implode(' ', $failed) . "\n") : "equivalence GREEN\n";
exit(count($failed));

// ---------------------------------------------------------------- helpers
function hv_block_mismatches(array $ref, array $cand, array $ids) {
    $mism = array();
    foreach ($ids as $id) {
        if (!isset($ref[$id])) continue;
        if (!isset($cand[$id])) { $mism[] = "$id missing"; continue; }
        $a = hv_normalise_lines($ref[$id]['lines']); $b = hv_normalise_lines($cand[$id]['lines']);
        if ($a !== $b) {
            $k = 0; while ($k < min(count($a), count($b)) && $a[$k] === $b[$k]) $k++;
            $mism[] = "$id differs at normalised line " . ($k + 1) . ': v1=' . json_encode(isset($a[$k]) ? substr($a[$k], 0, 90) : '<eof>')
                    . ' v2=' . json_encode(isset($b[$k]) ? substr($b[$k], 0, 90) : '<eof>');
        }
    }
    return $mism;
}
function hv_ids($html) { $ids = array(); if (preg_match_all('/\sid="([^"]+)"/', $html, $m)) $ids = array_values(array_unique($m[1])); return $ids; }
/**
 * Fact-bearing tokens of a help HTML: the text of every <code> and <kbd>, and every number of
 * two or more digits in the prose (limits, counts, years). Decoded, trimmed, whitespace-collapsed.
 */
function hv_fact_tokens($html) {
    $html = hv_html_only($html);
    // The scheduler topics print the live clock and live dates (date('g:i A'), SYSDATE rows); the v1 and v2
    // renders are seconds apart, so a minute or day boundary would turn a live number into a "lost" token
    // (it did once, 2026-10-15). Normalise them exactly as hv_normalise_lines does for the block comparison.
    $html = preg_replace('/\b\d{1,2}:\d{2} [AP]M\b/', 'H:MM', $html);
    $html = preg_replace('/\b\d{2}-[A-Z]{3}-\d{2}\b/', 'DD-MON-YY', $html);
    $html = preg_replace('/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/', 'Month D, YYYY', $html);
    $toks = array();
    if (preg_match_all('/<(code|kbd)\b[^>]*>(.*?)<\/\1>/s', $html, $m)) {
        foreach ($m[2] as $x) {
            $t = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($x), ENT_QUOTES, 'UTF-8')));
            if ($t !== '' && strlen($t) <= 120) $toks[$t] = 1;
        }
    }
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8');
    if (preg_match_all('/(?<![\w.])\d{2,}(?:[.,]\d+)?(?![\w])/', $text, $m)) foreach ($m[0] as $n) $toks[$n] = 1;
    return array_keys($toks);
}
function hv_tip_keys($html) { $k = array(); if (preg_match_all('/<div data-tip="([^"]+)"/', $html, $m)) $k = array_values(array_unique($m[1])); return $k; }
function hv_first_diff($a, $b) {
    $len = min(strlen($a), strlen($b));
    for ($p = 0; $p < $len && $a[$p] === $b[$p]; $p++) {}
    return 'at ' . $p . ': v1=' . json_encode(substr($a, $p, 60)) . ' v2=' . json_encode(substr($b, $p, 60));
}
