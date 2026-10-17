<?php
/**
 * patch_dashanchor.php - the dashboard's hub links carry their section anchor (2026-10-16).
 *
 *   php -n patch_dashanchor.php --file <js/penumbra_dashboard.js> [--check]
 *
 * Five hunks, byte-safe (CRLF kept, exact anchor text, each applied once; --check only
 * reports): a helper helpHubHref(topic, jumpTo) builds index.php#help=<topic>[:<anchor>]
 * (the anchor as strict as a topic id, else left off), and the three places that build a
 * hub link use it - the search builder's "?" icon (window.open), the panel's "Full Help
 * Center" link (also the "Open the Help Center" link of its failure note) and render()'s
 * rewired cross-topic links, which now keep their data-jump-to. The fifth hunk is a comment.
 * main.js parses the anchor (patch_helphash.php); until that is deployed the anchor is
 * ignored there (the id regex refuses the colon: the link opens the general topic).
 */
$o = getopt('', array('file:', 'check'));
if (empty($o['file'])) { fwrite(STDERR, "usage: --file <penumbra_dashboard.js> [--check]\n"); exit(2); }
$path = $o['file'];
$s = file_get_contents($path);
if ($s === false) { fwrite(STDERR, "cannot read $path\n"); exit(2); }
$crBefore = substr_count($s, "\r");
$eol = "\r\n";
if (strpos($s, 'function helpHubHref(') !== false) { echo "hunks already present\n"; echo "CR $crBefore -> $crBefore (0 new lines)\n"; exit(0); }

$hunks = array(
    array('helper after closeHelpPanel',
        "    function closeHelpPanel() { \$('#dashHelpOverlay').remove(); }" . $eol,
        "    function closeHelpPanel() { \$('#dashHelpOverlay').remove(); }" . $eol
        . "    // The Help Center's deep link, index.php#help=<topic>[:<anchor>] (main.js parses it," . $eol
        . "    // 2026-10-16): a heading id after the colon lands the topic on that section, so a hub" . $eol
        . "    // link keeps its data-jump-to. The anchor is as strict as a topic id, else left off." . $eol
        . "    function helpHubHref(topic, jumpTo) {" . $eol
        . "        jumpTo = String(jumpTo || '');" . $eol
        . "        return 'index.php#help=' + topic + (/^[A-Za-z0-9_-]+$/.test(jumpTo) ? ':' + jumpTo : '');" . $eol
        . "    }" . $eol),
    array('search builder ? icon (window.open)',
        "        window.open('index.php#help=' + encodeURIComponent(tgt), '_blank', 'noopener');" . $eol,
        "        window.open(helpHubHref(encodeURIComponent(tgt), \$(this).attr('data-jump-to')), '_blank', 'noopener');" . $eol),
    array('Full Help Center link',
        "        var href = 'index.php#help=' + topic;" . $eol,
        "        var href = helpHubHref(topic, jumpTo);" . $eol),
    array('render() hub links',
        "                else { \$(this).attr({ href: 'index.php#help=' + (tgt || 'whatIsPenumbraLightbox'), target: '_blank', rel: 'noopener' }); }" . $eol,
        "                else { \$(this).attr({ href: helpHubHref(tgt || 'whatIsPenumbraLightbox', \$(this).attr('data-jump-to')), target: '_blank', rel: 'noopener' }); }" . $eol),
    array('render() comment',
        "            // this page shows opens in this panel, any other opens the hub there." . $eol,
        "            // this page shows opens in this panel, any other opens the hub there, at its section." . $eol),
);
foreach ($hunks as $h) {
    $n = substr_count($s, $h[1]);
    if ($n !== 1) { fwrite(STDERR, "hunk '{$h[0]}': anchor found $n times (expected exactly 1): the file drifted, patch by hand\n"); exit(2); }
}
foreach ($hunks as $h) {
    echo "hunk ({$h[0]}): " . (isset($o['check']) ? 'would apply' : 'applied') . "\n";
    if (!isset($o['check'])) $s = str_replace($h[1], $h[2], $s);
}
if (!isset($o['check'])) {
    if (file_put_contents($path, $s) === false) { fwrite(STDERR, "cannot write $path\n"); exit(2); }
}
$crAfter = substr_count($s, "\r");
echo "CR $crBefore -> $crAfter (" . ($crAfter - $crBefore) . " new lines)\n";
