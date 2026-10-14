<?php
// penumbra_tests\purgedata\test.php <dir holding purge_report_data.php>
//
// purge_report_data.php's DELETE helper and its per-report loop (the Manage-mode "Erase
// data" buttons), lifted out of the file by markers and run against a STUB connection -
// no database. Proves (2026-10-01): a table that was never installed (ORA-00942) still
// counts as 0 rows and no error; a DELETE the database refuses (ORA-01031, the
// insufficient-privileges answer every History purge got before the 2026-10-01 grant)
// is named per statement in per_report[].error and errors[], and written into that
// report's DATA_PURGE audit row as "refused" with the true rows_deleted; the second
// statement of 'toggles' is named on its own while the first one's rows count; the batch
// goes on past a refusal; a report that is not found is still reported as before.
// Prints "N assertions, F failed" and exits 1 on a failure. The PRE-FIX file is the
// positive control: its helper swallows every error, so the refusal assertions go red.
$APP = isset($argv[1]) ? rtrim($argv[1], '\\/') : '';
if ($APP === '' || !is_file($APP . '/purge_report_data.php')) {
    fwrite(STDERR, "usage: php test.php <dir holding purge_report_data.php>\n");
    exit(2);
}
if (!class_exists('PDO')) { class PDO { const PARAM_INT = 1; const PARAM_STR = 2; } }
$pass = 0; $fail = 0; $lines = array();
function ok($name, $cond, $detail = '') {
    global $pass, $fail, $lines;
    if ($cond) { $pass++; $lines[] = "  PASS  $name"; }
    else { $fail++; $lines[] = "  FAIL  $name" . ($detail !== '' ? "\n        $detail" : ''); }
}

$src = str_replace("\r\n", "\n", file_get_contents($APP . '/purge_report_data.php'));

// ---- 1. the helpers, from the first helper's doc comment to the batch's try
$s = strpos($src, '/** True for Oracle');                    // the 2026-10-01 form
if ($s === false) { $s = strpos($src, '/** DELETE helper'); } // the pre-fix form (the control)
$e = strpos($src, "try {\n    \$oracleConn = getConnectionForTable('DUAL');");
if ($s === false || $e === false) { echo "FATAL: helper markers not found\n"; exit(1); }
eval(substr($src, $s, $e - $s));
ok('the helpers lifted (pdd_delete present)', function_exists('pdd_delete'));

// A stub connection: prepare() answers by the SQL's text - a row count to delete, a
// value for the SHORT_ID lookup, or an Exception to throw on execute.
class StubStmt {
    public $plan; public $binds = array();
    function __construct($plan) { $this->plan = $plan; }
    function bindValue($k, $v, $t = null) { $this->binds[$k] = $v; }
    function execute() { if ($this->plan instanceof Exception) { throw $this->plan; } return true; }
    function rowCount() { return is_int($this->plan) ? $this->plan : 0; }
    function fetchColumn() { return $this->plan; }
}
class StubConn {
    public $plans; public $log = array();
    function __construct($plans) { $this->plans = $plans; }
    function prepare($sql) {
        $this->log[] = $sql;
        foreach ($this->plans as $needle => $plan) { if (strpos($sql, $needle) !== false) { return new StubStmt($plan); } }
        return new StubStmt(0);
    }
}
$ORA00942 = new Exception('SQLSTATE[HY000]: General error: 942 OCIStmtExecute: ORA-00942: table or view does not exist');
$ORA01031 = new Exception('SQLSTATE[HY000]: General error: 1031 OCIStmtExecute: ORA-01031: insufficient privileges');

$refused = array();
$n = pdd_delete(new StubConn(array('PENUMBRA_SNAPS' => 3)), "DELETE FROM PENUMBRA_SNAPS WHERE REPORT_ID = :id", array(':id' => 7), $refused);
ok('helper: a DELETE that ran returns its row count, nothing refused', $n === 3 && $refused === array(), json_encode(array($n, $refused)));
$refused = array();
$n = pdd_delete(new StubConn(array('PENUMBRA_SNAPS' => $ORA00942)), "DELETE FROM PENUMBRA_SNAPS WHERE REPORT_ID = :id", array(':id' => 7), $refused);
ok('helper: a table never installed (ORA-00942) is 0 rows and no error, as before', $n === 0 && $refused === array(), json_encode(array($n, $refused)));
$refused = array();
$n = pdd_delete(new StubConn(array('PENUMBRA_AUDIT' => $ORA01031)), "DELETE FROM PENUMBRA_AUDIT WHERE REPORT_ID = :id", array(':id' => 7), $refused);
ok('helper: a refused DELETE (ORA-01031) is 0 rows AND named - the table and the reason', $n === 0 && $refused === array('DELETE on PENUMBRA_AUDIT refused: ORA-01031: insufficient privileges'), json_encode(array($n, $refused)));
$n = pdd_delete(new StubConn(array('PENUMBRA_AUDIT' => $ORA01031)), "DELETE FROM PENUMBRA_AUDIT WHERE REPORT_ID = :id", array(':id' => 7));
ok('helper: with no list to append to, a refusal still returns 0 quietly (no notice)', $n === 0);
$refused = array();
$n = pdd_delete(new StubConn(array('X' => new Exception('ORA-00054: resource busy and acquire with NOWAIT specified'))), "DELETE FROM X WHERE A = :a", array(':a' => 'q'), $refused);
ok('helper: any other failure (a lock) is named too', $n === 0 && $refused === array('DELETE on X refused: ORA-00054: resource busy and acquire with NOWAIT specified'), json_encode($refused));

