<?php
/**
 * penumbra_tests/diffparity/snapdate_fetch.php - (snapdate, 2026-11-26) the runner's side of a date-format calculated
 * column meeting a snapshot a person saved on the page.
 *
 * The page keeps such a column's DATE under the cell (and a page snapshot stores it); a run writes the date in the
 * column's pattern (pnb_calc_format), and so does every snapshot the scheduler saves. Checked here:
 *   - penumbra_fetch_latest_scheduler_snapshot hands a HAND-SAVED baseline over with those cells in this run's patterns
 *     (the change analysis fallback and the first-run check alike), and a scheduler-made one exactly as stored;
 *   - penumbra_calc_date_pats_for names the date-format columns a run applied, by their row keys;
 *   - execute_scheduled_report notes them right after it works the calculated columns out (a source check: the
 *     function needs a database to run).
 * On the tokenizer-lifted mirror of schedule_runner.php (never the runner itself: its top level opens Oracle, claims
 * tasks and sends e-mail), with queryViaOci8 stubbed. Prints one line per failed check, then "SNAPDATE ok=N bad=M".
 *
 *   php.exe -n snapdate_fetch.php [--app=<app dir>] [--runner=<schedule_runner.php>] [--calc=<penumbra_calc.php>]
 */
$APP = null; $RUNNER = null; $CALC = null;
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0) $APP = substr($a, 6);
    if (strpos($a, '--runner=') === 0) $RUNNER = substr($a, 9);
    if (strpos($a, '--calc=') === 0) $CALC = substr($a, 7);
}
if ($APP === null) $APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP = rtrim($APP, '\\/');
$runnerPath = ($RUNNER !== null) ? $RUNNER : $APP . '/schedule_runner.php';
$calcPath = ($CALC !== null) ? $CALC : $APP . '/penumbra_calc.php';
$extractor = dirname(__DIR__) . '/pivotparity/extract_mirror.php';
$mirrorPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_sdfetch_mirror_' . getmypid() . '.php';
if (!is_file($runnerPath) || !is_file($extractor) || !is_file($calcPath)) { fwrite(STDERR, "FATAL: runner, calc or extractor not found\n"); exit(2); }
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extractor) . ' ' . escapeshellarg($runnerPath) . ' ' . escapeshellarg($mirrorPath) . ' 2>&1';
$cwd = getcwd(); @chdir(sys_get_temp_dir());   // exec() spawns cmd.exe, which refuses a UNC cwd
exec($cmd, $xo, $xc);
@chdir($cwd);
if ($xc !== 0 || !is_file($mirrorPath)) { fwrite(STDERR, "FATAL: mirror extraction failed: " . implode("\n", $xo) . "\n"); exit(2); }

// ---- the database, stubbed: snapshot lists by the query's shape, payloads by id
$GLOBALS['sd_db'] = array('task' => array(), 'pool' => array(), 'hand' => array(), 'data' => array());
function queryViaOci8($sql, $binds = array(), $callTimeoutMs = 0, $memBudgetBytes = 0) {
    $db = $GLOBALS['sd_db'];
    if (strpos($sql, 'SELECT SNAP_DATA FROM PENUMBRA_SNAPS WHERE ID = :sid') !== false) {
        $id = (int)$binds[':sid'];
        return isset($db['data'][$id]) ? array(array('SNAP_DATA' => $db['data'][$id])) : array();
    }
    if (strpos($sql, 'NOTES = :tag') !== false) return $db['task'];
    if (strpos($sql, "CREATED_BY NOT LIKE 'SCHEDULER%'") !== false) return $db['hand'];
    if (strpos($sql, "NOTES NOT LIKE 'Scheduled task #%'") !== false) return $db['pool'];
    return array();
}
require_once $calcPath;
require $mirrorPath;
@unlink($mirrorPath);

