<?php
// =============================================================================
// repoorder - SERVER HALF (2026-10-02)
//
// The repository's opening list (get_server_reports.php mode=initial): the 15
// reports the user opened most recently, then the 15 most recently opened by
// anyone else (NULLS LAST fills the rest with never-opened reports), shown in
// exactly that order. Before: 10 + 10, then re-sorted by UPDATED_AT (the PHP
// usort was in fact a no-op - strtotime() cannot read Oracle's
// 'DD-MON-YY HH.MI.SS.FF6 AM', so every key was 0 - and the visible re-sort was
// the client's; the browser half covers that).
//
// Lifts the mode=initial block VERBATIM (text between its two anchors) and runs
// it against a fake PDO that answers like Oracle would: query A / query B rows
// in their ORDER BY order, honouring `r.ID NOT IN (...)` and FETCH FIRST N.
//
//   php -n server_test.php <get_server_reports.php>
// Prints one JSON object: { asserts: [ {id, ok, detail}, ... ] }
// =============================================================================
error_reporting(E_ALL);
$file = isset($argv[1]) ? $argv[1] : '';
$src = @file_get_contents($file);
$out = array('asserts' => array());
function t($id, $ok, $detail) { global $out; $out['asserts'][] = array('id' => $id, 'ok' => (bool)$ok, 'detail' => $detail); }
function finish() { global $out; echo json_encode($out); exit(0); }
if ($src === false || $src === '') { t('S-lift', false, 'cannot read ' . $file); finish(); }

$open  = "    if (\$mode === 'initial') {\n";
$close = "\n    } else if (\$mode === 'loadmore') {";
$src = str_replace("\r\n", "\n", $src);
$ca = substr_count($src, $open); $cb = substr_count($src, $close);
if ($ca !== 1 || $cb !== 1) { t('S-lift', false, "anchor counts open=$ca close=$cb (need 1/1)"); finish(); }
$i = strpos($src, $open) + strlen($open);
$block = substr($src, $i, strpos($src, $close, $i) - $i);
t('S-lift', true, strlen($block) . ' bytes lifted');

// --- stubs for the block's two outside calls --------------------------------
function buildAuthFilter($isAdmin, $u, $prefix = '') { return array('sql' => '', 'binds' => array()); }
function enrichReports($conn, $rows) { return $rows; }   // order-preserving, like the real one

class FakeStmt {
    public $sql; private $c;
    function __construct($c, $sql) { $this->c = $c; $this->sql = $sql; }
    function bindValue($k, $v, $t = null) { return true; }
    function execute() { $this->c->log[] = $this->sql; return true; }
    function fetchAll($m = null) {
        $isA = strpos($this->sql, 'USER_ID = :my_user') !== false;
        $rows = $isA ? $this->c->mine : $this->c->others;
        if (preg_match('/r\.ID NOT IN \(([0-9,]+)\)/', $this->sql, $mm)) {
            $ex = array_map('intval', explode(',', $mm[1]));
            $rows = array_values(array_filter($rows, function ($r) use ($ex) { return !in_array(intval($r['ID']), $ex, true); }));
        }
        if (preg_match_all('/FETCH FIRST (\d+) ROWS ONLY/', $this->sql, $fm) && count($fm[1])) {
            $rows = array_slice($rows, 0, intval(end($fm[1])));
        }
        return $rows;
    }
    function fetch($m = null) { return false; }
    function fetchColumn() { return 0; }
}
class FakeConn {
    public $mine, $others, $log = array();
    function __construct($mine, $others) { $this->mine = $mine; $this->others = $others; }
    function prepare($sql) { return new FakeStmt($this, $sql); }
}

// Oracle's own format, so a re-sort that could read it would show.
function ora($day, $hour) { return sprintf('%02d-SEP-26 %02d.00.00.000000 AM', $day, $hour); }
function row($id, $upd) { return array('ID' => (string)$id, 'SHORT_ID' => 'r' . $id, 'TITLE' => 'T' . $id, 'UPDATED_AT' => $upd); }

