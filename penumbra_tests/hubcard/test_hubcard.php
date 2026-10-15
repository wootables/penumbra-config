<?php
/**
 * penumbra_tests\hubcard - the health hub's cards render over fixtures.
 *
 *   php.exe -n -d date.timezone=America/New_York test_hubcard.php
 *       --health=<penumbra_health.php> --page=<health.php>
 *       [--html=<out.html>] [--control] [--mutant]
 *
 * WHAT IS UNDER TEST. The 2026-09-12 redesign of health.php. Seven regions of
 * the LIVE page - the status band, scheduler + database tiles, delivery,
 * failures, outage history, runtime, and the log viewer with its scripts - are
 * cut out of the shipped file by their anchors and rendered with PHP over
 * fixtures: an open outage with its escalation packet, an open near miss, a
 * muted recurring window, a closed near miss, a 24-hour strip with red and
 * amber cells, a degraded database tile, four delivery stalls, a folded and an
 * unfolded failures card, an unreadable log source. The mute POST handler runs
 * for real against a scratch mute file. Every diagnostic is promoted to fatal,
 * so a notice inside a template is a FAIL, not a line in a log nobody reads.
 *
 * Everything runs the shipped code: the OUTAGE HISTORY block and
 * penumbra_outage_packet() are lifted from penumbra_health.php, the page
 * helpers (pnb_h ... pnb_info) from health.php, both by the tokenizer.
 *
 * --control  one deliberately false assertion, which MUST report FAIL.
 * --mutant   the bell loses its data-slot before the outage card renders: a
 *            bell without a slot cannot mute anything (the handler refuses
 *            it), and the suite must go RED on exactly that.
 * --mutant3  the status band reads 'ok' alone again, ignoring last_known (the
 *            2026-09-24 bug: "All monitored components healthy" beside a down
 *            INFOED), and the suite must go RED on exactly the two bands whose
 *            only problem is a cached down.
 * --mutant4  the outage strip ignores the card's window and draws the last 24
 *            hours again (the 2026-10-01 report: "the chart does not cover the
 *            listed range"), and section 5c must go RED.
 * --mutant5  the status chips read the cards' $errs / $outg instead of the
 *            snapshot, so picking a window on a card changes chips labelled
 *            24h and 7d; section 5c must go RED on exactly those.
 * --mutant6  the left column back in its pre-2026-10-01 order (failures and
 *            outage history below delivery): every region still renders - the
 *            cuts follow the file's own order - and section 8 must go RED on
 *            exactly the order assertion.
 * --mutant7  pnb_warn_target() answers null for every warning (2026-10-14):
 *            the "Worth a look" lines render as plain text again, and section
 *            1 must go RED on exactly the two warning-link assertions.
 *
 * THE DECLUTTER (2026-10-14, section 10): the chips are links to their cards in
 * the cards' order and show each card's worst fact; every card folds to its
 * heading with a summary (data-open / data-force); the outage card's
 * availability is a line, its known windows fold, and the episode and run
 * lists show three with a show-more; the PHP errors tab carries a count.
 *
 * WCAG SERIOUS FIXES (2026-10-15, section 11): focus survives the refresh swap
 * and the job / bell / copy busy states (aria-disabled, never disabled); the
 * pause button is named "Pause auto-refresh"; a chip jump focuses its card; a
 * missing extension says so in words; every (i) is a role=button disclosure
 * with aria-describedby on its tip, and Escape closes any open tip. Static
 * checks: the JS behaviour itself was driven in headless Edge off --html.
 *
 * THE CARDS' WINDOWS (2026-10-01): the Failures and Outage history headings
 * carry a window control (?fail= / ?out=), the picker sits at the foot of the
 * page, and the strip draws the card's window. Section 5c renders both cards
 * over a default, a 24-hour, a 30-day and a custom past window.
 * --html     also writes the rendered regions into a page shell that links
 *            css/main.css + css/density.css beside it, for a headless look.
 */
error_reporting(E_ALL);
set_error_handler(function ($no, $str, $file, $line) {
    if (!(error_reporting() & $no)) return false;   // a deliberate @ stays silent
    throw new ErrorException($str, 0, $no, $file, $line);
});

// Under -n no php.ini loads, so mbstring (a shared DLL here) is absent; the
// page truncates messages with mb_substr. ASCII fixtures make substr exact.
if (!function_exists('mb_substr')) {
    function mb_substr($s, $a, $b = null, $e = null) { return $b === null ? substr($s, $a) : substr($s, $a, $b); }
    function mb_strlen($s, $e = null) { return strlen($s); }
}

$HEALTH = ''; $PAGE = ''; $HTML = ''; $CONTROL = false; $MUTANT = false; $MUTANT2 = false; $MUTANT3 = false; $MUTANT4 = false; $MUTANT5 = false; $MUTANT6 = false; $MUTANT7 = false;
foreach ($argv as $a) {
    if (strpos($a, '--health=') === 0)     $HEALTH = substr($a, 9);
    elseif (strpos($a, '--page=') === 0)   $PAGE = substr($a, 7);
    elseif (strpos($a, '--html=') === 0)   $HTML = substr($a, 7);
    elseif ($a === '--control')            $CONTROL = true;
    elseif ($a === '--mutant')             $MUTANT = true;
    elseif ($a === '--mutant2')            $MUTANT2 = true;
    elseif ($a === '--mutant3')            $MUTANT3 = true;
    elseif ($a === '--mutant4')            $MUTANT4 = true;
    elseif ($a === '--mutant5')            $MUTANT5 = true;
    elseif ($a === '--mutant6')            $MUTANT6 = true;
    elseif ($a === '--mutant7')            $MUTANT7 = true;
}
if ($HEALTH === '' || $PAGE === '') { fwrite(STDERR, "usage: --health=<penumbra_health.php> --page=<health.php> [--html=<out>] [--control] [--mutant] [--mutant2] [--mutant3] [--mutant4] [--mutant5] [--mutant6]\n"); exit(2); }

$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_hubcard_' . getmypid();
if (!@mkdir($TMP, 0777, true) && !is_dir($TMP)) { fwrite(STDERR, "cannot create $TMP\n"); exit(2); }
register_shutdown_function(function () use ($TMP) {
    foreach ((array)glob($TMP . DIRECTORY_SEPARATOR . '*') as $f) @unlink($f);
    @rmdir($TMP);
});

$PASS = 0; $FAIL = 0;
function ok($c, $label, $got = null) {
    global $PASS, $FAIL;
    if ($c) { $PASS++; echo "  ok   $label\n"; }
    else    { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ' (got: ' . substr(json_encode($got), 0, 300) . ')') . "\n"; }
}
function section($t) { echo "\n$t\n" . str_repeat('-', strlen($t)) . "\n"; }

/** Lift named functions by the tokenizer, so a one-line helper cannot swallow
 *  the function after it (the monfix suite's approach). */
function lift($src, $names) {
    $t = token_get_all($src); $n = count($t); $out = ''; $found = array();
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && ((is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) || (!is_array($t[$j]) && $t[$j] === '&'))) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;
        $fname = $t[$j][1];
        if (!in_array($fname, $names, true)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) {
                if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; $started = true; }
                $buf .= $tok[1];
            } else {
                if ($tok === '{') { $depth++; $started = true; } elseif ($tok === '}') { $depth--; }
                $buf .= $tok;
            }
            if ($started && $depth === 0) break;
        }
        $out .= "if (!function_exists('$fname')) {\n$buf\n}\n";
        $found[] = $fname;
    }
    $missing = array_diff($names, $found);
    if ($missing) { fwrite(STDERR, "MISSING from source: " . implode(', ', $missing) . "\n"); exit(2); }
    return $out;
}
/** The text between two anchors of the live page; every anchor must be unique. */
function cut($hay, $from, $to, $label) {
    if (substr_count($hay, $from) !== 1) { fwrite(STDERR, "anchor '$label' start matched " . substr_count($hay, $from) . " times\n"); exit(2); }
    $a = strpos($hay, $from);
    $b = strpos($hay, $to, $a);
    if ($b === false) { fwrite(STDERR, "anchor '$label' end not found\n"); exit(2); }
    return substr($hay, $a, $b - $a);
}
function render($file) {
    extract($GLOBALS, EXTR_SKIP);
    ob_start();
    try { include $file; return ob_get_clean(); }
    catch (Throwable $e) { ob_end_clean(); return "TEMPLATE ERROR: " . $e->getMessage() . " at " . basename($e->getFile()) . ":" . $e->getLine(); }
}
/** No template exception, and no PHP diagnostic text (case-sensitive: the log
 *  script legitimately says `undefined` and the (i) copy says `warning`). */
function clean($html) {
    return strpos($html, 'TEMPLATE ERROR') === false
        && !preg_match('/\b(Warning|Notice|Deprecated|Fatal error|Parse error): /', $html)
        && !preg_match('/Undefined (variable|index|array key|offset|property)/', $html);
}

// ---------------------------------------------------------------------------
// The code under test.
// ---------------------------------------------------------------------------
$src  = file_get_contents($HEALTH);
$page = file_get_contents($PAGE);
if ($src === false || $page === false) { fwrite(STDERR, "cannot read the sources\n"); exit(2); }
if ($MUTANT2) {
    // The stale threshold stops applying: a directory of any age reads 'ok'.
    $needle = 'if ($age > PENUMBRA_DIRECTORY_STALE_SECS) {';
    if (substr_count($src, $needle) !== 1) { fwrite(STDERR, "mutant2: stale threshold not found in penumbra_health.php\n"); exit(2); }
    $src = str_replace($needle, 'if (false) {', $src);
    echo "MUTANT2: penumbra_directory_status() never says stale\n";
}


$start = strpos($src, "/* =====================================================================\n * OUTAGE HISTORY");
$end   = strpos($src, "/**\n * Compose the whole picture.");
if ($start === false || $end === false) { fwrite(STDERR, "OUTAGE HISTORY block not found\n"); exit(2); }
$config = array();
$stub = '<?php function penumbra_health_cache_file($c) { return ' . var_export($TMP . DIRECTORY_SEPARATOR . 'penumbra_health_cache.json', true) . '; }'
      . ' function penumbra_log_web_account() { return "IIS APPPOOL\\\\penumbra"; }'
      . ' function penumbra_log_web_account_note() { return "the application pool identity"; } ?>';
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'block.php', $stub . "\n<?php\n" . substr($src, $start, $end - $start) . "\n");
require $TMP . DIRECTORY_SEPARATOR . 'block.php';
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'packet.php', "<?php\n" . lift($src, array('penumbra_outage_packet')));
require $TMP . DIRECTORY_SEPARATOR . 'packet.php';
if ($MUTANT7) {
    // Every "Worth a look" line loses its home: the routing helper answers null.
    $needle = 'function pnb_warn_target($w, $jobLabels = array()) {';
    if (substr_count($page, $needle) !== 1) { fwrite(STDERR, "mutant7: pnb_warn_target not found in health.php\n"); exit(2); }
    $page = str_replace($needle, $needle . ' return null;', $page);
    echo "MUTANT7: every warning line loses its home (pnb_warn_target returns null)\n";
}
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'helpers.php', "<?php\n" . lift($page, array('pnb_h', 'pnb_dot', 'pnb_ago', 'pnb_bytes', 'pnb_chip', 'pnb_dur', 'pnb_info', 'pnb_range_btn', 'pnb_cell_len', 'pnb_notice_line', 'pnb_warn_target', 'pnb_fold_btn')));
require $TMP . DIRECTORY_SEPARATOR . 'helpers.php';
// The window picker's quick spans (2026-10-01) come from the analytics pages'
// own function, lifted from the analytics_shared.php beside the page under test.
$anShared = @file_get_contents(dirname($PAGE) . DIRECTORY_SEPARATOR . 'analytics_shared.php');
if ($anShared === false) { fwrite(STDERR, "cannot read analytics_shared.php beside the page\n"); exit(2); }
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'quick.php', "<?php\n" . lift($anShared, array('penumbra_quick_ranges')));
require $TMP . DIRECTORY_SEPARATOR . 'quick.php';
// The directory verdict (2026-09-23): the pure function lifted from penumbra_health.php; its
// threshold constant is defined here to the value section 2c pins in the source.
if (!defined('PENUMBRA_DIRECTORY_STALE_SECS')) define('PENUMBRA_DIRECTORY_STALE_SECS', 30 * 3600);
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'dir.php', "<?php\n" . lift($src, array('penumbra_directory_status')));
require $TMP . DIRECTORY_SEPARATOR . 'dir.php';
// What the last probe found down (2026-09-24): the pure function the snapshot fills
// last_known with, which the status band now reads beside 'ok'.
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'lastknown.php', "<?php\n" . lift($src, array('penumbra_health_last_known')));
require $TMP . DIRECTORY_SEPARATOR . 'lastknown.php';


// ---------------------------------------------------------------------------
// Fixtures. A week of ledger: a 03:03 scheduler window on three days (one of
// them today, so it sits inside the 24-hour strip), HR down for two checks
// last night, a closed INFOED near miss, and right now an open www3 delivery
// outage plus an open INFOED near miss.
// ---------------------------------------------------------------------------
$T = time(); $DAY = 86400;
$ev = array();
$ev[] = array($T - 7 * $DAY, array(), array());
$schedStarts = array();
// The newest 03:03 window that has closed, then the two days before it. (Fixed
// 2026-10-15: between midnight and 03:18 the old per-day shift moved today's
// window onto yesterday's, so the ledger held two windows, not three, and 14
// outage assertions went red on the clock alone.)
$t3 = strtotime(date('Y-m-d', $T) . ' 03:03:10');
if ($t3 > $T - 900) $t3 -= $DAY;               // a run before 03:18 keeps the window in the past
for ($d = 2; $d >= 0; $d--) {
    $t0 = $t3 - $d * $DAY;
    $schedStarts[] = $t0;
    $ev[] = array($t0,       array('scheduler heartbeat is 412s old'), array());
    $ev[] = array($t0 + 300, array('scheduler heartbeat is 712s old'), array());
    $ev[] = array($t0 + 600, array(), array());
}
$hr0 = $T - 20 * 3600;
$ev[] = array($hr0,       array('database hr down'), array());
$ev[] = array($hr0 + 300, array('database hr down'), array());
$ev[] = array($hr0 + 600, array(), array());
$NM = 'database infoed degraded (2 failed connect attempt(s) before one succeeded)';
$ev[] = array($T - 3000, array(), array($NM));
$ev[] = array($T - 2700, array(), array());
for ($t = $T - 1500; $t <= $T - 300; $t += 300) {
    $ev[] = array($t, array('www3 delivery down'), ($t >= $T - 600) ? array($NM) : array());
}
usort($ev, function ($a, $b) { return $a[0] - $b[0]; });
foreach ($ev as $e) { penumbra_outage_record($e[1], $e[0], $config, $e[2]); }
$slot = penumbra_mute_slot($schedStarts[2]);
penumbra_mute_set('scheduler', $slot, true, 'bplimon', 'Scheduler ~03:03 daily', $config);

$outg = penumbra_outage_history(array('hours' => 168, 'limit' => 25), $config);

$dlvFailures = array();
foreach (array(1380, 1020, 660, 300) as $ago) {
    $dlvFailures[] = array('at' => date('c', $T - $ago), 'ts' => $T - $ago, 'kind' => 'stall', 'proxy' => '10.48.12.91',
                           'uri' => '/sponsor_migration/penumbra/css/main.css', 'status' => 200, 'win32' => 121, 'bytes' => 206671, 'ms' => 19051);
}
$dlvFailures[] = array('at' => date('c', $T - 200), 'ts' => $T - 200, 'kind' => 'drop', 'proxy' => '10.48.12.98',
                       'uri' => '/sponsor_migration/penumbra/index.php', 'status' => 200, 'win32' => 64, 'bytes' => 92264, 'ms' => 8102);
