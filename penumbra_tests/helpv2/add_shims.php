<?php
/**
 * add_shims.php - insert the v2 switch into the two v1 entry points, byte-safe.
 *
 *   php add_shims.php --stage <stage dir>
 *
 * help_content.php (CRLF): after `require_once 'db_connection.php';` add the
 * shim that hands the request to help/loader.php when v2 is active.
 * help_manifest.php (LF): before the v1 function_exists guard, require
 * help/manifest.php, which defines the v2 penumbra_help_manifest() /
 * penumbra_render_help_toc() first when v2 is active, so the v1 guard skips.
 * Idempotent: a file that already carries its shim is left alone. Prints the
 * CR count before and after (the CRLF file must keep its CRs, the LF file none).
 */
$opts = getopt('', array('stage:'));
if (empty($opts['stage'])) { fwrite(STDERR, "usage: --stage <dir>\n"); exit(2); }
$stage = rtrim($opts['stage'], '/\\');

function splice($path, $anchor, $insert, $where, $label) {
    $s = file_get_contents($path);
    if ($s === false) { fwrite(STDERR, "cannot read $path\n"); exit(2); }
    if (strpos($s, 'help/manifest.php') !== false) { echo "$label: shim already present\n"; return; }
    $pos = strpos($s, $anchor);
    if ($pos === false) { fwrite(STDERR, "$label: anchor not found\n"); exit(2); }
    if (strpos($s, $anchor, $pos + 1) !== false) { fwrite(STDERR, "$label: anchor not unique\n"); exit(2); }
    $crBefore = substr_count($s, "\r");
    if ($where === 'after') $s = substr($s, 0, $pos + strlen($anchor)) . $insert . substr($s, $pos + strlen($anchor));
    else                    $s = substr($s, 0, $pos) . $insert . substr($s, $pos);
    file_put_contents($path, $s);
    echo "$label: shim inserted (CR $crBefore -> " . substr_count($s, "\r") . ")\n";
}

// help_content.php is a CRLF file: the shim lines end in CRLF too.
$eol = "\r\n";
splice(
    "$stage/help_content.php",
    "require_once 'db_connection.php';" . $eol,
    "// Help Center v2 (2026-10-14): while help/v2.on exists (or an admin's preview cookie asks" . $eol .
    "// for it) the body comes from the help/ fragments, and this file is not reached." . $eol .
    "require_once __DIR__ . '/help/manifest.php';" . $eol .
    "if (pnb_help_v2_active()) { require __DIR__ . '/help/loader.php'; return; }" . $eol,
    'after', 'help_content.php'
);

// help_manifest.php is an LF file.
splice(
    "$stage/help_manifest.php",
    "if (!function_exists('penumbra_help_manifest')) {",
    "// Help Center v2 (2026-10-14): help/manifest.php defines penumbra_help_manifest() and\n" .
    "// penumbra_render_help_toc() first while v2 is active, so the v1 definitions below are\n" .
    "// skipped by their own guard. With v2 off it only defines its pnb_help_* helpers.\n" .
    "require_once __DIR__ . '/help/manifest.php';\n\n",
    'before', 'help_manifest.php'
);
