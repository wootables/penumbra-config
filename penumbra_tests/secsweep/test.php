<?php
// penumbra_tests\secsweep\test.php <dir holding the eleven files>
//
// The five code items of the 2026-09-04 security sweep, closed 2026-10-01, no database
// and no web server:
//  1. The server-side CSV formula guard (penumbraCsvGuardCell in shared_logic.php), lifted
//     by its markers: the browser rule - `=` `@` TAB CR always quoted, `+`/`-` only when
//     not a plain number - and the generated stub's twin (csvGuardCell, lifted out of
//     generate_stub.php's heredoc) giving the same answer for every case; the runner's
//     five fputcsv sites and the stub's two wrapped (static).
//  2. penumbraSessionStart() (db_connection.php), lifted: the cookie flags it sets -
//     HttpOnly, SameSite=Lax, Secure only under HTTPS - and the three admin tools calling
//     it instead of session_start() (static).
//  3. penumbraIsConsoleAudience() (db_connection.php), lifted with a stub connection:
//     admin / grant holder pass, a grant-less caller fails CLOSED without a database;
//     manage_table_info.php gates on it after authentication, ai_assist.php delegates
//     to it (static).
//  4. log_client_error.php files the error under a report only through
//     userCanAccessReport (static).
//  5. manage_snapshots.php: the pin rule (creator / owner / admin) before the UPDATE
//     (static); the two helpers lifted and the creator comparison checked.
// Prints "N assertions, F failed" and exits 1 on a failure. The pre-fix files are the
// positive control: FATAL (no guard to lift).
$APP = isset($argv[1]) ? rtrim($argv[1], '\\/') : '';
$NEED = array('db_connection.php', 'shared_logic.php', 'schedule_runner.php', 'generate_stub.php', 'grants_admin.php',
              'tags_admin.php', 'system_notice.php', 'manage_table_info.php', 'log_client_error.php', 'manage_snapshots.php', 'ai_assist.php');
foreach ($NEED as $need) {
    if ($APP === '' || !is_file($APP . '/' . $need)) { fwrite(STDERR, "usage: php test.php <dir holding $need>\n"); exit(2); }
}
$pass = 0; $fail = 0; $lines = array();
function ok($name, $cond, $detail = '') {
    global $pass, $fail, $lines;
    if ($cond) { $pass++; $lines[] = "  PASS  $name"; }
    else { $fail++; $lines[] = "  FAIL  $name" . ($detail !== '' ? "\n        $detail" : ''); }
}
function rd($p) { return str_replace("\r\n", "\n", file_get_contents($p)); }
function between($src, $from, $to, $what) {
    $s = strpos($src, $from); $e = ($s === false) ? false : strpos($src, $to, $s);
    if ($s === false || $e === false) { echo "FATAL: $what markers not found (pre-fix file?)\n"; echo "1 assertions, 1 failed\n"; exit(1); }
    return substr($src, $s, $e - $s);
}

