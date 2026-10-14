<?php
/**
 * cfgbak - the watchdog's config-backup watch (penumbra_monitor.php, 2026-10-14).
 *
 *   php -n test_cfgbak.php [--file=<penumbra_monitor.php>] [--control] [--mutant=NAME | --mutants]
 *
 * Lifts mon_cfgbak_eval() and mon_cfgbak_decide() FROM THE FILE by the tokenizer (never copied)
 * and checks: which log line decides a run's outcome, the stale rule, and the alert / reminder /
 * resolved discipline. -n: nothing here needs an extension.
 *   --control   the file BEFORE the feature (the live monitor until it ships) - lifting must
 *               fail, so the run is RED. After deploy, pass --file=<the pre-change copy>.
 *   --mutant=X  one single-point edit of the lifted source; exactly its own asserts go red.
 * EXPECTED: "PASS 25   FAIL 0"; every mutant RED on only its listed asserts.
 */
error_reporting(E_ALL);
$FILE = '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p\\penumbra_monitor.php';
$MUTANT = ''; $ALL = false; $CONTROL = false;
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--file=') === 0) $FILE = substr($a, 7);
    elseif ($a === '--control') $CONTROL = true;
    elseif (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
    elseif ($a === '--mutants') $ALL = true;
    else { fwrite(STDERR, "unknown argument $a\n"); exit(2); }
}

function lift($file, $names) {   // same tokenizer walk as monfix\test_monfix.php
    $src = @file_get_contents($file);
    if ($src === false) { fwrite(STDERR, "cannot read $file\n"); exit(2); }
    $t = token_get_all($src); $n = count($t); $out = ''; $found = array();
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING || !in_array($t[$j][1], $names, true)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) { if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; $started = true; } $buf .= $tok[1]; }
            else { if ($tok === '{') { $depth++; $started = true; } elseif ($tok === '}') { $depth--; } $buf .= $tok; }
            if ($started && $depth === 0) break;
        }
        $out .= $buf . "\n"; $found[] = $t[$j][1];
    }
    $missing = array_diff($names, $found);
    return array('src' => $out, 'missing' => array_values($missing));
}

// Each mutant: one edit of the lifted source, and the asserts it must turn red (and only those).
$MUTANTS = array(
    'skip-notes'   => array("if (preg_match('/^\\(notification failed|^notification test/i', \$m[2])) continue;", '', array('E5', 'E6')),
    'stale-off'    => array('if ($hours >= $staleHours) {', 'if (false) {', array('E8', 'E10')),
    'push-ok'      => array("'/^(REFUSED|push FAILED|ERROR)/'", "'/^(REFUSED|ERROR)/'", array('E3', 'E3k', 'E13')),
    'no-reminder'  => array('if ($now - $lastAlert >= $remindSecs) {', 'if (false) {', array('D4')),
    'no-resolved'  => array("'send' => \$alerted ? 'resolved' : ''", "'send' => ''", array('D5')),
    'spam'         => array("return array('send' => '', 'state' => array('alerted' => true, 'last_alert' => \$lastAlert", "return array('send' => 'reminder', 'state' => array('alerted' => true, 'last_alert' => \$lastAlert", array('D3', 'D8')),
);

