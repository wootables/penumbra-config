<?php
/**
 * penumbra_monitor.php - the EXTERNAL watchdog for Penumbra.  (added 2026-08-18)
 *
 * WHY THIS EXISTS
 * Penumbra can already detect its own problems: the scheduler heartbeat goes
 * stale, health.php answers 503, four surfaces show it. What it could not do is
 * TELL anyone unattended, because every push-alert path in the app lives inside
 * schedule_runner.php - so the runner's own death is the one failure it can
 * never report. A dying process does not send a message; it simply stops, and
 * silence is only noticeable to an observer holding a clock. This is that
 * observer.
 *
 * RUN IT AS A SECOND SCHEDULED TASK, separate from the runner. It deliberately
 * shares no state and no process with the thing it is watching. It still shares
 * the box, so it cannot report "server is down" - but it does catch the failure
 * that has actually happened here before: the runner process crashing or hanging
 * while the box stays up (see the July conditional-include fatal).
 *
 *   php.exe penumbra_monitor.php            normal run (quiet unless something changed)
 *   php.exe penumbra_monitor.php --verbose  print the full verdict
 *   php.exe penumbra_monitor.php --test     force an alert email, to prove the pipe works
 *   php.exe penumbra_monitor.php --simulate-degraded
 *                                           rehearse a real outage: injects a fake fault and lets
 *                                           the true state machine run (threshold, email, banner).
 *                                           Run it twice to clear FAILS_BEFORE_ALERT, then once
 *                                           without the flag to watch it recover. Everything it
 *                                           sends is labelled as a drill.
 *
 * ALERT DISCIPLINE - the reason a monitor gets ignored is that it cries wolf:
 *   - Nothing is sent until FAILS_BEFORE_ALERT consecutive bad checks (default 2),
 *     so a single slow cycle or a restart never pages anyone.
 *   - While a problem persists it re-sends only every REMIND_MINUTES (default 60).
 *   - Recovery sends exactly one "resolved" note.
 *   - A deliberately PAUSED scheduler is not a failure and never alerts.
 * State lives in penumbra_monitor_state.json next to the other runtime files.
 */

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$APP = 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra';

$argvRaw   = isset($argv) ? $argv : array();
$VERBOSE   = in_array('--verbose', $argvRaw, true);
$TESTMODE  = in_array('--test', $argvRaw, true);
// --simulate-degraded: inject a synthetic problem and let the REAL state machine
// run from there - consecutive-fail counter, alert email, auto-posted banner, and
// recovery on the next clean run. Exists so the alerting path can be rehearsed
// without breaking anything real: the alternative was unsealing the credential
// store to rename a database host, which is a poor trade for a drill.
// It does NOT test detection (that is what disabling the runner task proves);
// it tests everything that happens after something is detected.
$SIMULATE  = in_array('--simulate-degraded', $argvRaw, true);

require_once $APP . DIRECTORY_SEPARATOR . 'db_connection.php';
require_once $APP . DIRECTORY_SEPARATOR . 'penumbra_health.php';
require_once $APP . DIRECTORY_SEPARATOR . 'penumbra_email_shell.php'; // same template the scheduler uses
require_once $APP . DIRECTORY_SEPARATOR . 'penumbra_notice.php';      // auto-posted user-facing banner

// ---- tunables (override any of these in penumbra_config.php) -----------------
$MON = isset($config['monitor']) && is_array($config['monitor']) ? $config['monitor'] : array();
$RECIPIENTS        = isset($MON['recipients'])   ? $MON['recipients']   : 'bplimon@ncsu.edu';
$FROM              = isset($MON['from'])         ? $MON['from']         : 'penumbra-monitor@ncsu.edu';
$FAILS_BEFORE_ALERT= isset($MON['fails_before']) ? (int)$MON['fails_before'] : 2;
$REMIND_MINUTES    = isset($MON['remind_mins'])  ? (int)$MON['remind_mins']  : 60;
// Flap detection (2026-08-28) - see the block further down for what these mean.
// 3 bad checks in an hour is roughly "failing every twenty minutes", which is
// well clear of the one-off blips the consecutive rule is designed to swallow.
$FLAP_THRESHOLD    = isset($MON['flap_threshold'])   ? (int)$MON['flap_threshold']   : 3;
$FLAP_WINDOW_MINS  = isset($MON['flap_window_mins']) ? (int)$MON['flap_window_mins'] : 60;

