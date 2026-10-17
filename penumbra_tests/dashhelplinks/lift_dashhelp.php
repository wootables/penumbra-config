<?php
/**
 * lift_dashhelp.php - lift the dashboard help panel block out of a penumbra_dashboard.js
 * for the link harness (2026-10-16).
 *
 *   php -n lift_dashhelp.php --dashjs <penumbra_dashboard.js> --out <lifted.js>
 *
 * Writes verbatim (CRLF -> LF) the span from `var LOCAL_HELP = {` to the end of the
 * `#dashHelpOverlay [data-dash-help]` click handler: LOCAL_HELP, _helpHtml, closeHelpPanel,
 * helpJump, openHelpPanel (with its render() link rewiring), the help button handlers and
 * the two delegated link handlers (a[data-jump-to], [data-dash-help]). Works on the live
 * file and the patched stage copy alike, so the harness can run both (the live one is the
 * mutant). The harness page supplies dashKeysOff() and sets _helpHtml itself, so the
 * lifted openHelpPanel() renders synchronously without fetching help_content.php.
 */
$o = getopt('', array('dashjs:', 'out:'));
if (empty($o['dashjs']) || empty($o['out'])) { fwrite(STDERR, "usage: --dashjs <penumbra_dashboard.js> --out <lifted.js>\n"); exit(2); }
$s = file_get_contents($o['dashjs']);
if ($s === false) { fwrite(STDERR, "cannot read {$o['dashjs']}\n"); exit(2); }
$s = str_replace("\r\n", "\n", $s);

$start = '    var LOCAL_HELP = {';
$end   = '        openHelpPanel($(this).attr(\'data-dash-help\'), $(this).attr(\'data-jump-to\'));' . "\n" . '    });';
if (substr_count($s, $start) !== 1) { fwrite(STDERR, "start marker not unique (" . substr_count($s, $start) . ")\n"); exit(2); }
$p1 = strpos($s, $start);
$p2 = strpos($s, $end, $p1);
if ($p2 === false) { fwrite(STDERR, "end marker ([data-dash-help] handler) not found after the start\n"); exit(2); }
$block = substr($s, $p1, $p2 + strlen($end) - $p1);
foreach (array("function helpJump(id)", "function openHelpPanel(topic, jumpTo)", "'#dashHelpOverlay a[data-jump-to]", "'#dashHelpOverlay [data-dash-help]'") as $must) {
    if (strpos($block, $must) === false) { fwrite(STDERR, "lifted block lacks: $must\n"); exit(2); }
}
$out = "// lifted from " . basename($o['dashjs']) . " on " . date('Y-m-d H:i') . "\n" . $block . "\n";
file_put_contents($o['out'], $out);
$patched = strpos($block, "a[data-jump-to]:not([target])") !== false;
printf("lifted %d bytes -> %s (hub-link fix %s)\n", strlen($block), $o['out'], $patched ? 'PRESENT' : 'absent');
