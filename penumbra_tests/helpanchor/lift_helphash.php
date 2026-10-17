<?php
/**
 * lift_helphash.php - lift the Help Center deep-link parse out of a main.js for the hash
 * harness (2026-10-16).
 *
 *   php -n lift_helphash.php --mainjs <path> --out <lifted.js>
 *
 * Writes (CRLF -> LF) the `_helpTocItemFor` function verbatim and the boot-time `_helpHash`
 * block (from `var _helpHash = String(window.location.hash || '');` to the `}` that closes
 * its `if`) wrapped as `function runHelpHash() { ... }`, so the harness page can set
 * location.hash and run the block again per case. Works on the live file and the patched
 * stage alike (the live one is the control); prints whether the anchor hunk is present.
 */
$o = getopt('', array('mainjs:', 'out:'));
if (empty($o['mainjs']) || empty($o['out'])) { fwrite(STDERR, "usage: --mainjs <main.js> --out <lifted.js>\n"); exit(2); }
$s = file_get_contents($o['mainjs']);
if ($s === false) { fwrite(STDERR, "cannot read {$o['mainjs']}\n"); exit(2); }
$s = str_replace("\r\n", "\n", $s);

function span($s, $start, $end, $label) {
    $n = substr_count($s, $start);
    if ($n !== 1) { fwrite(STDERR, "$label: start marker found $n times\n"); exit(2); }
    $p1 = strpos($s, $start);
    $p2 = strpos($s, $end, $p1);
    if ($p2 === false) { fwrite(STDERR, "$label: end marker not found\n"); exit(2); }
    return substr($s, $p1, $p2 + strlen($end) - $p1);
}
$toc  = span($s, "    function _helpTocItemFor(fragId) {", "\n    }\n", 'TOC resolver');
$hash = span($s, "    var _helpHash = String(window.location.hash || '');", "\n    }\n", 'hash block');
foreach (array("openHelpCenter(", "'#help='") as $must) {
    if (strpos($hash, $must) === false) { fwrite(STDERR, "hash block lacks: $must\n"); exit(2); }
}
$out = "// lifted from " . basename($o['mainjs']) . " on " . date('Y-m-d H:i') . "\n"
     . "// ---- TOC resolver ----\n" . $toc . "\n"
     . "// ---- deep-link parse, wrapped so the harness can run it per hash ----\n"
     . "function runHelpHash() {\n" . $hash . "}\n";
file_put_contents($o['out'], $out);
printf("lifted %d + %d bytes -> %s (anchor hunk %s)\n", strlen($toc), strlen($hash), $o['out'],
    strpos($hash, '#help=<topicId>:<anchorId> (2026-10-16)') !== false ? 'PRESENT' : 'absent');
