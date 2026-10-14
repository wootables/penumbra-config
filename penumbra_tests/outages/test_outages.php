<?php
/**
 * test_outages.php - the outage ledger state machine, in isolation.
 *
 * Runs against the REAL functions extracted from penumbra_health.php (never a
 * copy - a test of a paste proves nothing about the file that ships). The only
 * stub is penumbra_health_cache_file(), which decides where the ledger lands;
 * everything under test is the shipped code.
 *
 *   php.exe test_outages.php
 */

$SRC = isset($argv[1]) ? $argv[1] : 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_health.php';
$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_outage_test_' . getmypid();
@mkdir($TMP, 0777, true);

// ---- extract the outage block from the live file ---------------------------
$src = file_get_contents($SRC);
if ($src === false) { fwrite(STDERR, "cannot read $SRC\n"); exit(2); }
$start = strpos($src, '/* =====================================================================' . "\n" . ' * OUTAGE HISTORY');
$end   = strpos($src, '/**' . "\n" . ' * Compose the whole picture.');
if ($start === false || $end === false || $end <= $start) {
    fwrite(STDERR, "could not locate the OUTAGE HISTORY block in $SRC\n"); exit(2);
}
$block = substr($src, $start, $end - $start);

// The one stub: point the ledger at a scratch directory.
$stub = '<?php function penumbra_health_cache_file($c) { return "' . addslashes($TMP) . DIRECTORY_SEPARATOR . DIRECTORY_SEPARATOR . 'penumbra_health_cache.json"; } $config = array(); ?>';
$harness = $TMP . DIRECTORY_SEPARATOR . 'harness.php';
file_put_contents($harness, $stub . "\n<?php\n" . $block . "\n");
require $harness;

// ---- tiny assert -----------------------------------------------------------
$PASS = 0; $FAIL = 0;
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ('  (got: ' . json_encode($got) . ')')) . "\n"; }
}
function ledger() { return penumbra_outage_ledger_read(array()); }
function reset_ledger() { @unlink(penumbra_outage_ledger_file(array())); }

// ---- the fixture clock -----------------------------------------------------
// The state-machine fixtures run on a FIXED clock, but it is ANCHORED to a
// recent day rather than nailed to a calendar literal.
//
// The trap this is built around (2026-09-21): the reader's window is measured
// from the real clock - penumbra_outage_history() does $cutoff = time() -
// hours*3600 - so any fixture written at a hard-coded date walks out of the
// 24*30h window used below as the calendar moves, and takes eight list /
// near-miss / mute assertions red with it. Nothing is wrong with the code on
// the day that happens; the fixtures have simply aged out of view. Anchoring
// keeps them where the reader can see them, permanently.
//
// Load-bearing, do not "simplify" away: the wall-clock TIME of day and the day
// OFFSETS. 23:08 is half-hour slot 46 - the slot every mute assertion names -
// and offsets 0..3 are four distinct days, which is what makes a recurring
// pattern. Only the calendar date floats.
$ANCHOR_DAY = 10;   // days ago; offsets reach +5, so the NEWEST fixture is 5 days old
$_anchor  = time() - ($ANCHOR_DAY * 86400);
$ANCHOR_Y = (int)date('Y', $_anchor); $ANCHOR_M = (int)date('n', $_anchor); $ANCHOR_D = (int)date('j', $_anchor);
/** $h:$i on the anchor day + $dayOffset. mktime() normalizes month/year rollover. */
function t_at($h, $i, $dayOffset = 0) {
    global $ANCHOR_Y, $ANCHOR_M, $ANCHOR_D;
    return mktime((int)$h, (int)$i, 0, $ANCHOR_M, $ANCHOR_D + (int)$dayOffset, $ANCHOR_Y);
}

echo "\n== the fixture clock ==\n";
// If THIS goes red, the fixtures have drifted out of the reader's widest
// window and everything downstream is red for a reason that has nothing to do
// with penumbra_health.php. Move the anchor, do not touch the assertions.
ok(t_at(23, 8, 0) > time() - (30 * 86400) && t_at(23, 6, 5) < time(),
   'the fixture days sit inside the 30-day window and in the past',
   array('anchor_days_ago' => $ANCHOR_DAY, 'oldest' => date('c', t_at(23, 8, 0)), 'newest' => date('c', t_at(23, 6, 5))));