$snap = array(
    'ok' => false, 'problems' => array('www3 delivery down'),
    'warnings' => array('www3 delivery: 4 stalled (win32 121) against 1 delivered in the last 15 min', 'INFOED near miss in progress: 2 failed connect attempt(s) before one succeeded'),
    'checked_at' => date('Y-m-d H:i:s', $T),
    'components' => array(
        'scheduler' => array('status' => 'online', 'last_run' => date('Y-m-d H:i:s', $T - 42), 'seconds_ago' => 42, 'detail' => ''),
        'errors'    => array('total' => 0, 'window_hours' => 24, 'by_action' => array()),
        'databases' => array(
            'hr'       => array('status' => 'ok', 'ms' => 38),
            'fin'      => array('status' => 'ok', 'ms' => 41),
            'infoed'   => array('status' => 'degraded', 'ms' => 1210, 'detail' => '2 failed connect attempt(s) before one succeeded'),
            'srar'     => array('status' => 'ok', 'ms' => 27),
            'wolfware' => array('status' => 'ok', 'ms' => 63),
        ),
        'databases_probed_at' => date('H:i:s', $T - 200), 'databases_from_cache' => true,
        'directory' => array('status' => 'ok', 'total' => 71887, 'active' => 24654, 'pi_eligible' => 2602,
                             'last_seen' => date('Y-m-d H:i:s', $T - 61200), 'age_secs' => 61200, 'ms' => 6, 'detail' => '', 'from_cache' => true,
                             'job' => array('name' => 'people_sync', 'label' => 'Employee directory refresh', 'time' => '05:30', 'scheduled' => true,
                                            'last' => date('Y-m-d', $T - 61200), 'requested' => false, 'paused' => false, 'will_run' => false, 'next' => 'tomorrow',
                                            'reason' => 'already launched today',
                                            'result' => array('finished' => date('Y-m-d H:i:s', $T - 61140), 'exit' => 0, 'secs' => 17.2, 'error' => null,
                                                              'reason' => 'scheduled 05:30', 'label' => 'ok in 17.2 s'))),
        'maintenance' => array('people_sync' => array('name' => 'people_sync', 'label' => 'Employee directory refresh', 'time' => '05:30', 'scheduled' => true,
                                                      'last' => date('Y-m-d', $T - 61200), 'requested' => false, 'paused' => false, 'will_run' => false, 'next' => 'tomorrow',
                                                      'reason' => 'already launched today',
                                                      'result' => array('finished' => date('Y-m-d H:i:s', $T - 61140), 'exit' => 0, 'secs' => 17.2, 'error' => null,
                                                                        'reason' => 'scheduled 05:30', 'label' => 'ok in 17.2 s'))),
        'maintenance_runs' => array('error' => null, 'rows' => array(
            array('id' => 903, 'ts' => date('m-d H:i', $T - 61140), 'user' => 'SCHEDULER', 'job' => 'people_sync', 'action' => 'PEOPLE_SYNC', 'kind' => 'ok',
                  'message' => 'people_sync: 71,887 staged, 24,654 active, 12 updated', 'stats' => array('staged' => 71887, 'updated' => 12, 'seconds' => 27.2)),
            array('id' => 902, 'ts' => date('m-d H:i', $T - 61300), 'user' => 'bplimon', 'job' => 'people_sync', 'action' => 'MAINT_JOB_REQUEST', 'kind' => 'control',
                  'message' => 'people_sync run requested from the Health hub (Employee directory refresh)', 'stats' => array()),
            array('id' => 880, 'ts' => date('m-d H:i', $T - 147540), 'user' => 'SCHEDULER', 'job' => 'people_sync', 'action' => 'PEOPLE_SYNC_FAIL', 'kind' => 'fail',
                  'message' => 'people_sync failed: ORA-01484 arrays can only be bound to PL/SQL statements', 'stats' => array('error' => 'ORA-01484')),
        )),
        'smtp' => array('status' => 'ok', 'ms' => 12, 'host' => 'mta.example.edu', 'port' => 25, 'seconds_ago' => 200, 'from_cache' => true),
        'delivery' => array('status' => 'down', 'window_mins' => 15, 'min_bytes' => 25000, 'proxies' => array('10.48.12.91', '10.48.12.98'),
                            'samples' => 6, 'ok' => 1, 'stalled' => 4, 'dropped' => 1, 'last_ok_at' => date('c', $T - 800), 'last_fail_at' => date('c', $T - 200),
                            'largest_ok_bytes' => 26262, 'failures' => $dlvFailures, 'files' => array('u_ex' . gmdate('ymd', $T) . '.log'),
                            'log_lag_secs' => 40, 'window_truncated' => false, 'checked_at' => date('c', $T),
                            'detail' => '4 stalled (win32 121) against 1 delivered in the last 15 min', 'ms' => 3),
        'recent_failures' => array('rows' => array(), 'detail' => ''),
        'tasks' => array('active' => 41, 'inactive' => 7, 'overdue' => 0, 'next_due' => date('Y-m-d H:i:s', $T + 240), 'next_in_secs' => 240),
        'runtime' => array('php_version' => '8.2.29', 'sapi' => 'cgi-fcgi', 'opcache' => 'on', 'php_eol' => '2026-12-31', 'host' => 'OITRAS',
                           'timezone' => 'America/New_York', 'memory_limit' => '512M', 'max_execution' => 300,
                           'extensions' => array('oci8' => true, 'sqlsrv' => true, 'pdo_sqlsrv' => true, 'gd' => true, 'mbstring' => true),
                           'pdo_oci_present' => false, 'inflight' => array('active' => 0, 'stale' => 0, 'limit' => 3),
                           'disks' => array('logs' => array('root' => 'D:\\', 'free_gb' => 120.4, 'pct_free' => 61),
                                            'web'  => array('root' => 'C:\\', 'free_gb' => 30.1, 'pct_free' => 25))),
        'outages' => $outg,
    ),
);
$sched = $snap['components']['scheduler']; $errs = $snap['components']['errors']; $dbs = $snap['components']['databases'];
$tasks = $snap['components']['tasks']; $rt = $snap['components']['runtime']; $fails = array();
// The cards' windows (2026-10-01): both on their defaults, as a plain health.php renders them.
$failWin = penumbra_health_window('', '24h'); $outWin = penumbra_health_window('', '7'); $failNote = '';
$plog = array('count' => 3, 'last_at' => date('H:i:s', $T - 1400));
$dbOk = 0; $dbBad = 0;
foreach ($dbs as $d) { if ($d['status'] === 'ok') $dbOk++; elseif ($d['status'] === 'down') $dbBad++; }
$logSources = array(
    'php'       => array('label' => 'PHP errors', 'path' => 'D:\\Utilities\\PHP_8.2-p\\logs\\php82_errors.log', 'kind' => 'php', 'hint' => 'Fatals, warnings and every PENUMBRA-prefixed line.'),
    'scheduler' => array('label' => 'Scheduler',  'path' => 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\log\\scheduler_' . date('Y-m-d') . '.log', 'kind' => 'scheduler', 'hint' => 'One line per task start and finish.'),
    'monitor'   => array('label' => 'Watchdog',   'path' => 'D:\\Utilities\\PHP_8.2-p\\logs\\penumbra_monitor.log', 'kind' => 'monitor', 'hint' => 'One line per 5-minute check.'),
    'iis'       => array('label' => 'IIS access', 'path' => 'C:\\inetpub\\logs\\LogFiles\\W3SVC1\\u_ex' . gmdate('ymd') . '.log', 'kind' => 'w3c', 'hint' => 'Every request, UTC.'),
    'httperr'   => array('label' => 'HTTP errors', 'path' => '', 'kind' => 'w3c', 'hint' => 'HTTP.sys rejects.', 'why' => 'C:\\Windows\\System32\\LogFiles\\HTTPERR is not readable by the pool identity'),
);

// ---------------------------------------------------------------------------
// The regions, cut from the live page by their anchors.
//
// THE LEFT COLUMN IS CUT BY ORDER OF APPEARANCE (2026-10-01). Each block starts
// at its own anchor and ends at whichever anchor comes next IN THE FILE, so the
// regions survive a reordering of the cards, and the order itself is ASSERTED
// (section 8) rather than assumed by the cuts. The user's order since
// 2026-10-01: scheduler + databases & mail, OUTAGE HISTORY, FAILURES, then the
// employee directory + maintenance, delivery, runtime. 'r1' stays "scheduler,
// tiles, directory, maintenance" for the assertions below: two blocks, joined.
// ---------------------------------------------------------------------------
if ($MUTANT6) {
    // The order before 2026-10-01: ... delivery, FAILURES, OUTAGE HISTORY, runtime.
    $aO = '  <?php /* =========================== OUTAGE HISTORY'; $aF = '  <?php /* SAYING WHAT THIS CARD IS NOT';
    $aD = '  <?php /* THE EMPLOYEE DIRECTORY'; $aR = '  <?php if ($rt) { ?>';
    $iO = strpos($page, $aO); $iF = strpos($page, $aF); $iD = strpos($page, $aD); $iR = strpos($page, $aR);
    if ($iO === false || $iF === false || $iD === false || $iR === false || !($iO < $iF && $iF < $iD && $iD < $iR)) { fwrite(STDERR, "mutant6: the 2026-10-01 order not found\n"); exit(2); }
    $page = substr($page, 0, $iO) . substr($page, $iD, $iR - $iD) . substr($page, $iF, $iD - $iF) . substr($page, $iO, $iF - $iO) . substr($page, $iR);
    echo "MUTANT6: the left column in its old order (failures, then outage history, below delivery)\n";
}
$leftAnchors = array(
    'r1a' => '  <?php /* =========================== SCHEDULER',
    'r4'  => '  <?php /* =========================== OUTAGE HISTORY',
    'r3'  => '  <?php /* SAYING WHAT THIS CARD IS NOT',
    'r1b' => '  <?php /* THE EMPLOYEE DIRECTORY',
    'r2'  => '  <?php /* Delivery through www3',
    'r5'  => '  <?php if ($rt) { ?>',
);
$leftEnd = strpos($page, '</div><!-- /left -->');
if ($leftEnd === false || substr_count($page, '</div><!-- /left -->') !== 1) { fwrite(STDERR, "anchor 'left end' not unique\n"); exit(2); }
$leftPos = array();
foreach ($leftAnchors as $k => $a) {
    if (substr_count($page, $a) !== 1) { fwrite(STDERR, "anchor '$k' matched " . substr_count($page, $a) . " times\n"); exit(2); }
    $leftPos[$k] = strpos($page, $a);
    if ($leftPos[$k] > $leftEnd) { fwrite(STDERR, "anchor '$k' is outside the left column\n"); exit(2); }
}
asort($leftPos);
$LEFT_ORDER = array_keys($leftPos);
$LEFT = array();
foreach ($LEFT_ORDER as $i => $k) {
    $end = isset($LEFT_ORDER[$i + 1]) ? $leftPos[$LEFT_ORDER[$i + 1]] : $leftEnd;
    $LEFT[$k] = substr($page, $leftPos[$k], $end - $leftPos[$k]);
}
$R = array(
    'top' => cut($page, '<div id="pnbHubTop">', '</div><!-- /pnbHubTop -->', 'status band') . '</div><!-- /pnbHubTop -->',
    'r1'  => $LEFT['r1a'] . $LEFT['r1b'],   // scheduler + tiles, then directory + maintenance
    'r2'  => $LEFT['r2'],                   // delivery
    'r3'  => $LEFT['r3'],                   // failures
    'r4'  => $LEFT['r4'],                   // outage history
    'r5'  => $LEFT['r5'],                   // runtime
    'r6'  => cut($page, '  <div class="pnb-adm-card pnb-log" id="pnbLog">', '<?php penumbra_admin_close(); ?>', 'R6 logs + scripts'),
);
if ($MUTANT) {
    $needle = 'data-slot="<?php echo (int)$p[\'slot\']; ?>"';
    if (substr_count($R['r4'], $needle) !== 1) { fwrite(STDERR, "mutant: bell slot markup not found\n"); exit(2); }
    $R['r4'] = str_replace($needle, 'data-slot=""', $R['r4']);
    echo "MUTANT: the bell renders without its data-slot\n";
}
if ($MUTANT3) {
    $needle = '$bandOk = $snap[\'ok\'] && !$bandLk;';
    if (substr_count($R['top'], $needle) !== 1) { fwrite(STDERR, "mutant3: the band verdict not found\n"); exit(2); }
    $R['top'] = str_replace($needle, '$bandOk = $snap[\'ok\'];', $R['top']);
    echo "MUTANT3: the status band reads 'ok' alone and ignores last_known\n";
}
if ($MUTANT4) {
    $needle = 'penumbra_outage_strip(24, null, $config, $outg[\'from\'], $outg[\'to\'])';
    if (substr_count($R['r4'], $needle) !== 1) { fwrite(STDERR, "mutant4: the strip call not found\n"); exit(2); }
    $R['r4'] = str_replace($needle, 'penumbra_outage_strip(24, 96, $config)', $R['r4']);
    echo "MUTANT4: the outage strip draws the last 24 hours whatever the card's window\n";
}
if ($MUTANT5) {
    $n1 = '$errsChip = $snap[\'components\'][\'errors\'];';
    $n2 = '$outChip = isset($snap[\'components\'][\'outages\']) ? $snap[\'components\'][\'outages\'] : array();';
    if (substr_count($R['top'], $n1) !== 1 || substr_count($R['top'], $n2) !== 1) { fwrite(STDERR, "mutant5: the chip sources not found\n"); exit(2); }
    $R['top'] = str_replace(array($n1, $n2), array('$errsChip = $errs;', '$outChip = $outg;'), $R['top']);
    echo "MUTANT5: the status chips read the cards' windowed \$errs / \$outg\n";
}
$H = array();
foreach ($R as $k => $tpl) {
    $f = $TMP . DIRECTORY_SEPARATOR . $k . '.php';
    file_put_contents($f, $tpl);
    $H[$k] = render($f);
}
// the failures card a second time, with rows
$errs = array('total' => 3, 'window_hours' => 24, 'by_action' => array('SCHEDULED_SEND' => 1, 'EXPORT' => 1, 'SCHEDULE_FAIL' => 1));
$fails = array(
    array('ts' => date('Y-m-d H:i', $T - 5000), 'action' => 'SCHEDULED_SEND', 'report' => 'awdspon', 'title' => 'Awards by Selected Funders', 'user' => 'scheduler', 'message' => 'ip_address=127.0.0.1 SMTP connect to mta:25 timed out after 30s'),
    array('ts' => date('Y-m-d H:i', $T - 9000), 'action' => 'EXPORT', 'report' => '', 'title' => '', 'user' => 'jdoe', 'message' => ''),
    // 2026-10-03: a scheduler failure carries its notice receipt; the address is
    // hostile on purpose - the line must escape it.
    array('ts' => date('Y-m-d H:i', $T - 9500), 'action' => 'SCHEDULE_FAIL', 'report' => 'awdunit', 'title' => 'Awards by Unit', 'user' => 'scheduler', 'message' => 'ORA-00942',
          'notice' => array('state' => 'sent', 'to' => 'owner@ncsu.edu, <b>x</b>@x.edu', 'bcc' => 'admin@ncsu.edu', 'confirmed' => true)),
);
$H['r3b'] = render($TMP . DIRECTORY_SEPARATOR . 'r3.php');
$errs = $snap['components']['errors']; $fails = array();

// ---------------------------------------------------------------------------
section('0. Every region renders without a diagnostic');
foreach ($H as $k => $html) { ok(clean($html), "$k renders clean", substr($html, 0, 200)); }

section('1. Status band');
$h = $H['top'];
ok(strpos($h, 'pnb-adm-status bad') !== false && strpos($h, 'Degraded: www3 delivery down') !== false, 'band is red and names the problem');
ok(preg_match('/<a class="pnb-hub-status-link"[^>]*>[^<]*<\/a>\s*<span class="pnb-i"/', $h) === 1, 'the (i) sits right after the headline link');
ok(strpos($h, 'aria-label="About the status"') !== false && strpos($h, 'warnings never page anyone') !== false, 'with its explanatory tip');
ok(preg_match('/<a class="pnb-chip bad"[^>]*>\s*<span class="pnb-chip-v">DOWN<\/span><span class="pnb-chip-l">delivery \(www3\)<\/span>/', $h) === 1, 'delivery chip DOWN in red');
$outNexp = (int)$outg['total'] + count($outg['open']);   // 4 closed + 1 open
ok($outNexp === 5 && preg_match('/<a class="pnb-chip bad" href="#pnbOutages" data-card="pnbOutages"[^>]*>\s*<span class="pnb-chip-v">1 OPEN<\/span><span class="pnb-chip-l">outages 7d · 5 total<\/span>/', $h) === 1, 'outages chip: the open outage is its value, in red; 4 closed + 1 open in its label (2026-10-14)', $outNexp);
ok(strpos($h, 'ONE IS STILL OPEN') !== false, 'and its tip says one is still open');
ok(strpos($h, '2 near miss(es) recorded as well') !== false, 'and its tip counts the near misses separately');
ok(strpos($h, '<li><a class="pnb-warn-link" href="#pnbOutages" data-card="pnbOutages" title="Open the card that explains this">INFOED near miss in progress') !== false, 'warnings list carries the near miss in progress, as a link to the outage card (2026-10-14)', $h);
ok(strpos($h, '<li><a class="pnb-warn-link" href="#pnbDelivery" data-card="pnbDelivery" title="Open the card that explains this">www3 delivery: 4 stalled') !== false && strpos($h, ' <span aria-hidden="true">&#8599;</span></a></li>') !== false, 'and the delivery warning links to the delivery card');

section('1b. The band counts what the last probe found down (2026-09-24)');
/* The bug: 'ok' is the 503 contract and counts only a LIVE probe, and the band
   read 'ok' alone - "All monitored components healthy" beside a red INFOED
   tile, a red 4/5 chip and an open INFOED outage. */
$lkC = array(
    'databases' => array('hr' => array('status' => 'ok', 'ms' => 38), 'infoed' => array('status' => 'down', 'ms' => 98121),
                         'fin' => array('status' => 'degraded', 'ms' => 1210)),
    'databases_probed_at' => date('c', $T - 176), 'databases_from_cache' => true,
    'smtp' => array('status' => 'ok', 'from_cache' => true, 'probed_at' => date('c', $T - 60)),
);
$lk = penumbra_health_last_known($lkC, $T);
ok(count($lk) === 1 && $lk[0]['problem'] === 'database infoed down' && $lk[0]['age_secs'] === 176 && $lk[0]['probed_at'] === $lkC['databases_probed_at'],
   'a cached down database is listed in the words problems uses, with its age', $lk);
$c = $lkC; unset($c['databases_from_cache']);
ok(penumbra_health_last_known($c, $T) === array(), 'a live database probe is left out: its down is already in problems');
$c = $lkC; $c['databases']['infoed']['status'] = 'degraded';
ok(penumbra_health_last_known($c, $T) === array(), 'a degraded database stays a warning, not a last-known down');
$c = $lkC; $c['databases'] = array(); $c['smtp'] = array('status' => 'down', 'from_cache' => true, 'probed_at' => date('c', $T - 600));
$lkM = penumbra_health_last_known($c, $T);
ok(count($lkM) === 1 && $lkM[0]['problem'] === 'smtp down' && $lkM[0]['age_secs'] === 600, 'a cached mail relay down is listed too', $lkM);
$c['smtp']['from_cache'] = false;
ok(penumbra_health_last_known($c, $T) === array(), 'a live mail probe is left out');
$c = $lkC; $c['databases_probed_at'] = null;
$lkU = penumbra_health_last_known($c, $T);
ok(count($lkU) === 1 && $lkU[0]['age_secs'] === null && $lkU[0]['probed_at'] === null, 'no probe time: still listed, age unknown', $lkU);
ok(penumbra_health_last_known(array(), $T) === array(), 'an empty component list lists nothing');
$pinP = strpos($src, "\$snap['problems'] = \$problems;");
$pinL = strpos($src, "\$snap['last_known'] = penumbra_health_last_known(\$snap['components'], time());");
$pinW = strpos($src, "\$snap['warnings'] = \$warn;");
ok(substr_count($src, "\$snap['last_known'] = ") === 1 && $pinP !== false && $pinL !== false && $pinW !== false && $pinP < $pinL && $pinL < $pinW,
   'penumbra_health_snapshot() fills last_known once, after ok/problems are final', array($pinP, $pinL, $pinW));

// The band over the same fixture, four ways. render() reads the globals.
$snapKeep = $snap;
$snap['ok'] = true; $snap['problems'] = array(); $snap['last_known'] = array();
$hGreen = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
$snap['last_known'] = $lk;
$hLk = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
$snap['last_known'] = $lkU;
$hLkU = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
$snap['ok'] = false; $snap['problems'] = array('scheduler offline'); $snap['last_known'] = $lk;
$hBoth = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
$snap = $snapKeep;
ok(clean($hGreen) && strpos($hGreen, 'pnb-adm-status ok') !== false && strpos($hGreen, '>All monitored components healthy</a>') !== false,
   'nothing down, live or cached: the band is green');
ok(clean($hLk) && strpos($hLk, 'pnb-adm-status bad') !== false && strpos($hLk, '>Degraded: database infoed down (probed 2m ago)</a>') !== false
   && strpos($hLk, 'All monitored components healthy') === false,
   'ok is true but the last probe found INFOED down: red, named, with its age (the 2026-09-24 bug)', substr($hLk, 0, 400));
ok(clean($hLkU) && strpos($hLkU, 'pnb-adm-status bad') !== false && strpos($hLkU, '>Degraded: database infoed down (cached)</a>') !== false,
   'a cached down with no probe time still turns it red, marked cached', substr($hLkU, 0, 400));
ok(clean($hBoth) && strpos($hBoth, 'pnb-adm-status bad') !== false && strpos($hBoth, '>Degraded: scheduler offline, database infoed down (probed 2m ago)</a>') !== false,
   'a live problem and a cached one are both named, live first');
ok(strpos($hLk, 'under last_known') !== false && strpos($hLk, 'answers 503 only on a live probe') !== false,
   'the (i) says why the JSON behind the link can still answer 200');

section('2. Scheduler card and the tiles');
$h = $H['r1'];
ok(strpos($h, 'id="pnbCardSched"') !== false && strpos($h, '<span class="k">Last heartbeat</span>') !== false, 'scheduler as a key/value list');
ok(preg_match('/<h2><button type="button" class="pnb-fold" aria-expanded="false"[^>]*>Scheduler<\/button> <span class="pnb-i"/', $h) === 1, 'its footnote became an (i) in the heading, after the fold toggle (2026-10-14)');
ok(strpos($h, 'class="pnb-h2-r"') !== false && strpos($h, 'ONLINE') !== false, 'status pinned at the heading\'s right');
ok(substr_count($h, '<div class="pnb-tile ') === 6, 'six tiles: five databases and the mail relay', substr_count($h, '<div class="pnb-tile '));
ok(preg_match('/<div class="pnb-tile degraded">.*?<b>INFOED<\/b>/s', $h) === 1, 'INFOED tile carries the degraded tone');
ok(preg_match('/<div class="pnb-tile degraded">.*?<span class="pnb-tile-s">degraded &middot; 1210 ms <span class="pnb-i"/s', $h) === 1, 'its detail is an (i) inside the tile');
ok(preg_match('/<div class="pnb-tile ok">.*?<b>MAIL \(MTA\)<\/b>\s*<span class="pnb-tile-s">up &middot; 12 ms/s', $h) === 1, 'mail relay is the sixth tile, up');
ok(strpos($h, 'never sends mail') !== false, 'with the handshake note in its (i)');
ok(strpos($h, '(cached) &middot; <a href="?full=1"') !== false, 're-probe link is on the card (first in the body since 2026-10-14)');
ok(strpos($h, '<table') === false, 'no table left in the databases card');
section('2b. Employee directory: folded into the Maintenance card (2026-10-14 evening), its chip kept');
$h = $H['r1'];
ok(strpos($h, 'id="pnbCardDir"') === false && strpos($h, '>Employee directory</button>') === false, 'no directory card of its own any more');
ok(preg_match('#<div class="pnb-kv pnb-maint-kv">\s*<span class="k">Employee directory</span>\s*<span class="v"><span class="pnb-adm-dot ok"></span>' . preg_quote(date('Y-m-d H:i:s', $T - 61200), '#') . ' <span class="pnb-adm-muted">\(17h ago\)</span> &middot; 71,887 people &middot; 24,654 active &middot; 2,602 PI-eligible</span>#', $h) === 1,
   'the Maintenance card leads with the directory: a dot, the refresh stamp and its age, the counts', $h);
ok(preg_match('#<span class="pnb-h2-r"><span class="pnb-adm-dot ok"></span>OK</span></h2>#', $h) === 1, 'verdict pinned at the heading right, green');
ok(strpos($h, '<span class="pnb-sum">directory refreshed 17h ago &middot; people_sync ok in 17.2 s (') !== false, 'the summary leads with the directory', $h);
ok(strpos($h, 'Lookups still answer') === false && strpos($h, 'refresh is paused') === false, 'no note while everything is fine');
ok(substr_count($h, '<div class="pnb-tile ') === 6, 'the six tiles are untouched');
ok(strpos($h, 'PENUMBRA_PEOPLE</strong> is what the people picker') !== false && strpos($page, 'Run, pause or read the job in the Maintenance card below') === false, 'the (i) explains the directory line; the old pointer to a separate card is gone');
$h = $H['top'];
ok(preg_match('#<a class="pnb-chip ok" href="\#pnbCardMaint" data-card="pnbCardMaint" title="last refreshed [^"]* - 71,887 people, 24,654 active - shown on the Maintenance card"><span class="pnb-chip-v">17h ago</span><span class="pnb-chip-l">directory</span>#', $h) === 1, 'directory chip: the age as its value, green, the counts in its tip, a link to the Maintenance card', $h);
$keep = $snap;
// stale: amber, the detail after the age, a note under the line, the card open
$snap['components']['directory']['status']   = 'stale';
$snap['components']['directory']['age_secs'] = 31 * 3600;
$snap['components']['directory']['detail']   = 'last refreshed 31h ago - the nightly people_sync did not land since';
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(preg_match('#<span class="pnb-h2-r"><span class="pnb-adm-dot warn"></span>STALE</span></h2>#', $h) === 1, 'stale: amber verdict on the Maintenance card', $h);
ok(strpos($h, '(1d ago)</span> <span class="pnb-adm-muted">&mdash; last refreshed 31h ago - the nightly people_sync did not land since</span>') !== false, 'the detail follows the age', $h);
ok(strpos($h, 'Lookups still answer from the rows already loaded. The people_sync row below says') !== false && strpos($h, 'id="pnbCardMaint" data-open="1" data-force="1"') !== false, 'a note under the line, and the card opens itself', $h);
ok(strpos($h, '<span class="pnb-sum"><span class="pnb-warn">directory stale (1d ago)</span> &middot; people_sync ok') !== false, 'the summary says stale, in amber', $h);
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('#<a class="pnb-chip warn"[^>]*><span class="pnb-chip-v">1d ago</span><span class="pnb-chip-l">directory</span>#', $h) === 1, 'the chip goes amber');
// down (an empty table), the job still known
$snap = $keep;
$snap['components']['directory'] = array('status' => 'down', 'total' => 0, 'active' => 0, 'pi_eligible' => 0, 'last_seen' => null, 'age_secs' => null, 'ms' => 4,
    'detail' => 'the directory is empty - the people_sync job has never loaded it', 'from_cache' => true, 'job' => $keep['components']['directory']['job']);
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(preg_match('#<span class="pnb-h2-r"><span class="pnb-adm-dot bad"></span>DIRECTORY DOWN</span></h2>#', $h) === 1, 'empty: red verdict, and it says which thing is down', $h);
ok(strpos($h, '<span class="pnb-adm-muted">never</span> <span class="pnb-adm-muted">&mdash; the directory is empty') !== false, 'never refreshed, with the reason', $h);
ok(strpos($h, '0 people &middot; 0 active &middot; 0 PI-eligible') !== false, 'the zero counts are shown, not hidden');
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('#<a class="pnb-chip bad"[^>]*><span class="pnb-chip-v">DOWN</span><span class="pnb-chip-l">directory</span>#', $h) === 1, 'the chip goes red and says DOWN');
// a paused refresh: the note, the card open
$snap = $keep;
$snap['components']['directory']['job']['paused'] = true;
$snap['components']['directory']['job']['next']   = 'paused';
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, 'The nightly refresh is paused, so the directory reads stale from about 30 hours') !== false && strpos($h, 'id="pnbCardMaint" data-open="1" data-force="1"') !== false, 'a paused refresh: the note, and the card opens itself', $h);
// the cache predates this line (no directory in it) but the job is known
$snap = $keep;
$snap['components']['directory'] = array('status' => 'unknown', 'detail' => 'not probed yet', 'from_cache' => true, 'job' => $keep['components']['directory']['job']);
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, '<span class="pnb-adm-muted">not probed yet</span> &middot; <a href="?full=1"') !== false && preg_match('#<span class="pnb-h2-r"><span class="pnb-adm-dot "></span>NOT PROBED</span></h2>#', $h) === 1, 'not probed yet: a probe-now link on the line, a toneless NOT PROBED verdict', $h);
// no component at all (a snapshot older than this line): the same line
unset($snap['components']['directory']);
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, '<span class="k">Employee directory</span>') !== false && strpos($h, 'not probed yet</span> &middot; <a href="?full=1"') !== false, 'no component: the line still reads not probed yet with a probe-now link', $h);
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('#<a class="pnb-chip" href="\#pnbCardMaint" data-card="pnbCardMaint" title="PENUMBRA_PEOPLE has not been probed yet - shown on the Maintenance card"><span class="pnb-chip-v">&mdash;</span><span class="pnb-chip-l">directory</span>#', $h) === 1, 'the chip is toneless with a dash');
$snap = $keep;
// the backup set, when the snapshot carries one, is the second line
$snap['components']['backup'] = array('status' => 'ok', 'age_secs' => 61200, 'detail' => 'last complete 17h ago - 14 tables, 106,800 rows, 40.6 MB', 'latest' => array('dir' => 'D:\\Utilities\\PHP_8.2-p\\penumbra_backups\\2026-10-14_0132'));
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(preg_match('#<span class="k">Table backups</span>\s*<span class="v"><span class="pnb-adm-dot ok"></span>last complete 17h ago - 14 tables, 106,800 rows, 40.6 MB &middot; <span title="[^"]*">D:\\\\Utilities\\\\PHP_8.2-p\\\\penumbra_backups\\\\2026-10-14_0132</span></span>#', $h) === 1 && strpos($h, '<strong>Backups:</strong>') === false, 'the backup set is the second line, not a note under the job', $h);
ok(strpos($h, '&middot; backups 17h ago</span>') !== false, 'and the summary carries its age');
$snap['components']['backup']['status'] = 'stale';
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(preg_match('#<span class="pnb-h2-r"><span class="pnb-adm-dot warn"></span>BACKUP STALE</span></h2>#', $h) === 1 && preg_match('#Table backups</span>\s*<span class="v"><span class="pnb-adm-dot warn"></span>#', $h) === 1, 'a stale set: amber on its line and in the verdict', $h);
$snap = $keep;