$ok = 0; $bad = 0;
function sd_check($name, $cond, $detail = '') {
    global $ok, $bad;
    if ($cond) { $ok++; return; }
    $bad++;
    echo "FAIL $name" . ($detail !== '' ? ": $detail" : '') . "\n";
}
function sd_payload($rows) { return json_encode(array_map(function ($r) { return array('rowData' => $r); }, $rows)); }
function sd_col($rows, $col) { return array_map(function ($r) use ($col) { return isset($r[$col]) ? $r[$col] : null; }, $rows); }
function sd_fetch($taskId, $handOnly) {
    ob_start();   // log_scheduler echoes
    $r = penumbra_fetch_latest_scheduler_snapshot(42, 'SCHEDULER', '', $taskId, $handOnly);
    ob_end_clean();
    return $r;
}

$have = function_exists('penumbra_snapshot_rows_shown') && function_exists('penumbra_calc_date_pats_for');
sd_check('helpers', $have, 'penumbra_snapshot_rows_shown / penumbra_calc_date_pats_for are not in this runner');

// The columns a run notes: date-format ones it applied, by row key (upper case); a text one or one left out is not
$defs = array(
    array('name' => 'DUE', 'formula' => '{DSRC}', 'format' => 'date:MMM D, YYYY'),
    array('name' => 'DAYFIRST', 'formula' => '{DSRC}', 'format' => 'date:DD/MM/YYYY'),
    array('name' => 'TXT', 'formula' => '{DSRC}', 'format' => 'text'),
    array('name' => 'GONE', 'formula' => '{NO_SUCH}', 'format' => 'date:MMM D, YYYY'),
);
$src = array(array('RID' => 'r1', 'DSRC' => '2026-11-04'), array('RID' => 'r2', 'DSRC' => ''), array('RID' => 'r3', 'DSRC' => 'TBD'));
$cp = array(); $ca = array();
$run = pnb_calc_apply_rows($src, $defs, $cp, $ca);
$pats = $have ? penumbra_calc_date_pats_for($defs, $ca) : array();
sd_check('pats: applied date columns only', $pats === array('DUE' => 'MMM D, YYYY', 'DAYFIRST' => 'DD/MM/YYYY'), json_encode($pats));
sd_check('run: DUE in the pattern', sd_col($run, 'DUE') === array('Nov 4, 2026', '', 'TBD'), json_encode(sd_col($run, 'DUE')));
sd_check('run: DAYFIRST in the pattern', sd_col($run, 'DAYFIRST') === array('04/11/2026', '', 'TBD'), json_encode(sd_col($run, 'DAYFIRST')));
$GLOBALS['penumbra_calc_date_pats'] = $pats;
$GLOBALS['penumbra_task_filter'] = '';

// The snapshots, as stored: a page one holds the dates, a scheduler one the patterns' text
$page = array(
    array('RID' => 'r1', 'DSRC' => '2026-11-04', 'DUE' => '2026-11-04', 'DAYFIRST' => '2026-11-04', 'TXT' => '2026-11-04'),
    array('RID' => 'r2', 'DSRC' => '', 'DUE' => '', 'DAYFIRST' => '', 'TXT' => ''),
    array('RID' => 'r3', 'DSRC' => 'TBD', 'DUE' => 'TBD', 'DAYFIRST' => 'TBD', 'TXT' => 'TBD'),
);
$sched = array(
    array('RID' => 'r1', 'DSRC' => '2026-11-04', 'DUE' => 'Nov 4, 2026', 'DAYFIRST' => '04/11/2026', 'TXT' => '2026-11-04'),
    array('RID' => 'r2', 'DSRC' => '', 'DUE' => '', 'DAYFIRST' => '', 'TXT' => ''),
    array('RID' => 'r3', 'DSRC' => 'TBD', 'DUE' => 'TBD', 'DAYFIRST' => 'TBD', 'TXT' => 'TBD'),
);
$GLOBALS['sd_db']['data'] = array(11 => sd_payload($sched), 12 => sd_payload($sched), 22 => sd_payload($page));
$meta = function ($id) { return array(array('ID' => $id, 'SNAP_NAME' => 's' . $id, 'CREATED_AT' => '2026-11-20 08:00:00', 'SEARCH_TERM' => '')); };