$stateFile = 'D:\\Utilities\\PHP_8.2-p\\logs\\penumbra_monitor_state.json';
$logFile   = 'D:\\Utilities\\PHP_8.2-p\\logs\\penumbra_monitor.log';

/**
 * Keep the site-wide notice banner in step with what the watchdog sees, so users
 * are told "we know" without an admin having to be awake.
 *
 * THREE RULES, all of them about not making things worse:
 *
 * 1. NEVER TOUCH A HUMAN'S NOTICE. The banner is a single slot shared with the
 *    admin screen. Ownership is decided by set_by === 'monitor'; if an admin has
 *    posted anything, this leaves it completely alone - it will not overwrite it
 *    while degraded, and crucially will not CLEAR it on recovery.
 * 2. PRESERVE THE MAINTENANCE HALF. penumbra_notice_save() rebuilds both halves
 *    from its argument, so passing only a notice would silently switch
 *    maintenance mode OFF - turning a monitoring nicety into an outage-ender.
 *    The current maintenance record is therefore copied through verbatim.
 * 3. NEVER ENABLE MAINTENANCE MODE. Posting a banner on a false positive is
 *    embarrassing; locking every user out of the app on a false positive is an
 *    outage the monitor caused itself. Informational only, always.
 *
 * Gated on the same consecutive-failure threshold as the email, so a single slow
 * check never flashes a banner at everyone.
 */
function mon_sync_notice($degraded, $problems, $msg = null) {
    // Overridable so a --simulate-degraded drill puts an honestly-labelled banner
    // in front of users rather than a false alarm. Ownership/clearing behaviour is
    // identical either way, so the drill still exercises the real rules.
    if ($msg === null) {
        $msg = 'We are aware of a problem affecting Penumbra and are looking into it. '
             . 'Scheduled reports may be delayed.';
    }

    $st  = penumbra_notice_state();
    $cur = $st['notice'];
    $mine = ($cur && isset($cur['set_by']) && $cur['set_by'] === 'monitor');

    // Rule 1: an admin's notice is untouchable, in both directions.
    if ($cur && !$mine) { return 'notice: left the admin notice alone'; }

    if ($degraded) {
        if ($mine && isset($cur['message']) && $cur['message'] === $msg) { return ''; } // already posted

        // RULE 4 - ACKNOWLEDGEMENT. An admin who clears a monitor-owned banner is
        // saying "I know". Without this, the next cycle simply puts it back and
        // the admin cannot win against a false positive.
        $sig = penumbra_monitor_problem_signature($problems);
        $ack = penumbra_monitor_ack_get();
        if ($ack) {
            if (!isset($ack['signature']) || $ack['signature'] === null) {
                // First run after the admin acknowledged: bind it to whatever is
                // wrong right now, so it silences THIS problem and not the next.
                penumbra_monitor_ack_stamp($sig);
                return 'notice: suppressed (acknowledged by ' . (isset($ack['by']) ? $ack['by'] : '?') . ')';
            }
            if ($ack['signature'] === $sig) { return ''; }   // same problem, still acknowledged
            // Something DIFFERENT is wrong now - the acknowledgement does not cover
            // it, so drop it and let the banner through.
            penumbra_monitor_ack_clear();
        }
    } else {
        // Recovery resets the slate so the next incident alerts normally.
        penumbra_monitor_ack_clear();
        if (!$mine) { return ''; }   // nothing of ours to clear - do not write at all
    }

    // Rule 2: carry the maintenance record through untouched.
    $save = array('notice' => null, 'maintenance' => null);
    if (!empty($st['maintenance'])) {
        $save['maintenance'] = array(
            'enabled' => true,
            'message' => $st['maintenance']['message'],
            'until'   => $st['maintenance']['until'],
            'set_by'  => $st['maintenance']['set_by'],
        );
    }
    if ($degraded) {
        $save['notice'] = array('message' => $msg, 'level' => 'warn', 'until' => 0, 'set_by' => 'monitor');
    }
    // Rule 3: $save['maintenance'] is only ever a copy of what was already there.
    if (!penumbra_notice_save($save)) { return 'notice: WRITE FAILED'; }
    return $degraded ? 'notice: posted' : 'notice: cleared';
}

function mon_log($msg) {
    global $logFile, $VERBOSE;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    if ($VERBOSE) echo $line;
}

