<?php
/**
 * Unit tests for the watchdog's auto-posted banner, mon_sync_notice().
 *
 * Two of its rules are genuinely dangerous if wrong, which is the whole reason
 * this file exists:
 *   - it must never overwrite OR clear a notice an admin posted, and
 *   - it must never clear maintenance mode as a side effect (penumbra_notice_save()
 *     rebuilds both halves from its argument, so a careless write switches the
 *     lockout off).
 * A monitor that ends an outage window by accident is worse than no monitor.
 *
 * The function is text-extracted from the live penumbra_monitor.php so this
 * always tests what is deployed. No database, no mail - penumbra_notice.php is
 * pure file state.
 */

$APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
// D:\ is the SERVER's drive when this runs on the box and the WORKSTATION's when
// run from a desk, so try the local path first and fall back to the UNC share.
$MONITOR = 'D:\\Utilities\\PHP_8.2-p\\penumbra_monitor.php';
if (!is_file($MONITOR)) { $MONITOR = '\\\\oitras\\d$\\Utilities\\PHP_8.2-p\\penumbra_monitor.php'; }

$stateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_monnotice_' . getmypid() . '.json';
$config = array('notice_state_file' => $stateFile);
require_once $APP . DIRECTORY_SEPARATOR . 'penumbra_notice.php';

// --- extract just mon_sync_notice() from the live monitor --------------------
$src = file_get_contents($MONITOR);
$start = strpos($src, 'function mon_sync_notice(');
if ($start === false) { fwrite(STDERR, "mon_sync_notice() not found in $MONITOR\n"); exit(2); }
$end = strpos($src, "\n}\n", $start);
if ($end === false) { fwrite(STDERR, "could not find the end of mon_sync_notice()\n"); exit(2); }
eval(substr($src, $start, $end - $start + 3));

$pass = 0; $fail = 0; $failures = array();
function check($name, $got, $want) {
    global $pass, $fail, $failures;
    if ($got === $want) { $pass++; return; }
    $fail++;
    $failures[] = sprintf('  FAIL %-52s got=%s want=%s', $name, var_export($got, true), var_export($want, true));
}
function reset_state($notice, $maint) {
    global $stateFile;
    file_put_contents($stateFile, json_encode(array('notice' => $notice, 'maintenance' => $maint)));
}

$future = time() + 3600;
$adminNotice = array('message' => 'Oracle patching Friday 6-8pm', 'level' => 'info', 'until' => 0, 'set_by' => 'bplimon');
$maint       = array('enabled' => true, 'message' => 'back at 8', 'until' => $future, 'set_by' => 'bplimon');

// ---- posts when degraded and nothing is set ---------------------------------
reset_state(null, null);
mon_sync_notice(true, array('scheduler offline'));
$n = penumbra_active_notice();
check('degraded + empty -> posts a notice', ($n !== null), true);
check('degraded + empty -> owned by monitor', ($n ? $n['set_by'] : ''), 'monitor');
check('degraded + empty -> warn level', ($n ? $n['level'] : ''), 'warn');

// ---- idempotent: a second run must not rewrite -------------------------------
check('already posted -> no-op', mon_sync_notice(true, array('scheduler offline')), '');

// ---- clears its own notice on recovery ---------------------------------------
mon_sync_notice(false, array());
check('recovery -> clears its own notice', penumbra_active_notice(), null);
check('recovery + nothing set -> no write', mon_sync_notice(false, array()), '');

// ---- RULE 1: never touch an admin's notice -----------------------------------
reset_state($adminNotice, null);
$r = mon_sync_notice(true, array('scheduler offline'));
$n = penumbra_active_notice();
check('degraded + admin notice -> not overwritten', ($n ? $n['message'] : ''), 'Oracle patching Friday 6-8pm');
check('degraded + admin notice -> reported as left alone', (strpos($r, 'left the admin notice alone') !== false), true);

reset_state($adminNotice, null);
mon_sync_notice(false, array());
$n = penumbra_active_notice();
check('recovery + admin notice -> NOT cleared', ($n ? $n['message'] : ''), 'Oracle patching Friday 6-8pm');

