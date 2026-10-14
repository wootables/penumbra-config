<?php
/**
 * test_schedliveness.php - scheduler liveness, and the verdict it feeds.
 *
 * THE BUG THIS PINS (2026-09-20). Scheduler liveness was read from ONE place: a
 * heartbeat row inside the database being reported on. So "Oracle is
 * unreachable" and "the runner is dead" produced the same reading. ieprd went
 * into restricted mode (ORA-12526) in three windows that Sunday; the scheduler
 * was reported unknown, then offline; five alerts named it and four outage
 * episodes were opened against it. The runner started and completed a cycle
 * every five minutes throughout.
 *
 * Runs against the REAL functions and the REAL verdict text extracted from
 * penumbra_health.php - never a copy, because a test of a paste proves nothing
 * about the file that ships.
 *
 *   php.exe test_schedliveness.php [path\to\penumbra_health.php]
 */

$SRC = isset($argv[1]) ? $argv[1] : 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_health.php';
$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_schedlive_' . getmypid();
@mkdir($TMP, 0777, true);

$src = file_get_contents($SRC);
if ($src === false) { fwrite(STDERR, "cannot read $SRC\n"); exit(2); }

// ---- extract: the three liveness functions, as shipped ---------------------
$fnStart = strpos($src, 'function penumbra_runner_log_liveness(');
$fnEnd   = strpos($src, '/**' . "\n" . ' * Recent failure counts,');
if ($fnStart === false || $fnEnd === false || $fnEnd <= $fnStart) {
    fwrite(STDERR, "could not locate the liveness functions in $SRC\n"); exit(2);
}
$fnBlock = substr($src, $fnStart, $fnEnd - $fnStart);

// ---- extract: the verdict fragment + the warning fragment, as shipped ------
$vStart = strpos($src, '    $schedStatus = $snap[\'components\'][\'scheduler\'][\'status\'];');
if ($vStart === false) { fwrite(STDERR, "could not locate the scheduler verdict block\n"); exit(2); }
$vEnd = strpos($src, '    if ($probeDbs) {', $vStart);
if ($vEnd === false) { fwrite(STDERR, "could not locate the end of the verdict block\n"); exit(2); }
$verdictFrag = substr($src, $vStart, $vEnd - $vStart);

$wStart = strpos($src, '    if ($schedStatus === \'blocked\') {');
$wEnd   = strpos($src, '    /* A database that answered, but only after some of its connect attempts had');
if ($wStart === false || $wEnd === false || $wEnd <= $wStart) {
    fwrite(STDERR, "could not locate the scheduler warning block\n"); exit(2);
}
$warnFrag = substr($src, $wStart, $wEnd - $wStart);

// ---- harness: the minimum stubs, nothing else ------------------------------
$stub = <<<'PHPSTUB'
<?php
if (!defined('PENUMBRA_SCHEDULER_STALE_SECS'))  define('PENUMBRA_SCHEDULER_STALE_SECS', 330);
if (!defined('PENUMBRA_RUNNER_LOG_STALE_SECS')) define('PENUMBRA_RUNNER_LOG_STALE_SECS', 330);
if (!class_exists('PDO')) { class PDO { const FETCH_ASSOC = 2; } }

// The one path stub: where the runner log is said to live. Proves the
// resolution branch is wired without dragging in the whole log hub.
$GLOBALS['STUB_LOG_PATH'] = '';
function penumbra_log_sources($config = array()) {
    return array('scheduler' => array('path' => $GLOBALS['STUB_LOG_PATH']));
}
// Drives the "could not connect at all" branch.
$GLOBALS['STUB_CONN'] = null;
function getConnectionForTable($t) { return $GLOBALS['STUB_CONN']; }

class FakeStmt {
    private $row;
    public function __construct($row) { $this->row = $row; }
    public function bindValue($a, $b = null) { return true; }
    public function execute() { return true; }
    public function fetch($mode = null) { return $this->row; }
}
class FakeConn {
    private $row; private $throw;
    public function __construct($row, $throw = null) { $this->row = $row; $this->throw = $throw; }
    public function prepare($sql) {
        if ($this->throw === 'exception') {
            throw new RuntimeException('ORA-12526: TNS:listener: all appropriate instances are in restricted mode');
        }
        if ($this->throw === 'error') { throw new Error('driver blew up'); }
        return new FakeStmt($this->row);
    }
}
PHPSTUB;

