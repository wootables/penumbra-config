<?php
/*
 * errbenign - the browser's harmless notices are NOT errors, anywhere: its
 * page-animation aborts (2026-09-25) and its ResizeObserver loop notice (2026-10-21).
 * Offline (no database): lifts the real functions out of the files under test and
 * checks the rule, its SQL twin, and that every consumer counts through it.
 *   php -n check.php <dir> [<app dir>]
 *       <dir>      holds the files under test: db_connection.php, get_audit_log.php,
 *                  analytics.php, analytics_all.php, penumbra_health.php,
 *                  log_client_error.php, analytics_shared.php, penumbra_logs.php
 *       <app dir>  every OTHER app PHP file (top level + plugins/includes/lib/api)
 *                  is swept for bare error counts too; the files under test win
 * Prints PASS/FAIL lines and RESULT: GREEN|RED.
 */
error_reporting(E_ALL);
$dir = rtrim($argv[1], '\\/');
$R = array();
function T($id, $name, $pass, $detail = '') { global $R; $R[] = array($id, $name, (bool)$pass, (string)$detail); }
function src($dir, $f) { $p = $dir . DIRECTORY_SEPARATOR . $f; return is_file($p) ? file_get_contents($p) : ''; }
function lift_fn($src, $name) { return preg_match('/^function ' . preg_quote($name, '/') . '\(.*?^\}\n/ms', $src, $m) ? $m[0] : null; }

$db  = src($dir, 'db_connection.php');
$aud = src($dir, 'get_audit_log.php');
$an  = src($dir, 'analytics.php');
$all = src($dir, 'analytics_all.php');
$hl  = src($dir, 'penumbra_health.php');
$log = src($dir, 'log_client_error.php');
$sh  = src($dir, 'analytics_shared.php');   // the metrics counter catalog (2026-10-01)
$lgs = src($dir, 'penumbra_logs.php');      // the health hub's log console (2026-10-21)

// ---- the rule, lifted -------------------------------------------------------
$fnNames = array('penumbraErrorActions', 'penumbraErrorActionsSql', 'penumbraBenignClientErrorPattern',
                 'penumbraClientErrorIsBenign', 'penumbraBenignClientErrorSql', 'penumbraErrorCondSql');
$missing = array(); $code = '';
foreach ($fnNames as $n) { $f = lift_fn($db, $n); if ($f === null) $missing[] = $n; else $code .= $f; }
$haveRule = !$missing;
if ($haveRule) { eval($code); }

$cases = array(
    array('Transition was skipped', true),
    array('Transition was aborted because of invalid state. ViewTransition opt-in disabled', true),
    array('Skipped ViewTransition due to another transition starting.', true),
    array('  transition was SKIPPED', true),
    array('Uncaught SyntaxError: Missing initializer in const declaration', false),
    array('Uncaught (in promise) AbortError: Transition was skipped', false),
    array('The user aborted a request.', false),
    array("Cannot read properties of undefined (reading 'transition')", false),
    array('Failed to fetch', false),
    // The ResizeObserver notice (2026-10-21): harmless in both wordings; anything
    // else that merely names ResizeObserver is not.
    array('ResizeObserver loop completed with undelivered notifications.', true),
    array('ResizeObserver loop limit exceeded', true),
    array('  resizeobserver loop COMPLETED with undelivered notifications', true),
    array('ResizeObserver loop', false),
    array('Uncaught ReferenceError: ResizeObserver is not defined', false),
    array('Uncaught Error: ResizeObserver loop limit exceeded', false),
    array('', false),
    array(null, false),
);
$nCases = count($cases);
$r1Name = "the rule: the three abort forms and the ResizeObserver notice (both wordings) are harmless (any case, trimmed), nothing else is ($nCases messages)";
if ($haveRule) {
    $bad = array();
    foreach ($cases as $c) { $got = penumbraClientErrorIsBenign($c[0]); if ($got !== $c[1]) $bad[] = var_export($c[0], true) . '=>' . var_export($got, true); }
    T('R1', $r1Name, !$bad, $bad ? implode('; ', $bad) : "$nCases/$nCases");
} else {
    T('R1', $r1Name, false, 'missing in db_connection.php: ' . implode(', ', $missing));
}