section('2c. penumbra_directory_status() verdicts (the stale threshold is 30h)');
$v = penumbra_directory_status($T - 3600, $T, 71887);
ok($v['status'] === 'ok' && $v['age_secs'] === 3600 && $v['detail'] === '', 'an hour old: ok, with its age', $v);
$v = penumbra_directory_status($T - 29 * 3600, $T, 71887);
ok($v['status'] === 'ok', '29h old: still ok (a nightly job leaves it about 24h old at most)', $v);
$v = penumbra_directory_status($T - 31 * 3600, $T, 71887);
ok($v['status'] === 'stale' && $v['age_secs'] === 31 * 3600 && $v['detail'] === 'last refreshed 31h ago - the nightly people_sync did not land since', '31h old: stale, and the detail says so', $v);
$v = penumbra_directory_status($T - 3 * 86400, $T, 71887);
ok($v['status'] === 'stale' && strpos($v['detail'], '72h ago') !== false, 'three days old: stale, 72h in the detail', $v);
$v = penumbra_directory_status($T - 3600, $T, 0);
ok($v['status'] === 'down' && $v['age_secs'] === null && strpos($v['detail'], 'empty') !== false, 'an empty table is down, whatever the stamp says', $v);
$v = penumbra_directory_status(0, $T, 71887);
ok($v['status'] === 'down' && strpos($v['detail'], 'never loaded') !== false, 'no stamp at all is down', $v);
$v = penumbra_directory_status($T + 600, $T, 5);
ok($v['status'] === 'ok' && $v['age_secs'] === 0, 'a stamp from a clock ahead of ours clamps to age 0, never stale', $v);
ok(strpos($src, "define('PENUMBRA_DIRECTORY_STALE_SECS', 30 * 3600)") !== false, 'the threshold is pinned at 30 hours in penumbra_health.php');

