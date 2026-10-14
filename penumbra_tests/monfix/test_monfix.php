<?php
/**
 * test_monfix.php - the four 2026-08-28 monitoring fixes, in isolation.
 *
 * WHAT HAPPENED. InfoEd was unreachable on and off from about 11:53 to 13:19 on
 * 2026-08-28. The watchdog sampled it fourteen times, reported 'down' on two of
 * them, and both times the very next tick was clean - so the consecutive-failure
 * counter reset to zero, never reached two, and no email, banner or ledger entry
 * of consequence was produced. A real user (mrgrady) was handed a 500 at
 * 12:24:51. Every rule involved behaved exactly as written.
 *
 * Two separate blind spots produced that:
 *   1. The alert rule only asks "is it STILL broken?", so a fault that recovers
 *      between samples is invisible no matter how often it recurs.
 *   2. The DB probe only asks "did we connect?", and the MS-SQL targets connect
 *      through a LADDER of drivers - so three rungs timing out and the fourth
 *      catching it reported the same word as instant success: ok.
 *
 * Fix 1 adds an N-in-M flap rule. Fix 2 adds a 'degraded' state so a near-miss
 * is countable. This file replays the real day against BOTH.
 *
 * Everything under test is LIFTED FROM THE SHIPPED FILES by the tokenizer - a
 * test of a pasted copy proves nothing about the code that runs.
 *
 *   php.exe test_monfix.php [--control]
 *
 * --control runs a deliberately false assertion, which MUST report FAIL. A
 * harness that has never been seen to fail has not been seen to work.
 */

date_default_timezone_set('America/New_York');

$APP = 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$PHPDIR = 'D:\\Utilities\\PHP_8.2-p';
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0)    $APP    = substr($a, 6);
    if (strpos($a, '--phpdir=') === 0) $PHPDIR = substr($a, 9);
}
$CONTROL = in_array('--control', $argv, true);

// ---------------------------------------------------------------------------
// Lift named functions out of a source file. Tokenizer, not regex: a brace
// inside a string or a comment must not end a function early.
// ---------------------------------------------------------------------------
function lift($file, $names) {
    $src = @file_get_contents($file);
    if ($src === false) { fwrite(STDERR, "cannot read $file\n"); exit(2); }
    $t = token_get_all($src);
    $n = count($t);
    $found = array();
    $out = '';
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        // Skip anonymous closures: only a T_FUNCTION followed by a name counts.
        $j = $i + 1;
        while ($j < $n && ((is_array($t[$j]) && $t[$j][0] === T_WHITESPACE)
                        || (!is_array($t[$j]) && $t[$j] === '&'))) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;
        $fname = $t[$j][1];
        if (!in_array($fname, $names, true)) continue;

        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) {
                // An interpolated "{$x}" opens a brace as an ARRAY token but is
                // closed by a PLAIN '}'. Count it, or the match ends early.
                if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) {
                    $depth++; $started = true;
                }
                $buf .= $tok[1];
            } else {
                if ($tok === '{')      { $depth++; $started = true; }
                elseif ($tok === '}')  { $depth--; }
                $buf .= $tok;
            }
            if ($started && $depth === 0) break;
        }
        // function_exists guard: these files carry conditional polyfills that
        // would otherwise fatal on redeclare.
        $out .= "if (!function_exists('$fname')) {\n$buf\n}\n";
        $found[] = $fname;
    }
    $missing = array_diff($names, $found);
    if ($missing) {
        fwrite(STDERR, "MISSING from $file: " . implode(', ', $missing) . "\n");
        exit(2);
    }
    return $out;
}

$lifted  = lift($PHPDIR . '\\penumbra_monitor.php', array('mon_flap_update', 'mon_correlated_update', 'mon_apply_mutes'));
$lifted .= lift($APP . '\\penumbra_health.php',     array('penumbra_outage_classify', 'penumbra_mute_lookup'));
$lifted .= lift($APP . '\\db_connection.php',       array('penumbraNoteConnectFallback',
                                                          'penumbraConnectFallbackFor',
                                                          'penumbraCsrfGuard'));
$tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_monfix_' . getmypid() . '.php';
file_put_contents($tmp, "<?php\n" . $lifted);
require $tmp;
@unlink($tmp);

// ---- child mode: prove the CSRF guard both exempts and blocks --------------
// Runs in its own process because the blocking path ends in exit().
if (in_array('--csrf-child', $argv, true)) {
    $config = array('csrf_guard_mode' => 'enforce');
    $GLOBALS['config'] = $config;
    $_SERVER = array('REQUEST_URI' => '/x.php?action=list');   // no Origin, no Referer
    $_POST = array(); $_GET = array('action' => 'list');
    penumbraCsrfGuard(array('list', 'check_runner', 'test_status'));
    echo "EXEMPT-RETURNED\n";                                   // reached => read was let through
    $_SERVER['REQUEST_URI'] = '/x.php?action=save';
    $_GET = array('action' => 'save');
    penumbraCsrfGuard(array('list', 'check_runner', 'test_status'));
    echo "WRITE-NOT-BLOCKED\n";                                 // must NOT be reached
    exit(0);
}

