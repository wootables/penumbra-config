<?php
/**
 * lift_tip.php - lift the shared help-popover code out of a main.js for the tip harness.
 *
 *   php lift_tip.php --mainjs <path> --out <lifted.js>
 *
 * Writes two blocks verbatim: the lazy first-hover wiring (from its `// Hover help on the
 * ? icons of the Settings panel` comment up to the `// ===== END COLUMN OPTIONS` marker)
 * and the popover itself (from `let _helpPopoverInited = false;` up to the `// Handler for
 * the Prompt Loader Dropdown` marker). Works on the live file and on a patched stage copy
 * alike, so tip_harness.ps1 can run both (the unpatched one is the control).
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
    return substr($s, $p1, $p2 - $p1);
}
$wire = span($s, "    // Hover help on the ? icons of the Settings panel", "    // ===== END COLUMN OPTIONS", 'lazy wiring');
$pop  = span($s, "    let _helpPopoverInited = false;", "    // Handler for the Prompt Loader Dropdown", 'popover');
$out = "// lifted from " . basename($o['mainjs']) . " on " . date('Y-m-d H:i') . "\n"
     . "// ---- lazy first-hover wiring ----\n" . str_replace("\r\n", "\n", $wire) . "\n"
     . "// ---- the popover ----\n" . str_replace("\r\n", "\n", $pop) . "\n";
file_put_contents($o['out'], $out);
printf("lifted %d + %d bytes -> %s (helptip patch %s)\n", strlen($wire), strlen($pop), $o['out'],
    strpos($wire, '(2026-10-19, helptip)') !== false ? 'PRESENT' : 'absent');
