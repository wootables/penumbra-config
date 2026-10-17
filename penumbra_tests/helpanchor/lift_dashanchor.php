<?php
/**
 * lift_dashanchor.php - lift the dashboard help panel block AND the search builder's "?"
 * handler out of a penumbra_dashboard.js for the anchor harness (2026-10-16).
 *
 *   php -n lift_dashanchor.php --dashjs <penumbra_dashboard.js> --out <lifted.js>
 *
 * Writes verbatim (CRLF -> LF): the span from `var LOCAL_HELP = {` to the end of the
 * `#dashHelpOverlay [data-dash-help]` click handler (as penumbra_tests\dashhelplinks lifts
 * it: LOCAL_HELP, _helpHtml, closeHelpPanel, the helper helpHubHref when present, helpJump,
 * openHelpPanel with render(), the panel's handlers), then the delegated click handler of
 * `#searchBuilderLightbox .tab-help-icon` (a local topic opens in the panel, any other
 * through window.open). Works on the live file and the patched stage alike; prints whether
 * the anchor hunks are present.
 */
$o = getopt('', array('dashjs:', 'out:'));
if (empty($o['dashjs']) || empty($o['out'])) { fwrite(STDERR, "usage: --dashjs <penumbra_dashboard.js> --out <lifted.js>\n"); exit(2); }
$s = file_get_contents($o['dashjs']);
if ($s === false) { fwrite(STDERR, "cannot read {$o['dashjs']}\n"); exit(2); }
$s = str_replace("\r\n", "\n", $s);

function span($s, $start, $end, $label) {
    $n = substr_count($s, $start);
    if ($n !== 1) { fwrite(STDERR, "$label: start marker found $n times\n"); exit(2); }
    $p1 = strpos($s, $start);
    $p2 = strpos($s, $end, $p1);
    if ($p2 === false) { fwrite(STDERR, "$label: end marker not found\n"); exit(2); }
    return substr($s, $p1, $p2 + strlen($end) - $p1);
}
$panel   = span($s, '    var LOCAL_HELP = {', "        openHelpPanel(\$(this).attr('data-dash-help'), \$(this).attr('data-jump-to'));\n    });", 'help panel');
$builder = span($s, "    \$(document).on('click', '#searchBuilderLightbox .tab-help-icon', function (e) {", "\n    });\n", 'builder ? handler');
foreach (array("function helpJump(id)", "function openHelpPanel(topic, jumpTo)", "'#dashHelpOverlay a[data-jump-to]") as $must) {
    if (strpos($panel, $must) === false) { fwrite(STDERR, "panel block lacks: $must\n"); exit(2); }
}
if (strpos($builder, 'window.open(') === false) { fwrite(STDERR, "builder handler lacks window.open\n"); exit(2); }
$out = "// lifted from " . basename($o['dashjs']) . " on " . date('Y-m-d H:i') . "\n"
     . "// ---- help panel ----\n" . $panel . "\n"
     . "// ---- search builder ? handler ----\n" . $builder . "\n";
file_put_contents($o['out'], $out);
$present = strpos($panel, 'function helpHubHref(') !== false && strpos($builder, 'helpHubHref(') !== false;
printf("lifted %d + %d bytes -> %s (anchor hunks %s)\n", strlen($panel), strlen($builder), $o['out'], $present ? 'PRESENT' : 'absent');