// ---- tiny assert -----------------------------------------------------------
$PASS = 0; $FAIL = 0; $GROUP = '';
function group($g) { global $GROUP; $GROUP = $g; echo "\n$g\n"; }
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ('  (got: ' . json_encode($got) . ')')) . "\n"; }
}

$WIN = 3600;   // the shipped default: 60 minutes
$THR = 3;      // the shipped default: 3 bad checks
function ts($hhmmss) {
    list($h, $m, $s) = array_map('intval', explode(':', $hhmmss));
    return mktime($h, $m, $s, 8, 28, 2026);
}

/** Replay a list of [time, badKeys] ticks; return the ticks that alerted. */
function replay($ticks, $thr = null, $win = null, $record = true) {
    global $THR, $WIN;
    $thr = $thr === null ? $THR : $thr;
    $win = $win === null ? $WIN : $win;
    $flap = array(); $alerted = array(); $fired = array();
    foreach ($ticks as $t) {
        $r = mon_flap_update($flap, $alerted, $t[1], ts($t[0]), $thr, $win, $record);
        $flap = $r['flap']; $alerted = $r['flap_alerted'];
        if ($r['flapping']) {
            $fired[] = array('at' => $t[0], 'keys' => array_keys($r['flapping']));
            // The caller marks what it alerted on; mirror that here.
            foreach ($r['flapping'] as $k => $n) { $alerted[$k] = ts($t[0]); }
        }
    }
    return $fired;
}

echo "Penumbra monitoring fixes - 2026-08-28\n";
echo "app=$APP\nphp=$PHPDIR\n";

// ===========================================================================
group('1. The real 2026-08-28 InfoEd day');

/* Tick times are the watchdog's own log. The 'down' ticks are the two it
   actually reported; the 'degraded' ticks are the ones whose completion time
   slipped well off the :02 cadence, which is the retry ladder burning 60-80s
   inside the probe - corroborated by InfoEd connect failures in php82_errors.log
   across the same span. Clean ticks landed on the cadence. */
$DOWN = array('db:infoed');
$day = array(
    array('11:48:11', array()),
    array('11:54:58', $DOWN),      // watchdog: DEGRADED database infoed down
    array('11:58:18', $DOWN),      // recovered on the ladder, reported ok
    array('12:03:42', $DOWN),
    array('12:08:40', $DOWN),
    array('12:13:02', array()),
    array('12:18:02', array()),
    array('12:23:05', $DOWN),
    array('12:28:02', array()),
    array('12:33:11', $DOWN),
    array('12:39:24', $DOWN),
    array('12:43:26', $DOWN),
    array('12:48:02', array()),
    array('12:53:05', $DOWN),
    array('12:59:38', $DOWN),
    array('13:04:59', $DOWN),      // watchdog: DEGRADED database infoed down
    array('13:08:03', array()),
    array('13:13:27', $DOWN),
    array('13:18:29', $DOWN),
    array('13:23:01', array()),
);

$fired = replay($day);
ok(count($fired) > 0, 'the day now produces at least one alert', count($fired));
ok(!empty($fired) && $fired[0]['at'] === '12:03:42',
   'first alert on the 3rd bad check (12:03:42), not the 14th', $fired ? $fired[0]['at'] : null);
ok(!empty($fired) && $fired[0]['keys'] === array('db:infoed'),
   'the alert names db:infoed', $fired ? $fired[0]['keys'] : null);

/* WITHOUT the degraded signal - i.e. the flap window alone, bolted onto the old
   probe that could only ever say down - the same day still says nothing. Two
   isolated 'down' ticks never reach three. This is why fix 1 needed fix 2:
   a wider counter over a blind sensor counts nothing. */
$downOnly = array();
foreach ($day as $t) {
    $isRealDown = in_array($t[0], array('11:54:58', '13:04:59'), true);
    $downOnly[] = array($t[0], $isRealDown ? $DOWN : array());
}
ok(count(replay($downOnly)) === 0,
   'flap rule ALONE would still have missed it (needs the degraded signal)',
   count(replay($downOnly)));

// ===========================================================================
group('2. History must survive healthy ticks (the original bug, one level up)');

$interleaved = array(
    array('01:00:00', $DOWN),
    array('01:05:00', array()),   // healthy - the old code reset $state here
    array('01:10:00', $DOWN),
    array('01:15:00', array()),
    array('01:20:00', $DOWN),     // 3rd bad check inside the hour
);
$f = replay($interleaved);
ok(count($f) === 1 && $f[0]['at'] === '01:20:00',
   'three bad checks separated by good ones still alert', $f);

// ===========================================================================
group('3. The window actually expires');

$spread = array(
    array('01:00:00', $DOWN),
    array('01:40:00', $DOWN),
    array('02:20:00', $DOWN),   // 01:00 has aged out by now: only 2 in window
    array('03:00:00', $DOWN),   // 01:40 aged out: still only 2
);
ok(count(replay($spread)) === 0, 'bad checks spread wider than the window never accumulate',
   replay($spread));