// ---- RULE 2: maintenance must survive every path -----------------------------
reset_state(null, $maint);
mon_sync_notice(true, array('database ieprd down'));
check('degraded -> maintenance PRESERVED', (penumbra_active_maintenance() !== null), true);
check('degraded -> notice also posted', (penumbra_active_notice() !== null), true);

// the dangerous one: clearing our notice must not clear the lockout with it
reset_state(array('message' => 'We are aware of a problem affecting Penumbra and are looking into it. Scheduled reports may be delayed.',
                  'level' => 'warn', 'until' => 0, 'set_by' => 'monitor'), $maint);
mon_sync_notice(false, array());
check('recovery -> our notice cleared', penumbra_active_notice(), null);
check('recovery -> maintenance STILL ON', (penumbra_active_maintenance() !== null), true);
$m = penumbra_active_maintenance();
check('recovery -> maintenance expiry unchanged', ($m ? (int)$m['until'] : 0), (int)$future);
check('recovery -> maintenance owner unchanged', ($m ? $m['set_by'] : ''), 'bplimon');

// ---- RULE 3: it must never switch maintenance ON ------------------------------
reset_state(null, null);
penumbra_monitor_ack_clear();
mon_sync_notice(true, array('scheduler offline', 'smtp down'));
check('degraded -> never enables maintenance', penumbra_active_maintenance(), null);

// ---- RULE 4: ACKNOWLEDGEMENT (the false-positive escape hatch) -----------------
// Without this an admin clears the banner and the watchdog puts it back within
// five minutes, forever.
$probA = array('database hr down');
$probB = array('scheduler offline');

reset_state(null, null);
penumbra_monitor_ack_clear();
mon_sync_notice(true, $probA);
check('ack: banner posted before acknowledging', (penumbra_active_notice() !== null), true);

// admin clears it -> system_notice.php records the acknowledgement
reset_state(null, null);
penumbra_monitor_ack_set('bplimon');
$r = mon_sync_notice(true, $probA);
check('ack: first run after ack suppresses', (strpos($r, 'suppressed') !== false), true);
check('ack: nothing re-posted', penumbra_active_notice(), null);

// still the same problem on later cycles -> stays quiet
check('ack: same problem stays suppressed', mon_sync_notice(true, $probA), '');
check('ack: still nothing posted', penumbra_active_notice(), null);

// a DIFFERENT problem is not covered by the acknowledgement
$r = mon_sync_notice(true, $probB);
check('ack: a different problem breaks through', (penumbra_active_notice() !== null), true);
check('ack: and the stale ack is dropped', penumbra_monitor_ack_get(), null);

// order of the problem list must not matter to the signature
check('ack: signature is order-independent',
      penumbra_monitor_problem_signature(array('a', 'b')),
      penumbra_monitor_problem_signature(array('b', 'a')));

// recovery wipes the acknowledgement so the next incident alerts normally
reset_state(null, null);
penumbra_monitor_ack_set('bplimon');
penumbra_monitor_ack_stamp(penumbra_monitor_problem_signature($probA));
mon_sync_notice(false, array());
check('ack: recovery clears the acknowledgement', penumbra_monitor_ack_get(), null);
$r = mon_sync_notice(true, $probA);
check('ack: after recovery the same problem alerts again', (penumbra_active_notice() !== null), true);

// an expired acknowledgement must not suppress anything
reset_state(null, null);
penumbra_monitor_ack_set('bplimon', -60);   // already expired
check('ack: expired ack reads as absent', penumbra_monitor_ack_get(), null);
mon_sync_notice(true, $probA);
check('ack: expired ack does not suppress', (penumbra_active_notice() !== null), true);
penumbra_monitor_ack_clear();

if (is_file($stateFile)) unlink($stateFile);

echo "\n==== mon_sync_notice() unit tests ====\n";
echo "passed: $pass\nfailed: $fail\n";
if ($fail) { echo implode("\n", $failures) . "\n"; exit(1); }
echo "ALL PASS\n";
exit(0);