// ---- the collector uses the SAME rule, behind its kind gate --------------------
// Since 2026-10-21 the gate admits error events as well as rejections (the
// ResizeObserver notice arrives as an error event): the message decides, as in
// every count. A resource failure (a file that did not load) never matches.
$col = lift_fn($log, 'penumbra_client_error_is_benign');
if ($col === null && preg_match('/function penumbra_client_error_is_benign\(.*?\n\}\n/s', $log, $mm)) $col = $mm[0];
$r2Name = 'the collector drops exactly those (error events and unhandled rejections, never a resource failure) through the SHARED rule, no regex of its own';
if ($col !== null && $haveRule) {
    eval($col);
    $kc = array(
        array('unhandledrejection', 'Transition was skipped', true),
        array('unhandledrejection', 'Skipped ViewTransition due to another transition starting.', true),
        array('unhandledrejection', 'Transition was aborted because of invalid state.', true),
        array('error', 'ResizeObserver loop completed with undelivered notifications.', true),
        array('error', 'ResizeObserver loop limit exceeded', true),
        array('error', 'Transition was skipped', true),
        array('resource', 'Transition was skipped', false),
        array('resource', 'ResizeObserver loop completed with undelivered notifications.', false),
        array('unhandledrejection', 'Failed to fetch', false),
        array('error', "Uncaught TypeError: Cannot read properties of null (reading 'isConnected')", false),
    );
    $bad = array();
    foreach ($kc as $c) { $got = penumbra_client_error_is_benign($c[0], $c[1]); if ($got !== $c[2]) $bad[] = $c[0] . '/' . $c[1] . '=>' . var_export($got, true); }
    $usesShared = (bool)preg_match('/return\s+penumbraClientErrorIsBenign\(\$message\)/', $col) && !preg_match('/preg_match\(/', $col);
    T('R2', $r2Name, !$bad && $usesShared, ($bad ? implode('; ', $bad) : count($kc) . '/' . count($kc)) . ' shared=' . var_export($usesShared, true));
} else {
    T('R2', $r2Name, false, $col === null ? 'collector function not found' : 'no shared rule to call');
}

// ---- the SQL twin -------------------------------------------------------------
$pat = '^(Transition was (skipped|aborted)|Skipped ViewTransition|ResizeObserver loop (completed with undelivered notifications|limit exceeded))';
if ($haveRule) {
    $want  = "(CASE WHEN ACTION <> 'CLIENT_ERROR' THEN 0 WHEN REGEXP_LIKE(TRIM(JSON_VALUE(SOURCE_DATA, '$.message')), '" . $pat . "', 'i') THEN 1 ELSE 0 END) = 1";
    $wantA = str_replace(array('ACTION <>', 'JSON_VALUE(SOURCE_DATA'), array('a.ACTION <>', 'JSON_VALUE(a.SOURCE_DATA'), $want);
    // QUERY_FAIL joined the set 2026-10-30 (suite qfail).
    $set   = "'BADPASS','DENIED','DENIED_SCOPE','DENIED_IMPORT','EMAIL_FAIL','SCHEDULE_RUN_FAIL','SCHEDULE_FAIL','SCHEDULE_NOAUTH','QUERY_TIMEOUT','QUERY_TOOBIG','QUERY_FAIL','CLIENT_ERROR'";
    $okB  = penumbraBenignClientErrorSql() === $want;
    $okBA = penumbraBenignClientErrorSql('a') === $wantA;
    $okC  = penumbraErrorCondSql() === "(ACTION IN ($set) AND NOT $want)";
    $okCA = penumbraErrorCondSql('a') === "(a.ACTION IN ($set) AND NOT $wantA)";
    // ONE pattern for both engines: the PCRE test and the SQL twin both call it.
    $isFn  = lift_fn($db, 'penumbraClientErrorIsBenign');
    $sqlFn = lift_fn($db, 'penumbraBenignClientErrorSql');
    $onePat = penumbraBenignClientErrorPattern() === $pat && strpos($isFn, 'penumbraBenignClientErrorPattern()') !== false && strpos($sqlFn, 'penumbraBenignClientErrorPattern()') !== false;
    T('S1', 'the SQL twin: CLIENT_ERROR rows only (the JSON is read for nothing else), the same pattern as PHP, alias-qualified; the error condition = the set AND NOT a harmless abort', $okB && $okBA && $okC && $okCA && $onePat,
      'benign=' . var_export($okB, true) . ' benign(a)=' . var_export($okBA, true) . ' cond=' . var_export($okC, true) . ' cond(a)=' . var_export($okCA, true) . ' onePattern=' . var_export($onePat, true));
    $p = penumbraBenignClientErrorPattern();
    T('S2', 'the pattern stays dialect-safe (letters, spaces, ^ ( ) | only - PCRE and Oracle read it alike)', (bool)preg_match('/^[A-Za-z ^()|]+$/', $p), $p);
} else {
    T('S1', 'the SQL twin: CLIENT_ERROR rows only (the JSON is read for nothing else), the same pattern as PHP, alias-qualified; the error condition = the set AND NOT a harmless abort', false, 'no rule');
    T('S2', 'the pattern stays dialect-safe (letters, spaces, ^ ( ) | only - PCRE and Oracle read it alike)', false, 'no rule');
}