$tight = array(
    array('01:00:00', $DOWN),
    array('01:20:00', $DOWN),
    array('01:40:00', $DOWN),
);
ok(count(replay($tight)) === 1, 'the same three inside the window do alert', replay($tight));

// ===========================================================================
group('4. Re-alert throttle');

$sustained = array();
for ($m = 0; $m < 180; $m += 5) {
    $sustained[] = array(sprintf('%02d:%02d:00', 1 + intdiv($m, 60), $m % 60), $DOWN);
}
$f = replay($sustained);
ok(count($f) >= 2, 'sustained flapping does re-alert rather than firing once', count($f));
$gap = null;
if (count($f) >= 2) { $gap = ts($f[1]['at']) - ts($f[0]['at']); }
ok($gap !== null && $gap >= $WIN, 'and it waits out the full window first', $gap);

// ===========================================================================
group('4b. A sustained outage must not ALSO produce a flap alert (prod bug 08-28)');

/* THE REAL SEQUENCE, from penumbra_monitor.log the first night the flap rule was
   live. HR's nightly maintenance behaved exactly as designed on the consecutive
   channel - alert at 23:13 on the 2nd bad check, RESOLVED at 23:43 - and then
   sent a THIRD, wrong email at 23:48 saying "intermittent failures".
   Cause: the send was guarded on $state['alerted'], which the recovery branch
   resets to false, while seven marks from 23:08-23:38 sat inside the 60-minute
   window. The fix drops the marks of whatever the consecutive rule is currently
   reporting, so nothing survives the recovery to fire later. */
$HR = array('db:hr');
$hrNight = array(
    array('23:08:02', $HR, false),  // 1st bad - consecutive rule has not spoken yet
    array('23:13:02', $HR, true),   // 2nd bad -> ALERTED (the real email)
    array('23:18:02', $HR, true),
    array('23:23:02', $HR, true),
    array('23:28:02', $HR, true),
    array('23:33:02', $HR, true),
    array('23:38:02', $HR, true),   // last bad tick
    array('23:43:02', array(), false), // recovery: RESOLVED sent, alerted reset to false
    array('23:48:02', array(), false), // <- the tick that wrongly emailed
    array('23:53:02', array(), false),
);
$flap = array(); $alerted = array(); $fired = array();
foreach ($hrNight as $t) {
    // $t[2] mirrors $state['alerted'] as the decide block computes it.
    $sup = $t[2] ? $t[1] : array();
    $r = mon_flap_update($flap, $alerted, $t[1], ts($t[0]), $THR, $WIN, true, $sup);
    $flap = $r['flap']; $alerted = $r['flap_alerted'];
    if ($r['flapping']) { $fired[] = $t[0]; foreach ($r['flapping'] as $k => $n) { $alerted[$k] = ts($t[0]); } }
}
ok($fired === array(), 'a reported-and-resolved outage produces NO flap alert', $fired);
ok(!isset($flap['db:hr']) || $flap['db:hr'] === array(),
   'and leaves no marks behind to fire later in the window', isset($flap['db:hr']) ? $flap['db:hr'] : null);

// The pre-fix behaviour, to prove the test bites: same sequence, no suppression.
$flap2 = array(); $alerted2 = array(); $fired2 = array();
foreach ($hrNight as $t) {
    $r = mon_flap_update($flap2, $alerted2, $t[1], ts($t[0]), $THR, $WIN, true, array());
    $flap2 = $r['flap']; $alerted2 = $r['flap_alerted'];
    if ($r['flapping']) { $fired2[] = $t[0]; foreach ($r['flapping'] as $k => $n) { $alerted2[$k] = ts($t[0]); } }
}
ok(count($fired2) > 0, 'WITHOUT the fix the same night does fire - the test really bites', $fired2);

/* A different component blipping during someone else's reported episode keeps
   its own marks: suppression is per-key, not a global mute. */
$flap3 = array(); $alerted3 = array(); $fired3 = array();
$mixedNight = array(
    array('01:00:00', array('db:hr', 'smtp'), false),
    array('01:05:00', array('db:hr', 'smtp'), true),   // alert names both
    array('01:10:00', array('smtp'),          true),   // hr recovered; smtp still blipping
    array('01:15:00', array('smtp'),          false),
    array('01:20:00', array('smtp'),          false),
    array('01:25:00', array('smtp'),          false),
);
foreach ($mixedNight as $t) {
    $sup = $t[2] ? $t[1] : array();
    $r = mon_flap_update($flap3, $alerted3, $t[1], ts($t[0]), $THR, $WIN, true, $sup);
    $flap3 = $r['flap']; $alerted3 = $r['flap_alerted'];
    if ($r['flapping']) { $fired3[] = array($t[0], array_keys($r['flapping'])); foreach ($r['flapping'] as $k => $n) { $alerted3[$k] = ts($t[0]); } }
}
ok(count($fired3) === 1 && $fired3[0][1] === array('smtp'),
   'smtp still trips on its own three once the alert stops naming it', $fired3);
