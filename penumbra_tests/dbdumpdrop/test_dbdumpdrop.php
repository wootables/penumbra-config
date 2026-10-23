<?php
/**
 * =============================================================================
 * DB_DUMP: drop picked columns the report no longer returns (2026-10-22)
 * =============================================================================
 *
 *   php -n test_dbdumpdrop.php <app-path>
 *
 * A saved DB_DUMP task keeps the column list it was saved with, so a column
 * removed from the report used to land as an all-NULL destination column on
 * every run (PDUMP_FI_EPA / SUBMITTED_PROPOSALS, task #523). The runner now
 * prunes it. Lifts the three helpers out of schedule_runner.php:
 *
 *   _sr_dbdump_display_keys         first real row's keys of 'data', flat or grouped
 *   _sr_dbdump_columns_to_drop      the decision: real evidence only, calc columns kept
 *   _sr_persist_dbdump_column_drop  fresh-read prune + dbdump_columns_dropped note
 *
 * No database, no network: the PDO connection and execClobUpdate are stubs.
 * EXPECTED TAIL: "SUMMARY  pass=NN  fail=0".
 * =============================================================================
 */
$app = isset($argv[1]) ? rtrim($argv[1], "\\/") : '\\\\oitras\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$src = $app . DIRECTORY_SEPARATOR . 'schedule_runner.php';
if (!is_readable($src)) { fwrite(STDERR, "FATAL: cannot read $src\n"); exit(2); }

function pnb_extract_fn($lines, $name) {
    $out = ''; $in = false;
    foreach ($lines as $l) {
        if (!$in && strpos($l, "function $name(") === 0) $in = true;
        if ($in) { $out .= $l; if (rtrim($l, "\r\n") === '}') return $out; }
    }
    fwrite(STDERR, "FATAL: could not extract $name() from schedule_runner.php\n"); exit(2);
}
$lines = file($src);
$code = "<?php namespace Pnb;\n"
      . "class PDO { const FETCH_ASSOC = 2; }\n"
      . "function execClobUpdate(\$c, \$t, \$set, \$clob, \$where, \$binds) { \$GLOBALS['WRITES'][] = array(\$t, \$set, \$clob, \$where, \$binds); }\n";
foreach (array('_sr_dbdump_display_keys', '_sr_dbdump_columns_to_drop', '_sr_persist_dbdump_column_drop') as $fn) {
    $code .= pnb_extract_fn($lines, $fn) . "\n";
}
$tmp = tempnam(sys_get_temp_dir(), 'ddd');
file_put_contents($tmp, $code);
require $tmp;
unlink($tmp);

// Read stub: prepare/bindValue/execute/fetch over one canned OPTIONS row.
class FakeStmt {
    public $row;
    function __construct($r) { $this->row = $r; }
    function bindValue($a, $b) { $GLOBALS['BINDS'][$a] = $b; }
    function execute() { return true; }
    function fetch($m = null) { return $this->row; }
}
class FakeConn {
    public $row;
    function __construct($r) { $this->row = $r; }
    function prepare($sql) { $GLOBALS['SQL'][] = $sql; return new FakeStmt($this->row); }
}

$PASS = 0; $FAIL = 0;
function ok($c, $label, $got = null) {
    global $PASS, $FAIL;
    if ($c) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : '  (got: ' . json_encode($got) . ')') . "\n"; }
}
function t($a) { $o = array(); foreach ($a as $k) $o[$k] = true; return $o; }

echo "\n== _sr_dbdump_display_keys ==\n";
ok(\Pnb\_sr_dbdump_display_keys(null) === array(), 'null -> no keys');
ok(\Pnb\_sr_dbdump_display_keys(array()) === array(), 'empty -> no keys');
ok(\Pnb\_sr_dbdump_display_keys(array(array('Name' => 1, 'calc_x' => 2))) === t(array('NAME', 'CALC_X')), 'flat: first row, UPPER');
ok(\Pnb\_sr_dbdump_display_keys(array('Grp A' => array(array('a' => 1, 'B' => 2)))) === t(array('A', 'B')), "grouped: the first group's first row");

echo "\n== _sr_dbdump_columns_to_drop ==\n";
$flat = array(array('NAME' => 'x', 'PROPOSALS' => 3));
ok(\Pnb\_sr_dbdump_columns_to_drop(t(array('SUBMITTED_PROPOSALS')), t(array('NAME', 'PROPOSALS')), $flat) === array('SUBMITTED_PROPOSALS'),
   'the task #523 case: a vanished column is dropped');
