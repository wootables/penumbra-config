<?php
/**
 * penumbra_tests/snapsweep/run.php - the scheduler's snapshot change detection (2026-11-17).
 *
 * Pins the fixes of the snapshot bug sweeps (code tags snapsweep .. snapsweep7) in the functions a scheduled
 * task's change detection is made of: the data signature, the row diff, the analysis groups an e-mail lists, the
 * e-mail cell sanitizer and the per-task baseline tag. Everything runs on mirror.php - the tokenizer-lifted,
 * side-effect-free copy of schedule_runner.php's function declarations, regenerated EVERY run by
 * ../pivotparity/extract_mirror.php. NEVER require schedule_runner.php: its top level opens Oracle, claims tasks
 * and SENDS EMAIL. No database is touched: the functions under test are pure (the two that query are not called).
 *
 *   php.exe -n run.php [--app=<app dir>] [--control] [--mutant] [--keep]
 *
 * --control adds one deliberately false assertion and MUST report FAIL 1.
 * --mutant rewrites the mirror so (a) no rows now is "not comparable" again and (b) every task shares one tag -
 *   two of the faults the sweeps removed - and MUST report failures in sections 2 and 5.
 * --keep leaves mirror.php / mirror_mutant.php behind for inspection.
 *
 * EXPECTED TAIL: "PASS <n>   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$MUTANT  = in_array('--mutant',  $argv, true);
$KEEP    = in_array('--keep',    $argv, true);
$APP = null;
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = substr($a, 6); }
if ($APP === null) $APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP = rtrim($APP, '\\/');

$pass = 0; $fail = 0;
function t_ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}
function t_eq($got, $want, $label) {
    t_ok($got === $want, $label . '  (got ' . var_export($got, true) . ', want ' . var_export($want, true) . ')');
}
function section($title) { echo "== $title\n"; }
/** Runs $fn with the runner's log lines swallowed (log_scheduler echoes); returns [result, log text]. */
function quiet($fn) { ob_start(); $r = $fn(); $log = ob_get_clean(); return array($r, $log); }

// ---------------------------------------------------------------------------
// 1. Regenerate the runner mirror (never require the runner itself)
// ---------------------------------------------------------------------------
$runnerPath = $APP . '/schedule_runner.php';
if (!is_file($runnerPath)) { fwrite(STDERR, "FATAL: cannot read the app under $APP\n"); exit(2); }
$extractor  = dirname(__DIR__) . '/pivotparity/extract_mirror.php';
$mirrorPath = __DIR__ . '/mirror.php';
if (!is_file($extractor)) { fwrite(STDERR, "FATAL: extractor not found at $extractor\n"); exit(2); }
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extractor) . ' ' . escapeshellarg($runnerPath) . ' ' . escapeshellarg($mirrorPath) . ' 2>&1';
$__cwd = getcwd(); @chdir(sys_get_temp_dir()); // exec() spawns cmd.exe, which refuses a UNC cwd
exec($cmd, $xo, $xc);
@chdir($__cwd);
if ($xc !== 0 || !is_file($mirrorPath)) { fwrite(STDERR, "FATAL: mirror extraction failed (exit $xc): " . implode("\n", $xo) . "\n"); exit(2); }
echo "mirror: " . trim(implode(' ', $xo)) . "\n";

if ($MUTANT) {
    $m = file_get_contents($mirrorPath);
    // (a) no rows now: back to "not comparable"
    $m1 = preg_replace('/if \(empty\(\$curNorm\)\) \{/', 'if (empty($curNorm)) { return null; /* MUTANT */', $m, 1, $c1);
    // (b) one tag for every task
    $m2 = preg_replace("/return 'Scheduled task #' \. \(int\)\\\$taskId;/", "return 'Scheduled task #0'; /* MUTANT */", $m1, 1, $c2);
    if ($c1 !== 1 || $c2 !== 1) { fwrite(STDERR, "FATAL: mutant rewrites applied $c1/$c2 times (need 1/1)\n"); exit(2); }
    $mirrorPath = __DIR__ . '/mirror_mutant.php';
    file_put_contents($mirrorPath, $m2);
    echo "mutant: empty-result and shared-tag rewrites applied\n";
}

require $mirrorPath;
foreach (array('generate_snapshot_signature', 'penumbra_signature_rows', 'penumbra_compute_snapshot_diff', 'penumbra_build_diff_groups',
               'penumbra_analysis_visible_cols', '_sanitize_email_html_cell', 'penumbra_task_snap_tag', 'penumbra_task_pool_sql',
               'penumbra_split_change_columns') as $fn) {
    if (!function_exists($fn)) { fwrite(STDERR, "FATAL: $fn missing from the mirror - is the runner change deployed?\n"); exit(2); }
}
// The column-format helper lives outside the runner: a stand-in when the mirror has none.
if (!function_exists('_pnb_colfmt_value')) {
    function _pnb_colfmt_value($v, $spec) { return is_numeric($v) ? '$' . number_format((float)$v, 2) : null; }
}