ok(!isset($flap3['db:hr']) || $flap3['db:hr'] === array(),
   'while the reported component stays cleared', isset($flap3['db:hr']) ? $flap3['db:hr'] : null);

// ===========================================================================
group('5. Components are counted separately');

$mixed = array(
    array('01:00:00', array('db:infoed', 'smtp')),
    array('01:05:00', array('db:infoed')),
    array('01:10:00', array('db:infoed')),
);
$f = replay($mixed);
ok(count($f) === 1 && $f[0]['keys'] === array('db:infoed'),
   'infoed trips on its own three; one smtp blip does not ride along', $f);

// ===========================================================================
group('6. A drill must not train the detector');

$drill = array(
    array('01:00:00', $DOWN),
    array('01:05:00', $DOWN),
    array('01:10:00', $DOWN),
);
ok(count(replay($drill, null, null, false)) === 0,
   '--test / record=false records nothing', replay($drill, null, null, false));

// ===========================================================================
group('7. Key agreement between the two signals (integration risk)');

/* The flap window is keyed by component. The 'down' path derives its key from a
   problem STRING via penumbra_outage_classify(); the new 'degraded' path derives
   it from the database's array key. If those two ever disagree, a database that
   alternates between degraded and down splits into two half-full buckets and
   neither reaches the threshold - the exact failure this whole change exists to
   prevent, reintroduced silently. */
foreach (array('infoed', 'hr', 'fin', 'pins', 'ieprd') as $dbName) {
    $fromProblem  = penumbra_outage_classify('database ' . $dbName . ' down');
    $fromDegraded = 'db:' . strtolower($dbName);
    ok($fromProblem['key'] === $fromDegraded,
       "down and degraded agree on the key for $dbName", array($fromProblem['key'], $fromDegraded));
}

// ===========================================================================
group('8. The connect-fallback recorder');

$GLOBALS['penumbraConnectFallback'] = array();
ok(penumbraConnectFallbackFor('infoed') === null, 'a target that never fell back reads null');

penumbraNoteConnectFallback('infoed', 3, 'odbc:DSN=ie_red',
    new PDOException('SQLSTATE[08001] Named Pipes Provider: Could not open a connection'));
$fb = penumbraConnectFallbackFor('infoed');
ok(is_array($fb) && $fb['failed'] === 3, 'the failed-attempt count round-trips', $fb);
ok(is_array($fb) && $fb['winner'] === 'odbc:DSN=ie_red', 'the winning DSN is recorded', $fb);
ok(is_array($fb) && strpos($fb['last_error'], '08001') !== false,
   'the last error is carried for the detail line', $fb);
ok(is_array($fb) && strlen($fb['last_error']) <= 160, 'and it is capped at 160 chars',
   strlen($fb['last_error']));
ok(penumbraConnectFallbackFor('hr') === null, 'an untouched target stays null');

// A fallback record is what flips the probe to 'degraded'; 0 failures must not.
penumbraNoteConnectFallback('pins', 0, 'odbc:first', null);
$fb0 = penumbraConnectFallbackFor('pins');
ok(is_array($fb0) && empty($fb0['failed']),
   'a zero-failure record cannot read as degraded (health checks !empty)', $fb0);

// ===========================================================================
group('9. CSRF guard: reads exempt, writes still blocked');

$self  = escapeshellarg(__FILE__);
$php   = escapeshellarg($PHPDIR . '\\php.exe');
$cmd   = "$php -n $self --csrf-child --app=" . escapeshellarg($APP)
       . " --phpdir=" . escapeshellarg($PHPDIR) . " 2>&1";
$out   = shell_exec($cmd);
ok(strpos((string)$out, 'EXEMPT-RETURNED') !== false,
   "action=list returns instead of 403ing (this is the 12:00:16 request)", trim((string)$out));
ok(strpos((string)$out, 'WRITE-NOT-BLOCKED') === false,
   'action=save is STILL blocked - the exemption did not widen to writes', trim((string)$out));
ok(strpos((string)$out, 'Security check failed') !== false,
   'and the block still emits the CSRF error body', trim((string)$out));

// ===========================================================================
group('10. penumbra_db_health() turns a fallback into degraded');

/* The real shipped probe, with the five connect functions stubbed. A stub is
   only acceptable here because the thing under test is the VERDICT, not the
   driver: what matters is that a connection which succeeded after failed
   attempts stops being reported with the same word as a clean one. */
if (!function_exists('connectOracle')) {
    class PnbStubStmt {
        public function execute() { return true; }
        public function fetch($m = null) { return array('OK' => 1); }
    }
    class PnbStubConn {
        public function prepare($sql) { return new PnbStubStmt(); }
    }
    foreach (array('connectOracle', 'connectHr', 'connectFin', 'connectPins', 'connectInfoEd') as $fn) {
        eval("function $fn() { return new PnbStubConn(); }");
    }
}
$dbhealth = lift($APP . '\\penumbra_health.php', array('penumbra_db_health'));
$tmp2 = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_monfix_h_' . getmypid() . '.php';
file_put_contents($tmp2, "<?php\n" . $dbhealth);
require $tmp2;
@unlink($tmp2);

