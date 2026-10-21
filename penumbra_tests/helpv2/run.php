<?php
/**
 * run.php - the helpv2 suite runner.
 *
 *   php -n run.php --app=<dir> --orig=<dir> [--live=<webroot>] [--out=<dir>] [--php=<php.exe>] [--mutants] [--skip-coverage] [--skip-jump]
 *
 *   --app   the tree under test: the stage, or the live webroot once deployed
 *   --orig  the tree holding the v1 files to compare against; the live webroot is fine
 *           (the equivalence test forces v1 there), or the deploy's orig/ copy
 *   --live  where index.php / main.js / the dashboard files are read when --app lacks them
 *   --out   scratch dir for renders, caches and the coverage report (default: %TEMP%\helpv2_<stamp>)
 *
 * Runs lint_help (L*), equiv_help (E*), retrieval_smoke (R*), the jump harness (J1 on
 * --app's js/main.js when it carries the 2026-10-14 patch, J2 the control on --orig's main.js)
 * and the coverage map (report only), then prints RESULT: GREEN or RED. With --mutants every
 * mutant copies --app, breaks one thing and must turn its own checks red and nothing else: the
 * suite's control. Mutant expectations follow the manifest's phase (0 = pure split, 1+ = restructured).
 * Exit code = failed checks + failed mutants.
 */
require_once __DIR__ . '/lib.php';
$o = getopt('', array('app:', 'orig:', 'live:', 'out:', 'php:', 'mutants', 'skip-coverage', 'skip-jump'));
if (empty($o['app']) || empty($o['orig'])) { fwrite(STDERR, "usage: --app=<dir> --orig=<dir> [--live=<webroot>] [--out=<dir>] [--php=<php.exe>] [--mutants] [--skip-coverage] [--skip-jump]\n"); exit(2); }
$app  = rtrim(str_replace('\\', '/', $o['app']), '/');
$orig = rtrim(str_replace('\\', '/', $o['orig']), '/');
$live = isset($o['live']) ? rtrim(str_replace('\\', '/', $o['live']), '/') : '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$php  = isset($o['php']) ? $o['php'] : PHP_BINARY;
$out  = isset($o['out']) ? rtrim(str_replace('\\', '/', $o['out']), '/') : rtrim(str_replace('\\', '/', sys_get_temp_dir()), '/') . '/helpv2_' . date('Ymd_His');
if (!is_dir($out)) mkdir($out, 0777, true);

define('PNB_HELP_V2_FORCE', true);
require_once $app . '/help/manifest.php';
$phase = function_exists('pnb_help_v2_phase') ? (int)pnb_help_v2_phase() : 0;