section('2d. Maintenance card (2026-09-23, the folded-in Jobs tool)');
$h = $H['r1'];
ok(strpos($h, 'id="pnbCardMaint"') !== false && strpos($h, 'pnb-card-fold" id="pnbCardMaint"') === false, 'the card is present and unfolded with a job registered');
ok(preg_match('#<h2><button type="button" class="pnb-fold" aria-expanded="false"[^>]*>Maintenance</button> <span class="pnb-i".*?<span class="pnb-h2-r"><span class="pnb-adm-dot ok"></span>OK</span></h2>#s', $h) === 1, 'heading: the fold toggle, an (i), and a green dot with OK at the right (the job count moved into the summary 2026-10-14)');
ok(preg_match('#<div class="pnb-row" data-job="people_sync">\s*<span class="t"[^>]*>05:30 daily</span>\s*<span class="c ">OK</span>\s*<span class="d"[^>]*>Employee directory refresh</span>#', $h) === 1, 'the job row: schedule, OK, label', $h);
ok(strpos($h, '<span class="to" title="Last run">' . date('Y-m-d H:i:s', $T - 61140) . '</span>') !== false, 'last run timestamp');
ok(strpos($h, '<span class="p">ok in 17.2 s &middot; next: tomorrow 05:30</span>') !== false, 'the detail: result and next run');
ok(preg_match('#data-job-act="request" data-job="people_sync"[^>]*>Run now</button>#', $h) === 1 && preg_match('#data-job-act="pause" data-job="people_sync"[^>]*>Pause</button>#', $h) === 1, 'Run now and Pause buttons carry the job');
ok(strpos($h, 'class="pnb-log-jump" data-log="jobs" data-q="[people_sync]"') !== false, 'a log link jumps to the one Internal jobs tab, filtered to the job (2026-10-12)');
ok(substr_count($h, '<div class="pnb-rows pnb-rows-runs">') === 1 && substr_count($h, '<span class="c ">OK</span>') === 2 && strpos($h, '<span class="c bad">FAILED</span>') !== false && strpos($h, '<span class="c warn">REQUEST</span>') !== false, 'latest runs: ok, failed and control rows with their pills');
ok(strpos($h, 'staged 71887 updated 12') !== false, 'a run row shows its first two stats');
ok(strpos($h, 'maintenance_jobs.php') === false, 'nothing on the page links to the retired Jobs tool');
ok(substr_count($h, '<div class="pnb-tile ') === 6, 'the six tiles are still untouched');
$keep2 = $snap;
$snap['components']['maintenance']['people_sync']['paused'] = true; $snap['components']['maintenance']['people_sync']['next'] = 'paused';
$snap['components']['maintenance']['people_sync']['requested'] = true;
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, '<span class="c warn">PAUSED</span>') !== false && preg_match('#data-job-act="resume"[^>]*>Resume</button>#', $h) === 1 && preg_match('#data-job-act="cancel_request"[^>]*>Withdraw</button>#', $h) === 1, 'paused + requested: PAUSED pill, Resume and Withdraw');
ok(strpos($h, '&middot; paused</span>') !== false, 'the detail says paused');
$snap = $keep2;
$snap['components']['maintenance']['people_sync']['result'] = array('finished' => date('Y-m-d H:i:s', $T - 61140), 'exit' => 1, 'secs' => 3, 'error' => null, 'reason' => 'scheduled 05:30', 'label' => 'failed in 3 s');
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, '<span class="c bad">FAILED</span>') !== false && strpos($h, '<span class="p">failed in 3 s &middot; next: tomorrow 05:30</span>') !== false, 'a failed last run: FAILED pill and the label');
$snap = $keep2;
$snap['components']['maintenance']['people_sync']['result'] = null; $snap['components']['maintenance']['people_sync']['last'] = '';
$snap['components']['maintenance_runs'] = array('error' => 'ORA-12541 no listener', 'rows' => array());
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, '<span class="c warn">NEVER RUN</span>') !== false && strpos($h, '<span class="to" title="Last run">never</span>') !== false, 'never run: amber pill, never');
ok(strpos($h, 'Latest runs unavailable: ORA-12541 no listener') !== false, 'a failed history read says so instead of hiding it');
$snap = $keep2;
$snap['components']['maintenance'] = array();
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, 'No maintenance jobs are registered') !== false && strpos($h, 'pnb-rows-jobs') === false && strpos($h, '<span class="k">Employee directory</span>') !== false && strpos($h, 'pnb-card-fold') === false, 'no jobs: the card keeps the directory line and says no job is registered (2026-10-14 evening)');
$snap = $keep2;
// a job's own findings (maint_<job>.checks, 2026-09-23): an amber note under its row
ok(strpos($H['r1'], 'pnb-job-note') === false, 'control: no findings, no note under the job row');
$snap['components']['maintenance']['people_sync']['checks'] = array('at' => '2026-09-24 05:31:07', 'warnings' => array('PI eligibility differs from PI_ELIGIBLE_PROFILES for 41 people (30 eligible only here, 11 only there) - the shared rule may have changed upstream; the directory keeps its own'));
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, '<div class="pnb-hub-note pnb-job-note"><strong>Employee directory refresh</strong> reported after its last run (2026-09-24 05:31:07):') !== false && strpos($h, '11 only there) - the shared rule may have changed upstream; the directory keeps its own</div>') !== false, 'the findings render as an amber note under the job row, stamped', $h);
ok(substr_count($h, 'pnb-job-note') === 1 && substr_count($h, '<div class="pnb-tile ') === 6, 'one note, the tiles untouched');
$snap['components']['maintenance']['people_sync']['checks'] = array('at' => '2026-09-24 05:31:07', 'warnings' => array());
$h = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($h, 'pnb-job-note') === false, 'an all-clear checks file (empty list) draws nothing');
$snap = $keep2;
ok(strpos($src, "foreach (\$mjRow['checks']['warnings'] as \$mjW) { \$warn[] = \$mjLabel . ': ' . \$mjW; }") !== false, 'the snapshot turns each finding into a hub warning prefixed with the job label (penumbra_health.php)');
ok(strpos($src, "'staged', 'active', 'pi_eligible', 'pi_drift', 'inserted'") !== false, 'the run rows know the PI stats (own-rule count and cross-check drift)');
    ok(strpos($src, "FROM NC_REPORTING.PENUMBRA_PEOPLE WHERE SOURCE = 'HR'") !== false, "the directory probe counts HR rows only, so a hand-registered account can never make a stale directory look fresh (2026-09-25)");


section('3. Delivery card');
$h = $H['r2'];
ok(strpos($h, 'id="pnbDelivery"') !== false && strpos($h, 'pnb-rows pnb-rows-dl') !== false, 'delivery failures as a one-line row list');
ok(substr_count($h, '<div class="pnb-row">') === 5, 'five rows: four stalls and a drop', substr_count($h, '<div class="pnb-row">'));
ok(substr_count($h, '<span class="c bad">STALL</span>') === 4 && substr_count($h, '<span class="c warn">CUT OFF</span>') === 1, 'stalls red, the drop amber');
$allJump = true;
foreach ($dlvFailures as $f) {
    $q = gmdate('H:i', $f['ts']);
    if (strpos($h, 'class="pnb-log-jump" data-log="iis" data-q="' . $q . '"') === false) $allJump = false;
}
ok($allJump, 'every row links to the IIS tab filtered to its UTC minute');
ok(strpos($h, 'title="/sponsor_migration/penumbra/css/main.css"') !== false, 'the uri survives whole in the title');
ok(preg_match('/<span class="pnb-h2-r"><span class="pnb-adm-dot bad"><\/span>DOWN<\/span>/', $h) === 1, 'verdict pinned at the heading\'s right');
ok(strpos($h, '4 delivered') === false && strpos($h, '1 delivered &middot; 4 stalled &middot; 1 cut off') !== false, 'the counts line');

section('4. Failures card folds when empty');
$h = $H['r3'];
ok(strpos($h, 'pnb-adm-card pnb-card-fold') !== false && strpos($h, '<span class="pnb-h2-val">none</span>') !== false, 'empty: one folded line saying none');
ok(strpos($h, 'pnb-fail-list') === false && strpos($h, 'pnb-fail-counts') === false, 'and nothing else');
// 2026-10-15: the tip is inside a role=button (i) now, which may hold no link,
// so it names the card in words.
ok(strpos($h, 'that is the <strong>Outage history</strong> card.') !== false, 'its (i) points at outage history');
$h = $H['r3b'];
ok(strpos($h, 'pnb-card-fold') === false && substr_count($h, 'pnb-fail-pill') === 3 && substr_count($h, '<div class="pnb-fail-row">') === 3, 'with rows: unfolded, pills and rows', substr($h, 0, 400));
ok(strpos($h, 'SMTP connect to mta:25 timed out') !== false, 'the message wraps whole', substr($h, 0, 400));
ok(strpos($h, 'Notice emailed to owner@ncsu.edu, &lt;b&gt;x&lt;/b&gt;@x.edu') !== false && strpos($h, '<b>x</b>') === false, 'a scheduler failure says who its notice went to, escaped', substr($h, 0, 1200));
ok(strpos($h, '+ admin bcc') !== false, 'and that the admin was bcc\'d');
ok(substr_count($h, 'pnb-fail-n') === 1, 'rows that never send a notice say nothing about one');

section('5. Outage history');
$h = $H['r4'];
ok(strpos($h, 'id="pnbOutages"') !== false, 'card present');
$ledgerN = array('total' => (int)$outg['total'], 'open' => count($outg['open']), 'near_total' => (int)$outg['near_total'], 'near_open' => count($outg['near_open']));
echo "  info ledger: " . json_encode($ledgerN) . "\n";
ok($ledgerN['total'] === 4 && $ledgerN['open'] === 1 && $ledgerN['near_open'] === 1 && $ledgerN['near_total'] === 1, 'ledger: 4 closed outages, one open, one open and one closed near miss', $ledgerN);
preg_match('/<span class="pnb-h2-r"><span class="pnb-adm-dot bad"><\/span>([^<]*)<\/span>/', $h, $hm);   // the dot is red: an outage is open (2026-10-14)
$outN = $ledgerN['total'] + $ledgerN['open']; $nearN = $ledgerN['near_total'] + $ledgerN['near_open'];
ok(isset($hm[1]) && $hm[1] === "$outN outage" . ($outN == 1 ? '' : 's') . " &middot; $nearN near miss" . ($nearN == 1 ? '' : 'es') . " &middot; coverage " . $outg['coverage_pct'] . '%', 'heading summary counts outages, near misses and coverage', isset($hm[1]) ? $hm[1] : null);
ok(preg_match('/<div class="pnb-out-openrow">\s*<span class="pnb-adm-dot bad"><\/span>\s*<strong>www3 delivery<\/strong> has been down for/', $h) === 1, 'open outage row');
ok(preg_match('/<button type="button" class="pnb-out-copy" data-packet="([^"]+)"/', $h, $m) === 1, 'with a Copy escalation packet button');
$packet = isset($m[1]) ? html_entity_decode($m[1], ENT_QUOTES, 'UTF-8') : '';
ok(strpos($packet, 'Penumbra outage: www3 delivery') === 0, 'packet starts with the component');
ok(strpos($packet, 'Problem: www3 delivery down') !== false, 'packet names the problem');
ok(strpos($packet, 'Evidence (IIS access log, last 15 min): 4 stalled (win32 121)') !== false, 'packet carries the delivery evidence line');
ok(substr_count($packet, ' STALL win32 121 - 206,671 bytes sent - 19.1s - via 10.48.12.91 - /sponsor_migration/penumbra/css/main.css') === 4, 'and the four stalled requests');
ok(strpos($packet, 'Peers: proxies 10.48.12.91, 10.48.12.98 -> this server') !== false, 'and the peers');
ok(strpos($packet, 'Health page: https://www3.acs.ncsu.edu/sponsor_migration/penumbra/health.php') !== false && strpos($packet, 'Watchdog log:') !== false, 'and where to look next');
ok(strpos($packet, "\n") !== false && strpos($m[1], '&') !== false, 'packet is multi-line and attribute-escaped');
ok(preg_match('/<div class="pnb-out-openrow near">\s*<span class="pnb-adm-dot warn"><\/span>\s*<strong>INFOED<\/strong> near miss for/', $h) === 1, 'open near miss row, amber');
ok(substr_count($h, 'pnb-out-copy') === 1, 'only the outage gets a Copy button (a near miss is not a ticket)');

// the strip: the card's default window, a week of hours (2026-10-01; it was
// the last 24 hours whatever the heading said)
/** Strip rows as component => cells / red / amber, plus the bar's classes. */
function strip_rows($html) {
    preg_match_all('/<div class="pnb-strip-r"><span class="pnb-strip-n">([^<]+)<\/span><div class="pnb-strip-bar( dense)?">(.*?)<\/div><\/div>/s', $html, $sm, PREG_SET_ORDER);
    $out = array();
    foreach ($sm as $row) { $out[$row[1]] = array('cells' => substr_count($row[3], '<i'), 'b' => substr_count($row[3], 'class="b"'), 'a' => substr_count($row[3], 'class="a"'), 'dense' => $row[2] !== ''); }
    return $out;
}
/** The five axis ticks under a strip. */
function strip_ticks($html) {
    if (!preg_match('/<div class="pnb-strip-ax"><span><\/span><div>(.*?)<\/div><\/div>/s', $html, $m)) return array();
    preg_match_all('/<span>([^<]*)<\/span>/', $m[1], $tm);
    return $tm[1];
}
ok(preg_match('/<div class="pnb-strip"/', $h) === 1, 'strip present');
$strip = strip_rows($h);
ok(isset($strip['www3 delivery'], $strip['INFOED'], $strip['HR'], $strip['Scheduler']), 'one strip row per component seen in the 7 days', array_keys($strip));
ok(!empty($strip['www3 delivery']) && $strip['www3 delivery']['cells'] === 168 && $strip['www3 delivery']['dense'] && $strip['www3 delivery']['b'] >= 1 && $strip['www3 delivery']['b'] <= 2, '168 hourly cells, dense; the open outage paints red', isset($strip['www3 delivery']) ? $strip['www3 delivery'] : null);
ok(!empty($strip['INFOED']) && $strip['INFOED']['a'] >= 1 && $strip['INFOED']['b'] === 0, 'a near miss paints amber, never red', isset($strip['INFOED']) ? $strip['INFOED'] : null);
ok(!empty($strip['HR']) && $strip['HR']['b'] >= 1 && $strip['HR']['b'] <= 2, 'last night\'s HR outage is one or two red cells', isset($strip['HR']) ? $strip['HR'] : null);
ok(!empty($strip['Scheduler']) && $strip['Scheduler']['b'] >= 3 && $strip['Scheduler']['b'] <= 6, 'all three 03:03 scheduler windows are on it, not just today\'s', isset($strip['Scheduler']) ? $strip['Scheduler'] : null);
$ticks = strip_ticks($h);
ok(count($ticks) === 5 && $ticks[4] === 'now' && preg_match('/^[A-Z][a-z]{2} \d\d:\d\d$/', $ticks[0]) === 1 && preg_match('/^[A-Z][a-z]{2} \d\d:\d\d$/', $ticks[2]) === 1,
   'five ticks over the week, weekday + time, ending at now', $ticks);
ok($ticks && $ticks[0] === date('D H:i', $outg['from']), 'the first tick is where the window starts', array($ticks ? $ticks[0] : null, date('D H:i', $outg['from'])));
ok(strpos($h, 'title="' . date('D d M H:i', $outg['from']) . ' to now in 1-hour cells: red = down') !== false, 'the strip legend names its span and its cell length');

// availability + the pattern pill with its bell
preg_match_all('/pnb-out-name">([^<]+)</', $h, $mm);
ok(in_array('HR', $mm[1], true) && in_array('Scheduler', $mm[1], true) && !in_array('INFOED', $mm[1], true), 'availability tiles for HR and Scheduler, none for a near miss', $mm[1]);
ok(preg_match('/<span class="pnb-out-patpill"[^>]*>\s*<b>Scheduler<\/b> ~03:03/', $h) === 1, 'the recurring 03:03 scheduler window is a pattern pill');
ok(preg_match('/<button type="button" class="pnb-bell muted" aria-pressed="true"\s+data-key="scheduler" data-slot="' . (int)$slot . '"/', $h) === 1, 'its bell is muted and carries key + slot for the handler', $slot);
ok(strpos($h, '&#128277; Muted</button>') !== false && strpos($h, 'Click to alert again.') !== false, 'muted bell reads Muted and offers to alert again');
ok(strpos($h, 'data-label="Scheduler ~03:03 daily"') !== false, 'and a label for the mute file');

// the merged one-line list
ok(strpos($h, '<div class="pnb-rows pnb-rows-out">') !== false, 'closed episodes and near misses share one list');
// 1 near / 2 when / 3 component / 4 length / 5 to / 6 cause text / 7 tags / 8 checks
preg_match_all('/<div class="pnb-row( near)?">\s*<span class="t">([^<]+)<\/span>\s*<span class="c">([^<]+)<\/span>\s*<span class="d">([^<]+)<\/span>\s*<span class="to">([^<]+)<\/span>\s*<span class="p" title="([^"]*)"><span class="pt">([^<]*)<\/span>(.*?)<\/span>\s*<span class="k">([^<]+)<\/span>/s', $h, $rows, PREG_SET_ORDER);
ok(count($rows) === 5, 'five one-line rows: 3 scheduler, 1 HR, 1 near miss', count($rows));
ok(!empty($rows) && $rows[0][1] === ' near' && $rows[0][3] === 'INFOED' && strpos($rows[0][8], 'near miss</span>') !== false, 'newest first: the closed INFOED near miss, tagged');
ok(!empty($rows) && $rows[0][2] === date('D d M H:i', $T - 3000) && $rows[0][5] === 'to ' . date('H:i', $T - 2700), 'with its start and end times');
ok(!empty($rows) && $rows[0][6] === $rows[0][7] && $rows[0][7] === pnb_h($NM), 'the cause text is clippable on its own, whole in the title');
$schedRows = array_filter($rows, function ($r) { return $r[3] === 'Scheduler'; });
$allTagged = count($schedRows) === 3;
foreach ($schedRows as $r) { if (strpos($r[8], '>recurring</span>') === false || strpos($r[8], '>muted</span>') === false) $allTagged = false; }
ok($allTagged, 'every scheduler row carries recurring + muted tags (listed, never hidden)');
$hrRows = array_filter($rows, function ($r) { return $r[3] === 'HR'; });
ok(count($hrRows) === 1 && trim(reset($hrRows)[8]) === '' && reset($hrRows)[9] === '2 checks', 'the HR row has no tag and 2 checks');
ok(strpos($h, '<strong>Near misses</strong>') === false && strpos($h, 'pnb-fail-list') === false, 'the old two-line lists are gone');

