<?php
/*
 * qfail (2026-10-30) - a viewer's run that dies with a database or server error
 * writes a QUERY_FAIL audit row next to its (sizeless) OPEN row, and every
 * error surface names it. Offline: lifts the real helpers out of
 * db_connection.php and RUNS the real failure blocks of query.php and the real
 * error-bucket code of both metrics pages against fixtures - no database.
 *
 *   php -n test_qfail.php <dir>
 *       <dir> holds the files under test: db_connection.php, query.php,
 *             analytics_shared.php, analytics_all.php, auditorHelpLightbox.php
 *
 *   M1 the message: connect vs query failure, the database, the error code
 *   M2 ...and never the driver's own words (identifiers, provider text)
 *   D1 the database a run was going to (Oracle target / MS-SQL table / hint)
 *   A1 the row is written for a run WITH an OPEN row only, never the scheduler's,
 *      and a failing audit write never throws
 *   E1 QUERY_FAIL is an error: in the canonical set, the feed's 'bad' family
 *   Q1 query.php's PDOException catch writes it (the InfoEd outage, run for real)
 *   Q2 its Exception catch (query.php's own connect failure; an ORA error on HR)
 *   Q3 a failed [CTE_SUBQUERY] tag   Q4 a failed [SUBQUERY] tag
 *   Q5 the stream's mid-way failure and the JSON encode failure write it too;
 *      the timeout / too-big catches do NOT (they have their own rows)
 *   C1 the metrics counter 'query_fails'
 *   C2 the report page's Errors card: "4 query-fail", reconciles, no "other"
 *   C3 Platform Metrics' Errors breakdown: the same
 *   S1 the feed's QUERY_* badges are red    H1 the Auditor help lists QUERY_FAIL
 *
 * Prints PASS/FAIL lines and RESULT: GREEN|RED.
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('error_log', sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'qfail_test_errlog.txt');
$dir = rtrim($argv[1], '\\/');
$R = array();
function T($id, $name, $pass, $detail = '') { global $R; $R[] = array($id, $name, (bool)$pass, (string)$detail); }
function src($dir, $f) { $p = $dir . DIRECTORY_SEPARATOR . $f; return is_file($p) ? str_replace("\r\n", "\n", file_get_contents($p)) : ''; }
function lift_fn($src, $name) { return preg_match('/^function ' . preg_quote($name, '/') . '\(.*?^\}\n/ms', $src, $m) ? $m[0] : null; }
function between($s, $a, $b, $inclusiveB = false) {
    $i = strpos($s, $a); if ($i === false) return null;
    $j = strpos($s, $b, $i + strlen($a)); if ($j === false) return null;
    return substr($s, $i, $j - $i + ($inclusiveB ? strlen($b) : 0));
}

$db  = src($dir, 'db_connection.php');
$qp  = src($dir, 'query.php');
$sh  = src($dir, 'analytics_shared.php');
$all = src($dir, 'analytics_all.php');
$hlp = src($dir, 'auditorHelpLightbox.php');

// ---- the helpers, lifted (+ a recording logPenumbraAudit) ----------------------
$AUD = array(); $AUD_THROW = false;
function logPenumbraAudit($report_id, $action, $before_json, $after_json, $message = null, $extra_source = null) {
    global $AUD, $AUD_THROW;
    if ($AUD_THROW) throw new Exception('ORA-03113: end-of-file on communication channel');
    $AUD[] = array($report_id, $action, $before_json, $after_json, $message);
    return 4242;
}
$missing = array(); $code = '';
foreach (array('penumbraErrorActions', 'penumbraQueryFailDb', 'penumbraQueryFailMessage', 'penumbraAuditQueryFail') as $n) {
    $f = lift_fn($db, $n); if ($f === null) $missing[] = $n; else $code .= $f;
}
foreach (array('penumbra_an_counter_sql', 'penumbra_an_feed_family') as $n) {
    $f = lift_fn($sh, $n); if ($f === null) $missing[] = $n; else $code .= $f;
}
// penumbra_an_counter_sql / feed_family reach for these on OTHER names; stubs.
$code .= "if (!function_exists('penumbraBenignClientErrorSql')) { function penumbraBenignClientErrorSql(\$a = '') { return '(0=1)'; } }\n"
       . "if (!function_exists('penumbraErrorCondSql')) { function penumbraErrorCondSql(\$a = '') { return '(1=1)'; } }\n"
       . "if (!function_exists('penumbraClientErrorIsBenign')) { function penumbraClientErrorIsBenign(\$m) { return false; } }\n";
$have = !$missing;
if ($have) { eval($code); }
$GLOBALS['pinsTableNames']   = array('PINS_AWARD', 'SHARED_NAME');
$GLOBALS['infoEdTableNames'] = array('IE_PROPOSAL', 'SHARED_NAME');
$whyMissing = 'missing: ' . implode(', ', $missing);

$OUTAGE = 'SQLSTATE[08001] SQLDriverConnect: 53 [Microsoft][SQL Server Native Client 11.0]Named Pipes Provider: Could not open a connection to SQL Server [53]. ';

// ---- M1 / M2 the message --------------------------------------------------------
$mc = array(
    array(new Exception('Required database connection (IEPrd Oracle) failed. The database might be down or inaccessible.'), null, 'Could not connect to IEPrd Oracle.'),
    array(new Exception('Required database connection (InfoEd MS-SQL) failed. The database might be down or inaccessible.'), 'PINS MS-SQL', 'Could not connect to InfoEd MS-SQL.'),
    array(new PDOException($OUTAGE), 'InfoEd MS-SQL', 'Could not connect to InfoEd MS-SQL (SQLSTATE 08001).'),
    array(new PDOException($OUTAGE), null, 'Could not connect to the database (SQLSTATE 08001).'),
    array(new PDOException('SQLSTATE[08S01]: Communication link failure: 10054 TCP Provider: An existing connection was forcibly closed'), 'PINS MS-SQL', 'Could not connect to PINS MS-SQL (SQLSTATE 08S01).'),
    array(new PDOException("SQLSTATE[42S02]: [Microsoft][ODBC Driver 17 for SQL Server][SQL Server]Invalid object name 'dbo.SECRET_TBL'."), 'InfoEd MS-SQL', 'Query failed on InfoEd MS-SQL (SQLSTATE 42S02).'),
    array(new Exception('OCI8 parse failed: ORA-00942: table or view does not exist'), 'IEPrd Oracle', 'Query failed on IEPrd Oracle (ORA-00942).'),
    array(new Exception('OCI8 parse failed: ORA-00904: "P"."SECRET_COL": invalid identifier'), 'HR Oracle', 'Query failed on HR Oracle (ORA-00904).'),
    array(new Exception('OCI8 fetch failed after 812 rows: ORA-12899: value too large for column "X"."SECRET_COL" (actual: 41, maximum: 40)'), 'FIN Oracle', 'Query failed on FIN Oracle (ORA-12899).'),
    array(new Exception('OCI8 fetch failed after 0 rows: ORA-12541: TNS:no listener'), 'IEPrd Oracle', 'Could not connect to IEPrd Oracle (ORA-12541).'),
    array(new Exception('OCI8 fetch failed after 9 rows: ORA-03113: end-of-file on communication channel'), null, 'Could not connect to the database (ORA-03113).'),
    array(new Exception('OCI8 connect failed: ORA-28001: the password has expired'), 'IEPrd Oracle', 'Could not connect to IEPrd Oracle (ORA-28001).'),
    array(new Exception('Undefined index SECRET_COL in C:\\inetpub\\wwwroot\\x.php'), 'IEPrd Oracle', 'Query failed on IEPrd Oracle.'),
    array(new Exception('weird internal SECRET_COL state'), null, 'Query failed.'),
    array(new Exception('weird internal SECRET_COL state'), '', 'Query failed.'),
);
if ($have) {
    $bad = array(); $leak = array();
    foreach ($mc as $i => $c) {
        $got = penumbraQueryFailMessage($c[0], $c[1]);
        if ($got !== $c[2]) $bad[] = "#$i got [$got] want [{$c[2]}]";
        foreach (array('SECRET', 'Named Pipes', 'Microsoft', 'TNS', 'listener', 'inetpub', 'invalid identifier', 'password', 'weird') as $w) {
            if (stripos($got, $w) !== false) $leak[] = "#$i says '$w': $got";
        }
    }
    T('M1', 'the message: connect vs query failure, the database, the error code (' . count($mc) . ' cases)', !$bad, $bad ? implode(' | ', $bad) : count($mc) . '/' . count($mc));
    T('M2', 'the message never carries the driver\'s own words (identifiers, provider text, paths)', !$leak, $leak ? implode(' | ', $leak) : 'clean');
} else {
    T('M1', 'the message', false, $whyMissing); T('M2', 'no driver words', false, $whyMissing);
}

// ---- D1 the database ----------------------------------------------------------------
$dc = array(
    array(array('ieprd'), 'IEPrd Oracle'), array(array('HR'), 'HR Oracle'), array(array('fin'), 'FIN Oracle'),
    array(array('oracle'), 'IEPrd Oracle'), array(array('infoed'), 'InfoEd MS-SQL'), array(array('pins'), 'PINS MS-SQL'),
    array(array('bogus'), null), array(array(''), null),
    array(array(null, null, 'IE_PROPOSAL'), 'InfoEd MS-SQL'), array(array(null, null, 'ie_proposal'), 'InfoEd MS-SQL'),
    array(array(null, null, 'PINS_AWARD'), 'PINS MS-SQL'), array(array(null, null, 'SHARED_NAME'), 'PINS MS-SQL'),
    array(array(null, null, 'SOME_ORACLE_TABLE'), null),
    array(array(null, 'INFOED', null), 'InfoEd MS-SQL'), array(array(null, 'PINS', 'HINT: PINS'), 'PINS MS-SQL'),
    array(array(null, 'INFOED', 'IE_PROPOSAL'), 'InfoEd MS-SQL'), array(array(null, 'PINS', 'IE_PROPOSAL'), 'InfoEd MS-SQL'),
    array(array('hr', 'INFOED', 'IE_PROPOSAL'), 'HR Oracle'),
    array(array(null, null, null), null),
);
if ($have) {
    $bad = array();
    foreach ($dc as $i => $c) {
        $got = call_user_func_array('penumbraQueryFailDb', $c[0]);
        if ($got !== $c[1]) $bad[] = "#$i " . json_encode($c[0]) . ' => ' . var_export($got, true);
    }
    T('D1', 'the database a run was going to: Oracle target, MS-SQL table (PINS first, as getConnectionForTable), DB hint (' . count($dc) . ' cases)', !$bad, $bad ? implode(' | ', $bad) : count($dc) . '/' . count($dc));
} else { T('D1', 'the database', false, $whyMissing); }

// ---- A1 the gate -------------------------------------------------------------------
if ($have) {
    $p = array();
    $AUD = array(); $r1 = penumbraAuditQueryFail(1234, 99, 'mrgrady', 'Could not connect to InfoEd MS-SQL (SQLSTATE 08001).');
    $p[] = ($r1 === true && count($AUD) === 1 && $AUD[0] === array(1234, 'QUERY_FAIL', null, null, 'Could not connect to InfoEd MS-SQL (SQLSTATE 08001).')) ? '' : 'a viewer run: ' . json_encode($AUD);
    $AUD = array(); $r2 = penumbraAuditQueryFail('1234', 99, 'mrgrady', 'x');
    $p[] = ($r2 === true && count($AUD) === 1 && $AUD[0][0] === 1234) ? '' : 'report id not an int: ' . json_encode($AUD);
    $AUD = array(); $r3 = penumbraAuditQueryFail(1234, null, 'mrgrady', 'x');
    $p[] = ($r3 === false && count($AUD) === 0) ? '' : 'wrote with no OPEN row';
    $AUD = array(); $r4 = penumbraAuditQueryFail(1234, 0, 'mrgrady', 'x');
    $p[] = ($r4 === false && count($AUD) === 0) ? '' : 'wrote with OPEN id 0';
    $AUD = array(); $r5 = penumbraAuditQueryFail(1234, 99, 'SCHEDULER', 'x');
    $p[] = ($r5 === false && count($AUD) === 0) ? '' : 'wrote for the scheduler (double count with SCHEDULE_RUN_FAIL)';
    $AUD = array(); $AUD_THROW = true; $thrown = null;
    try { $r6 = penumbraAuditQueryFail(1234, 99, 'mrgrady', 'x'); } catch (Throwable $t) { $thrown = $t->getMessage(); }
    $AUD_THROW = false;
    $p[] = ($thrown === null && isset($r6) && $r6 === false) ? '' : 'a failing audit write escaped: ' . $thrown;
    $p = array_values(array_filter($p));
    T('A1', 'written for a run WITH an OPEN row only, never the scheduler\'s; a failing audit write never throws', !$p, $p ? implode(' | ', $p) : '6/6');
} else { T('A1', 'the gate', false, $whyMissing); }

// ---- E1 an error ----------------------------------------------------------------
if ($have) {
    $inSet = in_array('QUERY_FAIL', penumbraErrorActions(), true);
    $fam = penumbra_an_feed_family('QUERY_FAIL', 'Could not connect to InfoEd MS-SQL (SQLSTATE 08001).');
    T('E1', 'QUERY_FAIL is an error: in penumbraErrorActions(), the feed\'s "bad" family', $inSet && $fam === 'bad', "inSet=" . var_export($inSet, true) . " family=$fam");
} else { T('E1', 'an error', false, $whyMissing); }

// ---- Q1-Q4 the real failure blocks of query.php, run ------------------------------
// Each block is cut from the file and executed with the variables query.php has
// at that point; exit becomes return. $isDebug false = a plain viewer.
function run_block($body, $vars) {
    global $AUD; $AUD = array();
    $f = function () use ($body, $vars) { extract($vars); $isDebug = false; ob_start(); try { eval($body); } finally { $GLOBALS['__out'] = ob_get_clean(); } };
    try { $f(); return null; } catch (Throwable $t) { return get_class($t) . ': ' . $t->getMessage(); }
}
$pdoBody = between($qp, "\n} catch (PDOException \$e) {\n", "\n} catch (Exception \$e) {\n");
$excBody = null;
$ex0 = strpos($qp, "\n} catch (Exception \$e) {\n    http_response_code(500);\n    error_log(\"PENUMBRA Exception for user");
if ($ex0 !== false) { $excBody = substr($qp, $ex0); $excBody = substr($excBody, 0, strrpos($excBody, "\n}")); }
$strip = function ($b, $head) { return $b === null ? null : substr($b, strpos($b, $head) + strlen($head)); };
$pdoRun = $strip($pdoBody, "} catch (PDOException \$e) {\n");
$excRun = $strip($excBody, "} catch (Exception \$e) {\n");
$cteBody = between($qp, "    } catch (Exception \$e) {\n        error_log(\"CTE Subquery Failed: ", "\n        exit;\n    }", true);
$subBody = between($qp, "    } catch (Exception \$e) {\n        error_log(\"Subquery Failed: ", "\n        exit;\n    }", true);
$cteRun = $cteBody === null ? null : str_replace('exit;', 'return;', substr($cteBody, strpos($cteBody, "{\n") + 2, -strlen("\n    }")));
$subRun = $subBody === null ? null : str_replace('exit;', 'return;', substr($subBody, strpos($subBody, "{\n") + 2, -strlen("\n    }")));
if (!function_exists('penumbraSubqueryErrorMessage')) { function penumbraSubqueryErrorMessage($t, $d, $e) { return "Cross-database $t failed on db=$d: $e"; } }

$viewer = array('report_id_num' => 1234, 'penumbraOpenAuditId' => 99, 'currentUserKey' => 'mrgrady',
                'oraTarget' => null, 'dbHint' => null, 'targetTableName' => 'IE_PROPOSAL', 'query_template' => 'SELECT 1', 'params' => array());
if ($have && $pdoRun !== null) {
    $p = array();
    $err = run_block($pdoRun, $viewer + array('e' => new PDOException($OUTAGE)));
    $out = isset($GLOBALS['__out']) ? $GLOBALS['__out'] : '';
    if ($err) $p[] = "threw $err";
    elseif (count($AUD) !== 1 || $AUD[0] !== array(1234, 'QUERY_FAIL', null, null, 'Could not connect to InfoEd MS-SQL (SQLSTATE 08001).')) $p[] = 'outage row: ' . json_encode($AUD);
    if (strpos($out, '"Query execution failed."') === false) $p[] = "response changed: $out";
    $err = run_block($pdoRun, array('currentUserKey' => 'SCHEDULER') + $viewer + array('e' => new PDOException($OUTAGE)));
    if ($err || count($AUD) !== 0) $p[] = 'scheduler: ' . ($err ?: json_encode($AUD));
    $nv = $viewer; unset($nv['penumbraOpenAuditId']);
    $err = run_block($pdoRun, $nv + array('e' => new PDOException($OUTAGE)));
    if ($err || count($AUD) !== 0) $p[] = 'no OPEN row (ad-hoc SQL): ' . ($err ?: json_encode($AUD));
    T('Q1', 'query.php\'s PDOException catch, RUN on the InfoEd outage: one QUERY_FAIL row "Could not connect to InfoEd MS-SQL (SQLSTATE 08001).", the response unchanged; none for the scheduler or a run with no OPEN row', !$p, $p ? implode(' | ', $p) : '3/3');
} else { T('Q1', 'the PDOException catch', false, $have ? 'catch block not found in query.php' : $whyMissing); }

if ($have && $excRun !== null) {
    $p = array();
    $err = run_block($excRun, array('oraTarget' => 'ieprd', 'targetTableName' => 'PROPOSALS') + $viewer + array('e' => new Exception('Required database connection (IEPrd Oracle) failed. The database might be down or inaccessible.')));
    if ($err || count($AUD) !== 1 || $AUD[0][4] !== 'Could not connect to IEPrd Oracle.') $p[] = 'connect: ' . ($err ?: json_encode($AUD));
    $err = run_block($excRun, array('oraTarget' => 'hr', 'targetTableName' => 'HR_TBL') + $viewer + array('e' => new Exception('OCI8 parse failed: ORA-00942: table or view does not exist')));
    if ($err || count($AUD) !== 1 || $AUD[0][4] !== 'Query failed on HR Oracle (ORA-00942).') $p[] = 'ORA on HR: ' . ($err ?: json_encode($AUD));
    if (strpos($GLOBALS['__out'], 'An unexpected error occurred.') === false) $p[] = 'response changed: ' . $GLOBALS['__out'];
    $vb = $viewer; unset($vb['oraTarget'], $vb['dbHint'], $vb['targetTableName']);   // failed before any target was chosen
    $err = run_block($excRun, $vb + array('e' => new Exception('weird')));
    if ($err || count($AUD) !== 1 || $AUD[0][4] !== 'Query failed.') $p[] = 'no target yet: ' . ($err ?: json_encode($AUD));
    T('Q2', 'its Exception catch, RUN: query.php\'s own connect failure "Could not connect to IEPrd Oracle.", an ORA error on HR, a failure before any target', !$p, $p ? implode(' | ', $p) : '3/3');
} else { T('Q2', 'the Exception catch', false, $have ? 'catch block not found in query.php' : $whyMissing); }

foreach (array(array('Q3', 'CTE_SUBQUERY', $cteRun), array('Q4', 'SUBQUERY', $subRun)) as $sq) {
    if ($have && $sq[2] !== null) {
        $err = run_block($sq[2], $viewer + array('e' => new PDOException($OUTAGE), 'tag' => array('db' => 'infoed', 'query' => 'SELECT 1')));
        $ok = !$err && count($AUD) === 1 && $AUD[0] === array(1234, 'QUERY_FAIL', null, null, 'Could not connect to InfoEd MS-SQL (SQLSTATE 08001).')
              && strpos($GLOBALS['__out'], 'Cross-database ' . $sq[1] . ' failed on db=infoed') !== false;
        T($sq[0], 'a failed [' . $sq[1] . ':infoed] tag, RUN: the QUERY_FAIL row names InfoEd, the 400 answer unchanged', $ok, $err ?: (json_encode($AUD) . ' | ' . $GLOBALS['__out']));
    } else { T($sq[0], 'a failed [' . $sq[1] . '] tag', false, $have ? 'catch block not found in query.php' : $whyMissing); }
}

// ---- Q5 the other two failure paths, and the two that must NOT ------------------
$streamBr = between($qp, "                if (\$penumbraStreamStarted) {\n", "                    exit;\n");
$jsonBr   = between($qp, "        echo json_encode([\"error\" => \"Failed to encode query results as JSON.\"]);", "    } else {");
$toBr     = between($qp, "} catch (PenumbraQueryTimeoutException \$e) {", "} catch (PenumbraResultTooLargeException \$e) {");
$bigBr    = between($qp, "} catch (PenumbraResultTooLargeException \$e) {", "} catch (PDOException \$e) {");
$q5 = array();
if ($streamBr === null || strpos($streamBr, 'penumbraAuditQueryFail(') === false || strpos($streamBr, 'penumbraQueryFailMessage($streamEx') === false) $q5[] = 'the mid-stream failure writes no row';
if ($jsonBr === null || strpos($jsonBr, 'penumbraAuditQueryFail(') === false) $q5[] = 'the JSON encode failure writes no row';
if ($toBr === null || strpos($toBr, 'penumbraAuditQueryFail') !== false) $q5[] = 'the timeout catch also writes QUERY_FAIL (two rows for one failure)';
if ($bigBr === null || strpos($bigBr, 'penumbraAuditQueryFail') !== false) $q5[] = 'the too-big catch also writes QUERY_FAIL (two rows for one failure)';
T('Q5', 'the mid-stream failure and the JSON encode failure write it too; the timeout and too-big catches do not (they write their own rows)', !$q5, $q5 ? implode(' | ', $q5) : '4/4');

// ---- C1-C3 the metrics pages -------------------------------------------------------
if ($have) {
    try { $c1 = penumbra_an_counter_sql('query_fails', array('timeFilter' => 'AND T', 'priorFilter' => 'AND P')); }
    catch (Throwable $t) { $c1 = 'threw: ' . $t->getMessage(); }
    $maps = (substr_count($sh, "'QFAIL_COUNT'      => 'query_fails',") === 1) && (substr_count($all, "'QFAIL_COUNT'      => 'query_fails',") === 1);
    T('C1', 'the counter "query_fails" = COUNT of QUERY_FAIL in the window; both pages ask for it', $c1 === "COUNT(CASE WHEN ACTION='QUERY_FAIL' AND T THEN 1 END)" && $maps, "sql=$c1 maps=" . var_export($maps, true));
} else { T('C1', 'the counter', false, $whyMissing); }

$card = between($sh, "    \$errTotal = (int)\$sys['ERR_TOTAL_COUNT'];", "    \$errorsSub = empty(\$errBits) ? ('none in ' . \$rangeLabelShort) : implode(' · ', \$errBits);", true);
if ($card !== null) {
    $runCard = function ($sys) use ($card) { try { $rangeLabelShort = '30D'; eval($card . "\n"); return $errorsSub; } catch (Throwable $t) { return 'threw: ' . $t->getMessage(); } };
    $z = array('BADPASS_COUNT' => 0, 'BADPASS_IP_COUNT' => 0, 'DENIED_COUNT' => 0, 'EMAILFAIL_COUNT' => 0, 'SCHED_FAIL_COUNT' => 0, 'TIMEOUT_COUNT' => 0, 'CLIENT_ERR_COUNT' => 0, 'QFAIL_COUNT' => 0);
    $a = $runCard(array('ERR_TOTAL_COUNT' => 4, 'QFAIL_COUNT' => 4) + $z);
    $b = $runCard(array('ERR_TOTAL_COUNT' => 7, 'QFAIL_COUNT' => 4, 'TIMEOUT_COUNT' => 2, 'DENIED_COUNT' => 1) + $z);
    T('C2', 'the report page\'s Errors card, RUN: "4 query-fail"; with a timeout + a denial "1 denied · 2 timeout · 4 query-fail" (reconciles, no "other")', $a === '4 query-fail' && $b === '1 denied · 2 timeout · 4 query-fail', "[$a] [$b]");
} else { T('C2', 'the report page\'s Errors card', false, 'segment not found in analytics_shared.php'); }

$brk = between($all, "\$badpass   = (int)\$k['BADPASS_COUNT'];", "\$errSub = empty(\$errBits) ? 'no failures in ' . \$rangeLabelShort : implode(' · ', \$errBits);", true);
if ($brk !== null) {
    $runBrk = function ($k) use ($brk) { try { $rangeLabelShort = '30D'; eval($brk . "\n"); return $errSub; } catch (Throwable $t) { return 'threw: ' . $t->getMessage(); } };
    $z = array('BADPASS_COUNT' => 0, 'EMAIL_FAIL_COUNT' => 0, 'DENIED_COUNT' => 0, 'SCHED_FAIL_COUNT' => 0, 'TIMEOUT_COUNT' => 0, 'CLIENT_ERR_COUNT' => 0, 'QFAIL_COUNT' => 0);
    $a = $runBrk(array('ERR_TOTAL_COUNT' => 1204, 'QFAIL_COUNT' => 1204) + $z);
    $b = $runBrk(array('ERR_TOTAL_COUNT' => 9, 'QFAIL_COUNT' => 4, 'SCHED_FAIL_COUNT' => 5) + $z);
    T('C3', 'Platform Metrics\' Errors breakdown, RUN: "1,204 query-fail"; "5 schedule · 4 query-fail" (reconciles, no "other")', $a === '1,204 query-fail' && $b === '5 schedule · 4 query-fail', "[$a] [$b]");
} else { T('C3', 'Platform Metrics\' Errors breakdown', false, 'segment not found in analytics_all.php'); }

// ---- S1 / H1 ----------------------------------------------------------------------
$css = preg_match('/^\s*\.act\.QUERY_FAIL, \.act\.QUERY_TIMEOUT, \.act\.QUERY_TOOBIG \{[^}]*var\(--an-danger\)[^}]*\}/m', $all);
T('S1', 'the activity feed\'s QUERY_FAIL / QUERY_TIMEOUT / QUERY_TOOBIG badges wear the danger colour', (bool)$css, $css ? 'present' : 'no .act.QUERY_FAIL rule');
T('H1', 'the Auditor help\'s action table lists QUERY_FAIL', strpos($hlp, '<code>QUERY_FAIL</code></td>') !== false, '');

// ---- report -------------------------------------------------------------------------
$f = 0;
foreach ($R as $r) { if (!$r[2]) $f++; echo ($r[2] ? 'PASS' : 'FAIL') . "  {$r[0]}  {$r[1]}" . ($r[3] !== '' ? "  [{$r[3]}]" : '') . "\n"; }
echo 'TOTAL pass=' . (count($R) - $f) . " fail=$f\n";
if ($f) echo 'FAILED: ' . implode(' ', array_map(function ($r) { return $r[0]; }, array_filter($R, function ($r) { return !$r[2]; }))) . "\n";
echo 'RESULT: ' . ($f ? 'RED' : 'GREEN') . "\n";
