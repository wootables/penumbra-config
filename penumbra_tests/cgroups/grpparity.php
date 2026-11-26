<?php
// php -n grpparity.php <penumbra_calc.php> <js.json>
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require $argv[1];
$fx = json_decode(file_get_contents($argv[2]), true);
if (!is_array($fx)) { echo "NO JSON\n"; exit(1); }
if (!empty($fx['fatal'])) { echo "JS FATAL: {$fx['fatal']}\n"; }
if (!empty($fx['errs'])) { echo "JS ERRS: " . json_encode($fx['errs']) . "\n"; }
$rows = $fx['rows']; $keys0 = array_keys($rows[0]);
$bad = 0; $cells = 0;
foreach ($fx['sets'] as $set) {
    $probs = array(); $applied = array();   // (cgroups sweep) the columns this run put on the rows
    $out = pnb_calc_apply_rows($rows, $set['defs'], $probs, $applied);
    $setBad = 0;
    $dateCols = array();
    foreach ($set['defs'] as $dd) if (is_array($dd) && isset($dd['format']) && strncmp((string)$dd['format'], 'date:', 5) === 0) $dateCols[strtoupper((string)$dd['name'])] = true;
    foreach ($out as $i => $r) {
        $ks = implode('|', array_keys($r));
        $vals = array();
        foreach ($r as $k => $v) if (!in_array($k, $keys0, true)) $vals[] = $v;
        $want = $set['out'][$i];
        if ($ks !== $want['keys']) { if ($setBad < 5) echo "  {$set['id']} row $i keys php=$ks js={$want['keys']}\n"; $setBad++; continue; }
        foreach ($vals as $x => $v) {
            // (cgroups sweep) a column in a date pattern: the page's row holds the ISO date and draws the pattern, the server
            // writes the pattern - by design, not a parity cell (a custom groups column READING it is compared)
            $colX = explode('|', $ks); $colX = $colX[count($keys0) + $x];
            if (isset($dateCols[$colX])) continue;
            $cells++;
            if ($v !== $want['vals'][$x]) {
                $col = explode('|', $ks); $col = $col[count($keys0) + $x];
                if ($setBad < 8) echo "  {$set['id']} row $i $col SPONSOR=" . json_encode($rows[$i]['SPONSOR']) . ' LIST=' . json_encode($rows[$i]['LIST']) . ' php=' . json_encode($v) . ' js=' . json_encode($want['vals'][$x]) . "\n";
                $setBad++;
            }
        }
    }
    // the group orders - (cgroups sweep) of the columns on the rows only, as the browser's
    $po = pnb_calc_group_orders($set['defs'], $applied);
    $jsN = array(); foreach ($set['order'] as $pair) $jsN[] = $pair[0];
    $phpN = array_keys($po); sort($jsN); sort($phpN);
    if ($jsN !== $phpN) { echo "  {$set['id']} order names php=" . json_encode($phpN) . ' js=' . json_encode($jsN) . "\n"; $setBad++; }
    // (cgroups sweep) the cells both engines must give
    foreach ((isset($set['expect']) ? $set['expect'] : array()) as $e) {
        $got = (isset($out[$e[0]]) && array_key_exists($e[1], $out[$e[0]])) ? $out[$e[0]][$e[1]] : null;
        if ($got !== $e[2]) { echo "  {$set['id']} expect row {$e[0]} {$e[1]} php=" . json_encode($got) . ' want=' . json_encode($e[2]) . "\n"; $setBad++; }
    }
    if (!empty($set['expectBad'])) { echo "  {$set['id']} expect (js): " . json_encode($set['expectBad']) . "\n"; $setBad++; }
    foreach ($set['order'] as $pair) {
        $nm = $pair[0]; $jo = $pair[1];
        if (!isset($po[$nm]) || json_encode($po[$nm]) !== json_encode($jo)) { echo "  {$set['id']} order $nm php=" . json_encode(isset($po[$nm]) ? $po[$nm] : null) . ' js=' . json_encode($jo) . "\n"; $setBad++; }
    }
    echo ($setBad ? 'FAIL' : 'PASS') . "  {$set['id']}  cols=" . (count(array_keys($out[0])) - count($keys0)) . "  applied(js)=" . implode(',', $set['problems']) . ($setBad ? "  ($setBad differ)" : '') . "\n";
    $bad += $setBad;
}
echo "cells=$cells bad=$bad\n";
echo $bad ? "RESULT: RED\n" : "RESULT: GREEN\n";