$sig = function ($rows, $api, $cols) { return generate_snapshot_signature(penumbra_signature_rows($rows, $api, $cols), $cols); };
$counts = function ($d) { return $d === null ? null : array(count($d['new']), count($d['removed']), count($d['modified']), count($d['unchanged'])); };

// ---------------------------------------------------------------------------
section('1. signature');
// ---------------------------------------------------------------------------
$a = array(array('ID' => '1', 'Amount' => '100'), array('ID' => '2', 'Amount' => '200'));
$b = array(array('ID' => '1', 'Amount' => '999'), array('ID' => '2', 'Amount' => '200'));
t_ok(generate_snapshot_signature($a, array('Amount')) !== generate_snapshot_signature($b, array('Amount')), 'a watched column whose name is not all upper case signs its changes');
t_ok(generate_snapshot_signature($a, array('ID')) === generate_snapshot_signature($b, array('ID')), 'a change in an unwatched column does not change the signature');
t_eq(generate_snapshot_signature(array(array('ID' => '1', 'AMOUNT' => '5')), array('AMOUNT')), md5(json_encode(array('AMOUNT' => '5'))), 'an upper-case row signs as it always did');
t_ok(generate_snapshot_signature(array(array('ID' => '1'), array('ID' => '2'))) === generate_snapshot_signature(array(array('ID' => '2'), array('ID' => '1'))), 'row order does not change the signature');
// a hidden watched column is read from the unprocessed rows; a tick column only the processed rows have still counts
$raw = array('rawData' => array(array('NAME' => 'x', 'AWARD_ID' => '7')));
t_ok($sig(array(array('NAME' => 'x', 'DONE' => '0')), $raw, array('AWARD_ID', 'DONE')) !== $sig(array(array('NAME' => 'x', 'DONE' => '1')), $raw, array('AWARD_ID', 'DONE')), 'hidden watched column + watched tick column: the tick still signs');
t_ok($sig(array(array('NAME' => 'x')), array('rawData' => array(array('NAME' => 'x', 'AWARD_ID' => '7'))), array('AWARD_ID'))
     !== $sig(array(array('NAME' => 'x')), array('rawData' => array(array('NAME' => 'x', 'AWARD_ID' => '8'))), array('AWARD_ID')), 'a hidden watched column signs from the unprocessed rows');
// DB_DUMP: the watched column is not among the dumped columns
$dump = array(array('ID' => '1', 'NAME' => 'a'), array('ID' => '2', 'NAME' => 'b'));
$r1 = array('rawData' => array(array('ID' => '1', 'NAME' => 'a', 'STATUS' => 'Open'), array('ID' => '2', 'NAME' => 'b', 'STATUS' => 'Open')));
$r2 = array('rawData' => array(array('ID' => '1', 'NAME' => 'a', 'STATUS' => 'Closed'), array('ID' => '2', 'NAME' => 'b', 'STATUS' => 'Open')));
t_ok($sig($dump, $r1, array('STATUS')) !== $sig($dump, $r2, array('STATUS')), 'dump: a watched column that is not dumped signs its changes');
// DROP on a grouped report: the rows, not the groups
$flat = function ($p) { $o = array(); foreach ($p as $g) { if (is_array($g)) foreach ($g as $r) { if (is_array($r)) $o[] = $r; } } return $o; };
$g1 = array('A' => array(array('ID' => '1', 'DONE' => '0')), 'B' => array(array('ID' => '2', 'DONE' => '0')));
$g2 = array('A' => array(array('ID' => '1', 'DONE' => '1')), 'B' => array(array('ID' => '2', 'DONE' => '0')));
$api = array('rawData' => array(array('ID' => '1'), array('ID' => '2')));
t_ok($sig($flat($g1), $api, array('DONE')) !== $sig($flat($g2), $api, array('DONE')), 'drop, grouped: one tick changed signs differently once the rows are flattened');
t_ok(generate_snapshot_signature($flat(array('A' => array(array('ID' => '1'), array('ID' => '2'))))) === generate_snapshot_signature($flat(array('A' => array(array('ID' => '2'), array('ID' => '1'))))), 'drop, grouped: the same rows in another order sign the same');
t_eq(generate_snapshot_signature(array()), md5(''), 'no rows sign as the empty signature');