$GLOBALS['penumbraConnectFallback'] = array();
$clean = penumbra_db_health(array());
ok(isset($clean['infoed']['status']) && $clean['infoed']['status'] === 'ok',
   'a first-try connection is ok', isset($clean['infoed']) ? $clean['infoed'] : null);
ok(isset($clean['hr']['status']) && $clean['hr']['status'] === 'ok', 'so are the Oracle targets');

$GLOBALS['penumbraConnectFallback'] = array();
penumbraNoteConnectFallback('infoed', 3, 'odbc:DSN=ie_red', new PDOException('Named Pipes Provider [53]'));
$sick = penumbra_db_health(array());
ok(isset($sick['infoed']['status']) && $sick['infoed']['status'] === 'degraded',
   'three failed rungs then success reads DEGRADED, not ok', isset($sick['infoed']) ? $sick['infoed'] : null);
ok(isset($sick['infoed']['failed_attempts']) && $sick['infoed']['failed_attempts'] === 3,
   'and carries the count the warning line prints', isset($sick['infoed']) ? $sick['infoed'] : null);
ok(isset($sick['infoed']['detail']) && strpos($sick['infoed']['detail'], 'Named Pipes') !== false,
   'and the reason, so the log says WHY', isset($sick['infoed']['detail']) ? $sick['infoed']['detail'] : null);
ok(isset($sick['hr']['status']) && $sick['hr']['status'] === 'ok',
   'a healthy sibling is untouched', isset($sick['hr']) ? $sick['hr'] : null);

/* The key the degraded path yields must be the one the flap window already
   uses - re-asserted here against the REAL probe output, not a hand-built name. */
$degradedKeys = array();
foreach ($sick as $n => $d) { if ($d['status'] === 'degraded') $degradedKeys[] = 'db:' . strtolower($n); }
ok($degradedKeys === array('db:infoed'),
   'the probe yields exactly the key penumbra_outage_classify would', $degradedKeys);

// ===========================================================================
group('11. Fix 3 wiring: a recovered probe is not filed as a failure');

/* STRUCTURAL, not behavioural, and labelled as such: this path needs a live
   Oracle plus an HTTP round trip to exercise, neither of which exists here. What
   is checked is that the three ends of the wire actually meet. */
$qsrc = (string)@file_get_contents($APP . '\\query.php');
$rsrc = (string)@file_get_contents($APP . '\\schedule_runner.php');

ok(strpos($rsrc, 'toobig_recoverable: true') !== false,
   'the DB_DUMP buffered probe declares itself recoverable');
ok(strpos($rsrc, "\$params['toobig_probe'] = '1'") !== false,
   'and that reaches query.php as a POST field');
ok(strpos($qsrc, "(\$currentUserKey === 'SCHEDULER') && !empty(\$_POST['toobig_probe'])") !== false,
   'query.php honours it ONLY for a scheduler-key run');

// The audit write must sit inside the else branch, or a recovered dump still
// inflates health.php's failure count - the whole point of the fix.
$catchAt = strpos($qsrc, 'catch (PenumbraResultTooLargeException');
$gateAt  = strpos($qsrc, '$penumbraToobigRecoverable = ');
$auditAt = strpos($qsrc, "'QUERY_TOOBIG',");
ok($catchAt !== false && $gateAt !== false && $auditAt !== false
   && $catchAt < $gateAt && $gateAt < $auditAt,
   'the gate is evaluated before the QUERY_TOOBIG audit write');
$between = ($gateAt !== false && $auditAt !== false) ? substr($qsrc, $gateAt, $auditAt - $gateAt) : '';
ok(strpos($between, 'if ($penumbraToobigRecoverable)') !== false && strpos($between, '} else {') !== false,
   'and the audit write is on the else side of it');
ok(strpos($qsrc, "'error_code'  => 'too_much_data'") !== false,
   'the response contract is unchanged - the caller still gets too_much_data');

// ===========================================================================
group('12. The scheduler reads the health cache instead of re-probing');

/* THE DOUBLE PROBE. Until 2026-08-28 the scheduler and the watchdog each opened
   a connection to all five databases every five minutes, 46 seconds apart, and
   wrote the same cache - 2,880 connects a day where 1,440 would do. Cheap while
   healthy; during the InfoEd flap it pushed the scheduler cycle from 0.5s to
   77.6s, twice over. The scheduler now reads.

   The block is inline in a 27k-line file that runs its scheduler on include and
   SENDS MAIL, so it is lifted textually and run against stubs - the same trick
   penumbra_tests\notice uses for mon_sync_notice(). */
$runnerSrc = (string)@file_get_contents($APP . '\\schedule_runner.php');
$blkFrom = strpos($runnerSrc, '$pnbHealthOn = !isset($global_config[\'scheduler_refresh_health\'])');
/* The block ends where `if ($pnbHealthOn) { ... }` closes, found by brace depth
   over the tokenizer (2026-09-24). It used to end at the next landmark comment,
   "The completion half of the run pair." - and the 2026-09-23 MAINTENANCE JOBS
   section landed between the two, so the harness ran that section too: its
   require_once resolved beside THIS file, it logged "MAINTENANCE: skipped", and
   four exact-log assertions below failed on a runner that was fine. Ending at
   the block's own brace cannot swallow whatever the runner grows after it. */