/**
 * Fold one tick into the rolling flap window and report which components have
 * crossed the threshold. See the long note at the flap-detection call site for
 * WHY this rule exists; this is only the bookkeeping.
 *
 * DELIBERATELY PURE - no globals, no clock, no I/O - because the bug it exists
 * to catch is a rule that behaves correctly on every tick in isolation and
 * wrongly across a sequence. That is only provable by replaying a sequence, and
 * only testable if the rule can be called without a database behind it.
 *
 * @param array $prevFlap    key => list of unix timestamps, from the last tick
 * @param array $prevAlerted key => unix ts this key was last flap-alerted
 * @param array $badKeys     component keys that looked bad THIS tick
 * @param int   $now         this tick's timestamp
 * @param int   $threshold   bad checks inside the window that constitute a flap
 * @param int   $windowSecs  how far back the window reaches
 * @param bool  $record      false on --test, so a drill cannot train the detector
 * @param array $suppress    keys the CONSECUTIVE rule owns this tick - their marks
 *                           are discarded, see the note on the unset() below
 * @return array flap / flap_alerted / flapping (key => count that tripped it)
 */
function mon_flap_update($prevFlap, $prevAlerted, $badKeys, $now, $threshold, $windowSecs, $record = true, $suppress = array()) {
    $hist    = is_array($prevFlap)    ? $prevFlap    : array();
    $alerted = is_array($prevAlerted) ? $prevAlerted : array();
    $cutoff  = $now - $windowSecs;

    if ($record) {
        foreach ($badKeys as $k) {
            if (!isset($hist[$k]) || !is_array($hist[$k])) $hist[$k] = array();
            $hist[$k][] = $now;
        }
    }

    /* Prune EVERY key, not just the ones bad on this tick. A component that
       stopped misbehaving has to age out on its own - otherwise marks left over
       from this morning sit there forever, and one fresh blip tonight combines
       with them to fire an alert about a system that is currently fine. */
    foreach ($hist as $k => $stamps) {
        $kept = array();
        foreach ((array)$stamps as $ts) { if ((int)$ts > $cutoff) $kept[] = (int)$ts; }
        if ($kept) { $hist[$k] = $kept; } else { unset($hist[$k]); }
    }
    // Expiring the alerted marker on the same window is what makes this remind
    // rather than fire once: sustained flapping re-alerts, at most hourly.
    foreach ($alerted as $k => $ts) { if ((int)$ts <= $cutoff) unset($alerted[$k]); }

    /* A COMPONENT THE CONSECUTIVE RULE HAS REPORTED LEAVES NO MARKS BEHIND.
       Caught in production on 2026-08-28, the first night this rule was live:
       HR's nightly maintenance alerted correctly at 23:13 (2 consecutive) and
       sent its RESOLVED note at 23:43 - and then a THIRD, wrong email at 23:48
       announcing "intermittent failures", because seven marks from 23:08-23:38
       were still inside the 60-minute window.
       Guarding the send on $state['alerted'] is right DURING an episode and
       useless after it: the recovery branch resets that flag to false, so the
       marks outlive the thing that was suppressing them. Dropping the marks is
       the durable form of the same intent - once an episode has been reported
       through the primary channel, it is by definition not an UNreported flap.
       Only the keys the alert actually names are dropped: a different
       component's blip during the same window is still its own signal. */
    foreach ($suppress as $k) { unset($hist[$k]); }

    $flapping = array();
    foreach ($hist as $k => $stamps) {
        if (count($stamps) >= $threshold && !isset($alerted[$k])) $flapping[$k] = count($stamps);
    }
    return array('flap' => $hist, 'flap_alerted' => $alerted, 'flapping' => $flapping);
}

// ---- gather ------------------------------------------------------------------
// probe_dbs + probe_smtp: this is the one caller that SHOULD pay for live checks.
// Interactive pages must never probe (a dead listener blocks for 60-90s), which
// is exactly why an out-of-band watcher is the right place to do it.
$problems = array();
$snap = null;
try {
    $snap = penumbra_health_snapshot(array('probe_dbs' => true, 'probe_smtp' => true, 'error_hours' => 24));
} catch (Exception $e) {
    $problems[] = 'health snapshot failed: ' . $e->getMessage();
} catch (Error $e) {
    $problems[] = 'health snapshot fatal: ' . $e->getMessage();
}