function run_block($block, $mine, $others) {
    $oracleConn = new FakeConn($mine, $others);
    $auth = array('sql' => '', 'binds' => array());
    $isAdmin = true; $currentUserKey = 'tester'; $metricsSel = ''; $mode = 'initial';
    // The report-tags join (2026-10-08) is built before the lifted block; empty = the
    // install without PENUMBRA_REPORT_TAGS. Undefined, PHP's warnings went to stdout
    // ahead of the JSON and run.py reported every server assert as one S-lift FAIL.
    $tagsSel = ''; $tagsJoin = '';
    $reports = null;
    eval($block);
    return array($reports, $oracleConn->log);
}
function ids($rows) { return array_map(function ($r) { return intval($r['ID']); }, $rows ?: array()); }

// Fixture 1: 20 of mine (101..120, newest open first; UPDATED_AT runs the OTHER
// way), 25 others (201..225) with two of mine (103, 110) inside the others' order
// - the exclusion must drop them.
$mine = array(); for ($k = 0; $k < 20; $k++) { $mine[] = row(101 + $k, ora(1 + $k, 9)); }
$others = array();
for ($k = 0; $k < 25; $k++) {
    if ($k === 2) { $others[] = row(103, ora(28, 9)); }
    if ($k === 5) { $others[] = row(110, ora(27, 9)); }
    $others[] = row(201 + $k, ora(1 + (($k * 7) % 25), 10));
}
list($rep, $log) = run_block($block, $mine, $others);
$got = ids($rep);
$sqlA = isset($log[0]) ? $log[0] : ''; $sqlB = isset($log[1]) ? $log[1] : '';
preg_match('/FETCH FIRST (\d+) ROWS ONLY/', $sqlA, $na); preg_match('/FETCH FIRST (\d+) ROWS ONLY/', $sqlB, $nb);
$gotMine = array_values(array_filter($got, function ($v) { return $v < 200; }));
$gotOth  = array_values(array_filter($got, function ($v) { return $v >= 200; }));
$wantMine = range(101, 115);
$wantOth = range(201, 215);
t('S-sqlA-15', isset($na[1]) && $na[1] === '15', 'query A FETCH FIRST ' . (isset($na[1]) ? $na[1] : '?'));
t('S-sqlB-15', isset($nb[1]) && $nb[1] === '15', 'query B FETCH FIRST ' . (isset($nb[1]) ? $nb[1] : '?'));
t('S-mine15', $gotMine === $wantMine, 'mine: ' . implode(',', $gotMine));
t('S-oth15', $gotOth === $wantOth, 'others: ' . implode(',', $gotOth));
t('S-order', $got === array_merge($wantMine, $wantOth), 'order: ' . implode(',', $got));
t('S-excl', strpos($sqlB, 'r.ID NOT IN (' . implode(',', $wantMine) . ')') !== false
    || strpos($sqlB, 'r.ID NOT IN (' . implode(',', range(101, 110)) . ')') !== false,
    'query B excludes the reports query A returned');
t('S-nulls', strpos($sqlB, 'ORDER BY a_all.LAST_ACCESS DESC NULLS LAST') !== false, 'query B keeps NULLS LAST (never-opened reports fill the rest)');

// Fixture 2: only 3 opens of my own - mine first, then the others' 15 (103 is
// mine so it drops out of theirs; 110 is not mine here, so it stays in place).
list($rep2) = run_block($block, array_slice($mine, 0, 3), $others);
$got2 = ids($rep2);
t('S-fewmine', $got2 === array_merge(array(101, 102, 103), array(201, 202, 203, 204, 205, 110), range(206, 214)), 'order: ' . implode(',', $got2));

// Fixture 3: none of my own - just the others' 15, in their order.
list($rep3) = run_block($block, array(), $others);
$got3 = ids($rep3);
t('S-nomine', $got3 === array_merge(array(201, 202, 103, 203, 204, 205, 110), range(206, 213)), 'order: ' . implode(',', $got3));
finish();