$blkTo = false;
$ifAt  = ($blkFrom !== false) ? strpos($runnerSrc, 'if ($pnbHealthOn) {', $blkFrom) : false;
if ($ifAt !== false) {
    $at = $ifAt - strlen('<?php ');   // token text is lossless, so $at tracks the offset in $runnerSrc
    $depth = 0; $opened = false;
    foreach (token_get_all('<?php ' . substr($runnerSrc, $ifAt)) as $tok) {
        if (is_array($tok) ? ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) : $tok === '{') { $depth++; $opened = true; }
        elseif ($tok === '}') { $depth--; }
        $at += strlen(is_array($tok) ? $tok[1] : $tok);
        if ($opened && $depth === 0) { $blkTo = $at; break; }
    }
}
$block = ($blkFrom !== false && $blkTo !== false && $blkTo > $blkFrom) ? substr($runnerSrc, $blkFrom, $blkTo - $blkFrom) : '';
ok($block !== '' && substr($block, -1) === '}' && strpos($block, 'MAINTENANCE') === false,
   'the health-readback block is locatable in the live runner, and the lift stops at its own closing brace',
   array($blkFrom, $ifAt, $blkTo));
/* The block pulls in penumbra_health.php by dirname(__FILE__), which inside an
   eval() resolves to THIS file's directory. Drop it - the snapshot is stubbed
   below and the one constant it needs is defined above. Asserting the strip
   happened means a change to that require surfaces here instead of silently
   leaving a half-tested block. */
$stripped = preg_replace('/^\s*require_once dirname\(__FILE__\).*?;\s*$/m', '', $block, 1, $nStrip);
ok($nStrip === 1, 'the block\'s require_once is stripped for the harness', $nStrip);
$block = $stripped;

ok(strpos($block, "'probe_dbs' => \$pnbProbeDbs") !== false,
   'it no longer hard-codes a live probe');
ok(strpos($block, "\$pnbProbeDbs = !empty(\$global_config['scheduler_probe_dbs'])") !== false,
   'and the live probe is opt-in via config');

if (!defined('PENUMBRA_OUTAGE_MONITOR_STALE_SECS')) define('PENUMBRA_OUTAGE_MONITOR_STALE_SECS', 900);
$GLOBALS['PNB_LOG'] = array();
if (!function_exists('log_scheduler')) {
    eval('function log_scheduler($m) { $GLOBALS["PNB_LOG"][] = $m; }');
}
/* One stub for the snapshot, driven by a fixture the test sets. It also RECORDS
   what probe_dbs it was handed, which is the whole point of the change: the
   assertion that matters most is that the runner asked for false. */
$GLOBALS['PNB_SNAP'] = array();
$GLOBALS['PNB_PROBED'] = null;
if (!function_exists('penumbra_health_snapshot')) {
    eval('function penumbra_health_snapshot($o = array()) {
              $GLOBALS["PNB_PROBED"] = !empty($o["probe_dbs"]);
              return $GLOBALS["PNB_SNAP"];
          }');
}

/** Run the lifted block against one fixture; return array(note, logged lines). */
function runHealthBlock($snap, $cfg = array()) {
    global $block;
    $GLOBALS['PNB_SNAP'] = $snap;
    $GLOBALS['PNB_LOG']  = array();
    $global_config = $cfg;
    $pnbHealthNote = '';
    eval($block);
    return array($pnbHealthNote, $GLOBALS['PNB_LOG']);
}
/** A snapshot whose DB block is cached and $secs old. */
function snapAged($dbs, $secs, $problems = array()) {
    return array(
        'ok' => true, 'problems' => $problems,
        'components' => array(
            'databases' => $dbs,
            'databases_probed_at' => date('c', time() - $secs),
            'databases_from_cache' => true,
        ),
    );
}
$okDbs = array('ieprd' => array('status' => 'ok'), 'hr' => array('status' => 'ok'),
               'fin' => array('status' => 'ok'), 'pins' => array('status' => 'ok'),
               'infoed' => array('status' => 'ok'));

list($note, $log) = runHealthBlock(snapAged($okDbs, 47));
ok($GLOBALS['PNB_PROBED'] === false, 'the runner asked for NO live probe', $GLOBALS['PNB_PROBED']);
ok(strpos($note, 'health ok (5 dbs') === 0, 'the healthy line keeps its shape', $note);
ok(strpos($note, 'cached 47s ago') !== false, 'and now carries the cache age', $note);
ok($log === array(), 'a healthy cycle logs no extra line', $log);

// A cached 'down' must still reach the scheduler log.
$downDbs = $okDbs; $downDbs['infoed'] = array('status' => 'down');
list($note, $log) = runHealthBlock(snapAged($downDbs, 60));
ok($note === 'health DEGRADED', 'a cached down is reported', $note);
ok(count($log) === 1 && strpos($log[0], 'database infoed down') !== false,
   'and named on its own line', $log);
