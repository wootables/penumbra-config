<?php
// calcfix engine phase, the server twin: php eng.php <penumbra_calc.php> <cases.json> -> JSON {sets, rx} as eng.html writes.
error_reporting(E_ALL & ~E_DEPRECATED);
require $argv[1];
$c = json_decode(file_get_contents($argv[2]), true);
$res = array('sets' => array(), 'rx' => array());
foreach ($c['sets'] as $s) {
    $p = array(); $a = array(); $w = array();
    $out = pnb_calc_apply_rows($s['rows'], $s['defs'], $p, $a, $w);
    $rows = array();
    foreach ($out as $r) { $o = array(); foreach ($s['defs'] as $d) { $k = isset($d['label']) ? $d['label'] : $d['name']; $o[$d['name']] = isset($r[$k]) ? $r[$k] : null; } $rows[] = $o; }
    $wm = array(); foreach ($w as $x) $wm[$x['name']] = $x['why'];
    $res['sets'][] = array('id' => $s['id'], 'rows' => $rows, 'warn' => (object)$wm);
}
foreach ($c['rx'] as $x) $res['rx'][] = _pnb_calc_grp_rx_problem($x[0]);
echo json_encode($res);
