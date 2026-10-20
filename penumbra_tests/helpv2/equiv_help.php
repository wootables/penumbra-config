<?php
/**
 * equiv_help.php - the audience gate does what it says.
 *
 * Until 2026-10-19 this file also compared the v2 render to the v1 help body (E1a/E1b/E2/E7,
 * P1-P9); those checks retired with the v1 body. --orig is still accepted (and ignored) so
 * run.php's call shape is unchanged.
 *
 *   php -n equiv_help.php --app=<stage dir> [--orig=<ignored>] [--php=<php.exe>]
 *
 *   E0  the body carries data-audience and keeps the sentinel main.js looks for
 *       ('searchHelpLightbox' = not a login page)
 *   E1c every block closes at depth 0
 *   E3  gate on, viewer: only viewer topics, no "For Administrators" blocks, no stars
 *   E4  gate on, writer: viewer + writer topics, the inner writer blocks back, no admin topic
 *   E5  gate on, admin: everything, legend present
 *   E6  gate off, viewer TOC: every topic listed, the manifest's star count
 *   E-php a PHP diagnostic in any render
 * Exit code = number of failed checks.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'orig:', 'php:'));
if (empty($o['app'])) { fwrite(STDERR, "usage: --app=<stage> [--orig=<ignored>] [--php=<php.exe>]\n"); exit(2); }
$app  = rtrim(str_replace('\\', '/', $o['app']), '/');
$php  = isset($o['php']) ? $o['php'] : PHP_BINARY;
$R = new HvReport();

define('PNB_HELP_V2_FORCE', true);
require_once $app . '/help/manifest.php';
$phase   = function_exists('pnb_help_v2_phase') ? (int)pnb_help_v2_phase() : 0;
$topics  = pnb_help_v2_topics();
$tips    = pnb_help_v2_tips();
$byAud   = array('viewer' => array(), 'writer' => array(), 'admin' => array());
foreach ($topics as $id => $t) $byAud[$t['audience']][] = $id;
$tocItems = array(); $tocStars = 0;
foreach (pnb_help_v2_manifest() as $g) foreach ($g['topics'] as $t) { $tocItems[] = $t['id']; if ($t['audience'] !== 'viewer') $tocStars++; }

echo "audience gate (phase $phase): $app\n";

// --- renders ---
$v2BodyOff   = hv_render($php, $app,  'body', '--v2=1');
$v2TocOff    = hv_render($php, $app,  'toc',  '--v2=1');
$v2BodyGV    = hv_render($php, $app,  'body', '--v2=1 --gate');
$v2BodyGW    = hv_render($php, $app,  'body', '--v2=1 --gate --writer');
$v2BodyGA    = hv_render($php, $app,  'body', '--v2=1 --gate --admin');
$v2TocGV     = hv_render($php, $app,  'toc',  '--v2=1 --gate');
$v2TocGW     = hv_render($php, $app,  'toc',  '--v2=1 --gate --writer');
$v2TocGA     = hv_render($php, $app,  'toc',  '--v2=1 --gate --admin');

foreach (array('v2BodyOff', 'v2TocOff', 'v2BodyGV', 'v2BodyGW', 'v2BodyGA') as $name) {
    // A real PHP diagnostic names the file and line; the help prose also says "Warning:" on its own.
    if (preg_match('/^(?:PHP )?(Parse error|Fatal error|Warning|Notice|Deprecated):\s.*? in \S+\.php on line \d+/m', $$name, $m)) {
        $R->check('E-php', false, "$name: PHP $m[1] in render: " . substr(trim($m[0]), 0, 200));
    }
}

// --- E0 ---
$R->check('E0', strpos($v2BodyOff, 'data-audience="') !== false && strpos($v2BodyOff, 'searchHelpLightbox') !== false,
    'v2 body carries data-audience and the searchHelpLightbox sentinel');

$b2 = hv_blocks($v2BodyOff);
$unclosed = array(); foreach ($b2 as $id => $blk) if (!$blk['closed']) $unclosed[] = $id;
$R->check('E1c', !$unclosed, $unclosed ? 'unclosed v2 blocks: ' . implode(',', $unclosed) : count($b2) . ' v2 blocks all close at depth 0');

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

$failed = $R->failed();
echo $failed ? ('audience gate RED: ' . implode(' ', $failed) . "\n") : "audience gate GREEN\n";
exit(count($failed));