$T = t_at(23, 8, 0);   // the fixed clock the state-machine fixtures run on

echo "\n== classify: identity must depend only on WHAT is broken ==\n";
$c = penumbra_outage_classify('database hr down');
ok($c['key'] === 'db:hr' && $c['component'] === 'HR' && $c['kind'] === 'database', 'database hr down -> db:hr/HR', $c);
ok(penumbra_outage_classify('scheduler offline')['key'] === 'scheduler', 'scheduler offline -> scheduler');
ok(penumbra_outage_classify('scheduler unknown')['key'] === 'scheduler', 'scheduler unknown -> same key as offline');
ok(penumbra_outage_classify('smtp down')['key'] === 'smtp', 'smtp down -> smtp');
ok(penumbra_outage_classify('SIMULATED FAULT - this is a drill, not a real failure')['kind'] === 'drill', 'drill is tagged, not treated as an outage');
ok(penumbra_outage_classify('database FIN down')['key'] === 'db:fin', 'case-insensitive db name');
// The regression this guards: a varying message must not fragment the episode.
ok(penumbra_outage_classify('widget queue backed up 41 deep')['key']
   === penumbra_outage_classify('widget queue backed up 902 deep')['key'], 'digits are stripped from unknown problems');

echo "\n== open / extend / close ==\n";
reset_ledger();
penumbra_outage_record(array(), $T - 300);                      // healthy
ok(count(ledger()['open']) === 0 && count(ledger()['episodes']) === 0, 'a healthy tick opens nothing');
ok(ledger()['observing_since'] == $T - 300, 'observing_since stamped on the first tick ever');

penumbra_outage_record(array('database hr down'), $T);          // 23:08 bad
$L = ledger();
ok(count($L['open']) === 1 && isset($L['open']['db:hr']), 'first bad tick opens one episode', array_keys($L['open']));
ok($L['open']['db:hr']['checks'] === 1, 'checks starts at 1');

for ($i = 1; $i <= 6; $i++) { penumbra_outage_record(array('database hr down'), $T + ($i * 300)); }
$L = ledger();
ok(count($L['open']) === 1, 'six identical ticks EXTEND, they do not duplicate', count($L['open']));
ok($L['open']['db:hr']['checks'] === 7, 'checks counted', $L['open']['db:hr']['checks']);
ok(count($L['episodes']) === 0, 'nothing closed while still bad');

penumbra_outage_record(array(), $T + 2100);                     // 23:43 recovered
$L = ledger();
ok(count($L['open']) === 0, 'recovery closes the episode');
ok(count($L['episodes']) === 1, 'one closed episode');
$ep = $L['episodes'][0];
ok($ep['started_at'] == $T, 'started_at = first bad reading');
ok($ep['ended_at'] == $T + 1800, 'ended_at = LAST CONFIRMED BAD reading, not the recovery tick', date('H:i', $ep['ended_at']));
ok($ep['recovered_by'] == $T + 2100, 'recovered_by = first confirmed good reading');
ok($ep['duration'] === 1800, 'duration measures only observed downtime (30m, not 35m)', $ep['duration']);

echo "\n== concurrent, independent components ==\n";
reset_ledger();
penumbra_outage_record(array('database hr down'), $T);
penumbra_outage_record(array('database hr down', 'scheduler offline'), $T + 300);
ok(count(ledger()['open']) === 2, 'a second problem opens its OWN episode');
penumbra_outage_record(array('database hr down'), $T + 600);
$L = ledger();
ok(count($L['open']) === 1 && count($L['episodes']) === 1, 'the recovered one closes; the other keeps running');
ok($L['episodes'][0]['key'] === 'scheduler', 'the right one closed', $L['episodes'][0]['key']);
ok($L['open']['db:hr']['started_at'] == $T, 'the surviving episode kept its original start');