// ---- every consumer counts and lists through the condition ---------------------
function has_all($s, $needles, &$miss) { $miss = array(); foreach ($needles as $k => $n) if (strpos($s, $n) === false) $miss[] = $k; return !$miss; }
$m1 = array(); $ok1 = has_all($aud, array(
    'bad family'   => "'bad'     => \"(\" . penumbraErrorCondSql() . \" OR ACTION = 'AUDIT_ACK')\"",
    'chip counts'  => "\" WHEN \" . penumbraErrorCondSql() . \" OR ACTION = 'AUDIT_ACK' THEN 'bad'\"",
    'cond var'     => '$errCond = penumbraErrorCondSql();',
    'benign var'   => '$benign  = penumbraBenignClientErrorSql();',
    'ERRORS'       => 'COUNT(CASE WHEN $errCond THEN 1 END) AS ERRORS,',
    'ERRORS_TODAY' => 'COUNT(CASE WHEN $errCond AND TIMESTAMP >= TRUNC(SYSDATE) THEN 1 END) AS ERRORS_TODAY,',
    'ERR_LAST'     => "TO_CHAR(MAX(CASE WHEN \$errCond THEN TIMESTAMP END), 'Mon FMDD') AS ERR_LAST,",
    'ERR_BROWSER'  => "COUNT(CASE WHEN ACTION = 'CLIENT_ERROR' AND NOT \$benign THEN 1 END) AS ERR_BROWSER,",
    'ERR_BLAST'    => "TO_CHAR(MAX(CASE WHEN ACTION = 'CLIENT_ERROR' AND NOT \$benign THEN TIMESTAMP END), 'Mon FMDD') AS ERR_BLAST,",
), $m1);
T('C1', 'Auditor (get_audit_log.php): Security & errors (list + chip), Errors / today / last, browser count + last - all without the aborts', $ok1, $ok1 ? 'all 9' : 'missing: ' . implode(', ', $m1));
// Since 2026-10-01 (step 2 of folding report metrics into Platform Metrics) both
// pages take their KPI counters from ONE catalog in analytics_shared.php: the
// browser bucket and the error total are defined there once, and each page asks
// for them by name. So C2/C3 pin the catalog's two definitions AND each page's
// request for them (the sparkline and Platform's preset + list stay inline).
$mc = array(); $okc = has_all($sh, array(
    'catalog browser bucket' => "case 'client_errors':        return \"COUNT(CASE WHEN ACTION='CLIENT_ERROR' AND NOT \" . penumbraBenignClientErrorSql() . \" \$t THEN 1 END)\";",
    'catalog error total'    => "case 'errors':               return \"COUNT(CASE WHEN \" . penumbraErrorCondSql() . \" \$t THEN 1 END)\";",
), $mc);
// The report's card sparks (the errors spark among them) are built in
// analytics_shared.php since 2026-10-01 (penumbra_an_report_sparks(), the one
// engine's E2a): the page requests the catalog counters, the shared builder
// draws the spark - both pinned.
// The page's own counter requests (browser bucket, error total) moved with them
// into penumbra_an_report_system(); the page calls both builders.
// Since the switch (2026-10-02) analytics.php is the engine's wrapper - a
// report's metrics page IS analytics_all.php at report scope, which calls the
// same two builders. Judge whichever the files under test carry.
$anIsWrapper = (strpos($an, "define('PENUMBRA_AN_REPORT_SCOPE', true);") !== false && strlen($an) < 4000);
$m2a = array(); $m2s = array();
$okA = $anIsWrapper
    ? has_all($all, array(
        'calls the system builder' => 'list($anRepSys, $anRepBpIps) = penumbra_an_report_system($run, $anRid, $anWin, ',
        'calls the spark builder'  => '$anRepSp    = penumbra_an_report_sparks($run, $anRid, $anWin, ',
      ), $m2a)
    : has_all($an, array(
        'calls the system builder' => 'list($sys, $bpIps) = penumbra_an_report_system($run, $report_id_num, $anWin, ',
        'calls the spark builder'  => '$anSparks = penumbra_an_report_sparks($run, $report_id_num, $anWin, ',
      ), $m2a);