ok(\Pnb\_sr_dbdump_columns_to_drop(t(array('A', 'B')), t(array('NAME')), $flat) === array('A', 'B'), 'several at once');
ok(\Pnb\_sr_dbdump_columns_to_drop(t(array('NAME', 'PROPOSALS')), array(), array(array('ERROR' => 'ORA-00942'))) === array(),
   'nothing found (an {ERROR} row / no rows) -> NOTHING dropped');
ok(\Pnb\_sr_dbdump_columns_to_drop(array(), t(array('NAME')), $flat) === array(), 'nothing missing -> nothing dropped');
ok(\Pnb\_sr_dbdump_columns_to_drop(t(array('MY_CALC', 'GONE')), t(array('NAME')), array(array('NAME' => 1, 'my_calc' => 9))) === array('GONE'),
   'a display-only (calc) column in data is KEPT');
ok(\Pnb\_sr_dbdump_columns_to_drop(t(array('X')), t(array('X', 'NAME')), $flat) === array(), 'found in some row -> not dropped');

echo "\n== _sr_persist_dbdump_column_drop ==\n";
$opts = array('destination_table' => 'PDUMP_FI_EPA', 'dbdump_columns_mode' => 'custom',
              'dbdump_columns_custom' => array('NAME', 'PROPOSALS', 'SUBMITTED_PROPOSALS'), 'subscribers' => array('keep-me'));
$GLOBALS['WRITES'] = array();
\Pnb\_sr_persist_dbdump_column_drop(new FakeConn(array('OPTIONS' => json_encode($opts))), 523, array('submitted_proposals'));
ok(count($GLOBALS['WRITES']) === 1, 'one write');
$w = $GLOBALS['WRITES'][0];
$saved = json_decode($w[1]['OPTIONS'], true);
ok($w[0] === 'PENUMBRA_SCHEDULED_TASKS' && $w[2] === array('OPTIONS') && $w[4] === array(':w_tid' => 523), 'CLOB-safe update of the task row');
ok($saved['dbdump_columns_custom'] === array('NAME', 'PROPOSALS'), 'pruned case-insensitively, order kept', $saved['dbdump_columns_custom']);
ok(isset($saved['dbdump_columns_dropped'][0]['col']) && $saved['dbdump_columns_dropped'][0]['col'] === 'SUBMITTED_PROPOSALS'
   && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $saved['dbdump_columns_dropped'][0]['at']), 'note recorded {col, at}', $saved['dbdump_columns_dropped']);
ok($saved['subscribers'] === array('keep-me') && $saved['destination_table'] === 'PDUMP_FI_EPA', 'every other key untouched');

// Dropping the same column again keeps ONE note for it.
$GLOBALS['WRITES'] = array();
$opts2 = $saved; $opts2['dbdump_columns_custom'][] = 'SUBMITTED_PROPOSALS';
\Pnb\_sr_persist_dbdump_column_drop(new FakeConn(array('OPTIONS' => json_encode($opts2))), 523, array('SUBMITTED_PROPOSALS', 'NAME'));
$s2 = json_decode($GLOBALS['WRITES'][0][1]['OPTIONS'], true);
$cols2 = array_map(function ($n) { return $n['col']; }, $s2['dbdump_columns_dropped']);
ok($cols2 === array('SUBMITTED_PROPOSALS', 'NAME'), 'notes de-duplicated by column', $cols2);
ok($s2['dbdump_columns_custom'] === array('PROPOSALS'), 'second drop prunes again', $s2['dbdump_columns_custom']);

$GLOBALS['WRITES'] = array();
\Pnb\_sr_persist_dbdump_column_drop(new FakeConn(array('OPTIONS' => json_encode(array('dbdump_columns_custom' => array('ONLY'))))), 1, array('ONLY'));
ok(count($GLOBALS['WRITES']) === 0, 'never writes an EMPTY column list');
\Pnb\_sr_persist_dbdump_column_drop(new FakeConn(false), 1, array('X'));
ok(count($GLOBALS['WRITES']) === 0, 'task row gone (transient draft test) -> no write');
\Pnb\_sr_persist_dbdump_column_drop(new FakeConn(array('OPTIONS' => '{"dbdump_columns_mode":"visible"}')), 1, array('X'));
ok(count($GLOBALS['WRITES']) === 0, 'no custom list -> no write');
$GLOBALS['SQL'] = array();
\Pnb\_sr_persist_dbdump_column_drop(new FakeConn(array('OPTIONS' => json_encode($opts))), 1, array(''));
ok(count($GLOBALS['WRITES']) === 0 && count($GLOBALS['SQL']) === 0, 'nothing to drop -> no read, no write');

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL ? 1 : 0);
