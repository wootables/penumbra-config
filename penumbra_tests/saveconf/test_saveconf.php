<?php
// saveconf suite - PHP half (2026-10-09). The save-conflict check in
// save_server_state.php and the version index.php hands the page.
//   php -n test_saveconf.php <save_server_state.php> <index.php>
// pnbSaveConflict() is LIFTED from the file under test and run (the endpoint
// itself cannot be required: it reads the request and opens Oracle); the rest
// are source checks: ORDER (after the permission and scope checks, before any
// write or audit), the 409, the response's updated_at, and the SAME TO_CHAR
// format on both sides - a mismatch would make every save a "conflict".
$ss = isset($argv[1]) ? $argv[1] : '';
$ix = isset($argv[2]) ? $argv[2] : '';
$pass = 0; $fail = 0;
function ok($c, $name) { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name\n"; } }

$s = is_file($ss) ? file_get_contents($ss) : '';
$i = is_file($ix) ? file_get_contents($ix) : '';
ok($s !== '' && $i !== '', 'S0 both files read');

// --- the decision, run ---------------------------------------------------
if (preg_match('/function pnbSaveConflict\(\$data, \$currentUpdatedAt\) \{.*?\n\}/s', $s, $m)) {
    eval($m[0]);
    $A = '2026-10-09 10:00:00.000000'; $B = '2026-10-09 10:30:00.123456';
    ok(pnbSaveConflict(array('base_updated_at' => $A), $A) === false, 'D1 the version the page loaded is still the row\'s: no conflict');
    ok(pnbSaveConflict(array('base_updated_at' => $A), $B) === true, 'D2 the row moved on since: conflict');
    ok(pnbSaveConflict(array('short_id' => 'x'), $B) === false, 'D3 no base_updated_at (an older client, a save onto another report): never a conflict');
    ok(pnbSaveConflict(array('base_updated_at' => $A, 'force' => true), $B) === false, 'D4 "Save anyway" (force): no conflict');
    ok(pnbSaveConflict(array('base_updated_at' => ''), null) === false, 'D5 never updated, still never updated (NULL reads as \'\'): no conflict');
    ok(pnbSaveConflict(array('base_updated_at' => ''), $B) === true, 'D6 never updated when loaded, saved since: conflict');
    ok(pnbSaveConflict(array('base_updated_at' => $A, 'force' => false), $B) === true, 'D7 force false is no force');
    ok(pnbSaveConflict('not an array', $B) === false, 'D8 a payload that is not an object: no conflict (the endpoint refuses it elsewhere)');
} else {
    ok(false, 'D0 pnbSaveConflict() found in ' . $ss);
}

// --- order and shape (source) ------------------------------------------------
$p_perm  = strpos($s, "if (!\$isAdmin && !\$ownsExisting && !penumbraReportGrantMatches(\$userGrants, \$short_id)) {");
$p_scope = strpos($s, 'penumbraTablesOutOfScope($userGrants, $newReportTables, $existingReportTables)');
$p_conf  = strpos($s, "if (pnbSaveConflict(\$data, isset(\$before_data['UPDATED_AT_TXT'])");
$p_audit = strpos($s, "logPenumbraAudit(\$report_id_num, 'UPDATE', \$before_json, \$after_json,");
$p_write = strpos($s, "execClobUpdate(\n            \$oracleConn,");
ok($p_conf !== false, 'O1 the overwrite path calls pnbSaveConflict on the row it read');
ok($p_perm !== false && $p_scope !== false && $p_perm < $p_conf && $p_scope < $p_conf, 'O2 AFTER the owner / grant check and the SQL scope check (a refused user learns nothing about the report)');
ok($p_conf !== false && $p_audit !== false && $p_write !== false && $p_conf < $p_audit && $p_conf < $p_write, 'O3 BEFORE the UPDATE audit row and the write');
$blk = $p_conf !== false ? substr($s, $p_conf, 1400) : '';
ok(strpos($blk, 'http_response_code(409);') !== false && strpos($blk, "'conflict'        => true,") !== false && strpos($blk, 'exit;') !== false, 'O4 a conflict answers 409 {conflict: true} and stops');
ok(strpos($blk, "'updated_by_name' =>") !== false && strpos($blk, "'updated_when'    =>") !== false && strpos($blk, "'updated_by_self' =>") !== false && strpos($blk, "'updated_action'  =>") !== false, 'O5 it names who, when, whether it was the saver, and what they did');
ok(strpos($s, "'updated_at' => \$pnb_updated_at,") !== false, 'O6 a successful save answers the row\'s new updated_at');
ok(strpos($s, ':uid') === false, 'O7 no :uid bind (ORA-01745)');
ok(strpos($s, "WHERE REPORT_ID = :rid AND ACTION IN ('UPDATE', 'ROLLBACK', 'RESTORE', 'OWNER_CHANGE')") !== false, 'O8 who changed it: the newest UPDATE / ROLLBACK / RESTORE / OWNER_CHANGE audit row');

// --- the same token on both sides --------------------------------------------
$fmt = "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6')";
ok(substr_count($s, $fmt) === 2, 'T1 save_server_state.php reads UPDATED_AT as ' . $fmt . ' (before the save and after it)');
ok(strpos($i, $fmt . ' AS UPDATED_AT_TXT') !== false, 'T2 index.php reads it the SAME way');
ok(strpos($i, '$preloaded_report_version = null;') !== false && strpos($i, "reportVersion: <?php echo json_encode(\$preloaded_report_version); ?>,") !== false, 'T3 index.php hands the page {id, at} as penumbra_vars.reportVersion (null when nothing is loaded)');

// --- schedsave (2026-10-16): a schedule change hands the page the new version ---
// manage_schedule.php's touch_report_updated_at() LIFTED and run against a fake
// connection: a compare-and-set from the version it read, and the header main.js
// reads ("<short id> <before> <after>", rawurlencoded). header() is captured.
$ms = isset($argv[3]) ? $argv[3] : '';
$m = is_file($ms) ? file_get_contents($ms) : '';
ok($m !== '', 'M0 manage_schedule.php read');
if (!class_exists('PDO')) { eval('class PDO { const FETCH_ASSOC = 2; }'); }
class ScFakeStmt {
    public $sql; public $binds = array(); private $c;
    function __construct($c, $sql) { $this->c = $c; $this->sql = $sql; }
    function bindValue($k, $v) { $this->binds[$k] = $v; }
    function execute() { $this->c->ran[] = $this; if ($this->c->throw) throw new Exception('boom'); return true; }
    function fetch($mode = null) { return $this->c->row; }
    function rowCount() { return $this->c->hit; }
}
class ScFakeConn {
    public $row; public $hit; public $throw = false; public $ran = array();
    function __construct($row, $hit) { $this->row = $row; $this->hit = $hit; }
    function prepare($sql) { return new ScFakeStmt($this, $sql); }
}
$GLOBALS['__sc_headers'] = array();
function __sc_header($h) { $GLOBALS['__sc_headers'][] = $h; }
if (preg_match('/function touch_report_updated_at\(\$conn, \$numeric_report_id\) \{.*?\n\}/s', $m, $mm)) {
    $fn = str_replace(array('function touch_report_updated_at(', 'header(', 'headers_sent()'), array('function sc_touch(', '__sc_header(', 'false'), $mm[0]);
    eval($fn);
    $A = '2026-10-16 09:00:00.000000'; $B = '2026-10-16 09:05:00.123456';
    $updates = function ($c) { return array_values(array_filter($c->ran, function ($s) { return stripos(ltrim($s->sql), 'UPDATE') === 0; })); };
    // the page's version still the row's: compare-and-set lands, the header says so
    $GLOBALS['__sc_headers'] = array();
    $c = new ScFakeConn(array('SID' => 'zz conf', 'BEFORE_TXT' => $A, 'NOW_TXT' => $B), 1);
    @sc_touch($c, 7);
    $u = $updates($c);
    ok(count($u) === 1 && isset($u[0]->binds[':before_ts']) && $u[0]->binds[':before_ts'] === $A && $u[0]->binds[':now_ts'] === $B
        && strpos($u[0]->sql, "NVL(TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6'), '-') = NVL(:before_ts, '-')") !== false,
        'M1 the touch is ONE compare-and-set from the version it read, to the time it read');
    ok($GLOBALS['__sc_headers'] === array('X-Penumbra-Report-Version: zz%20conf ' . rawurlencode($A) . ' ' . rawurlencode($B)),
        'M2 and answers X-Penumbra-Report-Version "<short id> <before> <after>" (rawurlencoded)');
    // the row moved under the touch (someone saved in between): a plain touch, NO header
    $GLOBALS['__sc_headers'] = array();
    $c = new ScFakeConn(array('SID' => 'zzconf', 'BEFORE_TXT' => $A, 'NOW_TXT' => $B), 0);
    @sc_touch($c, 7);
    $u = $updates($c);
    ok(count($u) === 2 && strpos($u[1]->sql, 'SET UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :id') !== false && $GLOBALS['__sc_headers'] === array(),
        'M3 the compare-and-set missed (the row moved): a plain touch and no header (the page keeps its version: still a conflict)');
    // never updated: '' before (the page holds '' too)
    $GLOBALS['__sc_headers'] = array();
    $c = new ScFakeConn(array('SID' => 'zzconf', 'BEFORE_TXT' => null, 'NOW_TXT' => $B), 1);
    @sc_touch($c, 7);
    ok($GLOBALS['__sc_headers'] === array('X-Penumbra-Report-Version: zzconf  ' . rawurlencode($B)), 'M4 a report never updated: <before> is \'\'');
    // no report id / no row / a DB error: nothing written, nothing said, nothing thrown
    $GLOBALS['__sc_headers'] = array();
    $c = new ScFakeConn(false, 1); @sc_touch($c, 7);
    $c2 = new ScFakeConn(array(), 1); @sc_touch($c2, 0);
    $c3 = new ScFakeConn(array('SID' => 'zzconf', 'BEFORE_TXT' => $A, 'NOW_TXT' => $B), 1); $c3->throw = true;
    $threw = false; try { @sc_touch($c3, 7); } catch (Throwable $e) { $threw = true; }
    ok(count($updates($c)) === 0 && count($c2->ran) === 0 && !$threw && $GLOBALS['__sc_headers'] === array(), 'M5 no row, no id or a DB error: no write, no header, no throw');
} else {
    ok(false, 'M1 touch_report_updated_at() found in ' . $ms);
}
ok(substr_count($m, 'touch_report_updated_at($conn, $numeric_report_id);') === 5, 'M6 the five schedule changes (edit, new, enable/disable, delete, restore) all go through it');
ok(strpos($m, "TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') AS BEFORE_TXT") !== false && strpos($m, "TO_TIMESTAMP(:now_ts, 'YYYY-MM-DD HH24:MI:SS.FF6')") !== false,
    'M7 the SAME token format as index.php / save_server_state.php');
ok(strpos($m, ':uid') === false, 'M8 no :uid bind (ORA-01745)');

echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