$okS = has_all($sh, array(
    'browser bucket' => "'CLIENT_ERR_COUNT' => 'client_errors',",
    'error total'    => "'ERR_TOTAL_COUNT'  => 'errors',",
    'spark var'      => '$errCondSql = penumbraErrorCondSql();',
    'spark ERRS'     => 'COUNT(CASE WHEN $errCondSql THEN 1 END) AS ERRS,',
), $m2s);
$m2  = array_merge($m2a, $m2s);
$ok2 = $okA && $okS && $okc;
T('C2', 'Report metrics (' . ($anIsWrapper ? 'the engine at report scope' : 'analytics.php') . ' + the shared counter catalog): the browser bucket, the Errors total and the errors sparkline', $ok2, $ok2 ? 'all 8' : 'missing: ' . implode(', ', array_merge($m2, $mc)));
$m3 = array(); $ok3 = has_all($all, array(
    'vars'           => '$errorCondSql    = penumbraErrorCondSql();',
    'vars a'         => "\$errorCondSqlA   = penumbraErrorCondSql('a');",
    'Errors preset'  => "'errors'  => array('label' => 'Errors',       'sql' => \"AND \$errorCondSql\"),",
    'browser bucket' => "'CLIENT_ERR_COUNT' => 'client_errors',",
    'error total'    => "'ERR_TOTAL_COUNT'  => 'errors',",
    // Both carry the same WHERE line since the per-report count joined (seen
    // 2026-10-21), so each is pinned by the line after it.
    'Errors list'    => "WHERE \$errorCondSqlA \$timeFilterA \$whenFilterA \$userFilterA \$reportFilterA\n          ORDER BY a.TIMESTAMP DESC",
    'per-report count' => "WHERE \$errorCondSqlA \$timeFilterA \$whenFilterA \$userFilterA \$reportFilterA\n              GROUP BY a.REPORT_ID",
), $m3) && $okc;
T('C3', 'Platform Metrics (analytics_all.php + the shared counter catalog): the Errors preset, browser bucket, Errors total, the Errors tab list and its per-report count', $ok3, $ok3 ? 'all 9' : 'missing: ' . implode(', ', array_merge($m3, $mc)));
// Since 2026-10-01 (the hub's window picker) the count and the list take their
// time predicate from penumbra_health_window_sql(), whose default is still the
// last N hours on the database clock - so C4 pins the condition, the shared
// predicate, and that default.
$m4 = array(); $ok4 = has_all($hl, array(
    'failure counts'   => "WHERE \" . penumbraErrorCondSql() . \$tSql . \"",
    'recent list'      => "WHERE \" . penumbraErrorCondSql('a') . \$tSql . \"",
    'count window'     => "list(\$tSql, \$tBind) = penumbra_health_window_sql(\$win, 'TIMESTAMP', \$hours);",
    'list window'      => "list(\$tSql, \$tBind) = penumbra_health_window_sql(\$win, 'a.TIMESTAMP', \$hours);",
    'default 24 hours' => "return array(\" AND \$col >= SYSDATE - (:hrs/24)\", array(':hrs' => (int)\$win['hours']));",
), $m4);
T('C4', 'Health hub + health page (penumbra_health.php): the 24 h failure count and the recent-failures list', $ok4, $ok4 ? 'all 5' : 'missing: ' . implode(', ', $m4));