// The verdict fragment, wrapped so a synthetic snapshot can be pushed through
// the SHIPPED text of the decision.
$verdictFn = "\nfunction pnb_verdict(\$snap) {\n"
           . "    \$ok = true; \$problems = array(); \$warn = array();\n"
           . $verdictFrag
           . $warnFrag
           . "\n    return array('ok' => \$ok, 'problems' => \$problems, 'warnings' => \$warn);\n}\n";

$harness = $TMP . DIRECTORY_SEPARATOR . 'harness.php';
file_put_contents($harness, $stub . "\n" . $fnBlock . "\n" . $verdictFn . "\n");
require $harness;

// ---- tiny assert -----------------------------------------------------------
$PASS = 0; $FAIL = 0;
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ('  (got: ' . json_encode($got) . ')')) . "\n"; }
}

$NOW = 1789929481;   // 2026-09-20 14:38:01 ET - the tick that opened the bogus episode
$LOG = $TMP . DIRECTORY_SEPARATOR . 'scheduler_2026-09-20.log';

/** Put the runner log at a chosen age; age null = no file at all. */
function set_log($ageSecs) {
    global $LOG, $NOW;
    if ($ageSecs === null) { @unlink($LOG); $GLOBALS['STUB_LOG_PATH'] = $LOG; return; }
    file_put_contents($LOG, "[2026-09-20 14:37:15] Starting Scheduler Run...\n");
    touch($LOG, $NOW - $ageSecs);
    clearstatcache(true, $LOG);
    $GLOBALS['STUB_LOG_PATH'] = $LOG;
}
/** A heartbeat row whose LAST_RUN is $ageSecs old. */
function hb_row($ageSecs, $options = null) {
    global $NOW;
    return array('LAST_RUN' => date('Y-m-d H:i:s', $NOW - $ageSecs), 'OPTIONS' => $options);
}
function sched($conn, $opts = array()) {
    global $NOW;
    $opts = array_merge(array('now' => $NOW), $opts);
    return penumbra_scheduler_health($conn, array(), $opts);
}

echo "\n== runner log liveness: the database-independent reading ==\n";
set_log(60);
$r = penumbra_runner_log_liveness(array(), array('now' => $NOW));
ok($r['alive'] === true, 'a log written 60s ago proves the process is alive', $r);
ok($r['age_secs'] === 60, 'age is reported exactly', $r['age_secs']);
ok($r['file'] === $LOG, 'resolved through penumbra_log_sources, not a private copy of the rule');

set_log(329);
ok(penumbra_runner_log_liveness(array(), array('now' => $NOW))['alive'] === true, '329s is inside the 330s window');
set_log(330);
ok(penumbra_runner_log_liveness(array(), array('now' => $NOW))['alive'] === false, '330s is outside it (boundary is <, same as the heartbeat)');
set_log(1000);
ok(penumbra_runner_log_liveness(array(), array('now' => $NOW))['alive'] === false, 'a log silent for 1000s says the process is not ticking');

set_log(null);
$r = penumbra_runner_log_liveness(array(), array('now' => $NOW));
ok($r['alive'] === null, 'NO FILE IS NOT A DEAD RUNNER - alive is null, never false', $r);
ok($r['age_secs'] === null, 'and no age is invented');

$GLOBALS['STUB_LOG_PATH'] = '';
ok(penumbra_runner_log_liveness(array(), array('now' => $NOW))['alive'] === null, 'an unresolvable path is also null');

echo "\n== the heartbeat could not be read at all (the 02:15 / 03:06 / 14:38 alerts) ==\n";
$GLOBALS['STUB_CONN'] = null;
set_log(60);
$s = sched(null);
ok($s['status'] === 'blocked', 'DB unreachable + runner log fresh = blocked, NOT unknown', $s['status']);
ok(strpos($s['detail'], 'no database connection') !== false, 'the detail still names the real cause');
ok($s['runner_log']['alive'] === true, 'the evidence that decided it is carried on the struct');

set_log(1000);
ok(sched(null)['status'] === 'offline', 'DB unreachable + runner log silent = offline (two sources agree)');

set_log(null);
$s = sched(null);
ok($s['status'] === 'unknown', 'DB unreachable + log unreadable = unknown, which says nothing', $s['status']);

echo "\n== seconds_ago must not be invented (the \"unknown (0s ago)\" line) ==\n";
$GLOBALS['STUB_CONN'] = null;
set_log(60);
ok(sched(null)['seconds_ago'] === null, 'a heartbeat never read reports NULL, not 0');
set_log(null);
ok(sched(null)['seconds_ago'] === null, 'likewise when nothing at all is known');

