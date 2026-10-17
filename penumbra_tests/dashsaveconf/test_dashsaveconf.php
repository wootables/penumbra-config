<?php
// dashsaveconf suite - PHP half (2026-10-16). The dashboard save-conflict check in
// manage_dashboard.php and the version dashboard.php hands the page.
//   php -n test_dashsaveconf.php <manage_dashboard.php> <dashboard.php>
// dashSaveConflict() is LIFTED from the file under test and run (the endpoint itself
// cannot be required: it reads the request and opens Oracle); the rest are source
// checks: ORDER (after the permission / tag / exists checks, before the write and the
// DASH_SAVE audit), the 409 shape, the version a success hands back, and the SAME
// TO_CHAR format on both sides - a mismatch would make every save a "conflict".
$md = isset($argv[1]) ? $argv[1] : '';
$dp = isset($argv[2]) ? $argv[2] : '';
$pass = 0; $fail = 0;
function ok($c, $name) { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name\n"; } }

$s = is_file($md) ? file_get_contents($md) : '';
$d = is_file($dp) ? file_get_contents($dp) : '';
ok($s !== '' && $d !== '', 'S0 both files read');

// --- the decision, run ---------------------------------------------------
if (preg_match('/function dashSaveConflict\(\$data, \$currentUpdatedAt\) \{.*?\n\}/s', $s, $m)) {
    eval($m[0]);
    $A = '2026-10-16 10:00:00.000000'; $B = '2026-10-16 10:30:00.123456';
    ok(dashSaveConflict(array('base_updated_at' => $A), $A) === false, 'D1 the version the page loaded is still the row\'s: no conflict');
    ok(dashSaveConflict(array('base_updated_at' => $A), $B) === true, 'D2 the row moved on since: conflict');
    ok(dashSaveConflict(array('short_id' => 'x', 'overwrite' => true), $B) === false, 'D3 no base_updated_at (a page from before the change): never a conflict');
    ok(dashSaveConflict(array('base_updated_at' => $A, 'force' => true), $B) === false, 'D4 "Save anyway" (force): no conflict');
    ok(dashSaveConflict(array('base_updated_at' => ''), null) === false, 'D5 never updated, still never updated (NULL reads as \'\'): no conflict');
    ok(dashSaveConflict(array('base_updated_at' => ''), $B) === true, 'D6 never updated when loaded, saved since: conflict');
    ok(dashSaveConflict(array('base_updated_at' => $A, 'force' => false), $B) === true, 'D7 force false is no force');
    ok(dashSaveConflict('not an array', $B) === false, 'D8 a payload that is not an object: no conflict (refused elsewhere)');
    ok(dashSaveConflict(array('base_updated_at' => '2026-10-16 10:00'), $A) === true, 'D9 a minute-precision value is NOT the token (the old list format would conflict)');
} else {
    ok(false, 'D0 dashSaveConflict() found in ' . $md);
}

// --- order and shape (source) ------------------------------------------------
$p_save  = strpos($s, "if (\$action === 'save') {");
$p_perm  = strpos($s, "if (!\$isAdmin && \$existing['OWNER_ID'] !== \$currentUserKey && !penumbraDashboardTagGrantMatches(\$userGrants, \$sid)) {");
$p_tags  = strpos($s, "\$tagsRefused = penumbraReportTagsRefused(\$isAdmin, \$userGrants, \$tagsBefore, \$tags);");
$p_exist = strpos($s, "if (empty(\$input['overwrite'])) {");
$p_conf  = strpos($s, "if (dashSaveConflict(\$input, \$dashCurVer)) {");
$p_write = $p_save !== false ? strpos($s, "execClobUpdate(", $p_save) : false;
$p_audit = $p_save !== false ? strpos($s, "logPenumbraAudit(null, 'DASH_SAVE', null,", $p_save) : false;
$p_tagap = $p_save !== false ? strpos($s, "dashApplyTags(\$oracleConn, (int)\$existing['ID']", $p_save) : false;
ok($p_conf !== false, 'O1 the overwrite path calls dashSaveConflict on the row it read');
ok($p_perm !== false && $p_tags !== false && $p_perm < $p_conf && $p_tags < $p_conf, 'O2 AFTER the owner / tag-grant check and the tag refusal (a refused user learns nothing)');
ok($p_exist !== false && $p_exist < $p_conf, 'O3 AFTER the "already exists" notice (a page that thinks it is new still hears that first)');
ok($p_conf !== false && $p_write !== false && $p_audit !== false && $p_tagap !== false && $p_conf < $p_write && $p_conf < $p_audit && $p_conf < $p_tagap, 'O4 BEFORE the write, the tag changes and the DASH_SAVE audit row');
$blk = $p_conf !== false ? substr($s, $p_conf, 1300) : '';
ok(strpos($blk, 'http_response_code(409);') !== false && strpos($blk, "'conflict'        => true,") !== false && strpos($blk, 'exit;') !== false, 'O5 a conflict answers 409 {conflict: true} and stops');
ok(strpos($blk, "'updated_by_name' =>") !== false && strpos($blk, "'updated_when'    =>") !== false && strpos($blk, "'updated_by_self' =>") !== false && strpos($blk, "'updated_by'      =>") !== false, 'O6 it names who, when, and whether it was the saver');
ok(preg_match("/\\\$dashCurVer = isset\\(\\\$existing\\['VERSION_TXT'\\]\\)/", $s) === 1, 'O7 the row\'s current version comes from the SELECT the save already makes');
ok(strpos($s, "SELECT ID, OWNER_ID, \" . DASH_VERSION_FMT . \" AS VERSION_TXT FROM PENUMBRA_DASHBOARDS WHERE TRIM(SHORT_ID) = :sid") !== false, 'O8 that SELECT reads VERSION_TXT in DASH_VERSION_FMT');
ok(strpos($s, "'version' => dashVersionOf(\$oracleConn, (int)\$existing['ID'])]);") !== false, 'O9 an update answers the row\'s new version');
ok(strpos($s, "\"SELECT \" . DASH_VERSION_FMT . \" FROM PENUMBRA_DASHBOARDS WHERE ID = :id\"") !== false, 'O10 dashVersionOf reads the SAME format');
ok(strpos($s, "'version' => '']);") !== false, 'O11 a create answers the never-updated version \'\'');
ok(strpos($s, "'version'    => (string)\$row['VERSION_TXT'],") !== false && substr_count($s, '" . DASH_VERSION_FMT . " AS VERSION_TXT') === 2, 'O12 action=get hands the version too (a kiosk hop saves against it)');
ok(strpos($s, ':uid') === false, 'O13 no :uid bind (ORA-01745)');
ok(strpos($s, "WHERE ACTION = 'DASH_SAVE' AND DBMS_LOB.INSTR(\\\"AFTER\\\", :needle) > 0") !== false && strpos($s, "'\"dash\":' . json_encode((string)\$sid)") !== false, 'O14 who saved it: the newest DASH_SAVE audit row naming this dashboard');
ok(strpos($s, "UPDATED_AT = CURRENT_TIMESTAMP") !== false, 'O15 the update still moves UPDATED_AT (the token)');

// --- the same token on both sides --------------------------------------------
$fmt = "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6')";
ok(strpos($s, "const DASH_VERSION_FMT = \"" . $fmt . "\";") !== false, 'T1 manage_dashboard.php: DASH_VERSION_FMT = ' . $fmt);
ok(strpos($d, $fmt . ' AS VERSION_TXT') !== false, 'T2 dashboard.php reads it the SAME way');
ok(strpos($d, "'version'    => (string)\$dash['VERSION_TXT'],") !== false, 'T3 dashboard.php hands the page meta.version');
ok(strpos($d, "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI') AS UPDATED_AT,") !== false, 'T4 the minute-precision display value is kept beside it');

echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