// Sweep: NO file of the app counts or lists errors with the bare set any more.
$bareRe = '/ACTION IN \(\s*(?:"\s*\.\s*penumbraErrorActionsSql\(\)\s*\.\s*"|\$errSet|\$errorActionsSql|\$errActionsSql|\$badList)\s*\)/';
$hits = array();
// db_connection.php minus penumbraErrorCondSql() itself: the condition's own body
// IS "ACTION IN (the set) AND NOT ..." - S1 pins it exactly.
$swept = array('get_audit_log.php' => $aud, 'analytics.php' => $an, 'analytics_all.php' => $all, 'analytics_shared.php' => $sh, 'penumbra_health.php' => $hl,
               'db_connection.php' => str_replace((string)lift_fn($db, 'penumbraErrorCondSql'), '', $db), 'log_client_error.php' => $log);
$appDir = isset($argv[2]) ? rtrim($argv[2], '\\/') : '';
if ($appDir !== '') {
    foreach (array('', 'plugins', 'includes', 'lib', 'api') as $sub) {
        $g = glob($appDir . ($sub !== '' ? DIRECTORY_SEPARATOR . $sub : '') . DIRECTORY_SEPARATOR . '*.php');
        foreach ($g ? $g : array() as $sf) { $bn = ($sub !== '' ? $sub . '/' : '') . basename($sf); if (!isset($swept[$bn])) $swept[$bn] = file_get_contents($sf); }
    }
}
foreach ($swept as $bn => $s) { if (preg_match_all($bareRe, $s, $mm)) $hits[] = $bn . ' x' . count($mm[0]); }
T('C5', 'no file of the app (' . count($swept) . ' swept) counts or lists errors with the bare error set', !$hits && count($swept) >= 4, $hits ? implode(', ', $hits) : 'clean');

// ---- the report metrics feed's chips -------------------------------------------
// Since the one engine's E3a (2026-10-01) the feed and its family rule live in
// analytics_shared.php (penumbra_an_report_feed / penumbra_an_feed_family);
// before that they were inline in analytics.php ($famFor). Judge whichever the
// files under test carry.
$feedSrc  = (strpos($an, '$famFor = function') !== false) ? $an : $sh;
$famCall  = ($feedSrc === $an) ? '$famFor' : 'penumbra_an_feed_family';
$famFound = false;
if ($feedSrc === $an && preg_match('/\$famFor = function \(.*?\n\};\n/s', $an, $fm)) { $famFound = true; }
elseif ($feedSrc === $sh && preg_match('/function penumbra_an_feed_family\(\$a, \$msg = null\)\n\{\n.*?\n\}\n/s', $sh, $fm)) {
    $famFound = true;
    $fm[0] = str_replace('function penumbra_an_feed_family(', '$famFor = function (', $fm[0]);
    $fm[0] = preg_replace('/\}\n$/', "};\n", $fm[0]);
}
if ($haveRule && $famFound) {
    eval($fm[0]);
    $fc = array(
        array('CLIENT_ERROR', 'Transition was skipped', 'other'),
        array('CLIENT_ERROR', 'Skipped ViewTransition due to another transition starting.', 'other'),
        array('CLIENT_ERROR', 'Uncaught SyntaxError: Missing initializer in const declaration', 'bad'),
        array('CLIENT_ERROR', null, 'bad'),
        array('BADPASS', null, 'bad'),
        array('AUDIT_ACK', null, 'bad'),
        array('OPEN', null, 'view'),
    );
    $bad = array();
    foreach ($fc as $c) { $got = $famFor($c[0], $c[1]); if ($got !== $c[2]) $bad[] = $c[0] . '/' . var_export($c[1], true) . '=>' . $got; }
    T('F1', 'Recent activity chips: a harmless abort is "other", a real browser error (or one with no message) stays under Errors', !$bad, $bad ? implode('; ', $bad) : '7/7');
} else {
    T('F1', 'Recent activity chips: a harmless abort is "other", a real browser error (or one with no message) stays under Errors', false, $haveRule ? 'the family rule not found' : 'no rule');
}
$m6 = array(); $ok6 = has_all($feedSrc, array(
    'init'     => '$famMsg = null;',
    'decoded'  => "if (!empty(\$sd['message'])) { \$parts[] = \$clip(\$sd['message']); \$famMsg = (string)\$sd['message']; }",
    'salvaged' => 'if (is_string($mv) && $mv !== \'\') { $parts[] = $clip($mv); $famMsg = $mv; }',
    'call'     => "'fam'    => $famCall((string)\$r['ACTION'], \$famMsg),",
), $m6);
T('F2', 'the feed hands each row\'s message (decoded, or salvaged from a truncated preview) to the chip classifier', $ok6, $ok6 ? 'all 4' : 'missing: ' . implode(', ', $m6));