section('5c. The cards\' windows (2026-10-01)');
// --- penumbra_health_window(): the address token -> a window ---------------
$N = mktime(14, 30, 0, 10, 1, 2026);   // a fixed clock: Thu 1 Oct 2026 14:30 local
$w = penumbra_health_window('', '24h', $N);
ok($w['token'] === '24h' && $w['is_default'] && $w['kind'] === 'rolling' && $w['hours'] === 24 && $w['from'] === $N - 86400 && $w['to'] === $N && $w['ends_now']
   && $w['label'] === 'last 24h' && $w['long'] === 'Last 24 hours', 'no token: the card\'s default, rolling 24 hours', $w);
$w = penumbra_health_window('', '7', $N);
ok($w['token'] === '7' && $w['is_default'] && $w['hours'] === 168 && $w['from'] === $N - 168 * 3600 && $w['label'] === 'last 7d', 'the outage card\'s default is 7 days = 168 rolling hours', $w);
$exp = array('24h' => array(24, 'last 24h'), '7' => array(168, 'last 7d'), '30' => array(720, 'last 30d'), '90' => array(2160, 'last 90d'));
$allPresets = true;
foreach ($exp as $tk => $e) {
    $w = penumbra_health_window($tk, '24h', $N);
    if ($w['token'] !== (string)$tk || $w['hours'] !== $e[0] || $w['label'] !== $e[1] || $w['from'] !== $N - $e[0] * 3600 || $w['is_default'] !== ($tk === '24h')) $allPresets = false;
}
ok($allPresets, 'every preset: its hours, its label, from = now - hours, default only for the card\'s own');
// (PHP stores '7' / '30' / '90' as integer keys; the tokens they render are strings.)
ok(array_map('strval', array_keys(penumbra_health_window_presets())) === array('24h', '7', '30', '90', 'all'), 'the menu order is the analytics pages\'');
$w = penumbra_health_window('all', '7', $N);
ok($w['kind'] === 'all' && $w['hours'] === null && $w['from'] === null && $w['to'] === $N && $w['label'] === 'all time' && !$w['is_default'], 'all time: no start of its own (the reader knows where its record begins)', $w);
$w = penumbra_health_window(' 30 ', '24h', $N);
ok($w['token'] === '30', 'a padded token still reads', $w['token']);
$w = penumbra_health_window('2026-09-01..2026-09-15', '24h', $N);
ok($w['kind'] === 'custom' && $w['token'] === '2026-09-01..2026-09-15' && $w['from'] === mktime(0, 0, 0, 9, 1, 2026) && $w['to'] === mktime(0, 0, 0, 9, 16, 2026)
   && !$w['ends_now'] && $w['hours'] === 360 && $w['label'] === 'Sep 1 - Sep 15' && $w['long'] === 'Sep 1, 2026 - Sep 15, 2026' && $w['from_ymd'] === '2026-09-01' && $w['to_ymd'] === '2026-09-15',
   'a custom range is whole days, From\'s midnight to the midnight after To', $w);
$w = penumbra_health_window('2026-09-15..2026-09-01', '24h', $N);
ok($w['token'] === '2026-09-01..2026-09-15', 'typed backwards: the same window', $w['token']);
$w = penumbra_health_window('2026-09-20..2026-10-09', '24h', $N);
ok($w['token'] === '2026-09-20..2026-10-01' && $w['to'] === $N && $w['ends_now'], 'a To in the future is today, and today ends now', $w);
$w = penumbra_health_window('2026-10-01..2026-10-01', '7', $N);
ok($w['label'] === 'Oct 1' && $w['from'] === mktime(0, 0, 0, 10, 1, 2026) && $w['to'] === $N, 'a single day: one date, and today ends now', $w);
$w = penumbra_health_window('2025-12-20..2026-01-05', '7', $N);
ok($w['label'] === 'Dec 20, 2025 - Jan 5, 2026', 'another year carries its years', $w['label']);
$bad = array('abc', '2026-13-01..2026-13-02', '2026-02-30..2026-03-01', '1..2', '2026-09-01', "2026-09-01..2026-09-15' OR 1=1--", '2026-10-05..2026-10-09', '7d', 'ALL;', '..');
$allBad = true;
foreach ($bad as $b) { $w = penumbra_health_window($b, '7', $N); if ($w['token'] !== '7' || !$w['is_default']) $allBad = false; }
ok($allBad, 'malformed, impossible, injected or not-yet-begun tokens fall back to the default', $bad);
$w = penumbra_health_window('ALL', '24h', $N);
ok($w['token'] === 'all', 'tokens are case-blind', $w['token']);
// --- penumbra_health_window_sql(): the audit predicate ---------------------
list($q, $b) = penumbra_health_window_sql(null, 'TIMESTAMP', 24);
ok($q === ' AND TIMESTAMP >= SYSDATE - (:hrs/24)' && $b === array(':hrs' => 24), 'no window: the last N hours, the predicate and bind every caller had', array($q, $b));
list($q, $b) = penumbra_health_window_sql(penumbra_health_window('30', '24h', $N), 'a.TIMESTAMP');
ok($q === ' AND a.TIMESTAMP >= SYSDATE - (:hrs/24)' && $b === array(':hrs' => 720), 'a preset: the same rolling predicate, its hours bound as an int', array($q, $b));
list($q, $b) = penumbra_health_window_sql(penumbra_health_window('all', '24h', $N), 'TIMESTAMP');
ok($q === '' && $b === array(), 'all time: no predicate, no bind (an unused bind is ORA-01036)', array($q, $b));
list($q, $b) = penumbra_health_window_sql(penumbra_health_window('2026-09-01..2026-09-15', '24h', $N), 'a.TIMESTAMP');
ok($q === " AND a.TIMESTAMP >= TO_DATE(:wfrom, 'YYYY-MM-DD') AND a.TIMESTAMP < TO_DATE(:wto, 'YYYY-MM-DD') + 1" && $b === array(':wfrom' => '2026-09-01', ':wto' => '2026-09-15'),
   'a custom range: whole days, both dates bound, every bind used', array($q, $b));
// --- penumbra_outage_strip_cells(): the ladder ------------------------------
$lad = array(86400 => 96, 604800 => 168, 604801 => 168, 30 * 86400 => 120, 90 * 86400 => 90, 3600 => 4, 15 * 86400 => 120, 44 * 86400 => 88);
$got = array(); foreach ($lad as $secs => $n) { $got[$secs] = penumbra_outage_strip_cells($secs); }
ok($got === $lad, 'cells: a day 96, a week 168 (a second late too), 30 days 120, 90 days 90; never over 168', $got);

// --- the headings carry the control -----------------------------------------
ok(preg_match('#<h2>Failures <span class="pnb-h2-win">\(<button type="button" class="pnb-range" data-range-key="fail" data-range="24h" data-default="24h" data-card="Failures" data-from="[0-9-]{10}" data-to="' . date('Y-m-d') . '" aria-haspopup="dialog" aria-expanded="false" title="Last 24 hours\. Click to choose another window for this card\.">last 24h<span class="pnb-range-car" aria-hidden="true">&\#9662;</span></button>\)</span>#', $H['r3']) === 1,
   'Failures: "(last 24h)" is the window button', substr($H['r3'], 0, 600));
ok(preg_match('#<h2><button type="button" class="pnb-fold" aria-expanded="true"[^>]*>Outage history</button> <span class="pnb-h2-win">\(<button type="button" class="pnb-range" data-range-key="out" data-range="7" data-default="7" data-card="Outage history"[^>]*>last 7d<span class="pnb-range-car"#', $H['r4']) === 1,
   'Outage history: "(last 7d)" is the window button');
ok(strpos($H['r3b'], 'class="pnb-range" data-range-key="fail"') !== false, 'the unfolded failures card carries it too');

// --- the outage card over a 24-hour window ------------------------------------
$outgKeep = $outg; $outWinKeep = $outWin;
$outWin = penumbra_health_window('24h', '7');
$outg = penumbra_outage_history(array('hours' => 24, 'limit' => 25), $config);
$h24 = render($TMP . DIRECTORY_SEPARATOR . 'r4.php');
$s24 = strip_rows($h24); $t24 = strip_ticks($h24);
ok(clean($h24) && strpos($h24, 'data-range="24h" data-default="7"') !== false && strpos($h24, '>last 24h<span class="pnb-range-car"') !== false, '?out=24h: the heading says last 24h', substr($h24, 0, 300));
ok(!empty($s24['www3 delivery']) && $s24['www3 delivery']['cells'] === 96 && !$s24['www3 delivery']['dense'], '96 cells of 15 minutes, with their gaps', $s24);
ok(isset($s24['HR']) && $s24['HR']['b'] >= 1, 'last night\'s HR outage is inside it', $s24);
ok(count($t24) === 5 && $t24[4] === 'now' && preg_match('/^[A-Z][a-z]{2} \d\d:\d\d$/', $t24[0]) === 1 && preg_match('/^\d\d:\d\d$/', $t24[1]) === 1, 'ticks: weekday + time, then clock times, then now', $t24);
preg_match_all('/<div class="pnb-row( near)?">/', $h24, $r24);
ok(count($r24[0]) === $outg['total'] + $outg['near_total'] && $outg['total'] < $outgKeep['total'], 'fewer rows than the week: only the last day\'s', array(count($r24[0]), $outg['total'], $outgKeep['total']));

// --- the outage card over a custom day in the past ----------------------------
$dayTok = date('Y-m-d', $schedStarts[0]) . '..' . date('Y-m-d', $schedStarts[0]);
$outWin = penumbra_health_window($dayTok, '7');
$outg = penumbra_outage_history(array('limit' => 25, 'from' => $outWin['from'], 'to' => $outWin['to']), $config);
$hD = render($TMP . DIRECTORY_SEPARATOR . 'r4.php');
$sD = strip_rows($hD); $tD = strip_ticks($hD);
ok(clean($hD) && $outg['from'] === $outWin['from'] && $outg['to'] === $outWin['to'] && !$outg['ends_now'], 'a past day: the history resolves exactly that day', array($outg['from'], $outg['to'], $outg['ends_now']));
ok(strpos($hD, '>' . date('M j', $schedStarts[0]) . '<span class="pnb-range-car"') !== false, 'the heading names the day', substr($hD, 0, 400));
ok(array_keys($sD) === array('Scheduler') && $sD['Scheduler']['cells'] === 96 && $sD['Scheduler']['b'] >= 1, 'the strip shows that day only: the scheduler window, nothing after', $sD);
ok(count($tD) === 5 && $tD[4] === '23:59' && $tD[0] === date('D', $schedStarts[0]) . ' 00:00', 'its axis runs midnight to the last minute, not to now', $tD);
ok($outg['total'] === 1 && $outg['open_in_window'] === 0 && count($outg['open']) === 1, 'one outage that day; today\'s open outage is not in it', array($outg['total'], $outg['open_in_window'], count($outg['open'])));
ok(preg_match('/<span class="pnb-h2-r"><span class="pnb-adm-dot bad"><\/span>1 outage &middot; 0 near misses &middot; coverage 100%<\/span>/', $hD) === 1, 'the heading counts only that day (the dot stays red: the open outage is still shown)', preg_match('/<span class="pnb-h2-r">.*?<\/span><\/span>/', $hD, $mD) ? $mD[0] : null);
ok(strpos($hD, '<strong>www3 delivery</strong> has been down for') !== false, 'but the open outage is still shown above it: a window never hides one');
ok(isset($outg['by_component']['scheduler']) && $outg['by_component']['scheduler']['episodes'] === 1 && $outg['by_component']['scheduler']['downtime'] === 600 && !isset($outg['by_component']['delivery']),
   'availability charges that day\'s window and nothing of the open outage', $outg['by_component']);

// --- the outage card over all time --------------------------------------------
$outWin = penumbra_health_window('all', '7');
$outg = penumbra_outage_history(array('limit' => 25, 'all' => true), $config);
$hA = render($TMP . DIRECTORY_SEPARATOR . 'r4.php');
$L0 = penumbra_outage_ledger_read($config);
ok(clean($hA) && $outg['from'] === (int)$L0['observing_since'] && $outg['ends_now'] && $outg['coverage_pct'] >= 99.9, 'all time starts where the record does, fully covered', array($outg['from'], $L0['observing_since'], $outg['coverage_pct']));
ok(strpos($hA, '>all time<span class="pnb-range-car"') !== false, 'the heading says all time');
$outg = $outgKeep; $outWin = $outWinKeep;

// --- the failures card over 30 days ---------------------------------------------
$failWinKeep = $failWin;
$failWin = penumbra_health_window('30', '24h');
$errs = array('total' => 20, 'window_hours' => 720, 'by_action' => array('SCHEDULED_SEND' => 14, 'EXPORT' => 6));
$fails = array();
for ($i = 0; $i < 12; $i++) { $fails[] = array('ts' => date('Y-m-d H:i', $T - 3600 * ($i + 1)), 'action' => 'SCHEDULED_SEND', 'report' => 'awdspon', 'title' => 'Awards', 'user' => 'scheduler', 'message' => 'timed out'); }
$hF = render($TMP . DIRECTORY_SEPARATOR . 'r3.php');
ok(clean($hF) && strpos($hF, 'data-range="30" data-default="24h"') !== false && strpos($hF, '>last 30d<span class="pnb-range-car"') !== false, '?fail=30: the heading says last 30d', substr($hF, 0, 300));
ok(strpos($hF, 'The 12 newest of 20 are listed; the counts above cover the whole window.') !== false, 'and says the list is the newest 12 of 20');
$failWin = penumbra_health_window('', '24h'); $errs = array('total' => 0, 'window_hours' => 24, 'by_action' => array()); $failNote = 'recent failures lookup failed: ORA-00942';
$hN = render($TMP . DIRECTORY_SEPARATOR . 'r3.php');
ok(strpos($hN, '<span class="pnb-h2-r">recent failures lookup failed: ORA-00942</span>') !== false, 'a lookup error still reads at the heading\'s right');
$errs = $snap['components']['errors']; $fails = array(); $failWin = $failWinKeep; $failNote = '';

// --- the chips keep the snapshot's fixed windows ---------------------------------
$errs = array('total' => 99, 'window_hours' => 720, 'by_action' => array('EXPORT' => 99));
$outg = penumbra_outage_history(array('hours' => 24, 'limit' => 25), $config);
$hTop = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('/<a class="pnb-chip ok"[^>]*>\s*<span class="pnb-chip-v">0<\/span><span class="pnb-chip-l">failures 24h<\/span>/', $hTop) === 1, 'a card on 30 days leaves the failures 24h chip on the snapshot\'s count');
ok(preg_match('/<span class="pnb-chip-v">1 OPEN<\/span><span class="pnb-chip-l">outages 7d · ' . $outNexp . ' total<\/span>/', $hTop) === 1, 'a card on 24 hours leaves the outages 7d chip on the week', $outNexp);
$errs = $snap['components']['errors']; $outg = $outgKeep;

