<?php
/**
 * penumbra_tests/diffparity/php_side.php - the SCHEDULER's half of the diff parity suite (2026-11-17).
 *
 * Runs every case of cases.json through penumbra_compute_snapshot_diff() - on mirror.php, the tokenizer-lifted,
 * side-effect-free copy of schedule_runner.php's functions (regenerated every run; NEVER require the runner
 * itself: its top level opens Oracle, claims tasks and sends e-mail) - and prints one JSON object:
 *   { "<case>": { "new": [rid..], "removed": [rid..], "unchanged": [rid..], "modified": ["rid:COL,COL"..] } | null }
 * null = the scheduler calls the pair not comparable. Rows are named by their RID column; lists are sorted.
 * run.py compares this with what the browser's comparison renders for the same case.
 *
 *   php.exe -n php_side.php [--app=<app dir>] [--runner=<schedule_runner.php>] [--calc=<penumbra_calc.php>] [--keep]
 *
 * (snapdate, 2026-11-26) A case with calcColumns: the run's rows are the case's live rows with those columns worked
 * out by penumbra_calc.php (a date-format one as its pattern's text, as execute_scheduled_report writes it), and a
 * snapshot no SCHEDULER saved (snapCreator) is handed over as penumbra_fetch_latest_scheduler_snapshot hands over a
 * hand-saved baseline: through penumbra_snapshot_rows_shown (snapdate_fetch.php checks the fetch does that).
 */
$APP = null; $RUNNER = null; $CALC = null; $KEEP = in_array('--keep', $argv, true);
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0) $APP = substr($a, 6);
    if (strpos($a, '--runner=') === 0) $RUNNER = substr($a, 9);
    if (strpos($a, '--calc=') === 0) $CALC = substr($a, 7);
}
if ($APP === null) $APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP = rtrim($APP, '\\/');
$runnerPath = ($RUNNER !== null) ? $RUNNER : $APP . '/schedule_runner.php';
$calcPath = ($CALC !== null) ? $CALC : $APP . '/penumbra_calc.php';
if (!is_file($calcPath)) { fwrite(STDERR, "FATAL: penumbra_calc.php not found\n"); exit(2); }
require_once $calcPath;
$extractor  = dirname(__DIR__) . '/pivotparity/extract_mirror.php';
$mirrorPath = __DIR__ . '/mirror.php';
if (!is_file($runnerPath) || !is_file($extractor)) { fwrite(STDERR, "FATAL: runner or extractor not found\n"); exit(2); }
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extractor) . ' ' . escapeshellarg($runnerPath) . ' ' . escapeshellarg($mirrorPath) . ' 2>&1';
$cwd = getcwd(); @chdir(sys_get_temp_dir());   // exec() spawns cmd.exe, which refuses a UNC cwd
exec($cmd, $xo, $xc);
@chdir($cwd);
if ($xc !== 0 || !is_file($mirrorPath)) { fwrite(STDERR, "FATAL: mirror extraction failed: " . implode("\n", $xo) . "\n"); exit(2); }
require $mirrorPath;
if (!$KEEP) @unlink($mirrorPath);

$cases = json_decode(file_get_contents(__DIR__ . '/cases.json'), true);
if (!is_array($cases)) { fwrite(STDERR, "FATAL: cases.json is not readable JSON\n"); exit(2); }

function dp_rid($row) {
    foreach ($row as $k => $v) { if (strtoupper((string)$k) === 'RID') return (string)$v; }
    return '?';
}
$out = array();
foreach ($cases as $c) {
    // The snapshot side as the scheduler stores it: UPPERCASE keys
    $snap = array();
    foreach ($c['snap'] as $r) { $u = array(); foreach ($r as $k => $v) { $u[strtoupper($k)] = $v; } $snap[] = $u; }
    $live = $c['live'];
    $GLOBALS['penumbra_calc_date_pats'] = array();
    if (!empty($c['calcColumns'])) {
        $cp = array(); $ca = array();
        $live = pnb_calc_apply_rows($live, $c['calcColumns'], $cp, $ca);
        if ($cp) { fwrite(STDERR, "FATAL: case " . $c['name'] . ": calculated column left out: " . json_encode($cp) . "\n"); exit(2); }
        if (function_exists('penumbra_calc_date_pats_for')) $GLOBALS['penumbra_calc_date_pats'] = penumbra_calc_date_pats_for($c['calcColumns'], $ca);
    }
    $creator = isset($c['snapCreator']) ? (string)$c['snapCreator'] : '';
    if (!preg_match('/^SCHEDULER/i', $creator) && function_exists('penumbra_snapshot_rows_shown')) $snap = penumbra_snapshot_rows_shown($snap);
    ob_start();   // log_scheduler echoes
    $d = penumbra_compute_snapshot_diff($live, $snap, $c['keys']);
    ob_end_clean();
    if ($d === null) { $out[$c['name']] = null; continue; }
    $g = array('new' => array(), 'removed' => array(), 'unchanged' => array(), 'modified' => array());
    foreach ($d['new'] as $r) $g['new'][] = dp_rid($r);
    foreach ($d['removed'] as $r) $g['removed'][] = dp_rid($r);
    foreach ($d['unchanged'] as $r) $g['unchanged'][] = dp_rid($r);
    foreach ($d['modified'] as $m) {
        $row = isset($m['row']) ? $m['row'] : (isset($m[0]) ? $m[0] : array());
        $cc  = isset($m['changedCols']) ? $m['changedCols'] : (isset($m[2]) ? $m[2] : array());
        $cc = array_map('strtoupper', array_map('strval', $cc)); sort($cc);
        $g['modified'][] = dp_rid($row) . ':' . implode(',', $cc);
    }
    foreach ($g as $k => $v) { sort($g[$k]); }
    $out[$c['name']] = $g;
}
echo json_encode($out), "\n";