ok(count($log) === 1 && strpos($log[0], 'cached 60s ago') !== false,
   'marked as a cached reading, so it is not mistaken for live', $log);

// Degraded (the new third state) reaches it too.
$degDbs = $okDbs; $degDbs['infoed'] = array('status' => 'degraded', 'failed_attempts' => 3);
list($note, $log) = runHealthBlock(snapAged($degDbs, 30));
ok($note === 'health DEGRADED' && strpos($log[0], 'database infoed degraded') !== false,
   'a cached degraded is reported too', array($note, $log));

/* THE BACKSTOP GIVEN UP. With the scheduler no longer probing, the watchdog is
   the only prober - so its silence has to be the headline, not the stale
   numbers underneath it. This is the assertion that pays for the trade. */
list($note, $log) = runHealthBlock(snapAged($okDbs, 3600));
ok($note === 'health STALE', 'a cache older than the watchdog-stale threshold reads STALE', $note);
ok(count($log) === 1 && strpos($log[0], 'penumbra_monitor.php') !== false,
   'and the line names the process to go and check', $log);
list($note, $log) = runHealthBlock(snapAged($okDbs, 899));
ok($note !== 'health STALE', 'just inside the threshold is not stale', $note);

// Never probed at all (no cache file yet).
$never = array('ok' => true, 'problems' => array(),
               'components' => array('databases' => array(), 'databases_probed_at' => null));
list($note, $log) = runHealthBlock($never);
ok($note === 'health STALE' && strpos($log[0], 'never probed') !== false,
   'a missing cache reads STALE, not "ok (0 dbs)"', array($note, $log));

/* 'ok' from the snapshot is NOT the verdict, deliberately: it ignores cached DB
   state by design, so trusting it would report every cycle healthy - the exact
   silent-green bug the day has been about. */
$snapLies = snapAged($downDbs, 60);
$snapLies['ok'] = true;   // as the real snapshot genuinely reports it
list($note, ) = runHealthBlock($snapLies);
ok($note === 'health DEGRADED',
   "a cached 'down' is caught even though snapshot['ok'] says true", $note);

// A paused scheduler is deliberate, and must not read as a failure.
list($note, $log) = runHealthBlock(snapAged($okDbs, 20, array('scheduler paused')));
ok(strpos($note, 'health ok') === 0, 'a paused scheduler is not a health failure', array($note, $log));

// The config escape hatch really restores the probe.
list($note, ) = runHealthBlock(snapAged($okDbs, 47), array('scheduler_probe_dbs' => true));
ok($GLOBALS['PNB_PROBED'] === true, 'scheduler_probe_dbs => true asks for a live probe again');
ok(strpos($note, 'cached') === false, 'and drops the cache-age note, which would be a lie', $note);

// ===========================================================================
group('13. Correlated blips: several components failing on the SAME check (2026-09-12)');
/* THE REAL MORNING. 2026-09-12 06:48:58: SMTP down AND InfoEd connected only on
   its third rung, on one tick; clean again at 06:53. The same pair at 07:53:43,
   clean at 07:58. Two independent systems failing at the same second is a
   network event, and it was the first sign of that day's proxy-path outage -
   but per-component rules saw two isolated one-tick blips and said nothing.
   mon_correlated_update() asks a different question: how many components went
   bad on THIS tick that were fine on the previous one? */
$GAP = 3600;
$prevKeys = array(); $last = 0; $fired = array();
$morning = array(
    array('06:43:02', array()),
    array('06:48:58', array('smtp', 'db:infoed')),
    array('06:53:02', array()), array('06:58:02', array()), array('07:03:02', array()), array('07:08:02', array()),
    array('07:13:02', array()), array('07:18:02', array()), array('07:23:02', array()), array('07:28:02', array()),
    array('07:33:02', array()), array('07:38:02', array()), array('07:43:02', array()), array('07:48:02', array()),
    array('07:53:43', array('smtp', 'db:infoed')),
    array('07:58:02', array()), array('08:03:02', array()),
);
foreach ($morning as $t) {
    $r = mon_correlated_update($prevKeys, $t[1], ts($t[0]), $last, $GAP, 2, false);
    if ($r['fire']) $fired[] = $t[0];
    $prevKeys = $t[1]; $last = $r['last_alert'];
}
ok($fired === array('06:48:58', '07:53:43'), 'the real morning fires at 06:48 and again at 07:53 (65 min later)', $fired);