// ---------------------------------------------------------------------------
section('2. row diff');
// ---------------------------------------------------------------------------
$cur = array(); $snap = array();
for ($i = 1; $i <= 5; $i++) { $cur[] = array('ID' => "$i", 'V' => 'a'); $snap[] = array('ID' => "$i", 'V' => 'a'); }
t_eq($counts(penumbra_compute_snapshot_diff($cur, $snap, null)), array(0, 0, 0, 5), 'identical rows: all unchanged');
t_eq($counts(penumbra_compute_snapshot_diff(array(), $snap, null)), array(0, 5, 0, 0), 'no rows now: every baseline row is removed (not "not comparable")');
t_eq($counts(penumbra_compute_snapshot_diff(array(), array(), null)), array(0, 0, 0, 0), 'no rows on either side: an empty diff');
t_eq($counts(penumbra_compute_snapshot_diff($cur, array(), null)), array(5, 0, 0, 0), 'an empty baseline: every row is new');
$cur2 = $cur; $cur2[1]['V'] = 'CHANGED';
t_eq($counts(penumbra_compute_snapshot_diff($cur2, $snap, array('ID'))), array(0, 0, 1, 4), 'key ID: one modified row');
t_eq($counts(penumbra_compute_snapshot_diff($cur2, $snap, null)), array(1, 1, 0, 4), 'all columns: an edit is a New + Removed pair');
// a key the baseline lacks: the remaining keys, else every shared column - never "all New and all Removed"
$cur3 = array(); foreach ($cur2 as $i => $r) { $r['NEWKEY'] = 'k' . $i; $cur3[] = $r; }
list($d, $log) = quiet(function () use ($cur3, $snap) { return penumbra_compute_snapshot_diff($cur3, $snap, array('ID', 'NEWKEY')); });
t_eq($counts($d), array(0, 0, 1, 4), 'keys ID + NEWKEY, baseline lacks NEWKEY: compared on ID');
t_ok(strpos($log, 'NEWKEY') !== false, 'the degrade is logged, naming the key');
list($d, $log) = quiet(function () use ($cur3, $snap) { return penumbra_compute_snapshot_diff($cur3, $snap, array('NEWKEY')); });
t_eq($counts($d), array(1, 1, 0, 4), 'key NEWKEY only, baseline lacks it: compared on every shared column');
t_eq(penumbra_compute_snapshot_diff($snap, $cur3, array('NEWKEY')), null, 'a key the CURRENT rows lack: not comparable');

// ---------------------------------------------------------------------------
section('3. what an analysis lists');
// ---------------------------------------------------------------------------
$base = array(array('ID' => '1', 'NAME' => 'a', 'SSN_LAST4' => '1234'), array('ID' => '2', 'NAME' => 'b', 'SSN_LAST4' => '5678'));
$gone = penumbra_build_diff_groups(penumbra_compute_snapshot_diff(array(), $base, null), array(), true);
t_ok(isset($gone['Removed Rows']) && count($gone['Removed Rows']) === 1, 'every row removed: one summary row');
t_ok(strpos(json_encode($gone), '1234') === false && strpos(json_encode($gone), 'SSN_LAST4') === false, 'every row removed: no baseline column or value is listed');
t_ok(strpos(json_encode($gone), '2 rows') !== false, 'every row removed: the count is said');
$cols = array('DEPT', 'NAME', 'SALARY', 'TOTAL');
$pv = array('viewMode' => 'pivot', 'pivot' => array('rows' => array('DEPT')), 'visibleColumns' => array('#', 0, 3), 'layoutColumnNames' => $cols);
t_eq(penumbra_analysis_visible_cols($cols, $pv), array('DEPT', 'TOTAL'), 'pivot: only the visible columns, by their saved names');
$pv2 = $pv; unset($pv2['layoutColumnNames']);
t_eq(penumbra_analysis_visible_cols($cols, $pv2), array('DEPT', 'TOTAL'), 'pivot: by place when the state has no names');
$pv3 = $pv; $pv3['layoutColumnNames'] = array('A', 'B', 'C', 'D');
t_eq(penumbra_analysis_visible_cols($cols, $pv3), array(), 'pivot: names that no longer match list nothing (never the hidden ones)');
$pv4 = $pv; unset($pv4['visibleColumns']);
t_eq(penumbra_analysis_visible_cols($cols, $pv4), $cols, 'pivot that hides nothing: every column');
t_eq(penumbra_analysis_visible_cols($cols, array('viewMode' => 'standard', 'visibleColumns' => array(0))), $cols, 'a table report is left alone (its rows are already the visible columns)');
$pd = penumbra_compute_snapshot_diff(array(array('DEPT' => 'A', 'NAME' => 'x', 'SALARY' => '90000', 'TOTAL' => '5')),
        array(array('DEPT' => 'A', 'NAME' => 'x', 'SALARY' => '90000', 'TOTAL' => '5'), array('DEPT' => 'B', 'NAME' => 'y', 'SALARY' => '70000', 'TOTAL' => '7')), null);