echo "\n== the 03:03 case: a blip that never emailed ==\n";
// Below the watchdog's 2-consecutive-fail threshold, so no alert was ever sent.
// It exists ONLY in the log - which is the whole reason this ledger exists.
// It is also the case that proves the duration RANGE: one bad reading has a
// confirmed duration of zero, and "0s" on a status page reads as "nothing
// happened". The outer bound is what must drive anything user-facing.
reset_ledger();
$blip = time() - 3600;
penumbra_outage_record(array('scheduler offline'), $blip);
penumbra_outage_record(array(), $blip + 300);
$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['total'] === 1, 'a single-tick blip is still recorded', $h['total']);
ok($h['episodes'][0]['duration'] === 0, 'confirmed duration is honestly zero');
ok($h['episodes'][0]['duration_max'] === 300, 'but the outer bound is the sampling interval', $h['episodes'][0]['duration_max']);
ok($h['by_component']['scheduler']['downtime'] === 300, 'and downtime uses the OUTER bound, never 0', $h['by_component']['scheduler']['downtime']);

echo "\n== reader: window, ongoing, clipping ==\n";
reset_ledger();
$now = time();
penumbra_outage_record(array('database hr down'), $now - (10 * 86400));   // 10 days ago
penumbra_outage_record(array(), $now - (10 * 86400) + 600);
penumbra_outage_record(array('database fin down'), $now - 3600);          // an hour ago
penumbra_outage_record(array(), $now - 1800);
$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['total'] === 1, '24h window excludes the 10-day-old episode', $h['total']);
$h = penumbra_outage_history(array('hours' => 336), array());
ok($h['total'] === 2, '14-day window includes both', $h['total']);

reset_ledger();
penumbra_outage_record(array('database hr down'), $now - (3 * 86400));    // still open, 3 days
$h = penumbra_outage_history(array('hours' => 24), array());
ok(count($h['open']) === 1, 'an ONGOING outage older than the window is still shown');
ok($h['open'][0]['ongoing'] === true, 'flagged ongoing');
ok($h['by_component']['db:hr']['downtime'] <= 24 * 3600 + 5, 'downtime is CLIPPED to the window, not 3 days', $h['by_component']['db:hr']['downtime']);

echo "\n== recurring patterns ==\n";
reset_ledger();
for ($d = 0; $d < 4; $d++) {                      // four nights at 23:08, 35 min
    $s = t_at(23, 8, $d);
    penumbra_outage_record(array('database hr down'), $s);
    penumbra_outage_record(array(), $s + 2100);
}
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok(count($h['patterns']) === 1, 'four nights at the same time = one pattern', count($h['patterns']));
$p = array_values($h['patterns'])[0];
ok($p['days'] === 4, 'four distinct days', $p['days']);
ok($p['component'] === 'HR', 'named');
ok($h['episodes'][0]['recurring'] === 4, 'each episode carries the recurring count');
ok($h['total'] === 4, 'recurring episodes are NOT suppressed - still all four rows', $h['total']);

reset_ledger();                                    // two nights is not yet a pattern
for ($d = 0; $d < 2; $d++) {
    $s = t_at(23, 8, $d);
    penumbra_outage_record(array('database hr down'), $s);
    penumbra_outage_record(array(), $s + 2100);
}
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok(count($h['patterns']) === 0, 'two occurrences do not make a pattern', count($h['patterns']));

echo "\n== the watchdog's own silence ==\n";
reset_ledger();
$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['ledger_missing'] === true, 'no ledger at all is reported as missing, not as healthy');
ok($h['monitor_stale'] === true, 'and stale');
ok($h['coverage_pct'] == 0, 'zero coverage');

penumbra_outage_record(array(), time() - 60);
$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['monitor_stale'] === false, 'a fresh tick is not stale');

reset_ledger();
penumbra_outage_record(array(), time() - 7200);   // last checked 2h ago
$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['monitor_stale'] === true, 'a 2h-old tick IS stale', $h['monitor_age']);
ok($h['total'] === 0, 'and reports no outages...');
ok($h['coverage_pct'] < 100, '...but does NOT claim to have watched the whole window', $h['coverage_pct']);

echo "\n== availability honesty ==\n";
reset_ledger();
$base = time() - (24 * 3600);
penumbra_outage_record(array(), $base);                       // observing starts
penumbra_outage_record(array('database hr down'), $base + 3600);
penumbra_outage_record(array(), $base + 3600 + 1800);         // 30 min down
penumbra_outage_record(array(), time());                      // still watching now
$h = penumbra_outage_history(array('hours' => 24), array());
$av = $h['by_component']['db:hr']['availability'];
ok($av > 97 && $av < 98.5, 'availability computed against OBSERVED time (~97.9%)', $av);
ok($h['coverage_pct'] > 95, 'coverage near 100% when the watchdog ran the whole window', $h['coverage_pct']);

