<?php
// =============================================================================
// searchrank runner (2026-10-21). See test.php for what is tested and README.md for the
// Oracle half (the DUAL probe) and the history.
//
//   php -n run.php                       candidate = the live get_server_reports.php
//   php -n run.php --app DIR             candidate = DIR/get_server_reports.php (a stage)
//   php -n run.php --control             the PRE-CHANGE file (--baseline DIR, else the live file
//                                        while it has no rank helper, else git: the parent of the
//                                        commit that brought penumbraReportSearchRankSql):
//                                        EXACTLY CONTROL_RED must fail
//   php -n run.php --mutants | --mutant NAME[,NAME]   single-point edits of the candidate
//                                        (mutants.json): each must turn EXACTLY its "must" red
//                                        ("must": null = explore, prints the red set)
// The child runs test.php with pdo_sqlite from the server's ext folder. Writes only to %TEMP%.
// =============================================================================
$HERE = __DIR__;
$APP = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$EXT = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext';
$EXPECT = array('P-lift', 'P-fixture', 'Q-epa8', 'S-epa50', 'S-tiers', 'Q-tiers', 'Q-ownername', 'S-ownername', 'S-escape-dot',
                'Q-escape-paren', 'S-literal', 'S-nonadmin', 'S-tag', 'Q-tag', 'R-helper', 'R-escape', 'R-fold', 'R-gate', 'R-long',
                'B-list', 'B-count');
// What the pre-change file gets wrong (frozen from the first control run, the live file of
// 2026-10-21 19:05, sha256 99c0ddff). Green there on purpose: the lift and the fixture, the
// paren term (one hit either way), tag:NAME (unchanged) and the bind discipline (no rank binds).
$CONTROL_RED = array('Q-epa8', 'S-epa50', 'S-tiers', 'Q-tiers', 'Q-ownername', 'S-ownername', 'S-escape-dot', 'S-literal',
                     'S-nonadmin', 'R-helper', 'R-escape', 'R-fold', 'R-gate', 'R-long');

$opts = getopt('', array('app:', 'baseline:', 'control', 'mutants', 'mutant:'));
$file = (isset($opts['app']) ? rtrim($opts['app'], '/\\') : $APP) . '/get_server_reports.php';
$control = isset($opts['control']);
if ($control) {
    if (isset($opts['baseline'])) { $file = rtrim($opts['baseline'], '/\\') . '/get_server_reports.php'; }
    else if (strpos((string)@file_get_contents("$APP/get_server_reports.php"), 'function penumbraReportSearchRankSql(') === false) { $file = "$APP/get_server_reports.php"; }
    else {
        require '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/penumbra_tests/_oldver/oldver.php';
        $shas = preg_split('/\s+/', trim(oldver_git(array('log', '--format=%H', '-S', 'function penumbraReportSearchRankSql(', '--', 'get_server_reports.php'))));
        $file = oldver_git_show(end($shas) . '^', 'get_server_reports.php');
    }
}
$MUT = json_decode(file_get_contents("$HERE/mutants.json"), true);
if (!is_array($MUT)) { fwrite(STDERR, "mutants.json does not parse\n"); exit(2); }

function run_test($path) {
    global $HERE, $EXT;
    $cmd = array(PHP_BINARY, '-n', '-d', "extension_dir=$EXT", '-d', 'extension=pdo_sqlite', '-d', 'date.timezone=America/New_York',
                 "$HERE/test.php", '--file', $path);
    $p = proc_open($cmd, array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes);
    $so = stream_get_contents($pipes[1]); $se = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    $j = json_decode($so, true);
    if (!is_array($j) || !isset($j['asserts'])) return array(array('id' => 'P-lift', 'ok' => false, 'detail' => 'test.php said: ' . substr($so . $se, 0, 400)));
    return $j['asserts'];
}
function evaluate($got) {
    global $EXPECT;
    $by = array();
    foreach ($got as $a) { if (!isset($by[$a['id']])) $by[$a['id']] = $a; }
    $res = array();
    foreach ($EXPECT as $id) { $res[] = array($id, isset($by[$id]) && $by[$id]['ok'], isset($by[$id]) ? $by[$id]['detail'] : 'NOT RECORDED'); }
    foreach ($by as $id => $a) { if (!in_array($id, $EXPECT, true)) $res[] = array($id, false, 'UNEXPECTED ID ' . $a['detail']); }
    return $res;
}
function reds($res) { $r = array(); foreach ($res as $x) { if (!$x[1]) $r[] = $x[0]; } sort($r); return $r; }

echo 'candidate: ' . $file . ($control ? '   (CONTROL: the pre-change file)' : '') . "\n";
$src = @file_get_contents($file);
if ($src === false) { echo "cannot read the candidate\nRESULT: RED\n"; exit(1); }

if (isset($opts['mutants']) || isset($opts['mutant'])) {
    $names = isset($opts['mutant']) ? explode(',', $opts['mutant']) : array_keys($MUT);
    $ok = 0; $bad = 0;
    foreach ($names as $m) {
        if (!isset($MUT[$m])) { echo "  FAIL  no mutant named $m\n"; $bad++; continue; }
        $mut = $src;
        foreach ($MUT[$m]['edits'] as $e) {
            $c = substr_count($mut, $e[0]);
            if ($c !== 1) { echo "  FAIL  mutant $m: anchor found $c times (needs the NEW build): " . substr($e[0], 0, 90) . "\n"; $bad++; continue 2; }
            $mut = str_replace($e[0], $e[1], $mut);
        }
        $tmp = sys_get_temp_dir() . '/pnb_searchrank_' . getmypid() . '_' . $m . '.php';
        file_put_contents($tmp, $mut);
        $res = evaluate(run_test($tmp));
        @unlink($tmp);
        $red = reds($res);
        $must = $MUT[$m]['must'];
        if ($must === null) { printf("  EXPLORE mutant %-13s red: %s\n", $m, $red ? implode(' ', $red) : '(nothing)'); $bad++; continue; }
        sort($must);
        $good = $red === $must;
        $good ? $ok++ : $bad++;
        printf("  %s  mutant %-13s turns %s red   [red: %s]\n", $good ? 'PASS' : 'FAIL', $m, implode(' ', $must), implode(' ', $red));
        if (!$good) { foreach ($res as $x) { if (!$x[1]) printf("        %-15s %s\n", $x[0], substr($x[2], 0, 300)); } }
    }
    echo "SUMMARY mutants ok=$ok bad=$bad\n";
    echo ($bad === 0 && $ok > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    exit($bad === 0 && $ok > 0 ? 0 : 1);
}

$res = evaluate(run_test($file));
$p = 0; $f = 0;
foreach ($res as $x) { printf("  %s  %-15s %s\n", $x[1] ? 'PASS' : 'FAIL', $x[0], substr($x[2], 0, 300)); $x[1] ? $p++ : $f++; }
$red = reds($res);
echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $red) . "\n";
if ($control) {
    $want = $CONTROL_RED; sort($want);
    $good = $red === $want;
    echo 'CONTROL: ' . ($good ? 'as expected' : 'NOT as expected') . ' (expected red: ' . implode(' ', $want) . ")\n";
    echo $good ? "RESULT: GREEN\n" : "RESULT: RED\n";
    exit($good ? 0 : 1);
}
echo ($f === 0 && $p > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
exit($f === 0 && $p > 0 ? 0 : 1);
