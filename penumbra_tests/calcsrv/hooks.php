<?php
// calcsrv suite - hook half (2026-10-11).
//   php -n hooks.php <penumbra_calc.php> <schedule_runner.php> <index.php>
// The candidate's OWN hook code, lifted out of schedule_runner.php / index.php and
// run here (never require the runner: it connects to Oracle and SENDS MAIL):
//   H-sched*   execute_scheduled_report(): the rows filled before any consumer,
//              the summable names, the left-out ones logged
//   H-stream*  the streamed table dump: each row mapped on the way in
//   H-total*   penumbra_summary_global_default(): a saved number-format column totals
//   H-json*    index.php ?json=1: the rows filled before the column placement
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
$lib = $argv[1];
$sr = str_replace("\r\n", "\n", (string)@file_get_contents($argv[2]));
$ix = str_replace("\r\n", "\n", (string)@file_get_contents($argv[3]));
ok(is_file($lib) && $sr !== '' && $ix !== '', 'S0 inputs read', $lib);
if (!is_file($lib)) { echo "TOTAL pass=$pass fail=$fail\nRESULT: RED\n"; exit; }
require $lib;
$LIBQ = var_export($lib, true);
function lift($src, $from, $to) {
    $i = strpos($src, $from); if ($i === false) return null;
    $j = strpos($src, $to, $i + strlen($from)); if ($j === false) return null;
    return substr($src, $i, $j - $i);
}
function uselib($code) { global $LIBQ; return str_replace("__DIR__ . '/penumbra_calc.php'", $LIBQ, $code); }
$LOG = array();
function log_scheduler($m) { global $LOG; $LOG[] = $m; }

$DEFS = array(array('name' => 'MARGIN', 'formula' => '{AMOUNT} - {COST}', 'format' => 'currency'),
              array('name' => 'PCT', 'formula' => 'ROUND({COST} / {AMOUNT}, 4)', 'format' => 'percent'),
              array('name' => 'NOTE', 'formula' => 'IF({MARGIN} < 0, "loss", "ok")', 'format' => 'text'),
              array('name' => 'GONE', 'formula' => '{NOPE} + 1'),
              array('name' => 'HALF', 'formula' => '{AMOUNT} / 2'));
$ROWS = array(array('ID' => '1', 'AMOUNT' => '100', 'COST' => '40'), array('ID' => '2', 'AMOUNT' => '50', 'COST' => '75.5'));

// ---- the scheduler's rows
$blk = lift($sr, "    // --- CALCULATED COLUMNS saved with the report (2026-10-11, calcsrv) ---\n", "    // --- JOURNAL TOGGLE STATUS for scheduled output");
ok($blk !== null, 'H-sched-found the hook block is in execute_scheduled_report');
$posDecode = strpos($sr, "    \$apiData = safe_json_decode(\$data_response);\n");
$posHook = $blk === null ? false : strpos($sr, $blk);
$posFlat = strpos($sr, "    \$flat_rows = isset(\$apiData['data']) ? \$apiData['data'] : array();\n");
$fnStart = strpos($sr, 'function execute_scheduled_report(');
$fnNext = strpos($sr, "\nfunction ", $fnStart + 10);
ok($posDecode !== false && $posHook !== false && $posFlat !== false && $posDecode < $posHook && $posHook < $posFlat && $posHook > $fnStart && $posHook < $fnNext,
   'H-sched-place right after the query answer is read, before the first reader ($flat_rows)', json_encode(array($posDecode, $posHook, $posFlat)));
if ($blk !== null) {
    $run = function ($state, $apiData) use ($blk) {
        eval(uselib($blk));
        return array($apiData, $GLOBALS['penumbra_calc_summable']);
    };
    list($api, $summ) = $run(array('calcColumns' => $DEFS), array('data' => $ROWS));
    $r0 = $api['data'][0]; $r1 = $api['data'][1];
    ok(array_keys($r0) === array('ID', 'AMOUNT', 'COST', 'MARGIN', 'PCT', 'NOTE', 'HALF'), 'H-sched-rows the saved columns at the END, in the saved order (the bad one left out)', json_encode(array_keys($r0)));
    ok($r0['MARGIN'] === '$60.00' && $r1['MARGIN'] === '-$25.50' && $r1['NOTE'] === 'loss' && $r0['PCT'] === '40%' && $r1['HALF'] === '25', 'H-sched-values worked out', json_encode($api['data']));
    ok($summ === array('MARGIN' => true, 'PCT' => true, 'HALF' => true), 'H-sched-summable the number-format ones, by exact name (not text, not the left-out one)', json_encode($summ));
    ok((bool)preg_grep('/GONE left out/', $LOG), 'H-sched-logged a left-out column is logged', json_encode($LOG));
    list($api2, $summ2) = $run(array('query' => 'x'), array('data' => $ROWS));
    ok($api2['data'] === $ROWS && $summ2 === array(), 'H-sched-none no saved columns: the rows untouched, the summable list reset', json_encode($summ2));
    list($api3, ) = $run(array('calcColumns' => $DEFS), array('data' => array()));
    ok($api3['data'] === array(), 'H-sched-empty no rows: nothing to do');
}

