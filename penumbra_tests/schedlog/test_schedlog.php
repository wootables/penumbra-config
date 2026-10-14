<?php
/**
 * test_schedlog.php - the spanning log tail (daily rotation, day pinning).
 *
 * Runs against the LIVE penumbra_logs.php and the LIVE scheduler log directory,
 * read-only. Nothing here writes anything.
 *
 *   php.exe test_schedlog.php <path-to-penumbra>
 */
$APP = isset($argv[1]) ? rtrim($argv[1], '\\/') : 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
require_once $APP . DIRECTORY_SEPARATOR . 'penumbra_logs.php';

$PASS = 0; $FAIL = 0;
function ok($c, $label, $got = null) {
    global $PASS, $FAIL;
    if ($c) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ('  (got: ' . json_encode($got) . ')')) . "\n"; }
}
/** First timestamp on a line, as "Y-m-d". */
function dayOf($line) { return preg_match('/^\[(\d{4}-\d{2}-\d{2})/', $line, $m) ? $m[1] : null; }

$cfg = array('scheduler_log_dir' => $APP . DIRECTORY_SEPARATOR . 'log');
$dir = $cfg['scheduler_log_dir'];

echo "\n== daily set ==\n";
$set = penumbra_log_daily_set($dir . DIRECTORY_SEPARATOR . 'scheduler_*.log');
ok(count($set) >= 3, 'found several daily files', count($set));
$days = array_map(function ($e) { return $e['day']; }, $set);
$sorted = $days; sort($sorted);
ok($days === $sorted, 'sorted oldest-first BY THE DATE IN THE NAME, not mtime');
ok(preg_match('/^\d{4}-\d{2}-\d{2}$/', $days[0]) === 1, 'day parsed off the filename', $days[0]);

