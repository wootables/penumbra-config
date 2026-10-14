<?php
/**
 * test_logctx.php - context lines around a log filter match (2026-08-28).
 *
 * WHAT THIS COVERS. The health hub's log console can filter by substring. A
 * match on its own is often useless - a fatal without its stack trace, a task
 * failure without the run that produced it - so the filter now shows N lines
 * either side, marks the matching line, and prints a separator wherever it
 * skipped some. Default 5, 0 turns it off.
 *
 * NOT A UNIT TEST OF A COPY. penumbra_logs.php is self-contained (no database,
 * no requires), and penumbra_log_sources() takes the PHP-error path straight
 * from $config - so this points that key at a scratch file and drives the REAL
 * penumbra_log_tail() end to end, tail reader and severity classifier included.
 *
 *   php.exe test_logctx.php [--control]
 *
 * --control runs a deliberately false assertion, which MUST report FAIL.
 */

date_default_timezone_set('America/New_York');

$APP = 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = substr($a, 6); }
$CONTROL = in_array('--control', $argv, true);

require $APP . DIRECTORY_SEPARATOR . 'penumbra_logs.php';

$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_logctx_' . getmypid();
@mkdir($TMP, 0777, true);
$LOG = $TMP . DIRECTORY_SEPARATOR . 'test.log';

$PASS = 0; $FAIL = 0;
function group($g) { echo "\n$g\n"; }
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ('  (got: ' . json_encode($got) . ')')) . "\n"; }
}

/** Write $lines to the scratch log and tail it through the real function. */
function tail($lines, $opts = array()) {
    global $LOG;
    file_put_contents($LOG, implode("\n", $lines) . "\n");
    return penumbra_log_tail('php', $opts, array('php_error_log' => $LOG));
}
/** Just the text of each returned row. */
function texts($d) {
    $o = array();
    foreach ($d['rows'] as $r) $o[] = $r['t'];
    return $o;
}
/** Indices (into rows) that carry the match mark. */
function hits($d) {
    $o = array();
    foreach ($d['rows'] as $i => $r) if (!empty($r['m'])) $o[] = $i;
    return $o;
}
function gaps($d) {
    $o = array();
    foreach ($d['rows'] as $r) if (!empty($r['g'])) $o[] = $r['t'];
    return $o;
}

// 30 plain lines, with NEEDLE on 10 and 25 (1-based line numbers in the text).
$plain = array();
for ($i = 1; $i <= 30; $i++) {
    $plain[] = ($i === 10 || $i === 25) ? "line $i NEEDLE here" : "line $i ordinary";
}

echo "Log filter context - 2026-08-28\napp=$APP\n";

// ===========================================================================
group('1. Sanity: the harness really is driving the shipped reader');

$d = tail($plain, array('lines' => 100));
ok(count($d['rows']) === 30, 'all 30 lines come back unfiltered', count($d['rows']));
ok(empty($d['filtered']), 'and it does not claim to be filtered');
ok($d['ctx'] === 0, 'no filter means no context, whatever ctx was asked for', $d['ctx']);
ok(hits($d) === array(), 'nothing is marked as a hit with no filter', hits($d));

// ===========================================================================
group('2. The default is ON, at five either side');

$d = tail($plain, array('lines' => 100, 'q' => 'NEEDLE'));   // ctx deliberately absent
ok($d['ctx'] === 5, 'an absent ctx defaults to 5', $d['ctx']);
ok($d['matches'] === 2, 'two matches found', $d['matches']);
// 5..15 and 20..30 -> 11 + 11 lines, plus one gap marker between them
ok($d['shown'] === 23, '11 + 11 context rows and one separator', $d['shown']);
ok(count(gaps($d)) === 1, 'exactly one gap marker', gaps($d));
ok(gaps($d)[0] === '----- 4 lines not shown -----',
   'and it names how many were skipped (16,17,18,19)', gaps($d));

$t = texts($d);
ok($t[0] === 'line 5 ordinary',  'window starts 5 lines before the first match', $t[0]);
ok($t[10] === 'line 15 ordinary', 'and ends 5 lines after it', $t[10]);
ok(end($t) === 'line 30 ordinary', 'last window runs to the end of the file', end($t));

// ===========================================================================
group('3. Only the matching lines are marked');

$h = hits($d);
ok(count($h) === 2, 'two rows carry the hit mark', $h);
ok($t[$h[0]] === 'line 10 NEEDLE here', 'first mark is on the real match', $t[$h[0]]);
ok($t[$h[1]] === 'line 25 NEEDLE here', 'second mark is on the real match', $t[$h[1]]);

// ===========================================================================
group('4. ctx=0 is the old behaviour exactly');

$d0 = tail($plain, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 0));
ok($d0['shown'] === 2, 'matches only', $d0['shown']);
ok(texts($d0) === array('line 10 NEEDLE here', 'line 25 NEEDLE here'), 'and nothing else', texts($d0));
ok(gaps($d0) === array(), 'NO separators when context is off - the off switch means "as before"', gaps($d0));
ok(hits($d0) === array(), 'and no hit marks either: with no neighbours there is nothing to distinguish');

// ===========================================================================
group('5. Overlapping windows merge instead of repeating lines');

$near = array();
for ($i = 1; $i <= 20; $i++) {
    $near[] = ($i === 8 || $i === 10) ? "line $i NEEDLE" : "line $i ordinary";
}
$d = tail($near, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 3));
// 5..11 and 7..13 -> union 5..13 = 9 rows, no gap
ok($d['shown'] === 9, 'two overlapping windows produce one run of 9', $d['shown']);
ok(gaps($d) === array(), 'no separator inside a contiguous run', gaps($d));
$t = texts($d);
ok(count(array_unique($t)) === count($t), 'no line is emitted twice', $t);
ok($t[0] === 'line 5 ordinary' && end($t) === 'line 13 ordinary', 'union spans 5..13', array($t[0], end($t)));

