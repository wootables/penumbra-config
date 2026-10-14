<?php
// =============================================================================
// NOTES COLUMN SUITE "notescol" - SNIPPETS + CUSTOM CONDITIONS (2026-10-14, round 8)
//
// "count(Notes > 0)", "count(Notes = budget)", "sum(AMOUNT, Notes > 0)" in a scheduled
// email's snippet and in a task's custom skip condition read the journal's notes as the
// page does, now that the runner reads every row's notes whenever row notes are on.
// Before: they returned NaN (CONDITION_EVAL_FAILED). Row notes off: still NaN.
//
// The REAL engines: every function schedule_runner.php declares, lifted without running
// it (tplparity's extract_mirror.php), with the build's journal_export.php and
// penumbra_search.php. Only the database is faked (queryViaOci8).
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring snip.php [--app DIR] [--control]
//   --control: the build before (expects RED on exactly CONTROL_RED)
// =============================================================================
error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
$APP = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$args = $argv; array_shift($args);
$app = $APP; $control = false;
for ($i = 0; $i < count($args); $i++) {
    if ($args[$i] === '--app') { $app = $args[++$i]; continue; }
    if ($args[$i] === '--control') { $control = true; continue; }
    fwrite(STDERR, "unknown argument {$args[$i]}\n"); exit(2);
}
$pick = function ($rel) use ($app, $APP) { $a = $app . '/' . $rel; return is_file($a) ? $a : $APP . '/' . $rel; };
$CONTROL_RED = array('N-count', 'N-word', 'N-not', 'N-sum', 'N-cond-skip', 'N-cond-send', 'N-cond-word', 'N-count-zero');

// the fake database: the resolver's two reads
$GLOBALS['NOTES'] = array();
function queryViaOci8($sql, $binds = array()) {
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return array();
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL') !== false && strpos($sql, "SCOPE = 'row'") !== false) return $GLOBALS['NOTES'];
    throw new Exception('unexpected SQL: ' . substr($sql, 0, 80));
}
function journalKeySig($cols) { return implode('|', $cols); }   // skips journal_export.php's filing block

$tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_notescol_snip_' . getmypid() . '.php';
if (!preg_match('/pnb_notescol_snip_\d+\.php$/', $tmp)) { fwrite(STDERR, "bad temp\n"); exit(2); }
$php = PHP_BINARY;
$runner = $pick('schedule_runner.php');
exec('"' . $php . '" -n "//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/penumbra_tests/tplparity/extract_mirror.php" "' . $runner . '" "' . $tmp . '"', $o, $rc);
if ($rc !== 0 || !is_file($tmp)) { fwrite(STDERR, "mirror failed: " . implode("\n", $o) . "\n"); exit(2); }
require $pick('journal_export.php');
require $tmp;
if (!function_exists('_search_get_virtual_columns')) require_once $pick('penumbra_search.php');
if (!function_exists('penumbra_vis_apply_tokens')) require_once $pick('penumbra_render_charts.php');   // the snippet engine's last step (vis() tokens)
@unlink($tmp);

$R = array();
$A = function ($id, $ok, $d = '') use (&$R) { $R[] = array($id, (bool)$ok, (string)$d); };
$note = function ($id, $rk, $text, $by, $at, $parent = null) {
    return array('ID' => (string)$id, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'CREATED_BY' => $by, 'AUTHOR_NAME' => ucfirst($by),
                 'CREATED_AT' => $at, 'PARENT_ID' => $parent, 'ATTACH_NAME' => null);
};
$GLOBALS['NOTES'] = array(
    $note(11, 'P-1', 'Budget review pending', 'pat', '2026-10-01 09:00:00'),
    $note(12, 'P-1', 'agreed', 'lee', '2026-10-01 10:00:00', 11),
    $note(13, 'P-3', 'Follow up with sponsor', 'kim', '2026-10-02 08:00:00'),
);
$rows = array(
    array('PROPOSAL ID' => 'P-1', 'TITLE' => 'Alpha', 'AMOUNT' => '100'),
    array('PROPOSAL ID' => 'P-2', 'TITLE' => 'Bravo', 'AMOUNT' => '200'),
    array('PROPOSAL ID' => 'P-3', 'TITLE' => 'Charlie', 'AMOUNT' => '300'),
);
$cols = array('PROPOSAL ID', 'TITLE', 'AMOUNT');
$state = function ($rowNotes) { return array('viewOptions' => array('journalEnabled' => true, 'journalKeyColumns' => array('PROPOSAL ID'),
                                                                   'journalRowNotes' => $rowNotes)); };