echo "\n== spanning tail ==\n";
$win = array_slice($set, -3);
// Ask for MORE lines than the newest file holds, or the boundary this whole
// feature exists to cross is never actually crossed. (Today's file grows all
// day, so the threshold is measured, not guessed.)
$newestPath  = $set[count($set) - 1]['path'];
$newestLines = count(file($newestPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
$ask = $newestLines + 250;
$t = penumbra_tail_files($win, $ask);
ok(count($t['lines']) === $ask, 'honours the line count across files', array(count($t['lines']), $ask));
ok(count($t['files']) >= 2, 'more than one file contributed', $t['files']);
$first = dayOf($t['lines'][0]);
$last  = dayOf($t['lines'][count($t['lines']) - 1]);
ok($first !== null && $last !== null && $first <= $last, 'chronological: oldest line first, newest last', array($first, $last));
ok($last === $days[count($days) - 1], 'the LAST line comes from the newest day', $last);

// The ordering regression that matters: files concatenated newest-first would
// still "work" and read backwards. Prove every adjacent pair is non-decreasing.
$bad = 0; $prev = null;
foreach ($t['lines'] as $ln) {
    $d = dayOf($ln); if ($d === null) continue;
    if ($prev !== null && $d < $prev) $bad++;
    $prev = $d;
}
ok($bad === 0, 'no line ever goes backwards in time across a file boundary', $bad);

echo "\n== a small ask does not open files it does not need ==\n";
// The cost guarantee is at FILE granularity: spanning must not turn every tail
// into a read of four days. (Bytes are not the measure - penumbra_tail_file
// always pulls at least one 32KB chunk, which predates this and is fine.)
$t2 = penumbra_tail_files($win, 20);
ok(count($t2['lines']) === 20, '20 lines returned', count($t2['lines']));
ok(count($t2['files']) === 1, 'only the newest file was opened', $t2['files']);
ok(count($t2['files']) < count($t['files']), 'strictly fewer files than the boundary-crossing ask',
   array(count($t2['files']), count($t['files'])));
ok($t2['read_bytes'] <= $t['read_bytes'], 'and never reads more', array($t2['read_bytes'], $t['read_bytes']));

echo "\n== source wiring ==\n";
$src = penumbra_log_source('scheduler', $cfg);
ok(!empty($src['set']), 'scheduler source carries a daily set');
ok(!empty($src['span']), 'and a span', $src['span']);
$php = penumbra_log_source('php', $cfg);
ok(empty($php['set']), 'a non-rotating source has NO set - it must behave exactly as before');

echo "\n== penumbra_log_tail: rolling window ==\n";
$r = penumbra_log_tail('scheduler', array('lines' => 500), $cfg);
ok(empty($r['error']), 'no error', $r['error']);
ok(count($r['days_all']) === min(count($set), PENUMBRA_LOG_PICK_DAYS),
   'the picker offers the most recent days, capped', count($r['days_all']));
ok($r['days_total'] === count($set), 'and reports the true total so the cap is never silent', $r['days_total']);
ok($r['days_all'][count($r['days_all']) - 1] === $days[count($days) - 1],
   'the newest day is always offered', $r['days_all'][count($r['days_all']) - 1]);
ok($r['day'] === null, 'nothing pinned by default');
ok(count($r['days_shown']) >= 1, 'reports which days are actually in view', $r['days_shown']);
ok(count($r['days_shown']) <= PENUMBRA_LOG_SPAN_DAYS, 'never spans more than the configured days', count($r['days_shown']));
ok(strpos($r['file'], '+') !== false || count($r['days_shown']) === 1, 'header names every file in view', $r['file']);

echo "\n== penumbra_log_tail: pinned day ==\n";
$pin = $days[count($days) - 2];              // yesterday-ish, a file that is closed
$p = penumbra_log_tail('scheduler', array('lines' => 500, 'day' => $pin), $cfg);
ok($p['day'] === $pin, 'the pin is honoured', $p['day']);
ok(count($p['days_shown']) === 1, 'exactly one day in view', $p['days_shown']);
$offDay = 0;
foreach ($p['rows'] as $row) { $d = dayOf($row['t']); if ($d !== null && $d !== $pin) $offDay++; }
ok($offDay === 0, 'and every line really is from that day', $offDay);
ok(strpos($p['file'], $pin) !== false, 'header names the pinned file', $p['file']);

// The cap is on the DROPDOWN, not on what is reachable. A day older than the
// offered list is still on disk and must still open when asked for by name.
if (count($set) > PENUMBRA_LOG_PICK_DAYS) {
    $old = $days[0];
    $o = penumbra_log_tail('scheduler', array('lines' => 20, 'day' => $old), $cfg);
    ok($o['day'] === $old, 'a day older than the picker cap still opens when pinned', $o['day']);
    ok(!in_array($old, $o['days_all'], true), '...even though the picker does not offer it');
} else {
    echo "  --   (skipped: fewer than " . PENUMBRA_LOG_PICK_DAYS . " days on disk)\n";
}

echo "\n== pinning is a LOOKUP, never a path ==\n";
// The day comes from the query string. It must be matched against the source's
// own file list; anything else turns a log viewer into a file-read primitive.
foreach (array('../../../../windows/win.ini', '2026-08-24/../../etc', '', 'not-a-day', '1999-01-01') as $bad) {
    $b = penumbra_log_tail('scheduler', array('lines' => 5, 'day' => $bad), $cfg);
    $safe = ($b['day'] === null) && empty($b['error']);
    ok($safe, 'unknown day "' . $bad . '" falls back to the window, no error', array($b['day'], $b['error']));
}

echo "\n== filters still work across the span ==\n";
/* ctx=0 EXPLICITLY. Context lines shipped on 2026-08-28 and default to 5, so a
   plain filtered tail now returns non-matching neighbours ON PURPOSE - this
   assertion caught that change, correctly, the day it landed. The pure-match
   contract still exists and is still worth pinning; it just has to ask for it.
   The context behaviour itself is covered by penumbra_tests\logctx. */
$f = penumbra_log_tail('scheduler', array('lines' => 50, 'q' => 'Run Complete', 'ctx' => 0), $cfg);
ok($f['filtered'] === true, 'marked filtered');
$nonMatch = 0;
foreach ($f['rows'] as $row) { if (stripos($row['t'], 'Run Complete') === false) $nonMatch++; }
ok($nonMatch === 0, 'with ctx=0, every returned line matches', $nonMatch);
ok(count($f['rows']) > 0, 'and there are some', count($f['rows']));

// ...and the default really is context-on, over the real spanning log.
$fc = penumbra_log_tail('scheduler', array('lines' => 50, 'q' => 'Run Complete'), $cfg);
ok($fc['ctx'] === 5, 'the default across a spanning source is 5', $fc['ctx']);
$neighbours = 0; $marked = 0;
foreach ($fc['rows'] as $row) {
    if (!empty($row['m'])) { $marked++; }
    elseif (empty($row['g']) && stripos($row['t'], 'Run Complete') === false) { $neighbours++; }
}
ok($marked > 0, 'matches are marked', $marked);
ok($neighbours > 0, 'and non-matching neighbours came along, which is the point', $neighbours);

echo "\n== byte budget: the control must deliver the number it names ==\n";
ok(PENUMBRA_LOG_SPAN_DAYS === 7, 'the span is a week', PENUMBRA_LOG_SPAN_DAYS);
ok(penumbra_log_budget(100)  === PENUMBRA_LOG_TAIL_BYTES, 'small asks keep the old floor');
ok(penumbra_log_budget(5000) > PENUMBRA_LOG_TAIL_BYTES,   'a big ask gets a bigger budget', penumbra_log_budget(5000));
ok(penumbra_log_budget(999999) === PENUMBRA_LOG_TAIL_MAX_BYTES, 'and is capped', penumbra_log_budget(999999));

/* THE REGRESSION THIS GUARDS. The byte cap, not the line count, is what stops a
   tail. On a long-line log - IIS rows average ~170-195 bytes - the old fixed
   256KB returned 1,347 of a requested 5,000 and flagged it "tail only": a
   dropdown offering a number the reader could not actually get. The scheduler
   log's short lines hid this, which is exactly why the fixture here is a
   synthetic IIS-shaped file rather than the log next door. */
$tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_longlines_' . getmypid() . '.log';
$h = fopen($tmp, 'wb');
for ($i = 0; $i < 8000; $i++) {
    fwrite($h, sprintf("2026-08-24 12:00:%02d W3SVC1 OITRAS 152.1.2.3 GET /sponsor_migration/penumbra/index.php "
        . "id=abcd&json=1&prompt1=something 443 unity 10.0.0.%d "
        . "Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) 200 0 0 %d\n", $i % 60, $i % 250, 1000 + $i));
}
fclose($h);
$short = penumbra_tail_file($tmp, 5000, PENUMBRA_LOG_TAIL_BYTES);
$full  = penumbra_tail_file($tmp, 5000, penumbra_log_budget(5000));
ok(count($short['lines']) < 5000, 'the OLD fixed budget really did fall short here', count($short['lines']));
ok(count($full['lines']) === 5000, 'the scaled budget delivers all 5000', count($full['lines']));
ok($full['lines'][4999] === $short['lines'][count($short['lines']) - 1], 'and ends on the same newest line');
@unlink($tmp);

echo "\n== severity ==\n";
ok(penumbra_log_severity('[2026-08-23 23:13:02] HEALTH: DEGRADED - database hr down', 'scheduler') === 'err',
   'a DEGRADED health line is finally coloured as an error');
ok(penumbra_log_severity('[2026-08-24 00:02:15] Run Complete: 0 tasks evaluated | health ok (5 dbs) | 0.9s', 'scheduler') === 'ok',
   'the new merged completion line still reads as ok');
ok(penumbra_log_severity('[2026-08-24 00:02:15] Starting Scheduler Run...', 'scheduler') === '',
   'the start line stays neutral');
ok(penumbra_log_severity('  WARNING skip_no_change is not a boolean: value=\'true\', type=string - treated as OFF (strict === true).', 'scheduler') === 'warn',
   'the narrowed skip_no_change watch reads as a warning');
// The monitor branch must still win over the generic patterns.
ok(penumbra_log_severity('[2026-08-20 20:35:50] DEGRADED: SIMULATED FAULT - this is a drill, not a real failure', 'monitor') === 'warn',
   'a watchdog drill is still NOT an error, even now that DEGRADED is one');

echo "\n== severity: the app's OWN error lines (2026-08-28) ==\n";
/* The generic patterns match on English - "failed", "Exception", "Fatal" - and
   Penumbra's hand-written error_log() messages mostly do not use those words,
   so the most actionable lines in the file were rendering as ordinary chatter.
   These are the real prefixes, taken from php82_errors.log. */
ok(penumbra_log_severity('[28-Aug-2026 12:02:20 America/New_York] PENUMBRA RESULT TOO LARGE for user bplimon: Result set exceeded the 922 MB buffer budget after 67,712 rows.', 'php') === 'err',
   'a report abandoned on the memory ceiling is an error');
ok(penumbra_log_severity('[28-Aug-2026 13:46:09 America/New_York] PENUMBRA QUERY TIMEOUT for user aclark4: Query cancelled after 120s (per-call timeout).', 'php') === 'err',
   'a cancelled query is an error, not the warn the generic TIMEOUT pattern gave it');
ok(penumbra_log_severity('[28-Aug-2026 09:00:00 America/New_York] PENUMBRA IMPORT IDOR blocked: user \'x\' requested import 42', 'php') === 'err',
   'an IDOR attempt is an error');
ok(penumbra_log_severity('[28-Aug-2026 03:03:00 America/New_York] PENUMBRA SCHEDULER: database connection unavailable - skipping run', 'php') === 'err',
   'the scheduler losing its database is an error');
ok(penumbra_log_severity('[28-Aug-2026 12:00:16 America/New_York] PENUMBRA CSRF-GUARD (enforce): blocked [/x.php?action=list] user=\'bplimon\' origin=\'(none)\'', 'php') === 'warn',
   'a CSRF refusal is a warning - the guard worked, and both on record were false positives');
ok(penumbra_log_severity('[28-Aug-2026 12:00:16 America/New_York] PENUMBRA AUTH-GATE (enforce): rejected', 'php') === 'warn',
   'so is an auth-gate refusal');

/* THE TWO THAT MUST STAY NEUTRAL. Getting either of these wrong is worse than
   the bug being fixed: one re-creates the false failure removed from the audit
   on 2026-08-28, the other paints the busiest lines in the file. */
$probe = '[28-Aug-2026 12:02:20 America/New_York] PENUMBRA RESULT TOO LARGE (recoverable probe, caller will retry as a stream) for user SCHEDULER: Result set exceeded the 922 MB buffer budget after 67,712 rows.';
ok(penumbra_log_severity($probe, 'php') === '',
   'the DB_DUMP buffer PROBE stays neutral - the dump goes on to succeed');
ok(penumbra_log_severity('[28-Aug-2026 12:02:22 America/New_York] PENUMBRA STREAM: 60000 rows, mem=230.0 MB, peak=230.0 MB, elapsed 41.2s', 'php') === '',
   'streaming progress telemetry stays neutral');

/* DRIFT GUARD. The neutral verdict above keys off a phrase query.php writes.
   Rename the message and every successful large dump turns red again, silently
   - so the classifier and the writer are asserted to still agree. */
$qsrc = (string)@file_get_contents($APP . DIRECTORY_SEPARATOR . 'query.php');
ok($qsrc !== '' && strpos($qsrc, 'recoverable probe') !== false,
   'query.php still writes the phrase the classifier keys the probe off');

// Regression: the lines that were ALREADY graded must not have moved.
ok(penumbra_log_severity('[28-Aug-2026 10:00:00 America/New_York] PENUMBRA SECURITY: Non-SELECT query blocked for user x', 'php') === 'err',
   'SECURITY lines unchanged');
ok(penumbra_log_severity('[28-Aug-2026 10:00:00 America/New_York] PENUMBRA INFLIGHT CAP: {"user":"x"}', 'php') === 'warn',
   'the in-flight cap is still a warning, not an error - it is a guardrail');
ok(penumbra_log_severity('[28-Aug-2026 12:23:32 America/New_York] InfoEd MS-SQL Connection failed (Lazy Load) with DSN \'odbc:...\': SQLSTATE[08001]', 'php') === 'err',
   'a driver connect failure is still an error');
ok(penumbra_log_severity('[28-Aug-2026 10:00:00 America/New_York] PENUMBRA Exception for user x: boom', 'php') === 'err',
   'plain exceptions still fall through to the generic rules');

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL === 0 ? 0 : 1);