// The regression that would silently flatter the system: if availability were
// measured from the confirmed bound, this whole 30-minute gap - observed on a
// single bad tick - would score a flawless 100%.
ok($h['by_component']['db:hr']['downtime'] === 1800, 'the uncertain interval is counted AGAINST uptime', $h['by_component']['db:hr']['downtime']);

echo "\n== drills never pollute real history ==\n";
reset_ledger();
penumbra_outage_record(array('SIMULATED FAULT - this is a drill, not a real failure'), $T);
penumbra_outage_record(array(), $T + 300);
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok(count($h['by_component']) === 0, 'a drill contributes no downtime to any component', $h['by_component']);
ok(count($h['patterns']) === 0, 'and forms no pattern');
ok($h['total'] === 1, 'but is still visible in the list, tagged', $h['total']);

echo "\n== corrupt / partial ledger degrades, never fatals ==\n";
file_put_contents(penumbra_outage_ledger_file(array()), '{not json');
$h = penumbra_outage_history(array('hours' => 24), array());
ok(is_array($h) && $h['total'] === 0, 'garbage file reads as an empty ledger');
file_put_contents(penumbra_outage_ledger_file(array()), '{"episodes":"nope","open":5}');
$h = penumbra_outage_history(array('hours' => 24), array());
ok(is_array($h) && $h['total'] === 0, 'wrong-typed fields are normalized away');
penumbra_outage_record(array('database hr down'), time());
ok(count(ledger()['open']) === 1, 'and the writer recovers on the next tick');

echo "\n== near misses: recorded beside outages, never counted as downtime (2026-09-12) ==\n";
// The 06:48 and 07:53 blips of 2026-09-12: InfoEd connected only on a fallback
// rung (degraded), SMTP was down for one tick. Degraded readings used to exist
// nowhere but the watchdog's log line; they are now ledger episodes of their own.
reset_ledger();
$NM = 'database infoed degraded (2 failed connect attempt(s) before one succeeded)';
$r = penumbra_outage_record(array(), $T, null, array($NM));
ok($r['opened'] === array() && $r['near_opened'] === array('db:infoed'), 'a degraded reading opens a NEAR-MISS episode, not an outage', $r);
$L = ledger();
ok(isset($L['open']['near:db:infoed']) && !empty($L['open']['near:db:infoed']['near_miss']), 'stored under its own key, flagged near_miss', array_keys($L['open']));
ok(count($L['open']) === 1 && !isset($L['open']['db:infoed']), 'and no outage was opened for the same component');
$r = penumbra_outage_record(array(), $T + 300, null, array($NM));
ok($r['near_opened'] === array() && ledger()['open']['near:db:infoed']['checks'] === 2, 'a second degraded tick EXTENDS it', ledger()['open']['near:db:infoed']['checks']);
$r = penumbra_outage_record(array(), $T + 600, null, array());
ok($r['near_closed'] === array('db:infoed') && $r['closed'] === array(), 'a clean tick closes it as a near miss', $r);
$L = ledger();
ok(count($L['open']) === 0 && count($L['episodes']) === 1 && !empty($L['episodes'][0]['near_miss']), 'one closed near-miss episode', $L['episodes']);
ok($L['episodes'][0]['problem'] === $NM && $L['episodes'][0]['component'] === 'INFOED', 'it keeps the description and the component name');

$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok($h['total'] === 0 && count($h['episodes']) === 0, 'the reader does NOT count it as an outage', array($h['total'], count($h['episodes'])));
ok($h['near_total'] === 1 && count($h['near_misses']) === 1 && !empty($h['near_misses'][0]['near_miss']), 'it is listed as a near miss', $h['near_total']);
ok($h['near_misses'][0]['duration'] === 300 && $h['near_misses'][0]['duration_max'] === 600, 'with the same confirmed / outer-bound durations an outage gets', $h['near_misses'][0]);
ok(count($h['by_component']) === 0, 'and contributes NO downtime to any component', $h['by_component']);
ok(count($h['open']) === 0 && count($h['near_open']) === 0, 'nothing open');