// ---- 1. the CSV guard and its stub twin
$logic = rd($APP . '/shared_logic.php');
eval(between($logic, "/**\n * Spreadsheet formula injection, server side", '// -- end of the CSV formula guard --', "the CSV guard's"));
ok('the CSV guard lifted', function_exists('penumbraCsvGuardCell') && function_exists('penumbraCsvGuardRow'));
$stub = rd($APP . '/generate_stub.php');
$twin = between($stub, 'function csvGuardCell(\$v) {', "\nfunction resultsToCsv(", "the stub twin's");
$twin = str_replace('\\\\', '\\', $twin);   // the heredoc's \\t \\r \\d \\. -> \t \r \d \.
$twin = str_replace('\\$', '$', $twin);     // and its \$ -> $
eval($twin);
ok('the stub\'s twin lifted out of the heredoc (its escapes undone)', function_exists('csvGuardCell'));
$CASES = array(
    '=SUM(A1:A9)' => "'=SUM(A1:A9)", '@cmd' => "'@cmd", "\tx" => "'\tx", "\rx" => "'\rx", '=' => "'=",
    '+1234' => '+1234', '-1234.5' => '-1234.5', '-1,234.50' => '-1,234.50', '+1e5' => '+1e5',
    '+x' => "'+x", '-abc' => "'-abc", '-1 and 2' => "'-1 and 2",
    '-' => '-', '+' => '+', '' => '', 'plain' => 'plain', '12' => '12', ' =not first' => ' =not first',
    // 2026-10-04: a plain number may carry a leading $ and a trailing % (a pivot's
    // % Change cells exported as '-26.7%); anything more is still quoted
    '-26.7%' => '-26.7%', '-100.0%' => '-100.0%', '+5%' => '+5%', '-$1,234.50' => '-$1,234.50', '+$12' => '+$12',
    '-1%+1' => "'-1%+1", '-$x' => "'-\$x", '-%' => "'-%", '-$' => "'-\$", '-5%%' => "'-5%%", '-%5' => "'-%5"
);
$bad = array();
foreach ($CASES as $in => $want) { $got = penumbraCsvGuardCell($in); if ($got !== $want) { $bad[] = json_encode(array($in, $got, $want)); } }
ok('the guard: = @ TAB CR always quoted; + and - only when not a plain number; a lone sign, empty and plain text untouched', !$bad, implode(' ', $bad));
ok('the guard: null reads as an empty cell', penumbraCsvGuardCell(null) === '');
$dis = array();
foreach ($CASES as $in => $want) { if (csvGuardCell($in) !== penumbraCsvGuardCell($in)) { $dis[] = json_encode(array($in, csvGuardCell($in), penumbraCsvGuardCell($in))); } }
ok('the stub\'s twin agrees with the shared guard on every case', !$dis, implode(' ', $dis));
// The browser's twin (main.js neutralizeFormulaInjection) uses the SAME plain-number
// pattern (2026-10-04). main.js from <dir> when it holds one, else live.
$mainJs = is_file($APP . '/main.js') ? $APP . '/main.js' : '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\js\\main.js';
$js = rd($mainJs);
$jsFn = between($js, 'function neutralizeFormulaInjection(str) {', "\n    function escapeCsvCell(", "main.js neutralizeFormulaInjection's");
preg_match('/const isPlainNumber = (\/.*\/)\.test\(/', $jsFn, $jm);
preg_match("/preg_match\('(\/[^']*\/)', trim\(\\\$s\)\)/", $logic, $pm);
ok('the browser twin (main.js) uses the same plain-number pattern as the server guard',
   isset($jm[1], $pm[1]) && $jm[1] === $pm[1], 'js ' . (isset($jm[1]) ? $jm[1] : '?') . ' | php ' . (isset($pm[1]) ? $pm[1] : '?'));
ok('the row guard maps every cell, headers included', penumbraCsvGuardRow(array('=a', 'b', '-1')) === array("'=a", 'b', '-1'));
$runner = rd($APP . '/schedule_runner.php');
ok('the runner wraps its five fputcsv sites', substr_count($runner, 'fputcsv($fp, penumbraCsvGuardRow(') === 5 && !preg_match('/fputcsv\(\$fp, \$/', $runner), substr_count($runner, 'fputcsv($fp, penumbraCsvGuardRow(') . ' wrapped');
ok('the stub wraps its two fputcsv sites', substr_count($stub, "array_map('csvGuardCell'") === 2 && strpos($stub, 'fputcsv(\$df, \$row);') === false);

// ---- 2. the session helper
$db = rd($APP . '/db_connection.php');
eval(between($db, "if (!function_exists('penumbraSessionStart')) {", '// -- end of the session helper --', "the session helper's"));
ok('the session helper lifted', function_exists('penumbraSessionStart'));
unset($_SERVER['HTTPS'], $_SERVER['SERVER_PORT'], $_SERVER['HTTP_X_FORWARDED_PROTO']);
$startedA = @penumbraSessionStart();
$pA = session_get_cookie_params();
ok('plain HTTP: the session starts with HttpOnly and SameSite=Lax, Secure off', $startedA && session_status() === PHP_SESSION_ACTIVE && $pA['httponly'] === true && $pA['samesite'] === 'Lax' && $pA['secure'] === false, json_encode($pA));
ok('an active session is left alone (a second call is true, no restart)', penumbraSessionStart() === true);
session_write_close();
$_SERVER['HTTPS'] = 'on';
$startedB = @penumbraSessionStart();
$pB = session_get_cookie_params();
ok('HTTPS: Secure on as well', $startedB && $pB['secure'] === true && $pB['httponly'] === true && $pB['samesite'] === 'Lax', json_encode($pB));
session_write_close();
foreach (array('grants_admin.php', 'tags_admin.php', 'system_notice.php') as $tool) {
    $src = rd($APP . '/' . $tool);
    // A bare call is a statement on its own line; the helper's trailing comment names session_start() too.
    ok("$tool starts its session through the helper, never bare", strpos($src, 'penumbraSessionStart();') !== false && !preg_match('/^\s*session_start\(\);/m', $src));
}