if (is_array($snap)) {
    if (empty($snap['ok']) && !empty($snap['problems'])) {
        foreach ($snap['problems'] as $p) {
            // A paused scheduler is a deliberate act, not an outage.
            if (stripos($p, 'paused') !== false) continue;
            $problems[] = $p;
        }
    }
}

$sched = is_array($snap) && isset($snap['components']['scheduler']) ? $snap['components']['scheduler'] : array();
$smtp  = is_array($snap) && isset($snap['components']['smtp'])      ? $snap['components']['smtp']      : array();
$dbs   = is_array($snap) && isset($snap['components']['databases']) ? $snap['components']['databases'] : array();

// The synthetic fault goes in AFTER the real checks, so the readings in the email
// stay truthful - the drill shows genuine scheduler/SMTP/database state and only
// the fault itself is fabricated. Labelled loudly everywhere it surfaces so a
// drill can never be mistaken for a real outage by whoever reads the mail.
if ($SIMULATE) {
    $problems[] = 'SIMULATED FAULT - this is a drill, not a real failure';
}

$healthy = empty($problems);

// ---- record ------------------------------------------------------------------
// Write this tick into the outage ledger (2026-08-24). BEFORE the alert
// decision, and outside it: what gets RECORDED must not depend on what gets
// SENT. The 2-consecutive-fails threshold and the hourly reminder exist to stop
// the mail being noise, and they are right for mail - but they are wrong for
// history. The 03:03 scheduler blips on 2026-08-21 and 2026-08-24 cleared
// within one tick, never crossed the threshold, never emailed, and so existed
// nowhere an admin would ever look. They are in the ledger now.
//
// --test is excluded because it forces the alert path without changing the
// readings; a drill (--simulate-degraded) IS recorded, tagged 'drill', and left
// out of every availability figure - a rehearsal should exercise this too.
$ledgerChange = array('opened' => array(), 'closed' => array());
if (!$TESTMODE) {
    $ledgerChange = penumbra_outage_record($problems, time(), $config);
}

// ---- decide ------------------------------------------------------------------
// flap / flap_alerted persist the rolling window the flap detector needs. They
// are listed here so a state file written before 2026-08-28 still loads clean.
$prev = array('consecutive_fails' => 0, 'alerted' => false, 'last_alert' => 0, 'last_problems' => array(),
              'flap' => array(), 'flap_alerted' => array());
$raw = @file_get_contents($stateFile);
if ($raw) { $d = json_decode($raw, true); if (is_array($d)) { $prev = array_merge($prev, $d); } }

$now = time();
$send = false;
$subject = '';
$reason = '';

if ($healthy) {
    if (!empty($prev['alerted'])) { $send = true; $subject = 'RESOLVED: Penumbra is healthy again'; $reason = 'recovery'; }
    $state = array('consecutive_fails' => 0, 'alerted' => false, 'last_alert' => 0, 'last_problems' => array());
} else {
    $fails = (int)$prev['consecutive_fails'] + 1;
    $state = array('consecutive_fails' => $fails,
                   'alerted' => !empty($prev['alerted']),
                   'last_alert' => (int)$prev['last_alert'],
                   'last_problems' => $problems);
    if (!$prev['alerted'] && $fails >= $FAILS_BEFORE_ALERT) {
        $send = true; $reason = 'first alert (' . $fails . ' consecutive)';
        $subject = 'ALERT: Penumbra - ' . implode('; ', $problems);
    } elseif (!empty($prev['alerted']) && ($now - (int)$prev['last_alert']) >= $REMIND_MINUTES * 60) {
        $send = true; $reason = 'reminder';
        $subject = 'STILL DOWN: Penumbra - ' . implode('; ', $problems);
    }
    if ($send) { $state['alerted'] = true; $state['last_alert'] = $now; }
}

if ($TESTMODE) { $send = true; $reason = 'forced --test'; $subject = 'TEST: Penumbra monitor alert pipeline'; }