// Still open: it must show as an ongoing near miss, never as an ongoing outage.
reset_ledger();
penumbra_outage_record(array(), time() - 600, null, array($NM));
penumbra_outage_record(array(), time() - 300, null, array($NM));
$h = penumbra_outage_history(array('hours' => 24), array());
ok(count($h['open']) === 0 && count($h['near_open']) === 1 && !empty($h['near_open'][0]['ongoing']), 'an ongoing near miss is in near_open, not open', array(count($h['open']), count($h['near_open'])));
ok($h['near_open'][0]['duration'] >= 600 && $h['near_open'][0]['checks'] === 2, 'with its running duration and check count', $h['near_open'][0]);
ok(count($h['by_component']) === 0, 'still no downtime');

// Down and degraded are different states of the SAME component: the outage
// and the near miss are separate episodes, and only the outage costs uptime.
reset_ledger();
$base = time() - (24 * 3600);
penumbra_outage_record(array(), $base);
penumbra_outage_record(array('database infoed down'), $base + 3600);
penumbra_outage_record(array(), $base + 3900, null, array($NM));     // recovered onto a fallback rung
penumbra_outage_record(array(), $base + 4200, null, array($NM));
penumbra_outage_record(array(), $base + 4500);                        // fully healthy
penumbra_outage_record(array(), time());
$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['total'] === 1 && $h['near_total'] === 1, 'one outage and one near miss for the same component', array($h['total'], $h['near_total']));
ok($h['by_component']['db:infoed']['downtime'] === 300 && $h['by_component']['db:infoed']['episodes'] === 1, 'downtime counts the outage alone (5 min), not the 10 degraded minutes', $h['by_component']['db:infoed']);

// Four nights of near misses at the same time are NOT a maintenance pattern.
reset_ledger();
for ($d = 0; $d < 4; $d++) {
    $s = t_at(23, 8, $d);
    penumbra_outage_record(array(), $s, null, array($NM));
    penumbra_outage_record(array(), $s + 600);
}
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok(count($h['patterns']) === 0 && $h['near_total'] === 4, 'near misses form no pattern pill, all four still listed', array(count($h['patterns']), $h['near_total']));

// A drill is a drill whether it arrives as a problem or a near miss.
reset_ledger();
penumbra_outage_record(array(), $T, null, array('SIMULATED FAULT - this is a drill, not a real failure'));
penumbra_outage_record(array(), $T + 300);
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok($h['near_total'] === 1 && $h['near_misses'][0]['kind'] === 'drill', 'a drill near miss stays tagged drill', $h['near_misses'][0]);

// The old three-argument call is untouched: no near misses, nothing new opens.
reset_ledger();
$r = penumbra_outage_record(array('database hr down'), $T);
ok($r['opened'] === array('db:hr') && $r['near_opened'] === array() && $r['near_closed'] === array(), 'the three-argument call still answers the old way, plus empty near-miss lists', $r);

echo "\n== known windows: mutes (2026-09-12) ==\n";
reset_ledger(); @unlink(penumbra_mute_file(array()));
ok(penumbra_mutes_read(array()) === array(), 'no file = no mutes');
ok(penumbra_mute_slot(t_at(23, 8, 0)) === 46, '23:08 falls in the 23:00 half hour (slot 46)', penumbra_mute_slot(t_at(23, 8, 0)));
ok(penumbra_mute_slot(t_at(3, 3, 0)) === 6, '03:03 -> slot 6');
$l = penumbra_mute_set('db:hr', 46, true, 'bplimon', 'HR ~23:03 daily', array());
ok(count($l) === 1 && $l[0]['key'] === 'db:hr' && $l[0]['slot'] === 46 && $l[0]['by'] === 'bplimon', 'a mute is stored with who and when', $l);
ok(count(penumbra_mutes_read(array())) === 1, 'and read back from the file');
$m = penumbra_mutes_read(array());
ok(penumbra_mute_has($m, 'db:hr', 46) && !penumbra_mute_has($m, 'db:hr', 47), 'the pill state is an exact slot match');
ok(penumbra_mute_lookup($m, 'db:hr', t_at(23, 8, 1)) !== null, 'an HR start at 23:08 is covered');
ok(penumbra_mute_lookup($m, 'db:hr', t_at(23, 31, 1)) !== null, 'a 23:31 start is the same window running late - covered');
ok(penumbra_mute_lookup($m, 'db:hr', t_at(22, 52, 1)) !== null, '22:52 is inside the 25-minute tolerance');
ok(penumbra_mute_lookup($m, 'db:hr', t_at(23, 45, 1)) === null, '23:45 is a different event - not covered');
ok(penumbra_mute_lookup($m, 'db:hr', t_at(3, 3, 1)) === null, 'a 03:03 HR outage is not covered by the 23:00 mute');
ok(penumbra_mute_lookup($m, 'smtp', t_at(23, 8, 1)) === null, 'another component in the same slot is not covered');
penumbra_mute_set('scheduler', 0, true, 'x', '', array());
ok(penumbra_mute_lookup(penumbra_mutes_read(array()), 'scheduler', t_at(23, 50, 1)) !== null, 'the 00:00 slot covers 23:50 across midnight');
$l = penumbra_mute_set('db:hr', 46, false, '', '', array());
ok(count($l) === 1 && $l[0]['key'] === 'scheduler', 'unmuting removes only that entry', $l);
penumbra_mute_set('scheduler', 0, false, '', '', array());
ok(penumbra_mutes_read(array()) === array(), 'empty again');
file_put_contents(penumbra_mute_file(array()), '{garbage');
ok(penumbra_mutes_read(array()) === array(), 'a corrupt mute file reads as no mutes, never a fatal');

