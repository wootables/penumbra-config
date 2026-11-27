<?php
// calcfix suite, scheduler phase: "Fix all 20" #2, #9, #18 on a mirror of the stage's schedule_runner.php (its functions only,
// lifted by penumbra_tests/pivotparity/extract_mirror.php - the runner itself is never required: it sends mail).
//   php sched.php <mirror.php> <penumbra_calc.php>     (a build without the fixes: stand-ins below, its checks fail)
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
require $argv[2];
require 'R:/inetpub/wwwroot/sponsor_migration/penumbra/penumbra_search.php';
require $argv[1];
// the build before the fixes has none of these: stand-ins that do what it did, so its checks fail rather than stop
if (!function_exists('pnb_calc_defs_iso')) { function pnb_calc_defs_iso($c) { return $c; } }
if (!function_exists('penumbra_calc_rows_shown_any')) { function penumbra_calc_rows_shown_any($d, $v) { return $d; } }
if (!function_exists('penumbra_page_sort_number')) { function penumbra_page_sort_number($v) { return is_strict_number($v) ? parse_accounting_number($v) : false; } }
$ok = 0; $bad = 0;
function chk($name, $got, $want) {
    global $ok, $bad;
    $g = json_encode($got, JSON_UNESCAPED_UNICODE); $w = json_encode($want, JSON_UNESCAPED_UNICODE);
    if ($g === $w) { $ok++; echo "ok   $name\n"; } else { $bad++; echo "BAD  $name\n     got  $g\n     want $w\n"; }
}
$rows = array();
foreach (array('2026-02-03', '2026-03-05', '2026-03-20', '2026-04-02', '2026-05-01', '2026-11-12', '2025-12-25') as $i => $d)
    $rows[] = array('ID' => (string)($i + 1), 'START' => $d, 'BURN' => array('12.25%', '12.5%', '0.5%', '-25%', '-3%', '7%', '(1%)')[$i]);
$defs = array(array('name' => 'DUE', 'formula' => '{START} + 0', 'format' => 'date:MMM D, YYYY'));
$p = array(); $a = array(); $w = array();
$run = @pnb_calc_apply_rows($rows, pnb_calc_defs_iso($defs), $p, $a, $w);
$GLOBALS['penumbra_calc_date_pats'] = penumbra_calc_date_pats_for($defs, $a);
chk('#2 rows hold the date', array_map(function ($r) { return $r['DUE']; }, $run), array('2026-02-03', '2026-03-05', '2026-03-20', '2026-04-02', '2026-05-01', '2026-11-12', '2025-12-25'));
chk('#2 the run knows the pattern', $GLOBALS['penumbra_calc_date_pats'], array('DUE' => 'MMM D, YYYY'));
// the schedule's filter reads the date
$kept = php_apply_search_filter($run, 'standard', 'DUE < 2026-04-01');
chk('#2 filter DUE < 2026-04-01', array_map(function ($r) { return $r['ID']; }, $kept), array('1', '2', '3', '7'));
// the saved sort reads the date
$sorted = penumbra_sched_sort_rows($run, array('sortCriteria' => array(array('colIdentifier' => 'DUE', 'direction' => 'asc'))));
chk('#2 sort by DUE', array_map(function ($r) { return $r['ID']; }, $sorted), array('7', '1', '2', '3', '4', '5', '6'));
// a Month level groups by the month; a plain level by the shown text
$spec = penumbra_group_level_spec('DUE:month', $run[0], $run, array());
$labs = array(); foreach ($run as $r) $labs[] = call_user_func($spec['label'], $r);
chk('#2 Month buckets', $labs, array(pivot_split_bucket_label('month', '2026-02-03'), pivot_split_bucket_label('month', '2026-03-05'), pivot_split_bucket_label('month', '2026-03-05'),
    pivot_split_bucket_label('month', '2026-04-02'), pivot_split_bucket_label('month', '2026-05-01'), pivot_split_bucket_label('month', '2026-11-12'), pivot_split_bucket_label('month', '2025-12-25')));
