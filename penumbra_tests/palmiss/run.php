<?php
/**
 * penumbra_tests/palmiss/run.php - the Quick actions misses log, server side (2026-10-21).
 *
 * Drives penumbra_palette_misses.php (required from --app: it only defines functions) against
 * an in-memory stand-in for PENUMBRA_PALETTE_MISSES that understands the lib's four statements
 * (INSERT, the purge DELETE, the recent SELECT) and nothing else, so a changed statement changes
 * the answer. Static checks read log_palette_miss.php, analytics_all.php, people_sync_lib.php
 * and the help topic as TEXT.
 *
 *   php.exe -n run.php [--app=<dir>] [--control] [--mutant=NAME | --mutants]
 *
 * --control adds one false assertion: MUST report FAIL 1.
 * Mutants (each MUST turn its named checks red): see $MUTANTS.
 * EXPECTED TAIL: "PASS <n>   FAIL 0".
 */

$app = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
define('PNB_PHPDIR', '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p');   // (PHP_BINARY loses the UNC lead here)
$control = false; $mutant = ''; $allMut = false;
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--app=') === 0) $app = substr($a, 6);
    elseif ($a === '--control') $control = true;
    elseif (strpos($a, '--mutant=') === 0) $mutant = substr($a, 9);
    elseif ($a === '--mutants') $allMut = true;
    else { fwrite(STDERR, "unknown argument $a\n"); exit(2); }
}

// name => [file key, old, new, checks that must go red]
$MUTANTS = array(
    'nolimit'  => array('lib', "if ((int)\$st['count'] >= \$max) { \$allowed = false; }", "if (false) { }", array('limit-61st-refused')),
    'nopurge'  => array('lib', "    pnbPmPurge(\$conn);\n    return 'stored';", "    return 'stored';", array('purge-on-write')),
    'nopurge2' => array('lib', "    if (!\$conn) return null;\n    pnbPmPurge(\$conn);", "    if (!\$conn) return null;", array('purge-on-read')),
    'leak'     => array('lib', "return array('text' => \$text, 'outcome' => \$outcome, 'page' => \$page, 'report' => \$report);", "return array_merge(\$data, array('text' => \$text, 'outcome' => \$outcome, 'page' => \$page, 'report' => \$report));", array('clean-four-keys')),
    'nogate'   => array('ana', "<?php if (!\$anReportScope && \$isAdmin): require_once __DIR__ . '/penumbra_palette_misses.php';", "<?php if (true): require_once __DIR__ . '/penumbra_palette_misses.php';", array('card-admin-gate')),
    'noesc'    => array('lib', "<details><summary>' . htmlspecialchars(\$x['text'])", "<details><summary>' . \$x['text']", array('card-escapes')),
);

function readApp($app, $rel) { $p = $app . DIRECTORY_SEPARATOR . $rel; return is_file($p) ? file_get_contents($p) : ''; }