// ---- 3. the console audience
if (!function_exists('getConnectionForTable')) { function getConnectionForTable($t) { return false; } }
eval(between($db, "if (!function_exists('penumbraIsConsoleAudience')) {", '// -- end of the console audience predicate --', "the audience predicate's"));
ok('the audience predicate lifted', function_exists('penumbraIsConsoleAudience'));
ok('an admin passes without a lookup', penumbraIsConsoleAudience(true, null, '') === true);
ok('a SQL-grant or report-grant holder passes', penumbraIsConsoleAudience(false, array('sql' => array('X')), 'u') === true && penumbraIsConsoleAudience(false, array('reports' => array('r1')), 'u') === true);
ok('a grant-less caller with no database fails CLOSED; an empty key fails', penumbraIsConsoleAudience(false, array(), 'u') === false && penumbraIsConsoleAudience(false, null, '') === false);
$tinfo = rd($APP . '/manage_table_info.php');
$pDeny = strpos($tinfo, 'penumbraDenyUnauthenticated()');
$pGate = strpos($tinfo, 'if (!penumbraIsConsoleAudience($isAdmin, $userGrants, $currentUserKey)) {');
$pAct = strpos($tinfo, "\$action = isset(\$_GET['action'])");
ok('manage_table_info.php gates on the audience after authentication and before any action', $pDeny !== false && $pGate !== false && $pAct !== false && $pDeny < $pGate && $pGate < $pAct, json_encode(array($pDeny, $pGate, $pAct)));
$ai = rd($APP . '/ai_assist.php');
ok('ai_assist.php delegates to the shared predicate and keeps no copy of the lookup', strpos($ai, 'return penumbraIsConsoleAudience($isAdmin, $grants, $userKey);') !== false && strpos($ai, 'FETCH FIRST 1 ROWS ONLY') === false);

// ---- 4. the client-error report gate
$cerr = rd($APP . '/log_client_error.php');
$pReq = strpos($cerr, "require_once 'report_auth.php';");
$pG = strpos($cerr, "&& userCanAccessReport(\$cerrConn, (int)\$cerrRow['ID'], \$currentUserKey, \$user_ouc, \$isAdmin)) {");
$pAssign = strpos($cerr, "\$reportNumericId = (int)\$cerrRow['ID'];");
ok('log_client_error.php files under the report only through userCanAccessReport (report_auth loaded)', $pReq !== false && $pG !== false && $pAssign !== false && $pG < $pAssign && ($pAssign - $pG) < 200, json_encode(array($pReq, $pG, $pAssign)));

// ---- 5. the pin rule
$snaps = rd($APP . '/manage_snapshots.php');
if (!function_exists('queryViaOci8')) { function queryViaOci8($sql, $binds = array()) { return array(array('OWNER_ID' => 'OWNER1')); } }
if (!function_exists('penumbraIsReportOwner')) { function penumbraIsReportOwner($ownerId, $userKey) { $u = strtoupper(trim((string)$userKey)); return $u !== '' && strtoupper(trim((string)$ownerId)) === $u; } }
eval(between($snaps, "/** Pinning is the snapshot creator's, the report owner's or an admin's call (2026-10-01). */", "function userCanAccessReport(", "the pin helpers'"));
ok('the pin helpers lifted', function_exists('penumbra_snap_is_creator') && function_exists('penumbra_snap_report_owned'));
ok('the creator comparison folds case and padding, and an empty user never matches', penumbra_snap_is_creator(' Ada ', 'ada') && !penumbra_snap_is_creator('Bob', 'ada') && !penumbra_snap_is_creator('', '') && !penumbra_snap_is_creator('x', ''));
ok('the owner check reads the report owner through the oci8 lookup', penumbra_snap_report_owned(5, 'owner1') === true && penumbra_snap_report_owned(5, 'other') === false);
$pRule = strpos($snaps, "if (!\$isAdmin && !penumbra_snap_is_creator(\$snap['CREATED_BY'], \$currentUserKey)");
$pUpd = strpos($snaps, 'UPDATE PENUMBRA_SNAPS SET PINNED_BY = :usr, PINNED_AT = SYSDATE WHERE ID = :sid');
$pWant = strpos($snaps, 'if ($want_pin) {');
ok('the pin rule runs inside the pin branch, before the UPDATE', $pRule !== false && $pUpd !== false && $pWant !== false && $pWant < $pRule && $pRule < $pUpd, json_encode(array($pWant, $pRule, $pUpd)));

echo implode("\n", $lines), "\n";
echo ($pass + $fail), " assertions, ", $fail, " failed\n";
exit($fail ? 1 : 0);
