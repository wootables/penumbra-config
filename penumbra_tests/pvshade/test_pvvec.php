<?php
// pvshade suite - the lopsided / floor helpers, browser vs email (pvsum 2026-10-11).
//   php -n test_pvvec.php <schedule_runner.php> <vec.json>
// vec.json = the page's {cases, out}: the cases (VEC in driver.js) and what main.js's
// _pvLopsided / _pvRankFloor - lifted from the main.js under test - answered. LIFTS
// pivot_shade_lopsided / pivot_shade_rank_floor (+ the heat domain) out of the candidate
// schedule_runner.php (never require it: it connects to Oracle and sends mail), runs the
// same cases and compares, plus each case's own expected answer (W-*).
$src = str_replace("\r\n", "\n", (string)@file_get_contents($argv[1]));   // schedule_runner.php is CRLF
$fx = json_decode(@file_get_contents($argv[2]), true);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
ok($src && is_array($fx) && isset($fx['cases'], $fx['out']), 'S0 inputs read', is_array($fx) && isset($fx['err']) ? $fx['err'] : '');
if (!$src || !is_array($fx) || !isset($fx['cases'], $fx['out'])) { echo "TOTAL pass=$pass fail=$fail\n"; exit; }

$missing = array();
foreach (array('_pnb_heat_percentile', 'pnb_heat_domain_from', 'pivot_shade_lopsided', 'pivot_shade_rank_floor') as $fn) {
    if (preg_match('/^function ' . preg_quote($fn, '/') . '\(.*?\n\}/sm', $src, $m)) { eval($m[0]); continue; }
    $missing[] = $fn;
}
ok(!$missing, 'S1 the helpers lifted', implode(',', $missing));
if ($missing) { echo "TOTAL pass=$pass fail=$fail\n"; exit; }

function same_nums($a, $b) {
    if (!is_array($a) || !is_array($b) || count($a) !== count($b)) return false;
    foreach ($a as $i => $x) {
        if (is_array($x)) { if (!same_nums($x, isset($b[$i]) ? $b[$i] : null)) return false; continue; }
        if (!isset($b[$i]) || (float)$x !== (float)$b[$i]) return false;
    }
    return true;
}
$js = array();
foreach ($fx['out'] as $o) $js[$o['id']] = $o;
foreach ($fx['cases'] as $c) {
    $col = array(); $doms = array();
    foreach ($c['doms'] as $i => $vals) {
        $vals = array_map('floatval', $vals);
        $col['k' . $i] = pnb_heat_domain_from($vals, null, null);
        $doms['k' . $i] = $vals;
    }
    $lop = pivot_shade_lopsided($col, $doms);
    $sorted = array();
    foreach ($col as $k => $d) { $d = pivot_shade_rank_floor($d); $sorted[] = $d['sorted']; }
    $j = isset($js[$c['id']]) ? $js[$c['id']] : null;
    $same = $j !== null && $j['lop'] === $lop && same_nums($sorted, $j['sorted']);
    ok($same, 'V-' . $c['id'] . ' the email answers as the page does', $same ? '' : json_encode(array('php' => array($lop, $sorted), 'js' => $j)));
    $want = $lop === $c['want'] && (!isset($c['sorted']) || same_nums($sorted, $c['sorted']));
    ok($want, 'W-' . $c['id'] . ' the email\'s answer is the expected one', $want ? '' : json_encode(array('php' => array($lop, $sorted), 'want' => $c)));
}
echo "TOTAL pass=$pass fail=$fail\n";