function runOnce($app, $control, $mut, $MUTANTS) {
    $files = array(
        'lib' => readApp($app, 'penumbra_palette_misses.php'),
        'ep'  => readApp($app, 'log_palette_miss.php'),
        'ana' => readApp($app, 'analytics_all.php'),
        'ddl' => readApp($app, 'people_sync_lib.php'),
        'hlp' => readApp($app, 'help/topics/commandPaletteHelpLightbox.php'),
    );
    if ($mut !== '') {
        list($k, $old, $new) = $MUTANTS[$mut];
        if (substr_count($files[$k], $old) !== 1) { echo "mutant $mut: anchor found " . substr_count($files[$k], $old) . " times\n"; return array('anchor' => false); }
        $files[$k] = str_replace($old, $new, $files[$k]);
    }
    $res = array();
    $ok = function ($name, $cond, $detail = '') use (&$res) { $res[$name] = (bool)$cond; echo ($cond ? 'PASS' : 'FAIL') . "  $name" . ($cond ? '' : "   $detail") . "\n"; };

    // the lib runs in a child php so a mutant's copy never collides with another run's functions
    $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_palmiss_' . getmypid() . '_' . mt_rand();
    @mkdir($tmp);
    file_put_contents("$tmp/lib.php", $files['lib']);
    file_put_contents("$tmp/probe.php", file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'probe.php'));
    // proc_open with an ARRAY: no shell, so the UNC php path survives (cmd.exe drops a leading \\)
    $pp = proc_open(array(PNB_PHPDIR . '\php.exe', '-n', '-d', 'extension=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext/php_mbstring.dll',   /* forward slashes: -d's ini parse eats a leading \\ */ "$tmp/probe.php", "$tmp/lib.php", $tmp),
                    array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, sys_get_temp_dir());
    $raw = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]); proc_close($pp);
    $probe = json_decode($raw, true);
    $ok('probe-ran', is_array($probe) && count($probe) >= 29, substr($raw, 0, 800));
    if (!is_array($probe)) $probe = array();
    foreach ($probe as $name => $v) $ok($name, $v === true, is_string($v) ? $v : json_encode($v));
    foreach (glob("$tmp/rl/*") ?: array() as $f) @unlink($f); @rmdir("$tmp/rl");
    foreach (glob("$tmp/*") as $f) @unlink($f); @rmdir($tmp);

    // ---- static: the endpoint is write-only, signed-in, CSRF-guarded
    $ep = $files['ep'];
    $ok('ep-exists', $ep !== '');
    $ok('ep-csrf', strpos($ep, 'penumbraCsrfGuard();') !== false);
    $ok('ep-204-no-body', strpos($ep, 'http_response_code(204);') !== false && !preg_match('/\b(echo|print|var_dump|json_encode|readfile)\b/', preg_replace('#/\*.*?\*/#s', '', $ep)));
    // ---- static: the card renders only for an admin on Platform scope, and the page 403s a non-admin
    $ana = $files['ana'];
    $ok('card-admin-gate', strpos($ana, "<?php if (!\$anReportScope && \$isAdmin): require_once __DIR__ . '/penumbra_palette_misses.php';") !== false
        && substr_count($ana, 'pnbPmCardBody(') === 1 && strpos($ana, 'pnbPmCardBody(') > strpos($ana, "<?php if (!\$anReportScope && \$isAdmin): require_once"));
    $ok('page-403-nonadmin', strpos($ana, "} elseif (!\$isAdmin) {\n    http_response_code(403);") !== false);
    $ok('card-title', strpos($ana, 'Top unmatched Quick actions searches') !== false);
    // ---- static: the table comes from the sync job's DDL list, with DELETE for the purge
    $ddl = $files['ddl'];
    $ok('ddl-table', strpos($ddl, "'name' => 'PENUMBRA_PALETTE_MISSES', 'sql' =>") !== false && strpos($ddl, 'CREATE INDEX $schema.IX_PALETTE_MISSES_AT') !== false);
    $ok('ddl-grant', strpos($ddl, 'GRANT SELECT, INSERT, DELETE ON $schema.PENUMBRA_PALETTE_MISSES TO $reader') !== false);
    // ---- help: one line that says admins see it
    $ok('help-line', strpos($files['hlp'], 'administrators can see in Platform Metrics what people look for') !== false);
    $noEm = true; foreach (array('ana', 'hlp', 'lib') as $k) if (strpos($files[$k], "\xE2\x80\x94") !== false && $k !== 'ana') $noEm = false;
    $ok('no-emdash', $noEm && !preg_match('/Top unmatched[^<]*\xE2\x80\x94/', $ana));
    if ($control) $ok('control-false', false, 'the control assertion');
    return $res;
}

if ($allMut || $mutant !== '') {
    $names = $allMut ? array_keys($MUTANTS) : array($mutant);
    $bad = 0;
    foreach ($names as $m) {
        echo "---- mutant $m\n";
        $r = runOnce($app, false, $m, $MUTANTS);
        $red = array_keys(array_filter($r, function ($v) { return !$v; }));
        $miss = array_diff($MUTANTS[$m][3], $red);
        $good = !isset($r['anchor']) && !$miss;
        $bad += !$good;
        echo ($good ? 'PASS' : 'FAIL') . "  mutant $m turns " . implode(' ', $MUTANTS[$m][3]) . " red   [red: " . implode(' ', $red) . "]\n";
    }
    echo "MUTANTS ok=" . (count($names) - $bad) . " bad=$bad\n";
    exit($bad ? 1 : 0);
}
$r = runOnce($app, $control, '', $MUTANTS);
$p = count(array_filter($r)); $f = count($r) - $p;
echo "PASS $p   FAIL $f\n";
exit($f ? 1 : 0);