chk('#2 a month is one group', count(array_unique($labs)), 6);
$spec = penumbra_group_level_spec('DUE', $run[0], $run, array());
chk('#2 plain level shows the pattern', call_user_func($spec['label'], $run[1]), 'Mar 5, 2026');
// the column format: apply_state_logic registers the pattern where the report saves none
$st = apply_state_logic($run, array('calcColumns' => $defs));
chk('#2 pattern is the column format', isset($GLOBALS['penumbra_column_formats']['DUE']) ? $GLOBALS['penumbra_column_formats']['DUE'] : null, array('t' => 'date', 'dp' => null, 'p' => 'MMM D, YYYY'));
chk('#2 raw format for the chart page', isset($GLOBALS['penumbra_column_formats_raw']['DUE']) ? $GLOBALS['penumbra_column_formats_raw']['DUE'] : null, 'date:MMM D, YYYY');
chk('#2 email cell draws the pattern', penumbra_email_cell_format('DUE', '2026-03-05'), 'Mar 5, 2026');
$st2 = apply_state_logic($run, array('calcColumns' => $defs, 'columnFormats' => array('Due' => 'date:YYYY')));
chk('#2 a report format wins', isset($GLOBALS['penumbra_column_formats']['DUE']) ? $GLOBALS['penumbra_column_formats']['DUE']['p'] : null, 'YYYY');
$st3 = apply_state_logic($run, array('calcColumns' => $defs, 'columnFormats' => array('due' => 'auto')));
chk('#2 an Automatic report format gives way (as the page)', isset($GLOBALS['penumbra_column_formats_raw']['DUE']) ? $GLOBALS['penumbra_column_formats_raw']['DUE'] : null, 'date:MMM D, YYYY');
chk('#2 ...its raw entry replaced', array_key_exists('due', $GLOBALS['penumbra_column_formats_raw']), false);
apply_state_logic($run, array('calcColumns' => $defs));
// totals: Min / Max of the date, in the pattern
$tf = renderTotalRow($run, array('ID', 'START', 'BURN', 'DUE'), '', array('DUE' => 'min'), $GLOBALS['penumbra_column_formats']);
chk('#2 Min in the pattern', strpos($tf, 'Dec 25, 2025') !== false, true);
$tf = renderTotalRow($run, array('ID', 'START', 'BURN', 'DUE'), '', array('DUE' => 'max'), $GLOBALS['penumbra_column_formats']);
chk('#2 Max in the pattern', strpos($tf, 'Nov 12, 2026') !== false, true);
// files keep the shown text
$csv = generate_csv_string(array('data' => $run, 'viewMode' => 'standard'));
$csvLines = preg_split('/\r?\n/', trim($csv));
chk('#2 CSV shows the pattern', isset($csvLines[2]) ? $csvLines[2] : null, '2,2026-03-05,12.5%,"Mar 5, 2026"');
$js = generate_json_string(array('data' => $run, 'viewMode' => 'standard'));
chk('#2 JSON shows the pattern', strpos($js, 'Mar 5, 2026') !== false, true);
$grp = array('A' => array_slice($run, 0, 3), 'B' => array_slice($run, 3));
$csvg = generate_csv_string(array('data' => $grp, 'viewMode' => 'grouped'));
chk('#2 grouped CSV shows the pattern', strpos($csvg, 'Nov 12, 2026') !== false, true);
chk('#2 rows shown, grouped shape', penumbra_calc_rows_shown_any($grp, 'grouped')['B'][0]['DUE'], 'Apr 2, 2026');
chk('#2 a pivot is left to its builder', penumbra_calc_rows_shown_any($run, 'pivot')[0]['DUE'], '2026-02-03');
// the change analysis compares what each side shows
$oldSched = array(); foreach ($run as $r) { $o = array(); foreach ($r as $k => $v) $o[strtoupper($k)] = $k === 'DUE' ? _pnb_colfmt_date_value($v, 'MMM D, YYYY') : $v; $oldSched[] = $o; }
$pageSnap = array(); foreach ($run as $r) { $o = array(); foreach ($r as $k => $v) $o[strtoupper($k)] = $v; $pageSnap[] = $o; }
$d1 = penumbra_compute_snapshot_diff($run, $oldSched, array('ID'));
chk('#2 vs an older scheduler snapshot (pattern text): no change', array(count($d1['new']), count($d1['removed']), count($d1['modified']), $d1['unchangedCount']), array(0, 0, 0, 7));
$d2 = penumbra_compute_snapshot_diff($run, $pageSnap, array('ID'));
chk('#2 vs a page / new scheduler snapshot (dates): no change', array(count($d2['new']), count($d2['removed']), count($d2['modified']), $d2['unchangedCount']), array(0, 0, 0, 7));
$moved = $pageSnap; $moved[1]['DUE'] = '2026-03-06';
$d3 = penumbra_compute_snapshot_diff($run, $moved, array('ID'));
chk('#2 a moved date is a change', count($d3['modified']), 1);
$fx = penumbra_snapshot_rows_shown(array(array('DUE' => '2026-03-05'), array('DUE' => 'Mar 5, 2026'), array('DUE' => 'soon')));
chk('#2 baseline: ISO shown, text as it is', array_map(function ($r) { return $r['DUE']; }, $fx), array('Mar 5, 2026', 'Mar 5, 2026', 'soon'));
// #9 the sort reads a number as the page does
$s9 = penumbra_sched_sort_rows($run, array('sortCriteria' => array(array('colIdentifier' => 'BURN', 'direction' => 'desc'))));
chk('#9 Percent sorts by number (desc)', array_map(function ($r) { return $r['BURN']; }, $s9), array('12.5%', '12.25%', '7%', '0.5%', '(1%)', '-3%', '-25%'));
chk('#9 page number rule', array(penumbra_page_sort_number('$1,000.50'), penumbra_page_sort_number('(12%)'), penumbra_page_sort_number('2014-0685'), penumbra_page_sort_number('.5'), penumbra_page_sort_number('')), array(1000.5, -12.0, false, 0.5, false));
// #18 values a custom order does not list: the page's compareValues
$cmp = get_custom_sort_comparator(array('G' => array('values' => array('First'))), 'G');
$vals = array('$200', 'First', 'zeta', '$1,000', 'Alpha', '10');
usort($vals, $cmp);
chk('#18 unlisted after the order, as the page orders them', $vals, array('First', '10', '$200', '$1,000', 'Alpha', 'zeta'));
echo "ok=$ok bad=$bad\n";