// The reader FLAGS muted episodes and pills; it hides nothing and charges
// exactly what it charged before.
penumbra_mute_set('db:hr', 46, true, 'bplimon', 'HR ~23:03 daily', array());
reset_ledger();
for ($d = 0; $d < 4; $d++) {
    $s = t_at(23, 8, $d);
    penumbra_outage_record(array('database hr down'), $s);
    penumbra_outage_record(array(), $s + 2100);
}
penumbra_outage_record(array('database hr down'), t_at(14, 0, 4));
penumbra_outage_record(array(), t_at(14, 10, 4));
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
$mutedRows = 0; $plainRows = 0;
foreach ($h['episodes'] as $ep) { if (!empty($ep['muted'])) $mutedRows++; else $plainRows++; }
ok($mutedRows === 4 && $plainRows === 1, 'the four nightly episodes read muted, the 14:00 one does not', array($mutedRows, $plainRows));
$p = array_values($h['patterns'])[0];
ok(!empty($p['muted']) && $p['slot'] === 46, 'the pattern pill carries muted and its slot', $p);
ok($h['total'] === 5 && $h['by_component']['db:hr']['episodes'] === 5, 'muting changes nothing about the history itself');
penumbra_outage_record(array('database hr down'), t_at(23, 6, 5));   // still open, in the window
$h = penumbra_outage_history(array('hours' => 24 * 30), array());
ok(count($h['open']) === 1 && !empty($h['open'][0]['muted']), 'an OPEN episode inside the window is flagged too');
penumbra_mute_set('db:hr', 46, false, '', '', array());
@unlink(penumbra_mute_file(array()));

echo "\n== the last 24 hours as a strip ==\n";
reset_ledger();
$now = time();
penumbra_outage_record(array(), $now - 86400);
penumbra_outage_record(array('database hr down'), $now - 3600);
penumbra_outage_record(array('database hr down'), $now - 3300);
penumbra_outage_record(array(), $now - 3000, null, array('database infoed degraded (2 failed connect attempt(s) before one succeeded)'));
penumbra_outage_record(array(), $now - 2700);
penumbra_outage_record(array('www3 delivery down'), $now - 600);
penumbra_outage_record(array('SIMULATED FAULT - this is a drill, not a real failure'), $now - 500);
penumbra_outage_record(array('www3 delivery down'), $now - 300);
$st = penumbra_outage_strip(24, 96, array());
ok($st['cells'] === 96 && $st['cell_secs'] == 900, '96 cells of 15 minutes', array($st['cells'], $st['cell_secs']));
$byKey = array(); foreach ($st['rows'] as $r) $byKey[$r['key']] = $r;
ok(isset($byKey['db:hr']) && isset($byKey['db:infoed']) && isset($byKey['delivery']) && !isset($byKey['drill']), 'one row per component, near misses under the component key, drills left out', array_keys($byKey));
$hr = $byKey['db:hr']['cells'];
$downCells = array_keys(array_filter($hr, function ($v) { return $v === 1; }));
ok(count($downCells) >= 1 && count($downCells) <= 2 && min($downCells) >= 91, 'HR down paints the cell(s) about an hour ago', $downCells);
ok(array_sum(array_slice($hr, 0, 88)) === 0, 'nothing painted where nothing happened');
$inf = $byKey['db:infoed']['cells'];
ok(in_array(2, $inf, true) && !in_array(1, $inf, true), 'INFOED shows a near-miss cell and no down cell');
$dl = $byKey['delivery']['cells'];
ok($dl[95] === 1, 'an open outage paints through the last cell');
ok(count($byKey['db:hr']['cells']) === 96 && $byKey['db:hr']['component'] === 'HR', 'rows carry the component name and a full cell set');