// Exactly adjacent windows (gap of one line) must also merge without a marker.
$adj = array();
for ($i = 1; $i <= 20; $i++) { $adj[] = ($i === 6 || $i === 8) ? "line $i NEEDLE" : "line $i ordinary"; }
$d = tail($adj, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 1));
ok(gaps($d) === array(), 'windows that just touch do not get a separator', gaps($d));
ok($d['shown'] === 5, '5..9 with no break', $d['shown']);

// ===========================================================================
group('6. Windows clamp at both ends of the file');

$edge = array('line 1 NEEDLE', 'line 2 ordinary', 'line 3 ordinary', 'line 4 ordinary', 'line 5 NEEDLE');
$d = tail($edge, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 10));
ok($d['shown'] === 5, 'a window wider than the file yields the file, not padding', $d['shown']);
ok(gaps($d) === array(), 'and no separator, because nothing was skipped', gaps($d));
ok(texts($d) === $edge, 'every line, in order', texts($d));

// ===========================================================================
group('7. Context ignores severity; the MATCH set still respects it');

/* An error line whose stack trace is plain text: with "problems only" AND a
   filter, the trace must still appear as context. Hiding it is the exact
   failure the feature exists to fix. */
$mixed = array(
    'line 1 ordinary',
    '[28-Aug-2026] PHP Fatal error: NEEDLE exploded',
    '  #0 stack frame one',
    '  #1 stack frame two',
    'line 5 ordinary',
);
$d = tail($mixed, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 2, 'errors_only' => true));
ok($d['matches'] === 1, 'one line satisfies severity AND substring', $d['matches']);
ok($d['shown'] === 4, 'its plain-text neighbours come along', $d['shown']);
$t = texts($d);
ok(in_array('  #0 stack frame one', $t, true) && in_array('  #1 stack frame two', $t, true),
   'the stack frames are present even though they are not error lines', $t);

// A non-error line containing the needle must NOT become a match under
// errors_only - it may only appear as somebody else's context.
$d = tail(array('aa NEEDLE plain', 'bb ordinary'), array('lines' => 100, 'q' => 'NEEDLE', 'errors_only' => true));
ok($d['matches'] === 0, 'a plain line matching the text is not a match under problems-only', $d['matches']);
ok($d['shown'] === 0, 'and nothing is rendered', $d['shown']);

// ===========================================================================
group('8. Filtering stays case-insensitive');

$d = tail($plain, array('lines' => 100, 'q' => 'needle', 'ctx' => 1));
ok($d['matches'] === 2, 'lowercase query still finds uppercase text', $d['matches']);

// ===========================================================================
group('9. ctx is clamped, not trusted');

$d = tail($plain, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 9999));
ok($d['ctx'] === 50, 'an absurd width clamps to the ceiling', $d['ctx']);
$d = tail($plain, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => -7));
ok($d['ctx'] === 0, 'a negative width clamps to off', $d['ctx']);

// ===========================================================================
group('10. The line cap still bounds the pane, and leaves no dangling marker');

$many = array();
for ($i = 1; $i <= 400; $i++) { $many[] = ($i % 20 === 0) ? "line $i NEEDLE" : "line $i ordinary"; }
$d = tail($many, array('lines' => 25, 'q' => 'NEEDLE', 'ctx' => 5));
ok(count($d['rows']) <= 25, 'never more rows than asked for', count($d['rows']));
ok(!empty($d['truncated']), 'and it says it was cut', $d['truncated']);
ok(empty($d['rows'][0]['g']), 'the first row is never an orphaned separator', $d['rows'][0]);
/* matches counts hits in the WINDOW THAT WAS READ, which is not the whole file:
   a filtered request widens the tail to lines*10 (capped at 5,000), so at
   lines=25 the reader sees the last 250 of these 400 lines and finds the 13
   multiples of 20 inside them. That is the honest number - it is what "matches"
   means everywhere else in the pane too - and it is deliberately larger than the
   number of hits that survived the row cap. */
ok($d['matches'] === 13, 'matches counts every hit in the READ window (250 lines here)', $d['matches']);
ok($d['matches'] > count(hits($d)),
   'and stays larger than the hits that fitted in the pane, so the cap is visible',
   array($d['matches'], count(hits($d))));

// ===========================================================================
group('11. shown and matches are different numbers, and both are reported');

$d = tail($plain, array('lines' => 100, 'q' => 'NEEDLE', 'ctx' => 5));
ok($d['matches'] === 2 && $d['shown'] === 23,
   'the pane can say "2 matches, 23 lines" rather than implying 23 hits',
   array($d['matches'], $d['shown']));
ok($d['matches'] < $d['shown'], 'context always widens the render', array($d['matches'], $d['shown']));

// ===========================================================================
group('12. A filter that matches nothing');

$d = tail($plain, array('lines' => 100, 'q' => 'NOTHINGMATCHESTHIS', 'ctx' => 5));
ok($d['shown'] === 0 && $d['matches'] === 0, 'no rows, no matches', array($d['shown'], $d['matches']));
ok(!empty($d['filtered']), 'and the pane is told it is filtered, so it says so rather than "empty log"');

// ===========================================================================
if ($CONTROL) {
    group('CONTROL (must FAIL - proves the harness can report failure)');
    ok(1 === 2, 'deliberate false assertion');
}

@unlink($LOG); @rmdir($TMP);
echo "\n" . str_repeat('-', 60) . "\n";
echo "PASS $PASS   FAIL $FAIL\n";
exit($FAIL === 0 ? 0 : 1);