echo "\n== a stale heartbeat row (the 14:53:02 \"offline (1246s ago)\" reading) ==\n";
set_log(60);
$s = sched(new FakeConn(hb_row(1246)));
ok($s['status'] === 'blocked', 'stale row + runner demonstrably ticking = blocked, NOT offline', $s['status']);
ok($s['seconds_ago'] === 1246, 'the real heartbeat age is still reported');
ok(strpos($s['detail'], 'cannot write') !== false, 'the detail points at the database, not the scheduler');

set_log(1000);
$s = sched(new FakeConn(hb_row(1246)));
ok($s['status'] === 'offline', 'A GENUINELY DEAD RUNNER STILL PAGES: stale row + silent log = offline', $s['status']);

set_log(null);
ok(sched(new FakeConn(hb_row(1246)))['status'] === 'offline', 'stale row + unreadable log stays offline - the row is real evidence');

echo "\n== the healthy path is unchanged, and pays nothing extra ==\n";
set_log(60);
$s = sched(new FakeConn(hb_row(46)));
ok($s['status'] === 'online', 'a fresh heartbeat is online');
ok($s['seconds_ago'] === 46, 'seconds_ago is the row age');
ok($s['runner_log'] === null, 'THE LOG IS NOT READ ON A HEALTHY TICK (lazy - a green run costs no IO)');

echo "\n== pause handling is untouched ==\n";
$s = sched(new FakeConn(hb_row(46, json_encode(array('paused_by' => 'bplimon')))));
ok($s['status'] === 'paused', 'an active pause still reads paused');
$s = sched(new FakeConn(hb_row(46, json_encode(array('paused_by' => 'bplimon', 'paused_until' => $NOW - 10)))));
ok($s['status'] === 'offline', 'an EXPIRED pause is still offline, not paused');
ok(sched(new FakeConn(false))['status'] === 'offline', 'a missing heartbeat row is still offline');

echo "\n== a throwing driver must not take the health page down ==\n";
set_log(60);
$s = sched(new FakeConn(null, 'exception'));
ok($s['status'] === 'blocked', 'a PDO exception routes through the same evidence test', $s['status']);
ok(strpos($s['detail'], 'ORA-12526') !== false, 'and keeps the Oracle error in the detail');
$s = sched(new FakeConn(null, 'error'));
ok($s['status'] === 'blocked', 'an ERROR (not Exception) is caught too - Throwable, not Exception', $s['status']);

echo "\n== the verdict: what may flip ok, and what may only warn ==\n";
function verdict_for($status, $detail = 'd') {
    return pnb_verdict(array('components' => array('scheduler' => array('status' => $status, 'detail' => $detail))));
}
$v = verdict_for('offline');
ok($v['ok'] === false, 'offline flips ok - a dead runner is still an outage');
ok(in_array('scheduler offline', $v['problems']), 'and says so in problems');

$v = verdict_for('blocked');
ok($v['ok'] === true, 'BLOCKED MUST NOT FLIP OK - this is the weekend false positive', $v);
ok(count($v['problems']) === 0, 'and raises no problem for the watchdog to alert on', $v['problems']);
ok(count($v['warnings']) === 1 && strpos($v['warnings'][0], 'scheduler blocked') === 0, 'it warns instead', $v['warnings']);

$v = verdict_for('unknown');
ok($v['ok'] === true, 'UNKNOWN MUST NOT FLIP OK - same fail-open rule as delivery', $v);
ok(count($v['problems']) === 0, 'and raises no problem', $v['problems']);
ok(count($v['warnings']) === 1 && strpos($v['warnings'][0], 'scheduler unchecked') === 0, 'it warns instead', $v['warnings']);

$v = verdict_for('paused');
ok($v['ok'] === true, 'paused does not flip ok (unchanged)');
ok(in_array('scheduler paused', $v['problems']), 'and keeps its problem string, which the watchdog filters (unchanged)');

$v = verdict_for('online');
ok($v['ok'] === true && count($v['problems']) === 0 && count($v['warnings']) === 0, 'online is silent');

// ---- cleanup ---------------------------------------------------------------
@unlink($LOG);
@unlink($harness);
@rmdir($TMP);

echo "\n";
echo "PASS: $PASS   FAIL: $FAIL\n";
echo ($FAIL === 0 ? "RESULT: GREEN\n" : "RESULT: RED\n");