// ---- the streamed table dump
$sblk = lift($sr, "    // A streamed run (the big table dump) never builds a rows array, so the saved\n", "    // Tell query.php this run's caller can absorb");
ok($sblk !== null && strpos($sr, $sblk) < strpos($sr, 'CURLOPT_WRITEFUNCTION', strpos($sr, $sblk)) && strpos($sr, $sblk) > $fnStart && strpos($sr, $sblk) < $fnNext,
   'H-stream-place the wrapper is set before the stream callback is handed to curl');
if ($sblk !== null) {
    $got = array();
    $inner = function ($row) use (&$got) { $got[] = $row; };
    $wrap = function ($state, $stream_row_callback, $penumbraStreaming) use ($sblk) { eval(uselib($sblk)); return $stream_row_callback; };
    $cb = $wrap(array('calcColumns' => $DEFS), $inner, true);
    foreach ($ROWS as $r) $cb($r);
    ok(count($got) === 2 && isset($got[1]['MARGIN']) && $got[1]['MARGIN'] === '-$25.50' && array_keys($got[0]) === array('ID', 'AMOUNT', 'COST', 'MARGIN', 'PCT', 'NOTE', 'HALF'),
       'H-stream-rows each streamed row carries the saved columns, as the buffered run does', json_encode($got));
    $got = array();
    $cb2 = $wrap(array(), $inner, true);
    $cb2($ROWS[0]);
    ok($cb2 === $inner && $got === array($ROWS[0]), 'H-stream-none no saved columns: the callback is left as it was');
}

// ---- default totals
$fblk = lift($sr, "function penumbra_summary_global_default(\$header, \$isCurrencyCol) {", "\n}\n");
ok($fblk !== null, 'H-total-found penumbra_summary_global_default');
if ($fblk !== null) {
    $GLOBALS['total_exemptions'] = array('AMOUNT');
    eval($fblk . "\n}\n");
    $GLOBALS['penumbra_calc_summable'] = array('HALF' => true);
    ok(penumbra_summary_global_default('half', false) === 'sum' && penumbra_summary_global_default('OTHER', false) === null
       && penumbra_summary_global_default('MY_AMOUNT', false) === 'sum' && penumbra_summary_global_default('X', true) === 'sum',
       'H-total-calc a saved number-format calculated column totals by exact name; the old rules unchanged');
    $GLOBALS['penumbra_calc_summable'] = array();
    ok(penumbra_summary_global_default('HALF', false) === null, 'H-total-reset the next report (no list) does not total it');
}

// ---- the JSON API
$jblk = lift($ix, "        // Calculated columns saved with the report - or carried by a ?state= view\n", "        // Strip debug info from JSON API responses");
$posCap = strpos($ix, "        \$response = json_decode(\$raw_json, true);\n");
$posVis = strpos($ix, "visibleColumns", $posCap === false ? 0 : $posCap);
ok($jblk !== null && $posCap !== false && strpos($ix, $jblk) > $posCap && strpos($ix, $jblk) < $posVis, 'H-json-place after query.php\'s capture is decoded, before the column placement');
if ($jblk !== null) {
    $jrun = function ($state, $response) use ($jblk) { eval(uselib($jblk)); return $response; };
    $r = $jrun(array('calcColumns' => $DEFS), array('data' => $ROWS, 'columns_meta' => array()));
    ok(isset($r['data'][0]['MARGIN']) && $r['data'][0]['MARGIN'] === '$60.00' && array_keys($r['data'][1]) === array('ID', 'AMOUNT', 'COST', 'MARGIN', 'PCT', 'NOTE', 'HALF'), 'H-json-rows the API rows carry the saved columns', json_encode($r));
    $r2 = $jrun(array('encrypted' => true, 'content' => 'x'), array('data' => $ROWS));
    $r3 = $jrun(null, array('data' => $ROWS));
    $r4 = $jrun(array('calcColumns' => $DEFS), array('error' => 'boom'));
    ok($r2['data'] === $ROWS && $r3['data'] === $ROWS && $r4 === array('error' => 'boom'), 'H-json-none an encrypted / missing state, or an error answer: untouched');
}

// ---- the off switch
$offDir = dirname($lib) . '/js';
@mkdir($offDir);
$off = $offDir . '/penumbra_calc.off';
@file_put_contents($off, '');
$o = pnb_calc_apply_rows($ROWS, $DEFS);
@unlink($off);
ok($o === $ROWS && pnb_calc_row_mapper($DEFS) !== null, 'H-off js/penumbra_calc.off switches the server copy off too');

echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