// ---- 2. the per-report loop, lifted and run with the stub connection and an audit stub
$AUDIT = array();
if (!function_exists('logPenumbraAudit')) {
    function logPenumbraAudit($rid, $action, $x, $details) { global $AUDIT; $AUDIT[] = array('rid' => $rid, 'action' => $action, 'details' => json_decode($details, true)); }
}
$ls = strpos($src, "    \$perReport = array();");
$le = strpos($src, "    echo json_encode([", $ls);
if ($ls === false || $le === false) { echo "FATAL: loop markers not found\n"; exit(1); }
$LOOP = substr($src, $ls, $le - $ls);
function runBatch($ids, $what, $oracleConn) {
    global $LOOP;
    eval($LOOP);
    return array('per_report' => $perReport, 'errors' => $errors, 'deleted' => $grandTotal);
}

$AUDIT = array();
$r = runBatch(array(7), 'audit', new StubConn(array('SELECT TRIM(SHORT_ID)' => 'zz-x', 'PENUMBRA_AUDIT' => 12)));
ok('audit: a purge that ran reports its rows, no error, and the audit row records them', $r['deleted'] === 12 && $r['errors'] === array() && $r['per_report'] === array(array('id' => 7, 'short_id' => 'zz-x', 'deleted' => 12)) && count($AUDIT) === 1 && $AUDIT[0]['action'] === 'DATA_PURGE' && $AUDIT[0]['details'] === array('short_id' => 'zz-x', 'what' => 'audit', 'rows_deleted' => 12), json_encode(array($r, $AUDIT)));

$AUDIT = array();
$r = runBatch(array(7), 'audit', new StubConn(array('SELECT TRIM(SHORT_ID)' => 'zz-x', 'PENUMBRA_AUDIT' => $ORA01031)));
$why = 'DELETE on PENUMBRA_AUDIT refused: ORA-01031: insufficient privileges';
ok('audit: a REFUSED purge reports 0 rows and names the refusal per report', $r['deleted'] === 0 && isset($r['per_report'][0]['error']) && $r['per_report'][0]['error'] === $why && $r['per_report'][0]['deleted'] === 0, json_encode($r));
ok('audit: ... and in errors[], with the report named', $r['errors'] === array('Report zz-x (7): ' . $why), json_encode($r['errors']));
ok('audit: ... and the DATA_PURGE row says "refused" with the true count - never a clean purge of nothing', count($AUDIT) === 1 && $AUDIT[0]['details']['rows_deleted'] === 0 && isset($AUDIT[0]['details']['refused']) && $AUDIT[0]['details']['refused'] === array($why), json_encode($AUDIT));

$AUDIT = array();
$r = runBatch(array(7), 'toggles', new StubConn(array('SELECT TRIM(SHORT_ID)' => 'zz-x', 'PENUMBRA_JOURNAL_TOGGLE' => 2, 'PENUMBRA_AUDIT' => $ORA01031)));
ok('toggles: the toggle rows that went count, the refused history DELETE is named on its own', $r['deleted'] === 2 && $r['per_report'][0]['deleted'] === 2 && $r['per_report'][0]['error'] === $why && $AUDIT[0]['details']['rows_deleted'] === 2 && $AUDIT[0]['details']['refused'] === array($why), json_encode(array($r, $AUDIT)));

$AUDIT = array();
$r = runBatch(array(7), 'snapshots', new StubConn(array('SELECT TRIM(SHORT_ID)' => 'zz-x', 'PENUMBRA_SNAPS' => $ORA00942)));
ok('snapshots: a table never installed is 0 rows, no error, no "refused" in the audit row', $r['deleted'] === 0 && $r['errors'] === array() && !isset($r['per_report'][0]['error']) && !isset($AUDIT[0]['details']['refused']), json_encode(array($r, $AUDIT)));

$AUDIT = array();
$conn = new StubConn(array('SELECT TRIM(SHORT_ID)' => 'zz-x', 'PENUMBRA_AUDIT' => $ORA01031));
$r = runBatch(array(7, 8), 'audit', $conn);
ok('batch: a refusal on one report does not stop the next (both reported, both audited)', count($r['per_report']) === 2 && count($r['errors']) === 2 && count($AUDIT) === 2, json_encode($r));

$AUDIT = array();
$r = runBatch(array(7), 'audit', new StubConn(array('SELECT TRIM(SHORT_ID)' => false)));
ok('batch: a report that is not found is reported as before, nothing audited', $r['per_report'] === array() && $r['errors'] === array('Report 7 not found.') && $AUDIT === array(), json_encode($r));

echo implode("\n", $lines), "\n";
echo ($pass + $fail), " assertions, ", $fail, " failed\n";
exit($fail ? 1 : 0);