function run($FILE, $mutant, $MUTANTS, $control) {
    $L = lift($FILE, array('mon_cfgbak_eval', 'mon_cfgbak_decide'));
    if ($L['missing']) { echo "  FAIL lift: " . implode(', ', $L['missing']) . " not found in $FILE\n"; return array('pass' => 0, 'fail' => 1, 'red' => array('LIFT')); }
    $src = $L['src'];
    if ($mutant !== '') {
        list($from, $to) = $MUTANTS[$mutant];
        if (substr_count($src, $from) !== 1) { echo "  FAIL mutant $mutant: anchor found " . substr_count($src, $from) . " times\n"; return array('pass' => 0, 'fail' => 1, 'red' => array('ANCHOR')); }
        $src = str_replace($from, $to, $src);
    }
    // a unique namespace-free prefix per run, so mutants can be evaluated in one process
    static $run = 0; $run++; $p = 'r' . $run . '_';
    eval(str_replace(array('function mon_cfgbak_eval', 'function mon_cfgbak_decide'), array("function {$p}eval", "function {$p}decide"), $src));
    $E = $p . 'eval'; $D = $p . 'decide';
    $pass = 0; $fail = 0; $red = array();
    $ok = function ($id, $cond, $got = null) use (&$pass, &$fail, &$red) {
        if ($cond) { $pass++; } else { $fail++; $red[] = $id; echo "  FAIL $id" . ($got === null ? '' : '  (got: ' . json_encode($got) . ')') . "\n"; }
    };
    $now = strtotime('2026-10-15 09:00:00');
    $L = function ($ts, $msg) { return '[' . $ts . '] ' . $msg; };
    // --- eval: which line decides ---
    $r = $E(array($L('2026-10-15 07:00:01', 'no change')), $now, 96);                                   $ok('E1', $r['status'] === 'ok', $r);
    $r = $E(array($L('2026-10-15 07:00:01', 'committed abc1234: x'), $L('2026-10-15 07:00:05', 'pushed abc1234')), $now, 96); $ok('E2', $r['status'] === 'ok', $r);
    $r = $E(array($L('2026-10-15 07:00:01', 'committed abc1234: x'), $L('2026-10-15 07:00:05', 'push FAILED (will retry next run)')), $now, 96);
    $ok('E3', $r['status'] === 'problem', $r); $ok('E3k', $r['kind'] === 'push', $r);
    $r = $E(array($L('2026-10-15 07:00:01', 'REFUSED: unsealed value(s) under ieprd_pass - seal them')), $now, 96);
    $ok('E4', $r['status'] === 'problem' && $r['kind'] === 'refused', $r);
    $r = $E(array($L('2026-10-15 07:00:01', 'REFUSED: file(s) over 5 MB: a.js'), $L('2026-10-15 07:00:02', '(notification failed: no toast)')), $now, 96);
    $ok('E5', $r['status'] === 'problem' && $r['kind'] === 'refused', $r);                               // a toast note does not hide a refusal
    $r = $E(array($L('2026-10-15 07:00:01', 'no change'), $L('2026-10-15 08:00:00', 'notification test sent (manual test, not a real problem)')), $now, 96);
    $ok('E6', $r['status'] === 'ok' && strpos($r['detail'], 'no change') !== false, $r);                 // a manual test is not an outcome
    $r = $E(array($L('2026-10-15 07:00:01', 'ERROR: git status failed')), $now, 96);                   $ok('E7', $r['status'] === 'problem' && $r['kind'] === 'error', $r);
    $r = $E(array($L('2026-10-11 08:00:00', 'no change')), $now, 96);                                   $ok('E8', $r['status'] === 'problem' && $r['kind'] === 'stale', $r);   // 97 h
    $r = $E(array($L('2026-10-11 10:00:00', 'no change')), $now, 96);                                   $ok('E9', $r['status'] === 'ok', $r);                                  // 95 h: a weekend stays quiet
    $r = $E(array($L('2026-10-11 08:00:00', 'push FAILED (will retry next run)')), $now, 96);           $ok('E10', $r['kind'] === 'stale', $r);                                // stale names the bigger problem
    $r = $E(array(), $now, 96);                                                                         $ok('E11', $r['status'] === 'problem' && $r['kind'] === 'empty', $r);
    $r = $E(array('garbage', '', 'line [2026-10-15 07:00:00] no change'), $now, 96);                    $ok('E12', $r['kind'] === 'empty', $r);                                // only stamped lines count
    $r = $E(array($L('2026-10-15 07:00:01', 'push FAILED'), "\r", ''), $now, 96);                       $ok('E13', $r['kind'] === 'push', $r);                                 // CR / blank tail
    $r = $E(array($L('2026-10-14 07:00:01', 'REFUSED: x'), $L('2026-10-15 07:00:01', 'committed a: x'), $L('2026-10-15 07:00:03', 'pushed a')), $now, 96);
    $ok('E14', $r['status'] === 'ok', $r);                                                              // a later clean run clears it
    $ok('E15', strpos($r['detail'], '2026-10-15 07:00') === 0, $r);
    // --- decide: alert discipline ---
    $bad = array('status' => 'problem', 'kind' => 'push', 'detail' => 'x');
    $good = array('status' => 'ok', 'kind' => 'ok', 'detail' => 'y');
    $d = $D(array(), $good, $now, 86400);                                                               $ok('D1', $d['send'] === '' && empty($d['state']['alerted']), $d);
    $d = $D(array(), $bad, $now, 86400);                                                                $ok('D2', $d['send'] === 'alert' && $d['state']['last_alert'] === $now, $d);
    $d = $D(array('alerted' => true, 'last_alert' => $now - 3600), $bad, $now, 86400);                   $ok('D3', $d['send'] === '' && $d['state']['last_alert'] === $now - 3600, $d);
    $d = $D(array('alerted' => true, 'last_alert' => $now - 86400), $bad, $now, 86400);                  $ok('D4', $d['send'] === 'reminder' && $d['state']['last_alert'] === $now, $d);
    $d = $D(array('alerted' => true, 'last_alert' => $now - 3600), $good, $now, 86400);                  $ok('D5', $d['send'] === 'resolved' && empty($d['state']['alerted']), $d);
    $d = $D(array('alerted' => false, 'last_alert' => 0), $good, $now, 86400);                           $ok('D6', $d['send'] === '', $d);
    $d = $D(array('garbage' => 1), $bad, $now, 86400);                                                  $ok('D7', $d['send'] === 'alert', $d);                                 // a corrupt state file still alerts
    $d = $D(array('alerted' => true, 'last_alert' => $now - 3600), $bad, $now, 86400);
    $d2 = $D($d['state'], $bad, $now + 300, 86400);                                                     $ok('D8', $d2['send'] === '', $d2);                                    // every 5-minute tick stays quiet
    $ok('D9', $d2['state']['detail'] === 'x', $d2);
    if ($control) { $ok('CONTROL', false); }
    return array('pass' => $pass, 'fail' => $fail, 'red' => $red);
}

if ($ALL) {
    $bad = 0;
    foreach ($MUTANTS as $name => $m) {
        $r = run($FILE, $name, $MUTANTS, false);
        $want = $m[2]; sort($want); $got = $r['red']; sort($got);
        $verdict = ($got === $want) ? 'OK (red on exactly ' . implode(' ', $want) . ')' : 'WRONG (wanted ' . implode(' ', $want) . ', got ' . implode(' ', $got) . ')';
        if ($got !== $want) $bad++;
        echo "mutant $name: $verdict\n";
    }
    echo $bad ? "MUTANTS: $bad WRONG\n" : "MUTANTS: all " . count($MUTANTS) . " OK\n";
    exit($bad ? 1 : 0);
}
$r = run($FILE, $MUTANT, $MUTANTS, $CONTROL);
echo "PASS {$r['pass']}   FAIL {$r['fail']}\n";
exit($r['fail'] === 0 ? 0 : 1);
