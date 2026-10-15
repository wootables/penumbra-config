<?php
/**
 * lift_jump.php - lift the Help Center navigation code out of a main.js for the jump harness.
 *
 *   php lift_jump.php --mainjs <path> --out <lifted.js>
 *
 * Writes two blocks verbatim: the `.help-jump-link` click handler (from its
 * `$(document).on('click', '.help-jump-link'` line to the `// --- END: ADD THIS BLOCK ---`
 * marker that follows it) and the hub navigation functions from `_helpTocItemFor` through
 * `window.activateHelpTopic = activateHelpTopic;`. Works on the live file and on the
 * patched stage copy alike, so the harness can run both (the live one is the control).
 */
$o = getopt('', array('mainjs:', 'out:'));
if (empty($o['mainjs']) || empty($o['out'])) { fwrite(STDERR, "usage: --mainjs <main.js> --out <lifted.js>\n"); exit(2); }
$s = file_get_contents($o['mainjs']);
if ($s === false) { fwrite(STDERR, "cannot read {$o['mainjs']}\n"); exit(2); }

function span($s, $start, $end, $label) {
    $p1 = strpos($s, $start);
    if ($p1 === false || substr_count($s, $start) !== 1) { fwrite(STDERR, "$label: start marker not unique\n"); exit(2); }
    $p2 = strpos($s, $end, $p1);
    if ($p2 === false) { fwrite(STDERR, "$label: end marker not found\n"); exit(2); }
    return substr($s, $p1, $p2 + strlen($end) - $p1);
}
$handler = span($s, "    \$(document).on('click', '.help-jump-link', function (e) {", "    // --- END: ADD THIS BLOCK ---", 'jump-link handler');
$nav     = span($s, "    function _helpTocItemFor(fragId) {", "    window.activateHelpTopic = activateHelpTopic;", 'hub navigation');
$out = "// lifted from " . basename($o['mainjs']) . " on " . date('Y-m-d H:i') . "\n"
     . "// ---- hub navigation ----\n" . str_replace("\r\n", "\n", $nav) . "\n"
     . "// ---- jump-link handler ----\n" . str_replace("\r\n", "\n", $handler) . "\n";
file_put_contents($o['out'], $out);
printf("lifted %d + %d bytes -> %s (cross-topic patch %s)\n", strlen($nav), strlen($handler), $o['out'],
    (strpos($handler, 'Cross-topic jump (2026-10-14)') !== false && strpos($nav, 'Owner re-resolution (2026-10-14)') !== false) ? 'PRESENT' : 'absent');