// --- the picker, its script, and the refresh default ------------------------------
$h = $H['r6'];
preg_match_all('/<button type="button" class="pnb-range-opt" data-range="([^"]+)" aria-pressed="false">([^<]+)<\/button>/', $h, $po);
ok($po[1] === array('24h', '7', '30', '90', 'all') && $po[2] === array('Last 24 hours', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'), 'the picker lists the analytics presets, in their order', $po[2]);
$qr = penumbra_quick_ranges(); $allQ = count($qr) === 4;
foreach ($qr as $ql => $qd) { if (strpos($h, 'class="pnb-range-q" data-from="' . $qd[0] . '" data-to="' . $qd[1] . '"') === false || strpos($h, '>' . pnb_h($ql) . '</button>') === false) $allQ = false; }
ok($allQ, 'and the analytics quick spans, dates from the same function', array_keys($qr));
ok(strpos($h, '<input type="date" id="pnbRangeFrom" max="' . date('Y-m-d') . '">') !== false && strpos($h, 'id="pnbRangeApply">Apply</button>') !== false, 'a custom From/To (no later than today) with Apply');
$popAt = strpos($page, 'id="pnbRangePop"'); $gridEnd = strpos($page, '</div><!-- /grid -->'); $leftEnd = strpos($page, '</div><!-- /left -->');
ok($popAt !== false && $popAt > $gridEnd && $popAt > $leftEnd, 'the picker sits outside both live regions, so a refresh cannot swap it away');
ok(strpos($h, "if (token === def) qs.delete(k); else qs.set(k, token);") !== false && strpos($h, "history.replaceState(null, '', addr)") !== false, 'applying writes the card\'s key into the address, dropping it for the default');
ok(strpos($h, "if (!nb || nb.getAttribute('data-range') !== token) { window.location.reload(); return; }") !== false, 'a repaint that did not land reloads at the new address');
ok(strpos($h, "if (rp && !rp.hidden) return 'held while you pick a window';") !== false, 'the page refresh holds while the picker is open');
ok(strpos($h, 'if (busy) { again = true; return pending; }') !== false && strpos($h, 'return pending;') !== false, 'refresh hands back its promise, and a call mid-refresh runs once more after it');
ok(strpos($h, "if (e.key === 'Escape' && !pop.hidden) { e.preventDefault(); e.stopPropagation(); close(true); }") !== false && strpos($h, '}, true);') !== false, 'Escape closes it, captured on window');
ok(strpos($h, "var rp = document.getElementById('pnbRangePop');   // the window picker owns the keys while it is open\n        if (rp && !rp.hidden) return;") !== false, 'single-key shortcuts stand down while it is open');
ok(strpos($page, '<option value="0" selected>off</option>') !== false && strpos($page, 'value="60" selected') === false && strpos($page, '<span id="hubRefreshNext">off</span>') !== false, 'auto-refresh is off by default');
$logsLib = @file_get_contents(dirname($PAGE) . DIRECTORY_SEPARATOR . 'penumbra_logs.php');
ok($logsLib !== false && strpos($logsLib, "\$out['jobs'] = array(") !== false && strpos($logsLib, "'label' => 'Internal jobs',") !== false && strpos($logsLib, "\$out['job_' .") === false && strpos($page, '<strong>Internal jobs</strong> tab') !== false, 'ONE maintenance log tab, "Internal jobs", for every job (no per-job tabs since 2026-10-12), and the Maintenance card\'s tip says so');

section('5d. The tooltips say what the page does now (2026-10-01)');
// The windows, the card order and auto-refresh-off each left a tip behind that
// described the old page. Every one is pinned here, with the old words absent.
ok(strpos($page, "while a card\\'s window picker is open, and while this tab is in the background") !== false && strpos($page, 'once an interval is picked; it starts off') !== false,
   'the pause button names the picker hold and that auto-refresh starts off');
ok(strpos($H['top'], 'Always the last 24 hours, whatever window the Failures card shows.') !== false, 'the failures chip says it keeps 24 hours whatever the card shows');
ok(strpos($H['top'], 'always the last 7 days, whatever window the Outage history card shows') !== false, 'the outages chip says it keeps 7 days whatever the card shows');
ok(strpos($H['r4'], 'The recurring-window pills read the whole record instead') !== false, 'the outage (i) says the pills read the whole record, not the window');
ok(strpos($H['r4'], "across the whole record and not only this card's window") !== false && strpos($H['r4'], 'Each time it falls inside the window you are viewing, it is still listed below.') !== false
   && strpos($page, 'Still listed below every time it happens') === false, 'a recurring-window pill no longer promises every occurrence is listed below');
ok(strpos($H['r6'], 'Auto-refresh is off unless you pick an interval in the header') !== false && strpos($H['r6'], '<b>r</b> re-reads the log') !== false
   && strpos($page, '<b>r</b> refreshes') === false, 'the Logs (i): auto-refresh is opt-in, and r re-reads the log (not the page)');
ok(strpos($H['r6'], 'title="Single-key shortcuts: r re-reads the log, 1 to ') !== false && strpos($page, 'Single-key shortcuts: r refreshes') === false, 'the keys switch says the same');
ok(strpos($H['r6'], "(auto ? ' - refreshes with the page' : ' - click the tab to re-read')") !== false && strpos($H['r6'], "var auto = !!(rs && rs.value !== '0');") !== false,
   'the log status line promises a refresh only while an interval is set');
$helpSrc = @file_get_contents(dirname($PAGE) . DIRECTORY_SEPARATOR . 'help_content.php');
if ($helpSrc === false) {
    echo "  (skipped: help_content.php is not beside health.php)\n";
} else {
    ok(strpos($helpSrc, 'failures in the last 24 hours with the last twelve listed') === false && strpos($helpSrc, '<kbd>1</kbd>-<kbd>4</kbd> switch logs') === false
       && strpos($helpSrc, 'the Health page\'s r and 1 to 4') === false, 'the help page no longer describes the old hub (24h failures only, four logs, a per-log auto-refresh)');
    ok(strpos($helpSrc, 'Each of those two cards reads the window named in its heading') !== false && strpos($helpSrc, 'it starts off.') !== false
       && strpos($helpSrc, 'internal-jobs logs') !== false, 'and describes the windows, auto-refresh off and the six logs');
}

section('6. Runtime card');
$h = $H['r5'];
ok(strpos($h, 'id="pnbRuntime"') !== false && strpos($h, 'pnb-kv pnb-kv-2') !== false, 'runtime as a two-column key/value list');
ok(strpos($h, '<span class="pnb-warn">security support ends 2026-12-31</span>') !== false, 'PHP end of support inline');
ok(substr_count($h, '<span class="k">Disk ') === 2, 'both disks');
ok(preg_match('/<h2><button type="button" class="pnb-fold" aria-expanded="false"[^>]*>Runtime<\/button> <span class="pnb-i"[^>]*><span class="pnb-i-tip"[^>]*>.*?IIS APPPOOL\\\\penumbra.*?<\/span><\/span><span class="pnb-sum">.*?<\/span><\/h2>/s', $h) === 1, 'the (i) names the web account; the summary follows it');
ok(strpos($h, '<span class="pnb-ext ok">oci8</span>') !== false && strpos($h, 'pdo_oci</span>') === false, 'extensions as pills, no pdo_oci');

section('7. Log viewer');
$h = $H['r6'];
ok(preg_match_all('/<button type="button" class="pnb-log-tab[^"]*"\s+data-log="/', $h) === 5 && strpos($h, 'role="tablist"') !== false, 'five file tabs', preg_match_all('/<button type="button" class="pnb-log-tab[^"]*"\s+data-log="/', $h));
ok(preg_match('/<button type="button" class="pnb-log-tab on"\s+data-log="php"[^>]*aria-selected="true"/', $h) === 1, 'the first is selected');
ok(preg_match('/class="pnb-log-tab off"\s+data-log="httperr"[^>]*aria-disabled="true"[^>]*title="C:\\\\Windows\\\\System32\\\\LogFiles\\\\HTTPERR is not readable[^"]*">HTTP errors<span class="sr-only"> \(unreadable\)<\/span>/', $h) === 1, 'an unreadable source is dimmed, disabled, and says why');
ok(strpos($h, '<div class="pnb-log-pane">') !== false, 'the tabs attach to a pane');
ok(substr_count($h, '<label class="pnb-tg"') === 3 && substr_count($h, '<i class="sw" aria-hidden="true"></i>') === 3, 'three switches: problems only, newest first, wrap');
ok(strpos($h, 'id="logCtxWrap" hidden') !== false, 'context control hidden until a filter is typed');
ok(strpos($h, 'id="logAuto"') === false && strpos($h, 'function schedule(') === false && strpos($h, 'penumbra_health_auto') === false, 'the per-log auto-refresh is gone');
ok(preg_match('/<select id="logLines" hidden aria-hidden="true" tabindex="-1">/', $h) === 1, 'line count select kept hidden as the state holder');
ok(preg_match('/<span class="pnb-log-lines" id="logLinesLinks">show <a href="#" data-lines="300">300<\/a> &middot; <a href="#" data-lines="5000" title="[^"]*">all<\/a><\/span>/', $h) === 1, 'the count is two links in the status line: 300 or all (2026-10-14)');
ok(preg_match('/<select id="logDay" aria-label="Day to show" hidden><\/select>/', $h) === 1, 'day picker sits inline in the status line');
ok(preg_match('/<button type="button" class="pnb-link-btn" id="logKeys" aria-pressed="true"/', $h) === 1, 'keys switch is a link-button');
ok(strpos($h, '<h2>Logs <span class="pnb-i"') !== false && strpos($h, '<b>5</b> pick a tab') !== false, 'the viewer (i) counts the tabs');
// the scripts
ok(strpos($h, 'window.pnbLog = {') !== false && strpos($h, 'jump: function (key, q)') !== false, 'log console exposes load + jump');
ok(strpos($h, "getElementById('hubRefreshSel')") !== false && strpos($h, "'penumbra_health_refresh'") !== false && strpos($h, "['pnbHubTop', 'pnbHubLeft']") !== false, 'page refresher swaps the two live regions');
ok(strpos($h, "qs.delete('full')") !== false, 'and never turns a timer into a live probe');
ok(strpos($h, "closest('.pnb-out-copy')") !== false && strpos($h, "closest('.pnb-bell')") !== false && strpos($h, "closest('.pnb-log-jump')") !== false, 'card actions are delegated on document');
ok(strpos($h, "fd.set('action', 'mute')") !== false && strpos($h, "method: 'POST'") !== false, 'the bell POSTs the mute');
ok(strpos($h, "setProperty('--pnb-stick-h'") !== false && strpos($h, "getElementById('pnbNoticeBar')") !== false, 'the sticky offset follows the header stack and the notice bar');
ok(strpos($h, "window.penumbraSingleKeysOff") !== false, 'single-key shortcuts still honour the app-wide off switch');

section('8. The page as a whole');
ok(strpos($page, 'function pnb_info(') !== false, 'pnb_info helper present');
ok(preg_match('/penumbra_admin_open\(\'System Health\', \'checked \' \. \$snap\[\'checked_at\'\], \'health\', true, \'wide\', \$pnbRefreshCtl\);/', $page) === 1, 'the refresh control rides into the chrome as the 6th argument');
ok(strpos($page, 'id="pnbHubTop"') !== false && strpos($page, 'id="pnbHubLeft"') !== false, 'both live regions have ids');
ok(strpos($page, "\$_POST['action'] === 'mute'") !== false && strpos($page, 'penumbra_mute_set(') !== false, 'mute POST action present');
ok(substr_count($page, 'pnb_info(') >= 10, 'ten or more footnotes became (i) tips', substr_count($page, 'pnb_info('));
ok(strpos($page, 'id="logAuto"') === false, 'no per-log auto-refresh anywhere');
ok(strpos($page, "\r\n") === false, 'line endings stayed LF');
// The left column's order (the user's call, 2026-10-01): outage history right
// under databases & mail, failures under it, then everything else as before.
ok($LEFT_ORDER === array('r1a', 'r4', 'r3', 'r1b', 'r2', 'r5'),
   'left column: scheduler + databases & mail, OUTAGE HISTORY, FAILURES, then directory + maintenance, delivery, runtime', $LEFT_ORDER);
preg_match_all('/<div class="pnb-adm-card[^"]*" id="(pnb[A-Za-z]+)"/', $LEFT['r1a'], $cardIds);
ok($cardIds[1] === array('pnbCardSched', 'pnbCardDbs'), 'and nothing sits between the databases card and outage history', $cardIds[1]);

section('8b. Declutter (2026-10-14): chips that navigate, cards that fold, lists that show more');
$h = $H['top'];
preg_match_all('/<a class="pnb-chip[^"]*" href="#(pnb[A-Za-z]+)"/', $h, $cm);
ok($cm[1] === array('pnbCardSched', 'pnbCardDbs', 'pnbOutages', 'pnbFailures', 'pnbCardMaint', 'pnbCardMaint', 'pnbDelivery', 'pnbLog', 'pnbRuntime'),
   'nine chips, each a link to its card, in the cards\' order (tasks, overdue, mail, queries and the disk folded into theirs; the directory chip leads to Maintenance since the evening)', $cm[1]);
ok(preg_match('/<div class="pnb-chip[ "]/', $h) === 0 && strpos($h, '>mail (mta)</span>') === false && strpos($h, '>tasks armed</span>') === false
   && strpos($h, '>overdue</span>') === false && strpos($h, '>queries running</span>') === false && strpos($h, '>log disk free</span>') === false, 'the five folded chips are gone');
ok(preg_match('/<a class="pnb-chip ok" href="#pnbCardSched" data-card="pnbCardSched" title="[^"]*41 active task\(s\), 7 disabled[^"]*"><span class="pnb-chip-v">ONLINE<\/span><span class="pnb-chip-l">scheduler · 41 armed · 0 overdue<\/span>/', $h) === 1, 'scheduler chip: ONLINE, the tasks in its label and tip', $h);
ok(preg_match('/<a class="pnb-chip warn" href="#pnbCardDbs" data-card="pnbCardDbs"[^>]*><span class="pnb-chip-v">4\/5<\/span><span class="pnb-chip-l">databases · mail up<\/span>/', $h) === 1, 'databases chip: 4/5 in amber for the degraded INFOED, the relay in its label', $h);
ok(preg_match('/<a class="pnb-chip ok" href="#pnbCardMaint" data-card="pnbCardMaint"[^>]*><span class="pnb-chip-v">1\/1<\/span><span class="pnb-chip-l">jobs<\/span>/', $h) === 1, 'the maintenance card has a chip: jobs ok over jobs registered', $h);
ok(preg_match('/<a class="pnb-chip warn" href="#pnbLog" data-card="pnbLog" data-log="php"[^>]*><span class="pnb-chip-v">3<\/span><span class="pnb-chip-l">php errors 60m<\/span>/', $h) === 1, 'the PHP errors chip leads to the log viewer\'s PHP tab', $h);
ok(preg_match('/<a class="pnb-chip ok" href="#pnbRuntime" data-card="pnbRuntime"[^>]*><span class="pnb-chip-v">61%<\/span><span class="pnb-chip-l">log disk free · 0 queries<\/span>/', $h) === 1, 'runtime chip: the log disk as the value, the queries in the label', $h);
// the worst fact is the value
$keep3 = $snap; $tasksKeep = $tasks; $dbsKeep = $dbs; $rtKeep = $rt;
$tasks['overdue'] = 2;
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('/<a class="pnb-chip bad" href="#pnbCardSched"[^>]*><span class="pnb-chip-v">2 OVERDUE<\/span><span class="pnb-chip-l">scheduler · online · 41 armed<\/span>/', $h) === 1, 'two overdue tasks: "2 OVERDUE" is the value, in red, and online moves to the label', $h);
$tasks = $tasksKeep;
$dbs['hr']['status'] = 'down'; $dbOk = 3; $dbBad = 1;
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('/<a class="pnb-chip bad" href="#pnbCardDbs"[^>]*><span class="pnb-chip-v">HR DOWN<\/span><span class="pnb-chip-l">databases 3\/5 · mail up<\/span>/', $h) === 1, 'HR down: "HR DOWN" is the value, the count moves to the label', $h);
$dbs = $dbsKeep; $dbOk = 4; $dbBad = 0;
$snap['components']['smtp']['status'] = 'down'; $snap['components']['smtp']['detail'] = 'connection refused';
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('/<a class="pnb-chip bad" href="#pnbCardDbs"[^>]*title="[^"]*connection refused[^"]*"><span class="pnb-chip-v">MAIL DOWN<\/span>/', $h) === 1, 'the relay down: "MAIL DOWN" is the value, the detail in the tip', $h);
$snap = $keep3;
$rt['inflight']['stale'] = 2;
$h = render($TMP . DIRECTORY_SEPARATOR . 'top.php');
ok(preg_match('/<a class="pnb-chip warn" href="#pnbRuntime"[^>]*><span class="pnb-chip-v">2 STALE<\/span><span class="pnb-chip-l">queries · log disk 61%<\/span>/', $h) === 1, 'stale query slots: "2 STALE" is the value, the disk moves to the label', $h);
$rt = $rtKeep;
// cards fold, and open themselves with something to report
$h = $H['r1'];
ok(strpos($h, '<div class="pnb-adm-card pnb-foldable" id="pnbCardSched" data-open="0">') !== false, 'the scheduler card, online with nothing overdue, starts folded and is not forced');
ok(strpos($h, '<span class="pnb-sum">heartbeat 42s ago &middot; 41 armed, 7 disabled &middot; next due in 4m</span>') !== false, 'its summary: heartbeat age, tasks, next due', $h);
ok(strpos($h, '<div class="pnb-adm-card pnb-foldable" id="pnbCardDbs" data-open="1" data-force="1">') !== false, 'the databases card opens itself for the degraded INFOED');
ok(strpos($h, '<span class="pnb-sum"><span class="pnb-warn">INFOED degraded</span> &middot; 4 of 5 ok &middot; mail up</span>') !== false, 'its summary names the degraded database and the relay', $h);
ok(strpos($h, '<div class="pnb-adm-card pnb-foldable" id="pnbCardMaint" data-open="0">') !== false && preg_match('/<span class="pnb-sum">directory refreshed 17h ago &middot; people_sync ok in 17\.2 s \(\d\d:\d\d\)<\/span>/', $h) === 1, 'the maintenance card: folded, the directory and the job\'s last result in its summary', $h);
ok(strpos($H['r2'], '<div class="pnb-adm-card pnb-foldable" id="pnbDelivery" data-open="1" data-force="1">') !== false && strpos($H['r2'], '<span class="pnb-sum">1 delivered &middot; 4 stalled &middot; 1 cut off in the last 15 min</span>') !== false, 'the delivery card opens itself when down, summarised', $H['r2']);
ok(strpos($H['r5'], '<div class="pnb-adm-card pnb-foldable" id="pnbRuntime" data-open="0">') !== false && strpos($H['r5'], '<span class="pnb-sum">PHP 8.2.29 &middot; opcache on &middot; 0 running, 0 stale &middot; D:\ 61% free &middot; C:\ 25% free &middot; <span class="pnb-warn">support ends 2026-12-31</span></span>') !== false, 'the runtime card: folded, summarised', $H['r5']);
ok(strpos($H['r4'], '<div class="pnb-adm-card pnb-foldable" id="pnbOutages" data-open="1" data-force="1">') !== false && preg_match('/<span class="pnb-sum"><strong class="pnb-bad">1 open<\/strong> &middot; <span class="pnb-warn">1 near miss in progress<\/span> &middot; [A-Za-z0-9 ]+ [0-9.]+%, [0-9hm ]+ down/', $H['r4']) === 1, 'the outage card opens by default and is forced by the open outage; its summary leads with what is open', $H['r4']);
ok(strpos($H['r3b'], '<div class="pnb-adm-card pnb-foldable" id="pnbFailures" data-open="1" data-force="1">') !== false && strpos($H['r3b'], '<span class="pnb-sum">3 in the window: 1 SCHEDULED_SEND, 1 EXPORT, 1 SCHEDULE_FAIL</span>') !== false, 'a failures card with rows opens itself, summarised by action', $H['r3b']);
ok(strpos($H['r3'], 'pnb-foldable') === false && strpos($H['r3'], 'pnb-fold"') === false, 'the empty failures card keeps its one-line fold and gets no toggle');
$keep4 = $snap; $snap['components']['maintenance'] = array();
$hM = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($hM, '<div class="pnb-adm-card pnb-foldable" id="pnbCardMaint" data-open="0">') !== false && strpos($hM, 'No maintenance jobs are registered') !== false && strpos($hM, '<span class="pnb-sum">directory refreshed 17h ago</span>') !== false, 'with no jobs the maintenance card still folds, carrying the directory line (2026-10-14 evening)', $hM);
$snap = $keep4;
// the outage card: availability as a line, the known windows folded, three episodes then show more
$h = $H['r4'];
ok(strpos($h, '<div class="pnb-out-avline">') !== false && strpos($h, 'pnb-out-summary') === false && strpos($h, 'pnb-out-bar') === false, 'availability is one line; the bars are gone');
ok(preg_match('/<div class="pnb-out-kw" data-key="kw">\s*<div class="pnb-out-kwline pnb-adm-muted"><b>1 known window<\/b> &middot; 1 muted &middot; Scheduler\s*<button type="button" class="pnb-link-btn pnb-kw-btn" aria-expanded="false" data-show="show them" data-hide="hide them"/', $h) === 1, 'the known windows fold to one line: count, muted count, components, show them', $h);
ok(preg_match('/<div class="pnb-out-kw"[^>]*>.*?<div class="pnb-out-pat">\s*<span class="pnb-out-patpill"/s', $h) === 1, 'with the pills, bells and all, inside the fold');
ok(substr_count($h, '<div class="pnb-rows-more">') === 1 && preg_match('/<div class="pnb-rows pnb-rows-out">\s*(<div class="pnb-row[^>]*>.*?<\/div>\s*){3}<div class="pnb-rows-more">/s', $h) === 1, 'three episodes listed, the other two behind the fold', $h);
ok(preg_match('/<div class="pnb-more-line pnb-adm-muted" data-key="out"><button type="button" class="pnb-link-btn pnb-more-btn" aria-expanded="false"\s+data-more="show 2 more" data-less="show fewer"\s+data-some="3 of 5 listed" data-all="5 of 5 listed">show 2 more<\/button> &middot; <span class="pnb-more-n">3 of 5 listed<\/span>, near misses included &middot; the full record is the <strong>Watchdog<\/strong> log tab<\/div>/', $h) === 1, 'the count line: show 2 more, 3 of 5 listed, where the rest is', $h);
ok(strpos($h, 'older in this window not listed') === false, 'the old "older not listed" note is gone');
ok(strpos($h, 'the strip, the availability line and the list all follow it') !== false && strpos($h, 'the tiles and the list') === false, 'the outage (i) names the availability line, not the tiles');
ok(strpos($hD, 'pnb-rows-more') === false && strpos($hD, '<span class="pnb-more-n">1 of 1 listed</span>') !== false && strpos($hD, 'pnb-more-btn') === false, 'one episode in the window: no fold, "1 of 1 listed"', $hD);
// the maintenance runs: three, then show more
ok(strpos($H['r1'], 'pnb-rows-more') === false && strpos($H['r1'], 'pnb-more-line') === false, 'three runs: no fold');
$keep5 = $snap;
$snap['components']['maintenance_runs']['rows'][] = array('id' => 879, 'ts' => date('m-d H:i', $T - 233940), 'user' => 'SCHEDULER', 'job' => 'people_sync', 'action' => 'PEOPLE_SYNC', 'kind' => 'ok', 'message' => 'people_sync: 71,850 staged', 'stats' => array('staged' => 71850));
$snap['components']['maintenance_runs']['rows'][] = array('id' => 878, 'ts' => date('m-d H:i', $T - 320340), 'user' => 'SCHEDULER', 'job' => 'people_sync', 'action' => 'PEOPLE_SYNC', 'kind' => 'ok', 'message' => 'people_sync: 71,840 staged', 'stats' => array('staged' => 71840));
$hR = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(clean($hR) && substr_count($hR, '<div class="pnb-rows-more">') === 1 && substr_count($hR, '<span class="c ">OK</span>') === 4
   && preg_match('/<div class="pnb-more-line pnb-adm-muted" data-key="runs"><button type="button" class="pnb-link-btn pnb-more-btn" aria-expanded="false"\s+data-more="show 2 more runs" data-less="show fewer"\s+data-some="3 of 5" data-all="all 5">show 2 more runs<\/button> &middot; <span class="pnb-more-n">3 of 5<\/span> in the last 30 days/', $hR) === 1,
   'five runs: three listed, two behind "show 2 more runs"', $hR);