// ---- flap detection ----------------------------------------------------------
/* CONSECUTIVE IS NOT THE ONLY SHAPE A FAILURE HAS (2026-08-28).
 *
 * Everything above this line asks one question: is it STILL broken? That is the
 * right question for the failure this watchdog was built for - a runner that
 * dies and stays dead - and the 2-consecutive threshold is what keeps a single
 * slow cycle from paging anyone at 3am.
 *
 * It is the wrong question for a link that is failing intermittently, and on
 * 2026-08-28 that cost us. InfoEd was sick from roughly 11:53 to 13:19. The
 * watchdog sampled it fourteen times and caught it red-handed twice - 11:54:58
 * and 13:04:59 - but each catch recovered on the very next tick, so the counter
 * reset to zero both times, never reached two, and nobody was told anything.
 * Ninety minutes of a broken database, two ledger episodes reading
 * "checks":1,"duration":0, one real user handed a 500, and total silence.
 * Every alert rule here was working exactly as written.
 *
 * So this counts a second way: N bad checks within a rolling window, whether or
 * not they touch. The window is per COMPONENT, keyed the same way the outage
 * ledger keys episodes, so InfoEd flapping cannot be diluted by SMTP being fine.
 *
 * WHAT COUNTS AS BAD. Both the hard problems the snapshot reports AND the new
 * 'degraded' state - a database that answered only after some of its connect
 * attempts failed. Degraded is the signal that would have caught this on the
 * first tick: it was true for most of that ninety minutes while 'down' was true
 * for ten of it. A near-miss repeated is not a near-miss.
 *
 * WHY THE HISTORY OUTLIVES A GOOD TICK. The obvious implementation - keep the
 * counter in $state and let the healthy branch reset it - is precisely the bug
 * being fixed, one level up. Flap history is carried across BOTH branches on
 * purpose and only ever expires by age.
 *
 * IT EMAILS BUT DOES NOT POST A BANNER. mon_sync_notice() is left keyed to the
 * consecutive rule. Flapping is worth waking an admin; it is not worth telling
 * every user the system is down, because between the blips it demonstrably is
 * not - it is answering their reports. */

// What looked wrong THIS tick, by stable component key.
$badNow = array();
foreach ($problems as $p) {
    $c = penumbra_outage_classify($p);
    if ($c['kind'] === 'drill') continue;   // a rehearsal must not train the detector
    $badNow[$c['key']] = $p;
}
foreach ($dbs as $dbName => $d) {
    if (isset($d['status']) && $d['status'] === 'degraded') {
        $badNow['db:' . strtolower($dbName)] = 'database ' . $dbName . ' degraded ('
            . (isset($d['failed_attempts']) ? $d['failed_attempts'] : '?')
            . ' failed connect attempt(s) before one succeeded)';
    }
}

$flapState = mon_flap_update(
    isset($prev['flap'])         ? $prev['flap']         : array(),
    isset($prev['flap_alerted']) ? $prev['flap_alerted'] : array(),
    array_keys($badNow),
    $now,
    $FLAP_THRESHOLD,
    $FLAP_WINDOW_MINS * 60,
    !$TESTMODE,
    // The consecutive rule has spoken for whatever is bad right now, so those
    // marks must not also feed this one - see the unset() note in the function.
    !empty($state['alerted']) ? array_keys($badNow) : array()
);
$flapHist    = $flapState['flap'];
$flapAlerted = $flapState['flap_alerted'];
$flapping    = $flapState['flapping'];

/* Only when the consecutive rule has NOT already spoken. A sustained outage
   trips both detectors - HR's nightly maintenance is 7 consecutive bad checks,
   which is also 7 bad checks in an hour - and it must produce one email, not
   two. The consecutive rule wins because it fires earlier and its subject line
   is the more accurate description of what is happening. */
$FLAPPING_ALERT = false;
$flapLines = array();
if (!$TESTMODE && !$send && empty($state['alerted']) && $flapping) {
    foreach ($flapping as $k => $n) {
        $flapLines[] = (isset($badNow[$k]) ? $badNow[$k] : $k)
                     . ' - ' . $n . ' bad checks in the last ' . $FLAP_WINDOW_MINS . ' min';
        $flapAlerted[$k] = $now;
    }
    $FLAPPING_ALERT = true;
    $send    = true;
    $reason  = 'flapping (' . count($flapping) . ' component(s), '
             . $FLAP_THRESHOLD . '-in-' . $FLAP_WINDOW_MINS . 'min rule)';
    $subject = 'ALERT: Penumbra - intermittent failures - ' . implode('; ', array_keys($flapping));
}

$state['flap']         = $flapHist;
$state['flap_alerted'] = $flapAlerted;