// (a) the task's own scheduler snapshot: exactly as stored (its day-first text is never re-read as a US date)
$GLOBALS['sd_db']['task'] = $meta(11); $GLOBALS['sd_db']['pool'] = array(); $GLOBALS['sd_db']['hand'] = $meta(22);
$f = sd_fetch(7, false);
sd_check('task snapshot fetched', is_array($f) && $f['id'] === 11, json_encode($f));
sd_check('task snapshot as stored', is_array($f) && $f['rows'] === $sched, json_encode(is_array($f) ? $f['rows'] : null));

// (b) the shared scheduler pool: as stored
$GLOBALS['sd_db']['task'] = array(); $GLOBALS['sd_db']['pool'] = $meta(12);
$f = sd_fetch(7, false);
sd_check('pool snapshot as stored', is_array($f) && $f['id'] === 12 && $f['rows'] === $sched, json_encode($f));

// (c) no scheduler snapshot: the newest one a person saved, its date-format calculated columns in this run's
//     patterns - exactly the run's own text - and nothing else touched (DSRC, the text-format TXT, TBD, blanks)
$GLOBALS['sd_db']['pool'] = array();
$f = sd_fetch(7, false);
sd_check('hand-saved fallback fetched', is_array($f) && $f['id'] === 22, json_encode($f));
sd_check('hand-saved fallback in the patterns', is_array($f) && $f['rows'] === $sched, json_encode(is_array($f) ? $f['rows'] : null));

// (d) the first-run check's fetch (a hand-saved one only): the same
$GLOBALS['sd_db']['task'] = $meta(11);
$f = sd_fetch(0, true);
sd_check('first-run baseline in the patterns', is_array($f) && $f['id'] === 22 && $f['rows'] === $sched, json_encode(is_array($f) ? $f['rows'] : null));

// (e) the diff then finds no change against this run's rows (the dates did not move)
if (is_array($f)) {
    ob_start();
    $d = penumbra_compute_snapshot_diff($run, $f['rows'], array('RID'));
    ob_end_clean();
    sd_check('no change vs the hand-saved baseline', is_array($d) && !$d['new'] && !$d['removed'] && !$d['modified'] && count($d['unchanged']) === 3,
        json_encode(is_array($d) ? array(count($d['new']), count($d['removed']), count($d['modified']), count($d['unchanged'])) : null));
}

// (f) a run with no date-format calculated columns: a hand-saved baseline is handed over as stored
$GLOBALS['penumbra_calc_date_pats'] = array();
$f = sd_fetch(0, true);
sd_check('no patterns: hand-saved as stored', is_array($f) && $f['rows'] === $page, json_encode(is_array($f) ? $f['rows'] : null));

// (g) execute_scheduled_report notes the patterns of the columns it applied, right after it works them out, and
//     starts every run with none
$code = file_get_contents($runnerPath);
$fs = strpos($code, 'function execute_scheduled_report(');
$fe = ($fs === false) ? false : strpos($code, "\nfunction ", $fs + 10);
$body = ($fs === false) ? '' : substr($code, $fs, ($fe === false ? strlen($code) : $fe) - $fs);
// (calcfix #2) the run works the columns out with their dates as dates (pnb_calc_defs_iso) and keeps the rule warnings
$iApply = strpos($body, "pnb_calc_apply_rows(\$apiData['data'], pnb_calc_defs_iso(\$state['calcColumns']), \$calcProblems, \$calcApplied, \$calcWarn)");
$iNote = strpos($body, "\$GLOBALS['penumbra_calc_date_pats'] = penumbra_calc_date_pats_for(\$state['calcColumns'], \$calcApplied)");
$iReset = strpos($body, "\$GLOBALS['penumbra_calc_date_pats'] = array();");
sd_check('wiring: noted after the calculated columns are worked out', $iApply !== false && $iNote !== false && $iNote > $iApply,
    'apply ' . var_export($iApply, true) . ', note ' . var_export($iNote, true));
sd_check('wiring: reset before them', $iReset !== false && $iApply !== false && $iReset < $iApply, 'reset ' . var_export($iReset, true));

echo "SNAPDATE ok=$ok bad=$bad\n";