$setup = function ($rowNotes) use ($rows, $state) {
    $r = $rows;
    $jt = journalExportToggleColumns('rpt', $state($rowNotes), $r);
    _snippet_journal_toggles($jt['resolver'] ? $jt['resolver'] : false);
    return $jt['resolver'];
};
$snip = function ($expr) use ($rows, $cols) { return trim(strip_tags(execute_email_snippet($expr, $rows, $cols, 'standard', array(), array(), true))); };
$cond = function ($expr) use ($rows, $cols) { return evaluate_custom_condition($expr, $rows, $cols, 'standard'); };

$A('P-engines', function_exists('execute_email_snippet') && function_exists('evaluate_custom_condition'), 'the runner\'s snippet + condition engines lifted');
$setup(true);
$A('N-count', $snip('count(Notes > 0)') === '2', 'count(Notes > 0) = ' . $snip('count(Notes > 0)'));
$A('N-count-zero', $snip('count(Notes = empty)') === '1' && $snip('count(Notes > 1)') === '1', 'empty ' . $snip('count(Notes = empty)') . ', > 1 ' . $snip('count(Notes > 1)'));
$A('N-word', $snip('count(Notes = budget)') === '1' && $snip('count(Notes = agreed)') === '1' && $snip('count(Notes = SPONSOR)') === '1',
   'budget ' . $snip('count(Notes = budget)') . ', agreed (a reply) ' . $snip('count(Notes = agreed)') . ', SPONSOR ' . $snip('count(Notes = SPONSOR)'));
$A('N-not', $snip('count(Notes != budget)') === '2', 'count(Notes != budget) = ' . $snip('count(Notes != budget)'));
$A('N-sum', $snip('sum(AMOUNT, Notes > 0)') === '400', 'sum(AMOUNT, Notes > 0) = ' . $snip('sum(AMOUNT, Notes > 0)'));
$A('N-cond-send', $cond('count(Notes > 0) > 0') === true, 'custom condition count(Notes > 0) > 0 -> ' . var_export($cond('count(Notes > 0) > 0'), true));
$A('N-cond-skip', $cond('count(Notes = zzqnothing) > 0') === false, 'a word in no note -> ' . var_export($cond('count(Notes = zzqnothing) > 0'), true));
$A('N-cond-word', $cond('count(Notes = sponsor) = 1') === true, 'count(Notes = sponsor) = 1 -> ' . var_export($cond('count(Notes = sponsor) = 1'), true));
$A('N-plain', $snip('count(TITLE = Bravo)') === '1' && $snip('count()') === '3', 'other conditions as before');
$setup(false);
$A('N-off-nan', $snip('count(Notes > 0)') === 'NaN' && $cond('count(Notes > 0) > 0') === null, 'row notes off: still NaN / not evaluable: ' . $snip('count(Notes > 0)'));
_snippet_journal_toggles(false);

$EXPECT = array('P-engines', 'N-count', 'N-count-zero', 'N-word', 'N-not', 'N-sum', 'N-cond-send', 'N-cond-skip', 'N-cond-word', 'N-plain', 'N-off-nan');
$got = array(); foreach ($R as $r) $got[$r[0]] = $r;
$p = 0; $f = 0; $failed = array();
foreach ($EXPECT as $id) {
    $r = isset($got[$id]) ? $got[$id] : array($id, false, 'NOT RECORDED');
    printf("  %s  %-14s %s\n", $r[1] ? 'PASS' : 'FAIL', $id, substr($r[2], 0, 300));
    if ($r[1]) $p++; else { $f++; $failed[] = $id; }
}
printf("TOTAL pass=%d fail=%d   failed: %s\n", $p, $f, implode(' ', $failed));
if ($control) {
    sort($failed); $w = $CONTROL_RED; sort($w);
    echo ($failed === $w) ? "CONTROL: as expected\nRESULT: GREEN\n" : "CONTROL: NOT as expected (want red: " . implode(' ', $w) . ")\nRESULT: RED\n";
    exit($failed === $w ? 0 : 1);
}
echo ($f === 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
exit($f ? 1 : 0);