// PERSIST STATE HERE, before any early exit. Writing it only on the send path
// (the first version of this file) meant consecutive_fails reset every quiet run
// and the counter could never reach FAILS_BEFORE_ALERT - a watchdog that logs
// diligently and never actually alerts.
@file_put_contents($stateFile, json_encode($state));

// Keep the user-facing banner in step. Tied to $state['alerted'] rather than to
// $healthy alone, so the banner appears on the same confirmed-failure threshold
// as the email instead of flashing on a single slow check. --test never posts:
// a pipeline test must not put a scare banner in front of every user.
$noticeOn = !isset($MON['post_notice']) || (bool)$MON['post_notice'];
if ($noticeOn && !$TESTMODE) {
    $noteMsg = $SIMULATE
        ? 'Scheduled test of the Penumbra status banner - no action needed, and nothing is actually wrong.'
        : null;
    $noteResult = mon_sync_notice(!$healthy && !empty($state['alerted']), $problems, $noteMsg);
    if ($noteResult !== '') { mon_log($noteResult); }
}

// ---- report ------------------------------------------------------------------
$verdict = $healthy ? 'ok' : ('DEGRADED: ' . implode('; ', $problems));
// Databases that answered only on a later fallback rung. Named in the log even
// on an 'ok' tick, because before 2026-08-28 this was the state that left no
// trace anywhere but php82_errors.log while a database quietly fell apart.
$dbDegraded = array();
foreach ($dbs as $dbName => $d) {
    if (isset($d['status']) && $d['status'] === 'degraded') {
        $dbDegraded[] = $dbName . '(' . (isset($d['failed_attempts']) ? $d['failed_attempts'] : '?') . ' failed)';
    }
}
mon_log($verdict
    . ' | scheduler=' . (isset($sched['status']) ? $sched['status'] : '?')
    . (isset($sched['seconds_ago']) ? ' (' . $sched['seconds_ago'] . 's ago)' : '')
    . ' | smtp=' . (isset($smtp['status']) ? $smtp['status'] : '?')
    . ' | dbs=' . count($dbs)
    . ($dbDegraded ? ' | DEGRADED: ' . implode(',', $dbDegraded) : '')
    // Transitions only. A tick that changed nothing says nothing extra, so the
    // log stays scannable and the two lines that bracket an outage stand out.
    . ($ledgerChange['opened'] ? ' | outage OPENED: ' . implode(',', $ledgerChange['opened']) : '')
    . ($ledgerChange['closed'] ? ' | outage CLOSED: ' . implode(',', $ledgerChange['closed']) : '')
    . ($send ? ' | SENDING (' . $reason . ')' : ''));

if (!$send) { exit($healthy ? 0 : 1); }

// ---- alert -------------------------------------------------------------------
// Built from penumbra_email_shell.php - the same template the scheduler's failure
// notices use, so everything Penumbra sends unprompted looks like one system.
// Recovery is green rather than alarm-red, and carries a tick instead of a
// warning triangle: a RESOLVED note should be readable as good news at a glance.
if ($FLAPPING_ALERT) {
    /* Amber, not red, and deliberately not green even though this tick may well
       be healthy: the whole point of a flap alert is that the instantaneous
       reading is not the story. Whoever opens this needs to understand at a
       glance that it is about a PATTERN over the last hour. */
    $band = '#b26a00'; $glyph = '&#9888;';
    $headline = 'Penumbra is failing intermittently';
    $intro = 'A component has failed repeatedly over the last ' . $FLAP_WINDOW_MINS . ' minutes without '
           . 'ever staying down long enough to trip the usual consecutive-failure alert. It may be '
           . 'answering normally right now. The readings below are current; the pattern is the problem.';
} elseif ($healthy) {
    $band = '#1a7f37'; $glyph = '&#10004;';
    $headline = 'Penumbra has recovered';
    $intro = 'Everything the watchdog checks is responding again. No action is needed - this note '
           . 'is sent once, so you know the earlier alert is closed.';
} else {
    $band = '#a12a2a'; $glyph = '&#9888;';
    $headline = 'Penumbra needs attention';
    $intro = 'The watchdog found a problem that has persisted across consecutive checks. '
           . 'The current state of every monitored component is below.';
}
if ($TESTMODE) {
    $band = '#336699'; $glyph = '&#9873;';
    $headline = 'Monitor test';
    $intro = 'This is a forced test of the watchdog alert pipeline (--test). It says nothing about '
           . 'the health of the system; the readings below are real, but no alert threshold was met.';
}
if ($SIMULATE) {
    // Blue, not red: whoever opens this at 3am must be able to tell in one glance
    // that it is a drill. The readings below are still real - only the fault is not.
    $band = '#336699'; $glyph = '&#9873;';
    $headline = ($healthy ? 'Drill complete: simulated fault cleared' : 'DRILL: simulated fault');
    $intro = $healthy
        ? 'The simulated fault has cleared and the watchdog has sent its recovery notice. '
          . 'Nothing was ever actually wrong; this confirms the full alerting path works.'
        : 'This is a REHEARSAL (--simulate-degraded). No component has actually failed - a fake '
          . 'fault was injected to exercise the alert threshold, the email and the status banner. '
          . 'Every reading below is genuine; only the fault is fabricated.';
}