echo "\n== a window that is not the last N hours (2026-10-01, the hub's window picker) ==\n";
// Fixtures sit at NOON on days counted back from the real clock, so a window of
// whole days holds them at any run hour (no midnight straddle, no calendar rot).
reset_ledger();
$now  = time();
$noon = function ($daysAgo) use ($now) { return strtotime(date('Y-m-d', $now - $daysAgo * 86400) . ' 12:00:00'); };
penumbra_outage_record(array(), $now - 20 * 86400);                       // watching since 20 days ago
$d10 = $noon(10);
penumbra_outage_record(array('database hr down'), $d10);
penumbra_outage_record(array('database hr down'), $d10 + 1500);
penumbra_outage_record(array(), $d10 + 1800);                             // HR: 30 min, 10 days ago
$d3 = $noon(3);
penumbra_outage_record(array('database fin down'), $d3);
penumbra_outage_record(array(), $d3 + 600);                               // FIN: 10 min, 3 days ago
$d2 = $noon(2);
penumbra_outage_record(array(), $d2, null, array('database infoed degraded (2 failed connect attempt(s) before one succeeded)'));
penumbra_outage_record(array(), $d2 + 300);                               // a near miss, 2 days ago
penumbra_outage_record(array('www3 delivery down'), $now - 3600);
penumbra_outage_record(array('www3 delivery down'), $now - 300);          // still open, an hour old

$h = penumbra_outage_history(array('hours' => 24), array());
ok($h['to'] <= time() && $h['to'] >= $now && $h['from'] === $h['to'] - 86400 && $h['ends_now'] && $h['window_hours'] === 24, 'the plain form resolves its window: the last 24 hours, ending now', array($h['from'], $h['to'], $h['window_hours']));

$f = strtotime(date('Y-m-d', $d10) . ' 00:00:00'); $t = strtotime(date('Y-m-d', $d10) . ' 00:00:00 +1 day');
$h = penumbra_outage_history(array('from' => $f, 'to' => $t), array());
ok($h['from'] === $f && $h['to'] === $t && !$h['ends_now'] && $h['window_hours'] === (int)round(($t - $f) / 3600), 'a past day: exactly that day, not ending now', array($h['from'], $h['to'], $h['ends_now']));
ok($h['total'] === 1 && $h['episodes'][0]['key'] === 'db:hr', 'only that day\'s outage - FIN came after the window', $h['total']);
ok(count($h['open']) === 1 && $h['open_in_window'] === 0, 'the open outage is still listed, but not counted in a window that ended before it began', array(count($h['open']), $h['open_in_window']));
ok(array_keys($h['by_component']) === array('db:hr') && $h['by_component']['db:hr']['downtime'] === 1800, 'availability charges that day\'s 30 minutes and nothing of the open outage', $h['by_component']);
ok($h['coverage_pct'] == 100 && $h['near_total'] === 0 && $h['near_open_in_window'] === 0, 'fully watched; no near miss that day', array($h['coverage_pct'], $h['near_total']));

$h = penumbra_outage_history(array('from' => $d10 - 3600, 'to' => $d10 + 900), array());
ok($h['total'] === 1 && $h['by_component']['db:hr']['downtime'] === 900, 'a window that ends mid-outage charges only the part inside it', $h['by_component']);

$h = penumbra_outage_history(array('from' => $now - 7200), array());
ok($h['ends_now'] && $h['open_in_window'] === 1 && $h['total'] === 0 && isset($h['by_component']['delivery']) && $h['by_component']['delivery']['downtime'] >= 3600,
   'a window that holds the open outage\'s start counts it and charges it to now', array($h['open_in_window'], isset($h['by_component']['delivery']) ? $h['by_component']['delivery'] : null));