// ---- the health hub's log console (2026-10-21) ---------------------------------
// penumbra_log_severity() (penumbra_logs.php) leaves a harmless CLIENT-ERROR line
// uncoloured - the same rule judges the message - and keeps a real one red. The
// lines are log_client_error.php's error_log() one-liner, whose shape the parser
// relies on: pinned too, so the two cannot drift apart.
$l1Name = 'the log console: a harmless browser notice\'s CLIENT-ERROR line is uncoloured (not in "problems only"), a real one stays red; the collector still writes the line shape it parses';
$sevFn = lift_fn($lgs, 'penumbra_log_severity');
if ($sevFn !== null && $haveRule) {
    eval($sevFn);
    $pfx = '[19-Oct-2026 14:49:23 America/New_York] PENUMBRA CLIENT-ERROR: user=bplimon ';
    $lc = array(
        array($pfx . 'report=hitratio kind=error | ResizeObserver loop completed with undelivered notifications. | https://www3.acs.ncsu.edu/sponsor_migration/penumbra/index.php?id=hitratio:0:0', ''),
        array($pfx . 'report=- kind=error | ResizeObserver loop limit exceeded | https://www3.acs.ncsu.edu/sponsor_migration/penumbra/index.php:0:0', ''),
        array($pfx . 'report=- kind=unhandledrejection | Transition was aborted because of invalid state. ViewTransition opt-in disabled | :0:0', ''),
        array($pfx . "report=pipins kind=error | Uncaught TypeError: Cannot read properties of null (reading 'isConnected') | https://www3.acs.ncsu.edu/sponsor_migration/penumbra/js/penumbra_find.js?v=1792435688:1026:33", 'err'),
        // The words in the SOURCE, not the message, change nothing.
        array($pfx . 'report=- kind=error | Uncaught Error: boom | https://www3.acs.ncsu.edu/x/index.php?q=ResizeObserver loop limit exceeded:1:1', 'err'),
        // A report id the collector wrote as one token (spaces -> _) cannot fake the marker.
        array($pfx . 'report=x_kind=error_|_ResizeObserver_loop_limit_exceeded kind=error | Uncaught TypeError: x is undefined | https://www3.acs.ncsu.edu/x/js/main.js?v=1:2:3', 'err'),
        array('[19-Oct-2026 14:49:23 America/New_York] PENUMBRA CLIENT-ERROR: audit write failed: ORA-12170: TNS:Connect timeout occurred', 'err'),
    );
    $bad = array();
    foreach ($lc as $c) { $got = penumbra_log_severity($c[0], 'php'); if ($got !== $c[1]) $bad[] = substr($c[0], 40, 100) . '=>' . var_export($got, true); }
    $shape = has_all($log, array(
        'prefix' => "error_log('PENUMBRA CLIENT-ERROR: user=' . \$currentUserKey",
        'report' => "    . ' report=' . (\$shortId !== '' ? str_replace(' ', '_', \$shortId) : '-')",   // one token: an id cannot fake "kind=... | "
        'kind'   => "    . ' kind=' . \$kind",
        'msg'    => "    . ' | ' . mb_substr(\$message, 0, 200, 'UTF-8')",
    ), $mShape);
    T('L1', $l1Name, !$bad && $shape, ($bad ? implode('; ', $bad) : count($lc) . '/' . count($lc)) . ($shape ? ' shape ok' : ' shape missing: ' . implode(', ', $mShape)));
} else {
    T('L1', $l1Name, false, $sevFn === null ? 'penumbra_log_severity not found in penumbra_logs.php' : 'no rule');
}

$fail = 0;
foreach ($R as $r) { if (!$r[2]) $fail++; printf("%s  %s %s  [%s]\n", $r[2] ? 'PASS' : 'FAIL', $r[0], $r[1], $r[3]); }
printf("TOTAL pass=%d fail=%d\n", count($R) - $fail, $fail);
if ($fail) { $ids = array(); foreach ($R as $r) if (!$r[2]) $ids[] = $r[0]; echo 'FAILED: ' . implode(' ', $ids) . "\n"; }
echo $fail ? "RESULT: RED\n" : "RESULT: GREEN\n";