$rows  = penumbra_email_row('Scheduler',
        '<strong>' . penumbra_email_h(isset($sched['status']) ? strtoupper($sched['status']) : '?') . '</strong>'
      . (isset($sched['seconds_ago']) ? ' &middot; heartbeat ' . penumbra_email_h($sched['seconds_ago']) . 's ago' : '')
      . (isset($sched['last_run']) ? '<br><span style="color:#888888;">last run ' . penumbra_email_h($sched['last_run']) . '</span>' : ''));
$rows .= penumbra_email_row('SMTP',
        '<strong>' . penumbra_email_h(isset($smtp['status']) ? strtoupper($smtp['status']) : '?') . '</strong>'
      . (isset($smtp['host']) ? ' &middot; ' . penumbra_email_h($smtp['host'] . ':' . $smtp['port']) : '')
      . (isset($smtp['detail']) ? '<br><span style="color:#888888;">' . penumbra_email_h($smtp['detail']) . '</span>' : ''));
foreach ($dbs as $dbName => $d) {
    $rows .= penumbra_email_row(strtoupper($dbName),
            '<strong>' . penumbra_email_h(isset($d['status']) ? strtoupper($d['status']) : '?') . '</strong>'
          . (isset($d['ms']) ? ' &middot; ' . penumbra_email_h($d['ms']) . ' ms' : '')
          . (!empty($d['detail']) ? '<br><span style="color:#888888;">' . penumbra_email_h($d['detail']) . '</span>' : ''));
}
$rows .= penumbra_email_row('Checked', penumbra_email_h(date('Y-m-d H:i:s T')));

$html  = penumbra_email_open($headline, $band, 'Penumbra Monitor', $glyph);
$html .= penumbra_email_intro($intro);
if ($FLAPPING_ALERT && !empty($flapLines)) {
    $html .= penumbra_email_callout('What keeps failing', nl2br(penumbra_email_h(implode("\n", $flapLines))));
} elseif (!$healthy && !empty($problems)) {
    $html .= penumbra_email_callout('What is wrong', nl2br(penumbra_email_h(implode("\n", $problems))));
}
$html .= penumbra_email_section('System status', penumbra_email_kv_table($rows));
$html .= penumbra_email_section('Where to look', penumbra_email_pre(
      "Scheduler log:  " . $APP . "\\log\\scheduler_" . date('Y-m-d') . ".log\n"
    . "Monitor log:    " . $logFile . "\n"
    . "Runbook:        " . $APP . "\\README.md  (section 4)"));
$html .= penumbra_email_cta('https://www3.acs.ncsu.edu/sponsor_migration/penumbra/health.php', 'Open the health dashboard');
$html .= penumbra_email_close('This is an automated message from the Penumbra watchdog (penumbra_monitor.php, reason: '
    . penumbra_email_h($reason) . '). It alerts only after consecutive failed checks and reminds at most hourly. '
    . 'Replies are not monitored.');

$sent = penumbra_email_send($RECIPIENTS, $subject, $html, 'Penumbra Monitor', $FROM);

// If SMTP is the thing that is broken, the alert cannot get out - say so loudly
// in the log, which is then the only surviving record.
mon_log($sent ? ('alert emailed to ' . $RECIPIENTS) : ('ALERT EMAIL FAILED - mail() returned false. '
      . 'SMTP status was ' . (isset($smtp['status']) ? $smtp['status'] : '?') . '.'));

exit($healthy ? 0 : 1);