$snap = $keep5;
// the log tab badge, the scripts, the stylesheet and the help
$h = $H['r6'];
ok(preg_match('/data-log="php"[^>]*>PHP errors<span class="pnb-log-n" title="3 PHP error line\(s\) in the last hour">3<\/span><\/button>/', $h) === 1, 'the PHP errors tab carries the hour\'s count as a badge', $h);
ok(strpos($h, 'badge: badge,') !== false && strpos($h, "if (rows[pi].s === 'err' || rows[pi].s === 'warn') nProb++;") !== false, 'the console counts the problem lines it loads onto the open tab');
ok(strpos($h, 'window.pnbFolds = { apply: apply, jump: jump };') !== false && strpos($h, "var PREF = 'penumbra_health_folds';") !== false && strpos($h, "closest('.pnb-chip[data-card], .pnb-warn-link[data-card]')") !== false
   && strpos($h, "if (card.getAttribute('data-force') === '1') open = true;") !== false && strpos($h, "if (window.pnbFolds) window.pnbFolds.apply();") !== false,
   'the fold script: remembered folds, forced cards, chip and warning jumps, re-applied after the refresh swap');
ok(strpos($h, "history.replaceState(null, '', window.location.pathname + window.location.search + '#' + id)") !== false && strpos($h, "/^pnb[A-Za-z]+$/.test(hashId)") !== false, 'a jump writes the card\'s anchor into the address, and an address with one opens that card');
$cssSrc = @file_get_contents(dirname($PAGE) . DIRECTORY_SEPARATOR . 'css' . DIRECTORY_SEPARATOR . 'main.css');
if ($cssSrc === false) {
    echo "  (skipped: css/main.css is not beside health.php)\n";
} else {
    ok(strpos($cssSrc, '.pnb-foldable[data-open="0"] > :not(h2) { display: none; }') !== false && strpos($cssSrc, '.pnb-rows-more:not(.on) { display: none; }') !== false
       && strpos($cssSrc, '.pnb-out-kw .pnb-out-pat:not(.on) { display: none; }') !== false && strpos($cssSrc, 'a.pnb-chip { text-decoration: none;') !== false,
       'the stylesheet folds a closed card, hides the folded rows and pills, and dresses the chips as links');
}
if ($helpSrc !== false) {
    ok(strpos($helpSrc, 'Every chip is a link to its card') !== false && strpos($helpSrc, 'the folds you choose are remembered in your browser') !== false && strpos($helpSrc, 'the three newest with a <em>show more</em>') !== false,
       'the help page describes the chips, the folds and the show-more');
}
// Evening follow-up (2026-10-14): a dot and a word end every heading, the
// databases probe line moved into the body, the maintenance rows wrap, the
// viewer defaults to 2 lines of context, offers 300 or all, and last 14 days.
ok(strpos($H['r1'], '<span class="pnb-h2-r"><span class="pnb-adm-dot warn"></span>DEGRADED</span></h2>') !== false
   && preg_match('#>Databases &amp; mail</button>.*?</h2>\s*<div class="pnb-hub-fine pnb-adm-muted" style="margin: 0 0 8px;">probed [^<]*\(cached\) &middot; <a href="\?full=1"#s', $H['r1']) === 1,
   'databases: an amber dot and DEGRADED end the heading; the probe age and re-probe link sit first in the body', $H['r1']);
ok(preg_match('#<span class="pnb-h2-r"><span class="pnb-adm-dot bad"></span>5 outages &middot; 2 near misses &middot; coverage #', $H['r4']) === 1, 'outage history: a red dot for the open outage before its counts', $H['r4']);
ok(strpos($H['r3b'], '<span class="pnb-h2-r"><span class="pnb-adm-dot warn"></span>3 FAILURES</span></h2>') !== false, 'failures with rows: an amber dot and the count', $H['r3b']);
ok(strpos($H['r3'], '<span class="pnb-h2-r"><span class="pnb-adm-dot ok"></span>NONE</span></h2>') !== false, 'the empty failures card: a green dot and NONE', $H['r3']);
ok(substr_count($H['r1'], '<span class="pnb-adm-dot ok"></span>OK</span></h2>') === 1 && strpos($H['r1'], '<span class="pnb-adm-dot ok"></span>ONLINE</span></h2>') !== false, 'maintenance: a green dot and OK; the scheduler keeps ONLINE', $H['r1']);
ok(strpos($H['r5'], '<span class="pnb-h2-r"><span class="pnb-adm-dot ok"></span>OK</span></h2>') !== false && strpos($H['r2'], '<span class="pnb-h2-r"><span class="pnb-adm-dot bad"></span>DOWN</span></h2>') !== false, 'runtime: a green dot and OK; delivery keeps its red DOWN', $H['r5']);
$keep6 = $snap;
$snap['components']['maintenance']['people_sync']['result'] = array('finished' => date('Y-m-d H:i:s', $T - 61140), 'exit' => 1, 'secs' => 3, 'error' => null, 'reason' => 'scheduled 05:30', 'label' => 'failed in 3 s');
$hF2 = render($TMP . DIRECTORY_SEPARATOR . 'r1.php');
ok(strpos($hF2, '<span class="pnb-h2-r"><span class="pnb-adm-dot bad"></span>FAILED</span></h2>') !== false, 'a failed job: a red dot and FAILED', $hF2);
$snap = $keep6;
$rtKeep2 = $rt; $rt['disks']['web']['pct_free'] = 8;
$hR2 = render($TMP . DIRECTORY_SEPARATOR . 'r5.php');
ok(strpos($hR2, '<span class="pnb-h2-r"><span class="pnb-adm-dot bad"></span>CHECK</span></h2>') !== false && strpos($hR2, 'id="pnbRuntime" data-open="1" data-force="1"') !== false, 'a disk under 10%: a red dot, CHECK, and the card opens itself', $hR2);
$rt = $rtKeep2;
$h = $H['r6'];
ok(strpos($h, '<input type="number" id="logCtx" value="2"') !== false, 'context defaults to 2 lines either side (was 5)');
ok(preg_match('/<select id="logLines" hidden aria-hidden="true" tabindex="-1">\s*<option value="300" selected>300 lines<\/option>\s*<option value="5000">all \(up to 5,000 lines\)<\/option>\s*<\/select>/', $h) === 1, 'the hidden count holder offers 300 and all', $h);
ok(strpos($h, "if (def < 14) html.push('<option value=\"span:14\">day: last 14</option>');") !== false && strpos($h, "(dayVal ? '&day=' + encodeURIComponent(dayVal) : (spanPref ? '&span=' + spanPref : ''))") !== false && strpos($h, "pref('span', String(spanPref));") !== false,
   'the day list offers last 14, sent as span, remembered per browser');
ok(strpos($h, "if ((p = pref('lines')) && lines.querySelector('option[value=\"' + p + '\"]')) { lines.value = p; }") !== false, 'a remembered count the list no longer offers is ignored');
ok(strpos($page, "'span'        => isset(\$_GET['span']) ? (int)\$_GET['span'] : 0,") !== false, 'the tail action passes span through');
if ($cssSrc !== false) {
    ok(strpos($cssSrc, '.pnb-rows-jobs .pnb-row, .pnb-rows-runs .pnb-row { white-space: normal; align-items: start; }') !== false, 'the maintenance rows wrap instead of clipping');
}
$logsLib2 = @file_get_contents(dirname($PAGE) . DIRECTORY_SEPARATOR . 'penumbra_logs.php');
ok($logsLib2 !== false && strpos($logsLib2, "define('PENUMBRA_LOG_CTX_DEFAULT', 2)") !== false && strpos($logsLib2, "'span_default' =>") !== false, 'the log library defaults context to 2 and reports the span in force');

section('9. The mute handler, for real');
$mute = cut($page, '// --- known-window mute toggle (admin only, POST)', '// --- one-time metrics column provisioning', 'mute handler');
ok(substr_count($mute, 'exit;') === 3, 'handler exits on refusal, bad input and success');
// exit -> return so the handler can be included repeatedly; header() and
// http_response_code() -> shims, because this process has already written
// its results to stdout and PHP would refuse the real ones.
$muteHarness = str_replace(array('exit;', 'header(', 'http_response_code('), array('return;', 'pnb_test_header(', 'pnb_test_code('), $mute);
ok(substr_count($muteHarness, 'pnb_test_code(') === 2 && substr_count($muteHarness, 'pnb_test_header(') === 1, 'handler sets a status code on both refusals');
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'mute.php', "<?php\n" . $muteHarness);
$TEST_CODE = 200;
function pnb_test_header($h) { }
function pnb_test_code($c = null) { global $TEST_CODE; if ($c !== null) $TEST_CODE = (int)$c; return $TEST_CODE; }
function run_mute($post, $admin) {
    global $config, $TMP, $TEST_CODE;
    $_POST = $post; $isAdmin = $admin; $currentUserKey = 'tester'; $TEST_CODE = 200;
    ob_start(); include $TMP . DIRECTORY_SEPARATOR . 'mute.php'; $out = ob_get_clean();
    return array($TEST_CODE, json_decode($out, true), $out);
}
list($code, $j) = run_mute(array('action' => 'mute', 'key' => 'db:hr', 'slot' => '10', 'on' => '1', 'label' => 'HR ~05:00 daily'), true);
ok($code === 200 && !empty($j['ok']) && $j['muted'] === true, 'admin mutes db:hr slot 10', array($code, $j));
ok(penumbra_mute_has(penumbra_mutes_read($config), 'db:hr', 10), 'and the mute file has it');
ok(penumbra_mute_has(penumbra_mutes_read($config), 'scheduler', $slot), 'without losing the scheduler mute');
list($code, $j) = run_mute(array('action' => 'mute', 'key' => 'db:hr', 'slot' => '10', 'on' => '0'), true);
ok($code === 200 && !empty($j['ok']) && $j['muted'] === false && !penumbra_mute_has(penumbra_mutes_read($config), 'db:hr', 10), 'unmute removes it');
list($code, $j) = run_mute(array('action' => 'mute', 'key' => 'db:hr', 'slot' => '99', 'on' => '1'), true);
ok($code === 400 && isset($j['error']), 'slot 99 is refused', array($code, $j));
list($code, $j) = run_mute(array('action' => 'mute', 'key' => '', 'slot' => '3', 'on' => '1'), true);
ok($code === 400 && isset($j['error']), 'an empty key is refused');
list($code, $j) = run_mute(array('action' => 'mute', 'key' => 'db:hr', 'slot' => '10', 'on' => '1'), false);
ok($code === 403 && isset($j['error']) && !penumbra_mute_has(penumbra_mutes_read($config), 'db:hr', 10), 'a non-admin is refused and nothing is written');
list($code, $j) = run_mute(array('action' => 'mute', 'key' => 'db:hr<script>', 'slot' => '11', 'on' => '1'), true);
ok($code === 200 && penumbra_mute_has(penumbra_mutes_read($config), 'db:hrscript', 11) && !penumbra_mute_has(penumbra_mutes_read($config), 'db:hr<script>', 11), 'key is reduced to its safe characters');