$pg = penumbra_build_diff_groups($pd, penumbra_analysis_visible_cols($cols, $pv), false);
t_ok(strpos(json_encode($pg), 'SALARY') === false && strpos(json_encode($pg), '70000') === false, 'pivot analysis: the hidden column is in no row');
$pn = penumbra_build_diff_groups($pd, array(), true);
t_ok(strpos(json_encode($pn), '90000') === false && isset($pn['Removed Rows']) && isset($pn['Unchanged Rows']), 'no listable column: counts per group, no values');
// a modified cell in its column's format
$GLOBALS['penumbra_column_formats'] = array('AMOUNT' => 'currency');
$md = penumbra_compute_snapshot_diff(array(array('ID' => '1', 'AMOUNT' => '2000')), array(array('ID' => '1', 'AMOUNT' => '1234.5')), array('ID'));
$mg = penumbra_build_diff_groups($md, array('ID', 'AMOUNT'), true);
$mcell = isset($mg['Modified Rows'][0]['AMOUNT']) ? strip_tags($mg['Modified Rows'][0]['AMOUNT']) : '';
t_ok(strpos($mcell, '1,234.50') !== false && strpos($mcell, '2,000.00') !== false, 'a modified cell shows both values in the column\'s format');
unset($GLOBALS['penumbra_column_formats']);

// ---------------------------------------------------------------------------
section('4. e-mail cell sanitizer');
// ---------------------------------------------------------------------------
t_eq(_sanitize_email_html_cell('<span>[was: Phase one = pilot]</span>'), '<span>[was: Phase one = pilot]</span>', 'plain text that looks like an on*= attribute is kept');
t_eq(_sanitize_email_html_cell('Status online=yes now'), 'Status online=yes now', 'text outside any tag is untouched');
t_eq(_sanitize_email_html_cell('<img src=x onerror="alert(1)">'), '<img src=x>', 'a quoted handler in a tag is removed');
t_eq(_sanitize_email_html_cell("<a href='#' onclick=alert(1)>x</a>"), "<a href='#'>x</a>", 'an unquoted handler in a tag is removed');
t_ok(strpos(_sanitize_email_html_cell('<img src=x title="a>" onerror="alert(1)">'), 'onerror') === false, 'a handler after a quoted value holding ">" is removed');
t_ok(strpos(_sanitize_email_html_cell('<b onmouseover=\'x()\'>t</b> one = two'), 'onmouseover') === false
     && strpos(_sanitize_email_html_cell('<b onmouseover=\'x()\'>t</b> one = two'), 'one = two') !== false, 'a handler goes, the text after the tag stays');

// ---------------------------------------------------------------------------
section('5. a baseline per task');
// ---------------------------------------------------------------------------
$GLOBALS['penumbra_task_is_transient'] = false;
t_eq(penumbra_task_snap_tag(281), 'Scheduled task #281', 'a task\'s tag names the task');
t_ok(penumbra_task_snap_tag(281) !== penumbra_task_snap_tag(282), 'two tasks have two tags');
t_ok(strpos(penumbra_task_pool_sql(281), "NOTES = 'Scheduled task #281'") !== false, 'the rotation pool holds the task\'s own rows');
t_ok(strpos(penumbra_task_pool_sql(281), 'NOTES IS NULL') !== false && strpos(penumbra_task_pool_sql(281), "NOT LIKE 'Scheduled task #%'") !== false, 'the rotation pool holds the unmarked rows, never another task\'s');
t_ok(strpos(penumbra_task_pool_sql("5' OR 1=1 --"), 'OR 1=1') === false, 'the task id is a number in the SQL');
$GLOBALS['penumbra_task_is_transient'] = true;
t_eq(penumbra_task_snap_tag(77), '', 'a draft test\'s snapshot belongs to no task');
$GLOBALS['penumbra_task_is_transient'] = false;
set_error_handler(function () { return true; });
$sp = penumbra_split_change_columns(array('ID', '!NOTE'));
restore_error_handler();
t_ok(in_array('ID', $sp['keys'], true) && in_array('NOTE', $sp['ignore'], true), 'watched columns split into keys and ignored ("!NAME")');

// ---------------------------------------------------------------------------
if ($CONTROL) { section('6. control'); t_ok(false, 'CONTROL - this assertion is meant to fail'); }
// ---------------------------------------------------------------------------
if (!$KEEP) { @unlink(__DIR__ . '/mirror.php'); @unlink(__DIR__ . '/mirror_mutant.php'); }
echo "\n" . ($MUTANT ? '[MUTANT] ' : '') . "PASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