$r = mon_correlated_update(array(), array('smtp', 'db:infoed'), ts('06:48:58'), 0, $GAP, 2, false);
ok($r['newly'] === array('db:infoed', 'smtp') && $r['fire'] === true && $r['last_alert'] === ts('06:48:58'), 'two fresh failures on one tick fire, newly sorted, last_alert stamped', $r);
$r = mon_correlated_update(array(), array('smtp'), ts('06:48:58'), 0, $GAP, 2, false);
ok($r['fire'] === false && $r['newly'] === array('smtp'), 'one fresh failure is an ordinary blip - the consecutive and flap rules own it', $r);
$r = mon_correlated_update(array('db:hr'), array('db:hr', 'smtp'), ts('23:38:02'), 0, $GAP, 2, false);
ok($r['fire'] === false && $r['newly'] === array('smtp'), 'a component ALREADY down does not count: HR in its window plus one SMTP blip is not correlated', $r);
$r = mon_correlated_update(array('db:hr'), array('db:hr', 'smtp', 'db:infoed'), ts('23:38:02'), 0, $GAP, 2, false);
ok($r['fire'] === true && $r['newly'] === array('db:infoed', 'smtp'), 'but two fresh ones beside it are', $r);
$r = mon_correlated_update(array('smtp', 'db:infoed'), array('smtp', 'db:infoed'), ts('06:53:02'), ts('06:48:58'), $GAP, 2, false);
ok($r['fire'] === false && $r['newly'] === array(), 'the same pair persisting on the next tick is not a second event (the consecutive rule takes it from here)', $r);
$r = mon_correlated_update(array(), array('smtp', 'db:infoed'), ts('07:08:02'), ts('06:48:58'), $GAP, 2, false);
ok($r['fire'] === false && $r['last_alert'] === ts('06:48:58'), 'a repeat inside the gap is rate-limited and does not move last_alert', $r);
$r = mon_correlated_update(array(), array('smtp', 'db:infoed'), ts('07:49:02'), ts('06:48:58'), $GAP, 2, false);
ok($r['fire'] === true, 'and fires again once the gap has passed', $r);
$r = mon_correlated_update(array(), array('smtp', 'db:infoed'), ts('06:48:58'), 0, $GAP, 2, true);
ok($r['fire'] === false && $r['newly'] === array('db:infoed', 'smtp') && $r['last_alert'] === 0, 'suppressed (a reported outage is in progress, or --test): the pattern is still reported, nothing is sent', $r);
$r = mon_correlated_update(array(), array('smtp', 'db:infoed'), ts('06:48:58'), 0, $GAP, 3, false);
ok($r['fire'] === false, 'the component floor is configurable: at 3, a pair is not enough', $r);
$r = mon_correlated_update(null, array('smtp', 'db:infoed', 'delivery'), ts('06:48:58'), null, $GAP, 2, false);
ok($r['fire'] === true && count($r['newly']) === 3, 'a state file from before this rule (no keys, no stamp) loads clean', $r);

// ===========================================================================
group('14. Known windows: a muted episode is recorded but not alerted (2026-09-12)');
$MUTES = array(array('key' => 'db:hr', 'slot' => 46, 'by' => 'bplimon', 'at' => 0, 'label' => 'HR ~23:03 daily'));
$T2308 = mktime(23, 8, 0, 8, 28, 2026);
$openHr = array('db:hr' => array('started_at' => $T2308));
$r = mon_apply_mutes(array('database hr down'), $openHr, $MUTES, $T2308 + 300);
ok($r['alert'] === array() && isset($r['muted']['db:hr']), 'HR down inside its muted window is withheld from alerting', $r);
$r = mon_apply_mutes(array('database hr down', 'smtp down'), $openHr + array('smtp' => array('started_at' => $T2308)), $MUTES, $T2308 + 300);
ok($r['alert'] === array('smtp down') && count($r['muted']) === 1, 'SMTP failing in the same minute still alerts - a mute is per component', $r);
$r = mon_apply_mutes(array('database hr down'), array('db:hr' => array('started_at' => mktime(14, 0, 0, 8, 28, 2026))), $MUTES, mktime(14, 5, 0, 8, 28, 2026));
ok($r['alert'] === array('database hr down') && $r['muted'] === array(), 'HR down at 14:00 is a different event - it alerts', $r);
$r = mon_apply_mutes(array('database hr down'), array(), $MUTES, $T2308);
ok($r['alert'] === array() && isset($r['muted']['db:hr']), 'no open episode yet (first tick, --test): the tick time stands in for the start');
$r = mon_apply_mutes(array('SIMULATED FAULT - this is a drill, not a real failure'), array(), array(array('key' => 'drill', 'slot' => 46, 'by' => '', 'at' => 0, 'label' => '')), $T2308);
ok(count($r['alert']) === 1 && $r['muted'] === array(), 'a drill is never muted');
$r = mon_apply_mutes(array('database hr down'), $openHr, array(), $T2308 + 300);
ok($r['alert'] === array('database hr down') && $r['muted'] === array(), 'no mutes at all: everything alerts');
$r = mon_apply_mutes(array(), $openHr, $MUTES, $T2308 + 300);
ok($r['alert'] === array() && $r['muted'] === array(), 'a healthy tick stays healthy');

// ===========================================================================
if ($CONTROL) {
    group('CONTROL (must FAIL - proves the harness can report failure)');
    ok(1 === 2, 'deliberate false assertion');
}

echo "\n" . str_repeat('-', 60) . "\n";
echo "PASS $PASS   FAIL $FAIL\n";
exit($FAIL === 0 ? 0 : 1);