section('10. The job handler, for real (2026-09-23)');
$jobH = cut($page, '// --- maintenance job control (admin only, POST)', '// --- known-window mute toggle (admin only, POST)', 'job handler');
ok(substr_count($jobH, 'exit;') === 5, 'handler exits on refusal (403), two bad inputs (400), a write failure (500) and success');
$jobHarness = str_replace(array('exit;', 'header(', 'http_response_code('), array('return;', 'pnb_test_header(', 'pnb_test_code('), $jobH);
file_put_contents($TMP . DIRECTORY_SEPARATOR . 'job.php', "<?php\n" . $jobHarness);
$maintLib = dirname($PAGE) . DIRECTORY_SEPARATOR . 'penumbra_maintenance.php';
if (!is_file($maintLib)) {
    echo "  (skipped: penumbra_maintenance.php is not beside health.php)\n";
} else {
    require_once $maintLib;
    if (!function_exists('logPenumbraAudit')) { function logPenumbraAudit($rid, $action, $b, $a, $msg = null, $x = null) { $GLOBALS['pnb_audits'][] = array($action, $msg); return 1; } }
    $config['maintenance_state_dir'] = $TMP;
    $config['maintenance'] = array('people_sync' => '05:30');
    $GLOBALS['pnb_audits'] = array();
    function run_job($post, $admin) {
        global $config, $TMP, $TEST_CODE;
        $_POST = $post; $isAdmin = $admin; $currentUserKey = 'tester'; $TEST_CODE = 200;
        ob_start(); include $TMP . DIRECTORY_SEPARATOR . 'job.php'; $out = ob_get_clean();
        return array($TEST_CODE, json_decode($out, true), $out);
    }
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'people_sync', 'do' => 'request'), true);
    ok($code === 200 && !empty($j['ok']) && $j['did'] === 'request' && !empty($j['state']['requested']) && $j['state']['next'] === 'next_cycle', 'admin requests a run: ok, requested, next cycle', array($code, $j));
    ok(trim((string)@file_get_contents($TMP . DIRECTORY_SEPARATOR . 'maint_people_sync.request')) === 'on', 'the request control file says on');
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'people_sync', 'do' => 'cancel_request'), true);
    ok($code === 200 && empty($j['state']['requested']) && trim((string)@file_get_contents($TMP . DIRECTORY_SEPARATOR . 'maint_people_sync.request')) === 'off', 'withdrawn: the file says off (the web worker cannot delete it)');
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'people_sync', 'do' => 'pause'), true);
    ok($code === 200 && !empty($j['state']['paused']) && $j['state']['next'] === 'paused', 'paused', array($code, $j));
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'people_sync', 'do' => 'resume'), true);
    ok($code === 200 && empty($j['state']['paused']), 'resumed');
    ok(count($GLOBALS['pnb_audits']) === 4 && $GLOBALS['pnb_audits'][0][0] === 'MAINT_JOB_REQUEST' && $GLOBALS['pnb_audits'][3][0] === 'MAINT_JOB_RESUME', 'each write is audited under its own action', $GLOBALS['pnb_audits']);
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'rm_rf', 'do' => 'request'), true);
    ok($code === 400 && isset($j['error']), 'an unregistered job is refused');
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'people_sync', 'do' => 'launch'), true);
    ok($code === 400 && isset($j['error']), 'an unknown action is refused');
    list($code, $j) = run_job(array('action' => 'job', 'job' => 'people_sync', 'do' => 'pause'), false);
    ok($code === 403 && isset($j['error']) && count($GLOBALS['pnb_audits']) === 4, 'a non-admin is refused and nothing is written or audited');
}
section('11. WCAG serious fixes (2026-10-15)');
// 11a. Focus survives the page refresh's swap (2.4.3).
$h = $H['r6'];
$iFk = strpos($h, 'var fk = focusKey(document.activeElement);');
$iSw = strpos($h, "['pnbHubTop', 'pnbHubLeft'].forEach(function (id) {");
$iAp = strpos($h, 'if (window.pnbFolds) window.pnbFolds.apply();');
$iFb = preg_match('/\n[ \t]*focusBack\(fk\);/', $h, $fbm, PREG_OFFSET_CAPTURE) ? $fbm[0][1] : false;   // a live call: alone on its line, not commented out
ok($iFk !== false && $iSw !== false && $iAp !== false && $iFb !== false && $iFk < $iSw && $iSw < $iAp && $iAp < $iFb,
   'the refresh notes the focused control BEFORE the swap and focuses its replacement after the folds are re-applied');
ok(strpos($h, "if (a && swapRegion(a) && kbdFocus(a)) return 'held while a card control has focus';") !== false
   && strpos($h, "var SWAP = ['pnbHubTop', 'pnbHubLeft'];") !== false,
   'auto-refresh holds while a control in the swapped regions has keyboard focus');
ok(preg_match("/var KEY_ATTRS = \[[^\]]*'data-job'[^\]]*\];/", $h) === 1 && preg_match("/var KEY_ATTRS = \[[^\]]*data-job-act/", $h) === 0
   && strpos($h, "t = scope.querySelector('h2 .pnb-fold');") !== false,
   'the focus key names a job by its job, not its action (Run now becomes Withdraw), and falls back to the card\'s fold button');
$cardActs = cut($h, '/* CARD ACTIONS (2026-09-12)', '/* FOLDS, JUMPS AND SHOW-MORE', 'card actions script');
ok(preg_match('/\.disabled\s*=\s*true/', $cardActs) === 0 && strpos($cardActs, "function busy(btn, on) { if (on) btn.setAttribute('aria-disabled', 'true');") !== false
   && substr_count($cardActs, 'if (isBusy(') === 3,
   'Copy, the job buttons and the bell go busy with aria-disabled (focus stays), never disabled, and a busy one ignores clicks');
// 11b. The pause button's name is fixed; aria-pressed carries the state (4.1.2).
ok(preg_match('/<button type="button" id="hubRefreshPause" class="pnb-hub-refresh-p" aria-pressed="false" aria-label="Pause auto-refresh" [^>]*><span aria-hidden="true">&#10074;&#10074;<\/span><\/button>/', $page) === 1,
   'the pause button is named "Pause auto-refresh" and its glyph is hidden from AT');
ok(strpos($h, "pauseBtn.innerHTML = '<span aria-hidden=\"true\">' + (paused ? '&#9654;' : '&#10074;&#10074;') + '</span>';") !== false
   && strpos($h, "pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');") !== false,
   'pressing it swaps only the hidden glyph and aria-pressed');
// 11c. A chip or a "Worth a look" line moves focus to the card it opens (2.4.3).
$jumpFn = cut($h, '    function jump(id, log) {', '    document.addEventListener(\'click\', function (e) {' . "\n" . '        if (!e.target.closest) return;', 'jump()');
$iScr = strpos($jumpFn, 'card.scrollIntoView(');
$iFoc = strpos($jumpFn, 'ft.focus({ preventScroll: true });');
ok($iScr !== false && $iFoc !== false && $iScr < $iFoc && strpos($jumpFn, "var ft = card.querySelector('h2 .pnb-fold') || card.querySelector('h2');") !== false,
   'jump() focuses the card\'s fold button (else its heading) with preventScroll, after the scroll');
// 11d. A missing extension says so in words, on the pill and in the summary (1.4.1).
$rtKeep3 = $rt;
$rt['extensions']['gd'] = false; $rt['pdo_oci_present'] = true;
$hX = render($TMP . DIRECTORY_SEPARATOR . 'r5.php');
$rt = $rtKeep3;
ok(clean($hX) && strpos($hX, '<span class="pnb-ext bad">gd missing</span>') !== false && strpos($hX, '>pdo_oci loaded, must be off</span>') !== false
   && strpos($hX, '<span class="pnb-ext ok">oci8</span>') !== false, 'a missing extension\'s pill says "missing"; pdo_oci says it is loaded', $hX);
ok(strpos($hX, '<span class="pnb-sum"><span class="pnb-bad">missing: gd</span> &middot; <span class="pnb-bad">pdo_oci loaded</span> &middot; PHP 8.2.29') !== false,
   'and the card\'s summary leads with them, in words', $hX);
// 11e. The (i) tips are disclosures with their text exposed (1.3.1 / 4.1.2 / 1.4.13).
$all = $H['top'] . $H['r1'] . $H['r2'] . $H['r3'] . $H['r4'] . $H['r5'] . $H['r6'];
$nI = preg_match_all('/<span class="pnb-i"[^>]*>/', $all, $im);
$nGood = preg_match_all('/<span class="pnb-i" tabindex="0" role="button" aria-expanded="false" aria-label="[^"]+" aria-describedby="(pnbTip[0-9a-f]{10}(?:-\d+)?)"><span class="pnb-i-tip" id="\1" role="tooltip">/', $all, $gm);
ok($nI >= 10 && $nGood === $nI && count(array_unique($gm[1])) === $nI && strpos($all, 'role="note"') === false,
   'every (i) is role=button with aria-expanded and aria-describedby naming its own tip (unique ids, no role=note)', array($nI, $nGood, count(array_unique($gm[1]))));
preg_match_all('/<span class="pnb-i-tip"[^>]*>(.*?)<\/span><\/span>/s', $all, $tm);
$tipLinks = 0; foreach ($tm[1] as $tt) { if (preg_match('/<(a|button|input|select)\b/i', $tt)) $tipLinks++; }
ok(count($tm[1]) === $nI && $tipLinks === 0, 'no tip holds a link or a control (a button\'s content is not interactive)', $tipLinks);
ok(strpos($cardActs, 'activeElement.blur()') === false && strpos($cardActs, "if (e.key !== 'Escape') return;") !== false
   && strpos($cardActs, "document.querySelectorAll('.pnb-i'), function (t) {\n            if (tipShown(t)) { tipShut(t, true); closed = true; }") !== false
   && strpos($cardActs, "if (i && e.target === i && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {") !== false
   && strpos($cardActs, "i.setAttribute('aria-expanded', tipShown(i) ? 'true' : 'false');") !== false,
   'Escape closes every open tip, hovered ones too, without blur(); Enter / Space toggle it; aria-expanded follows what shows');

if ($CONTROL) { section('CONTROL'); ok(false, 'control: a deliberately false assertion (must FAIL)'); }

// ---------------------------------------------------------------------------
// Optional: a page for a headless look. Not a test, but it is what the eye
// checks, so the regions above are the ones on it.
// ---------------------------------------------------------------------------
if ($HTML !== '') {
    $refresh = '<div class="pnb-hub-refresh" id="pnbHubRefresh" role="group" aria-label="Page auto-refresh"><span>&#8635; auto-refresh</span>'
             . '<select id="hubRefreshSel" aria-label="Auto-refresh interval"><option value="0" selected>off</option><option value="30">30s</option><option value="60">60s</option><option value="120">2 min</option><option value="300">5 min</option></select>'
             . '<span id="hubRefreshNext">off</span><button type="button" id="hubRefreshPause" class="pnb-hub-refresh-p" aria-pressed="false" aria-label="Pause auto-refresh" title="Pause auto-refresh"><span aria-hidden="true">&#10074;&#10074;</span></button>'
             . '<span class="pnb-hub-refresh-bar" aria-hidden="true"><i id="hubRefreshBar"></i></span></div>';
    $mockRows = array(
        array('t' => date('Y-m-d H:i:s', $T - 60) . ' DEGRADED: www3 delivery down | delivery=down | near-miss OPEN infoed | correlated: none | SENDING (alert, 2nd consecutive)', 's' => 'err'),
        array('t' => date('Y-m-d H:i:s', $T - 360) . ' DEGRADED: www3 delivery down | delivery=down | near-miss OPENED infoed', 's' => 'err'),
        array('t' => date('Y-m-d H:i:s', $T - 660) . ' OK | delivery=intermittent | hr 38ms fin 41ms infoed 1210ms srar 27ms wolfware 63ms | smtp 12ms', 's' => 'warn'),
        array('t' => date('Y-m-d H:i:s', $T - 960) . ' OK | delivery=ok | hr 36ms fin 40ms infoed 44ms srar 29ms wolfware 61ms | smtp 11ms', 's' => 'ok'),
        array('t' => date('Y-m-d H:i:s', $T - 1260) . ' OK | delivery=ok | hr 37ms fin 39ms infoed 45ms srar 28ms wolfware 60ms | smtp 12ms', 's' => 'ok'),
        array('t' => date('Y-m-d H:i:s', $T - 1560) . ' OK | delivery=quiet | hr 36ms fin 41ms infoed 43ms srar 27ms wolfware 62ms | smtp 11ms', 's' => 'ok'),
    );
    $mock = json_encode(array('file' => 'penumbra_monitor.log', 'size' => 1834211, 'mtime_h' => date('Y-m-d H:i:s', $T - 61), 'age_secs' => 61,
                              'shown' => count($mockRows), 'truncated' => true, 'days_all' => array(), 'span' => 0, 'day' => '', 'ctx' => 0,
                              'hint' => 'One line per 5-minute check. DEGRADED lines bracket an outage.', 'rows' => $mockRows));
    $mockJs = '<script>window.fetch = function (u) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(' . $mock . '); }, text: function () { return Promise.resolve("<html></html>"); } }); };</script>' . "\n";
    $r6 = preg_replace('/<script>/', $mockJs . '<script>', $H['r6'], 1);
    // The left column in the page's own order (2026-10-01): each block rendered on its own.
    $leftHtml = '';
    foreach ($LEFT_ORDER as $k) {
        if (isset($H[$k])) { $leftHtml .= $H[$k]; continue; }
        $lf = $TMP . DIRECTORY_SEPARATOR . 'left_' . $k . '.php';
        file_put_contents($lf, $LEFT[$k]);
        $leftHtml .= render($lf);
    }
    $shell = '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
           . '<title>Penumbra &middot; Health (fixture render)</title><link rel="stylesheet" href="css/main.css"><link rel="stylesheet" href="css/density.css"></head>' . "\n"
           . '<body class="pnb-adm theme-wolfpack">' . "\n"
           . '<div class="pnb-adm-stick"><div id="pnbNoticeBar" class="pnb-notice pnb-notice-critical" role="alert"><span class="pnb-notice-msg"><span class="sr-only">Critical: </span><strong>Penumbra outage:</strong> www3 delivery has been down for ' . pnb_h(pnb_dur($outg['open'][0]['duration'])) . ' (since ' . date('H:i', $outg['open'][0]['started_at']) . '). Large pages may not load through www3.</span><a class="pnb-notice-manage" href="#">Manage &rarr;</a></div>'
           . '<header class="pnb-adm-bar"><span class="pnb-crumb"><span class="pnb-crumb-home">Penumbra</span><span class="pnb-crumb-sep">&rsaquo;</span><span class="pnb-crumb-step">Admin</span></span><div class="pnb-adm-titles"><h1>System Health</h1><p>checked ' . pnb_h($snap['checked_at']) . '</p></div>' . $refresh
           . '<nav class="pnb-adm-nav"><a href="#">&#9776; Repository</a><a href="#" class="on" aria-current="page">&#10084; Health</a><a href="#">&#9993; Notice</a><a href="#">&#128273; Grants</a></nav></header></div>' . "\n"
           . '<main class="pnb-adm-main wide">' . "\n" . $H['top'] . "\n"
           . '<div class="pnb-hub-grid">' . "\n" . '<div class="pnb-hub-col" id="pnbHubLeft">' . "\n" . $leftHtml . '</div><!-- /left -->' . "\n"
           . '<div class="pnb-hub-col">' . "\n" . $r6 . "\n"
           . '<script>setTimeout(function () { var i = document.querySelector("#pnbCardDbs .pnb-tile.degraded .pnb-i"); if (i) i.focus(); }, 300);</script>' . "\n"
           . '</main></body></html>';
    file_put_contents($HTML, $shell);
    echo "\nHTML: " . strlen($shell) . " bytes -> $HTML\n";
}

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL === 0 ? 0 : 1);