$h = penumbra_outage_history(array('to' => $d3 + 43200, 'from' => $noon(4)), array());
ok($h['total'] === 1 && $h['episodes'][0]['key'] === 'db:fin' && $h['near_total'] === 0, 'from/to together: FIN only, the near miss two days ago is after it', array($h['total'], $h['near_total']));

$h = penumbra_outage_history(array('all' => true), array());
$L = ledger();
ok($h['from'] === (int)$L['observing_since'] && $h['horizon'] === (int)$L['observing_since'] && $h['ends_now'], 'all time: from the first tick the watchdog recorded', array($h['from'], $L['observing_since']));
ok($h['total'] === 2 && $h['near_total'] === 1 && $h['open_in_window'] === 1 && $h['coverage_pct'] >= 99.9, 'every outage, every near miss, fully watched', array($h['total'], $h['near_total'], $h['coverage_pct']));

$h = penumbra_outage_history(array('from' => $now - 40 * 86400), array());
ok(abs($h['coverage_pct'] - 50.0) < 0.2, 'a window reaching before the first tick is only partly covered (20 of 40 days)', $h['coverage_pct']);

// The strip over the same windows.
$st = penumbra_outage_strip(24, null, array(), $f, $t);
$byKey = array(); foreach ($st['rows'] as $r) $byKey[$r['key']] = $r;
ok($st['from'] === $f && $st['to'] === $t && $st['cells'] === penumbra_outage_strip_cells($t - $f), 'a strip over a past day takes that day and its own cell count', array($st['from'], $st['to'], $st['cells']));
ok(array_keys($byKey) === array('db:hr'), 'and only what happened that day: no FIN, no open delivery outage', array_keys($byKey));
$red = array_keys(array_filter($byKey['db:hr']['cells'], function ($v) { return $v === 1; }));
$c0 = (int)floor(($d10 - $f) / $st['cell_secs']);
ok($red === array($c0, $c0 + 1), 'HR\'s 30 minutes from noon paint exactly two 15-minute cells', array($red, $c0));
$st = penumbra_outage_strip(24, null, array(), $now - 7 * 86400);
ok($st['cells'] === 168 && abs($st['cell_secs'] - 3600) < 1, 'a week: 168 cells of an hour', array($st['cells'], $st['cell_secs']));
$st = penumbra_outage_strip(24, null, array(), $now - 7 * 86400, $now + 86400);
ok($st['to'] <= time() && $st['to'] >= $now, 'a strip never runs past now', $st['to']);

// The horizon: a ledger trimmed at PENUMBRA_OUTAGE_KEEP no longer holds its oldest
// days, so "all time" and coverage begin at the oldest episode it still holds.
reset_ledger();
$L = ledger();
$L['observing_since'] = $now - 200 * 86400; $L['last_tick_at'] = $now - 60; $L['ticks'] = 1;
for ($i = 0; $i < PENUMBRA_OUTAGE_KEEP; $i++) {
    $s = $now - 100 * 86400 + $i * 17000;
    $L['episodes'][] = array('key' => 'db:hr', 'component' => 'HR', 'kind' => 'database', 'problem' => 'database hr down',
                             'started_at' => $s, 'last_bad_at' => $s + 300, 'checks' => 2, 'near_miss' => false,
                             'ended_at' => $s + 300, 'recovered_by' => $s + 600, 'duration' => 300);
}
penumbra_outage_ledger_write($L, array());
$h = penumbra_outage_history(array('all' => true), array());
ok($h['horizon'] === $now - 100 * 86400 && $h['from'] === $now - 100 * 86400, 'a full ledger: all time starts at its oldest episode, not the first tick', array($h['horizon'], $now - 100 * 86400));
$h = penumbra_outage_history(array('from' => $now - 150 * 86400), array());
ok(abs($h['coverage_pct'] - 66.7) < 0.2, 'and a window reaching past it is only partly covered (100 of 150 days)', $h['coverage_pct']);
$h = penumbra_outage_history(array('hours' => 168), array());
ok($h['coverage_pct'] >= 99.9, 'a week inside the horizon is unaffected', $h['coverage_pct']);
reset_ledger();

// ---- cleanup ---------------------------------------------------------------
@unlink(penumbra_mute_file(array()));
@unlink(penumbra_outage_ledger_file(array()));
@unlink($harness);
@rmdir($TMP);

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL === 0 ? 0 : 1);