function child($php, $script, $args) {
    $cmd = escapeshellarg($php) . ' -n ' . escapeshellarg(__DIR__ . '/' . $script) . ' ' . $args . ' 2>&1';
    exec($cmd, $lines, $code);
    return array('code' => $code, 'out' => implode("\n", $lines));
}
function redIds($text) {
    $ids = array();
    if (preg_match_all('/^\s*FAIL\s+(\S+)/m', $text, $m)) $ids = array_values(array_unique($m[1]));
    return $ids;
}
/** Run the headless jump harness through PowerShell; returns array(ok, text). */
function jumpHarness($mainJs, $outDir, $control) {
    $ps1 = str_replace('/', '\\', __DIR__ . '/jump_harness.ps1');
    $here = str_replace('/', '\\', __DIR__);
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText(\'' . $ps1 . '\'))) -MainJs \'' . str_replace('/', '\\', $mainJs) . '\' -Here \'' . $here . '\' -Out \'' . str_replace('/', '\\', $outDir) . '\'' . ($control ? ' -ExpectControl' : '') . '" 2>&1';
    exec($cmd, $lines, $code);
    $text = implode("\n", $lines);
    return array(strpos($text, 'RESULT: GREEN') !== false, $text);
}

/** Run the hover-tip harness (2026-10-19, helptip) through PowerShell; returns array(ok, text). */
function tipHarness($mainJs, $outDir, $control) {
    $ps1 = str_replace('/', '\\', __DIR__ . '/tip_harness.ps1');
    $here = str_replace('/', '\\', __DIR__);
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText(\'' . $ps1 . '\'))) -MainJs \'' . str_replace('/', '\\', $mainJs) . '\' -Here \'' . $here . '\' -Out \'' . str_replace('/', '\\', $outDir) . '\'' . ($control ? ' -ExpectControl' : '') . '" 2>&1';
    exec($cmd, $lines, $code);
    $text = implode("\n", $lines);
    return array(strpos($text, 'RESULT: GREEN') !== false, $text);
}

/** Run the Ask page's client harness through PowerShell; returns array(ok, text). */
function askHarness($app, $outDir) {
    $ps1 = str_replace('/', '\\', __DIR__ . '/ask_harness.ps1');
    $here = str_replace('/', '\\', __DIR__);
    $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create([IO.File]::ReadAllText(\'' . $ps1 . '\'))) -App \'' . str_replace('/', '\\', $app) . '\' -Here \'' . $here . '\' -Out \'' . str_replace('/', '\\', $outDir) . '\'" 2>&1';
    exec($cmd, $lines, $code);
    $text = implode("\n", $lines);
    return array(strpos($text, 'RESULT: GREEN') !== false, $text);
}

echo "helpv2 suite (phase $phase): app=$app out=$out (orig=$orig, unused since the v1 help went, 2026-10-19)\n";
$fails = 0;
$lint = child($php, 'lint_help.php', '--app=' . escapeshellarg($app) . ' --live=' . escapeshellarg($live) . ' --php=' . escapeshellarg($php));
echo $lint['out'] . "\n"; $fails += (int)$lint['code'];
$eq = child($php, 'equiv_help.php', '--app=' . escapeshellarg($app) . ' --orig=' . escapeshellarg($orig) . ' --php=' . escapeshellarg($php));
echo $eq['out'] . "\n"; $fails += (int)$eq['code'];
$rs = child($php, 'retrieval_smoke.php', '--app=' . escapeshellarg($app) . ' --orig=' . escapeshellarg($orig) . ' --out=' . escapeshellarg($out . '/retrieval'));
echo $rs['out'] . "\n"; $fails += (int)$rs['code'];

// Phase 6: the Ask page's pure half (A1-A10, a stub model) and its client (H1, headless Edge), when the tree carries it.
if (is_file("$app/help/ask.php")) {
    $as = child($php, 'ask_tests.php', '--app=' . escapeshellarg($app) . ' --orig=' . escapeshellarg($orig) . ' --out=' . escapeshellarg($out . '/ask'));
    echo $as['out'] . "\n"; $fails += (int)$as['code'];
    if (!isset($o['skip-jump'])) {
        list($okH, $tH) = askHarness($app, "$out/askjs");
        printf("  %-5s %-8s %s\n", $okH ? 'PASS' : 'FAIL', 'H1', 'Ask page client harness (T1-T8 in headless Edge)' . ($okH ? '' : ": \n" . $tH));
        if (!$okH) $fails++;
    }
}

// Jump harness: J1 on the tree under test (only meaningful once it carries the patch), J2 the control.
if (!isset($o['skip-jump'])) {
    $mj = hv_locate('js/main.js', $app, '');
    if ($mj && strpos(hv_read($mj), 'Owner re-resolution (2026-10-14)') !== false) {
        list($ok1, $t1) = jumpHarness($mj, "$out/jump_patched", false);
        printf("  %-5s %-8s %s\n", $ok1 ? 'PASS' : 'FAIL', 'J1', 'jump harness on ' . $mj . ($ok1 ? ' (T1-T6 green)' : ": \n" . $t1));
        if (!$ok1) $fails++;
        $origJs = hv_locate('js/main.js', $orig, $live);
        if ($origJs && strpos(hv_read($origJs), 'Owner re-resolution (2026-10-14)') === false) {
            list($ok2, $t2) = jumpHarness($origJs, "$out/jump_control", true);
            printf("  %-5s %-8s %s\n", $ok2 ? 'PASS' : 'FAIL', 'J2', 'control: the unpatched main.js fails exactly T2-T5' . ($ok2 ? '' : ": \n" . $t2));
            if (!$ok2) $fails++;
        } else {
            echo "  INFO  J2       no unpatched main.js to run as the control\n";
        }
    } else {
        echo "  INFO  J1       js/main.js under --app has no cross-topic patch (phase 0 tree): harness skipped\n";
    }
}

// Tip harness (2026-10-19, helptip): K1 on the tree under test, K2 the control (the unpatched main.js must fail exactly T1).
if (!isset($o['skip-jump'])) {
    $mj = hv_locate('js/main.js', $app, '');
    if ($mj && strpos(hv_read($mj), '(2026-10-19, helptip)') !== false) {
        list($ok1, $t1) = tipHarness($mj, "$out/tip_patched", false);
        printf("  %-5s %-8s %s\n", $ok1 ? 'PASS' : 'FAIL', 'K1', 'tip harness on ' . $mj . ($ok1 ? ' (T1-T4 green)' : ": \n" . $t1));
        if (!$ok1) $fails++;
        $origJs = hv_locate('js/main.js', $orig, $live);
        if ($origJs && strpos(hv_read($origJs), '(2026-10-19, helptip)') === false) {
            list($ok2, $t2) = tipHarness($origJs, "$out/tip_control", true);
            printf("  %-5s %-8s %s\n", $ok2 ? 'PASS' : 'FAIL', 'K2', 'control: the unpatched main.js fails exactly T1' . ($ok2 ? '' : ": \n" . $t2));
            if (!$ok2) $fails++;
        } else {
            echo "  INFO  K2       no unpatched main.js to run as the control\n";
        }
    } else {
        echo "  INFO  K1       js/main.js under --app has no helptip patch: harness skipped\n";
    }
}

if (!isset($o['skip-coverage'])) {
    $cv = child($php, 'coverage_help.php', '--app=' . escapeshellarg($app) . ' --live=' . escapeshellarg($live) . ' --out=' . escapeshellarg($out . '/coverage_report.md'));
    echo $cv['out'] . "\n";
}

// ------------------------------------------------------------------ mutants
$mutantFails = 0;
if (isset($o['mutants'])) {
    echo "\nmutants (each must turn exactly its own checks red; phase $phase expectations):\n";
    $anyE = array('E0', 'E1a', 'E1b', 'E1c', 'E3a', 'E3b', 'E3c', 'E3d', 'E4a', 'E4b', 'E4c', 'E5', 'E6', 'E7', 'E-php');
    $anyP = array('P1', 'P2', 'P3', 'P5', 'P6', 'P7', 'P8');
    if ($phase === 0) {
        $M = array(
            'audience-mismatch' => array('edits' => array(array('help/topics/sqlHelpLightbox.php', 'class="help-topic" data-audience="writer"', 'class="help-topic" data-audience="viewer"', 1)), 'expect' => array('L3'), 'allow' => array()),
            'dangling-jump'     => array('edits' => array(array('help/topics/pivotBuilderHelpLightbox.php', 'data-jump-to="pvh-presets"', 'data-jump-to="pvh-presetz"', 1)), 'expect' => array('L5', 'E1b'), 'allow' => array()),
            'missing-fragment'  => array('edits' => array(array('help/topics/saveIdHelpLightbox.php', null, null, 0)), 'expect' => array('L1', 'E1a', 'E1b', 'E4a', 'E5'), 'allow' => array()),
            'dup-id'            => array('edits' => array(array('help/topics/groupingHelpLightbox.php', 'id="grh-opening"', 'id="grh-overview"', 1)), 'expect' => array('L4', 'L5', 'E1b'), 'allow' => array()),
            'unbalanced-div'    => array('edits' => array(array('help/topics/emailHelpLightbox.php', "    </div>\r\n</div>\r\n", "    </div>\r\n", 1)), 'expect' => array('L8', 'E1b'), 'allow' => array('E1a', 'E1c', 'E3a', 'E4a', 'E5', 'E3b')),
            'text-drift'        => array('edits' => array(array('help/topics/whatIsPenumbraLightbox.php', 'Democratized Analytics', 'Democratised Analytics', 1)), 'expect' => array('E1b'), 'allow' => array()),
            'gate-leak'         => array('edits' => array(array('help/topics/pivotBuilderHelpLightbox.php', "pnb_help_show('writer')", 'true', 2)), 'expect' => array('E3c'), 'allow' => array()),
            'shim-missing'      => array('edits' => array(array('help_content.php', "if (pnb_help_v2_active()) { require __DIR__ . '/help/loader.php'; return; }\r\n", '', 1)), 'expect' => array('L13', 'E0', 'E3a', 'E3c', 'E4b'), 'allow' => array('E1a', 'E1b', 'E4a', 'E5', 'E3d')),
            'php-error'         => array('edits' => array(array('help/topics/copyHelpLightbox.php', "<?php if (pnb_help_show('writer')):", "<?php if (pnb_help_show('writer'):", 2)), 'expect' => array('L9', 'E-php'), 'allow' => $anyE),
        );
    } elseif ($phase >= 2) {
        // Phase 2 rewrote the viewer topics (LF, tier standard). The v1 comparison (P1-P9, E7) retired on
        // 2026-10-19 with the v1 help body: text-drift, fact-dropped and phase3-chart-id went with it, and
        // the P* ids below survive only in allow lists.
        $anyP2 = array_merge($anyP, array('P9', 'L16'));
        $M = array(
            'audience-mismatch' => array('edits' => array(array('help/topics/sqlHelpLightbox.php', 'class="help-topic" data-audience="writer"', 'class="help-topic" data-audience="viewer"', 1)), 'expect' => array('L3'), 'allow' => array('A6')),
            'dangling-jump'     => array('edits' => array(array('help/topics/pivotBuilderHelpLightbox.php', 'data-jump-to="pvh-presets"', 'data-jump-to="pvh-presetz"', 1)), 'expect' => array('L5'), 'allow' => array()),
            'missing-fragment'  => array('edits' => array(array('help/topics/saveIdHelpLightbox.php', null, null, 0)), 'expect' => array('L1', 'E4a', 'E5'), 'allow' => array('L16')),
            'dup-id'            => array('edits' => array(array('help/topics/groupingHelpLightbox.php', 'id="grh-opening"', 'id="grh-overview"', 1)), 'expect' => array('L4', 'L5'), 'allow' => array()),
            'unbalanced-div'    => array('edits' => array(array('help/topics/emailHelpLightbox.php', "    </div>\n</div>\n", "    </div>\n", 1)), 'expect' => array('L8'), 'allow' => array_merge($anyE, $anyP2)),
            'anchor-removed'    => array('edits' => array(array('help/topics/groupingHelpLightbox.php', ' id="grh-opening"', '', 1)), 'expect' => array('L5'), 'allow' => array()),
            'canonical-dangling'=> array('edits' => array(array('help/topics/saveSecurityHelpLightbox.php', 'data-canonical-ref="access-list-entries"', 'data-canonical-ref="access-list-entriez"', 1)), 'expect' => array('L14'), 'allow' => array()),
            'gate-leak'         => array('edits' => array(array('help/topics/pivotBuilderHelpLightbox.php', "pnb_help_show('writer')", 'true', 2)), 'expect' => array('E3c'), 'allow' => array()),
            // 2026-10-19: the shim is all help_content.php is; without its loader line the body is empty (L13, and every gate render sees no topic)
            'shim-missing'      => array('edits' => array(array('help_content.php', "require __DIR__ . '/help/loader.php';\r\n", '', 1)), 'expect' => array('L13', 'E0', 'E3a', 'E3b', 'E4a', 'E4b', 'E5'), 'allow' => array_merge($anyE, $anyP2)),
            // phase 7 (2026-10-15): the Copy topic's PHP-stub block became admin-gated, so one writer gate remains to break
            'php-error'         => array('edits' => array(array('help/topics/copyHelpLightbox.php', "<?php if (pnb_help_show('writer')):", "<?php if (pnb_help_show('writer'):", 1)), 'expect' => array('L9', 'E-php'), 'allow' => array_merge($anyE, $anyP2)),
            'long-paragraph'    => array('edits' => array(array('help/topics/dashboardsHelpLightbox.php', '<h4 id="dsh-notes"', '<p>' . trim(str_repeat('ninety words of filler ', 30)) . '</p><h4 id="dsh-notes"', 1)), 'expect' => array('L16'), 'allow' => array()),
            // phase 3 (2026-10-15): the writer/admin rewrites. A cell over budget in the Scheduler book -> L16; the
            // recipient-variables chart id (main.js clones #pnbRecipientVarsChart into two other topics) -> P2; an id an
            // index.php help icon targets (dbDumpHelp-destination) -> P2 + L5.
            'phase3-long-cell'  => array('edits' => array(array('help/topics/schedulerHelpLightbox.php', 'max-width: none;">1</td>', 'max-width: none;">1 ' . trim(str_repeat('eighty words of filler ', 27)) . '</td>', 1)), 'expect' => array('L16'), 'allow' => array()),
            'phase3-icon-anchor'=> array('edits' => array(array('help/topics/schedulerHelpLightbox.php', 'id="dbDumpHelp-destination"', 'id="dbDumpHelp-destinatio"', 1)), 'expect' => array('L5'), 'allow' => array()),
            // phase 4 (2026-10-15): the Custom Code reference is generated from help/snippets.php. A registry edit
            // without a regeneration -> L17; a registry name that is not an editor function -> L18 (+ L17, stale).
            'registry-stale'    => array('edits' => array(array('help/snippets.php', "'summary' => 'Counts rows matching", "'summary' => 'Counts the rows matching", 1)), 'expect' => array('L17'), 'allow' => array()),
            'registry-name'     => array('edits' => array(array('help/snippets.php', "'names' => array('avg')", "'names' => array('avgx')", 1)), 'expect' => array('L17', 'L18'), 'allow' => array()),
            // phase 4b (2026-10-15): a flex-div pseudo-table row in a standard topic -> L19.
            'flex-table'        => array('edits' => array(array('help/topics/dashboardsHelpLightbox.php', '<h4 id="dsh-notes"', '<div style="display: flex; gap: 8px; padding: 2px 0;"><div style="flex: 0 0 100px; padding-left: 6px;">x</div><div style="flex: 1; min-width: 0;">y</div></div><h4 id="dsh-notes"', 1)), 'expect' => array('L19'), 'allow' => array()),
        );
        if ($phase >= 6) {
            // phase 6 (2026-10-15): the Ask page. Each mutant breaks one promise of help/ask.php (or the audience
            // filter in help_retrieval.php) and must turn only its A-check red: the card cache, the no-passage
            // gate, the text-only answer, the day budget, the audience filter, the card audience.
            $M['ask-no-card-hit']   = array('edits' => array(array('help/ask.php', '$i = pnb_ask_find_card($data, $norm, $tokens, $allowedAud);', '$i = null;', 1)), 'expect' => array('A2'), 'allow' => array('A3', 'A8', 'A11'));   // A3 and A11 lean on the cache too
            $M['ask-no-empty-gate'] = array('edits' => array(array('help/ask.php', '        if (!$chunks) {', '        if (false && !$chunks) {', 1)), 'expect' => array('A5'), 'allow' => array());
            $M['ask-no-strip']      = array('edits' => array(array('help/ask.php', '    $t = strip_tags($t);', '    $t = (string)$t;', 1)), 'expect' => array('A7'), 'allow' => array());
            $M['ask-no-daily']      = array('edits' => array(array('help/ask.php', "    if ((int)\$d['n'] >= \$limit) {", '    if (false) {', 1)), 'expect' => array('A4'), 'allow' => array());
            $M['ask-no-audience']   = array('edits' => array(array('help_retrieval.php', "            if (\$allowedAud !== null && isset(\$c['a']) && !in_array(\$c['a'], \$allowedAud, true)) continue;   // not for this reader\n", '', 1)), 'expect' => array('A6'), 'allow' => array());
            $M['ask-card-leak']     = array('edits' => array(array('help/ask.php', "        if (!empty(\$c['retired']) || !pnb_ask_card_visible(\$c, \$allowedAud)) continue;", "        if (!empty(\$c['retired'])) continue;", 1)), 'expect' => array('A6'), 'allow' => array());
            $M['ask-no-notice']     = array('edits' => array(array('help/ask.php', "    if (pnb_ask_audience_rank(\$needAud) <= pnb_ask_audience_rank(\$role)) return '';", "    return '';", 1)), 'expect' => array('A11'), 'allow' => array());
            $M['ask-no-recall']     = array('edits' => array(array('help_retrieval.php', '            $need = min(2, count($qTerms));', '            $need = 2;', 1)), 'expect' => array('R6'), 'allow' => array());
            // 2026-10-17 (E2E_2026-10-17 D1): the two-letter allow-list. Dropped from the tokenizer -> R8 (the IP question finds no
            // passage); the Ask-only tier let through to the assistant's question -> R9 (data questions naming PI / ID / FY pull help).
            $M['short-tokens-dropped'] = array('edits' => array(array('help_retrieval.php', "        if (strlen(\$w) < 3 && !isset(\$GLOBALS['PNB_HELP_SHORT'][\$w])) continue;", '        if (strlen($w) < 3) continue;', 1)), 'expect' => array('R8'), 'allow' => array());
            $M['assist-short-leak']    = array('edits' => array(array('help_retrieval.php', "        if (\$mode !== 'ask') {", '        if (false) {', 1)), 'expect' => array('R9'), 'allow' => array());
            // 2026-10-20: the in-flight indicator. Without busyOn() the harness's T8 sees no dots, no busy mark, no dimmed answer -> H1.
            $M['ask-no-busy']          = array('edits' => array(array('js/penumbra_help_ask.js', '        busyOn();', '        /* ask-no-busy */', 1)), 'expect' => array('H1'), 'allow' => array());
        }
    } else {
        $M = array(
            'audience-mismatch' => array('edits' => array(array('help/topics/sqlHelpLightbox.php', 'class="help-topic" data-audience="writer"', 'class="help-topic" data-audience="viewer"', 1)), 'expect' => array('L3'), 'allow' => array()),
            'dangling-jump'     => array('edits' => array(array('help/topics/pivotBuilderHelpLightbox.php', 'data-jump-to="pvh-presets"', 'data-jump-to="pvh-presetz"', 1)), 'expect' => array('L5', 'P7'), 'allow' => array()),
            'missing-fragment'  => array('edits' => array(array('help/topics/saveIdHelpLightbox.php', null, null, 0)), 'expect' => array('L1', 'P1', 'E4a', 'E5'), 'allow' => array('P2', 'P5', 'P6', 'P7')),
            'dup-id'            => array('edits' => array(array('help/topics/groupingHelpLightbox.php', 'id="grh-opening"', 'id="grh-overview"', 1)), 'expect' => array('L4', 'L5', 'P7'), 'allow' => array('P2')),
            'unbalanced-div'    => array('edits' => array(array('help/topics/emailHelpLightbox.php', "    </div>\r\n</div>\r\n", "    </div>\r\n", 1)), 'expect' => array('L8', 'P7'), 'allow' => array_merge($anyE, $anyP)),
            'text-drift'        => array('edits' => array(array('help/topics/whatIsPenumbraLightbox.php', 'Democratized Analytics', 'Democratised Analytics', 1)), 'expect' => array('P7'), 'allow' => array()),
            'anchor-removed'    => array('edits' => array(array('help/topics/groupingHelpLightbox.php', ' id="grh-opening"', '', 1)), 'expect' => array('P2', 'L5', 'P7'), 'allow' => array()),
            'canonical-dangling'=> array('edits' => array(array('help/topics/saveSecurityHelpLightbox.php', 'data-canonical-ref="access-list-entries"', 'data-canonical-ref="access-list-entriez"', 1)), 'expect' => array('L14'), 'allow' => array()),
            'gate-leak'         => array('edits' => array(array('help/topics/pivotBuilderHelpLightbox.php', "pnb_help_show('writer')", 'true', 2)), 'expect' => array('E3c'), 'allow' => array()),
            'shim-missing'      => array('edits' => array(array('help_content.php', "if (pnb_help_v2_active()) { require __DIR__ . '/help/loader.php'; return; }\r\n", '', 1)), 'expect' => array('L13', 'E0', 'E3a', 'E3c', 'E4b'), 'allow' => array_merge($anyE, $anyP)),
            'php-error'         => array('edits' => array(array('help/topics/copyHelpLightbox.php', "<?php if (pnb_help_show('writer')):", "<?php if (pnb_help_show('writer'):", 2)), 'expect' => array('L9', 'E-php'), 'allow' => array_merge($anyE, $anyP)),
        );
    }
    foreach ($M as $name => $spec) {
        $dir = "$out/mut_$name";
        rcopy($app, $dir);
        $applied = true;
        foreach ($spec['edits'] as $e) {
            $path = $dir . '/' . $e[0];
            if ($e[1] === null) { if (!@unlink($path)) { $applied = false; echo "  $name: could not delete $e[0]\n"; } continue; }
            $s = hv_read($path);
            $n = substr_count($s, $e[1]);
            if ($n < 1 || ($e[3] > 0 && $n !== $e[3])) { $applied = false; echo "  $name: anchor found $n times in $e[0] (expected {$e[3]})\n"; continue; }
            file_put_contents($path, str_replace($e[1], $e[2], $s));
        }
        if (!$applied) { $mutantFails++; printf("  %-18s FAIL (could not apply)\n", $name); continue; }
        $l = child($php, 'lint_help.php', '--app=' . escapeshellarg($dir) . ' --live=' . escapeshellarg($live) . ' --php=' . escapeshellarg($php));
        $q = child($php, 'equiv_help.php', '--app=' . escapeshellarg($dir) . ' --orig=' . escapeshellarg($orig) . ' --php=' . escapeshellarg($php));
        $ak = is_file("$dir/help/ask.php") ? child($php, 'ask_tests.php', '--app=' . escapeshellarg($dir) . ' --orig=' . escapeshellarg($orig) . ' --out=' . escapeshellarg($out . '/ask_' . $name)) : array('out' => '', 'code' => 0);
        $rk = is_file("$dir/help/ask.php") ? child($php, 'retrieval_smoke.php', '--app=' . escapeshellarg($dir) . ' --orig=' . escapeshellarg($orig) . ' --out=' . escapeshellarg($out . '/retrieval_' . $name)) : array('out' => '', 'code' => 0);
        // the client harness (headless Edge) only for a mutant that names H1: the other mutants never touch the client
        $hk = (in_array('H1', $spec['expect'], true) || in_array('H1', $spec['allow'], true)) ? askHarness($dir, "$out/askjs_$name") : null;
        $red = array_values(array_unique(array_merge(redIds($l['out']), redIds($q['out']), redIds($ak['out']), redIds($rk['out']), ($hk !== null && !$hk[0]) ? array('H1') : array())));
        $missing = array_diff($spec['expect'], $red);
        $unexpected = array_diff($red, $spec['expect'], $spec['allow']);
        $ok = !$missing && !$unexpected;
        if (!$ok) $mutantFails++;
        printf("  %-18s %s  red=[%s]%s%s\n", $name, $ok ? 'killed' : 'FAIL', implode(' ', $red),
            $missing ? ' MISSING=[' . implode(' ', $missing) . ']' : '', $unexpected ? ' UNEXPECTED=[' . implode(' ', $unexpected) . ']' : '');
    }
    echo "mutants: " . (count($M) - $mutantFails) . '/' . count($M) . " killed as expected\n";
}

$total = $fails + $mutantFails;
echo "\nRESULT: " . ($total === 0 ? 'GREEN' : "RED ($fails check failures, $mutantFails mutant failures)") . "\n";
exit($total);

function rcopy($src, $dst) {
    if (!is_dir($dst)) mkdir($dst, 0777, true);
    foreach (scandir($src) as $f) {
        if ($f === '.' || $f === '..') continue;
        $s = "$src/$f"; $d = "$dst/$f";
        if (is_dir($s)) {
            if ($f === 'cache') continue;
            if ($f === 'js') {   // js/ (7 MB) is not what mutants break, but L20 looks for the Ask client (phase 6)
                if (is_file("$s/penumbra_help_ask.js")) { if (!is_dir($d)) mkdir($d, 0777, true); copy("$s/penumbra_help_ask.js", "$d/penumbra_help_ask.js"); }
                continue;
            }
            rcopy($s, $d);
        }
        else copy($s, $d);
    }
}
