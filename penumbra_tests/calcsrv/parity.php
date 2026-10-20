<?php
// calcsrv suite - parity half, server side (2026-10-11).
//   php -n parity.php <penumbra_calc.php> <parity.json>
// The browser's output (parity.js through js/penumbra_calc.js) against
// penumbra_calc.php's over the SAME rows and definitions: every row's column
// order and every appended cell, byte for byte.
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
$lib = $argv[1];
if (!is_file($lib)) { ok(false, 'S0 penumbra_calc.php exists', $lib); echo "TOTAL pass=$pass fail=$fail\nRESULT: RED\n"; exit; }
require $lib;
$fx = json_decode(file_get_contents($argv[2]), true);
ok(is_array($fx) && !empty($fx['sets']), 'S0 the browser side ran', is_array($fx) && isset($fx['fatal']) ? $fx['fatal'] : '');
if (!is_array($fx) || empty($fx['sets'])) { echo "TOTAL pass=$pass fail=$fail\nRESULT: RED\n"; exit; }
// TODAY(): the browser's day is the machine's local day - the server's is its own zone
if (!empty($fx['tz'])) @date_default_timezone_set($fx['tz']);
ok(date('Y-n-j') === $fx['today'], 'S1 both sides agree on today', date('Y-n-j') . ' vs ' . $fx['today']);

$rows = $fx['rows'];
$keys0 = array_keys($rows[0]);
$cells = 0; $totalBad = 0;
foreach ($fx['sets'] as $set) {
    $out = pnb_calc_apply_rows($rows, $set['defs']);
    $bad = array(); $n = 0;
    foreach ($out as $i => $r) {
        $ks = implode('|', array_keys($r));
        $vals = array();
        foreach ($r as $k => $v) if (!in_array($k, $keys0, true)) $vals[] = $v;
        $want = $set['out'][$i];
        $n += count($vals);
        if ($ks !== $want['keys']) { $bad[] = "row $i keys php=$ks js={$want['keys']}"; continue; }
        foreach ($vals as $x => $v) {
            if ($v !== $want['vals'][$x]) {
                $col = explode('|', $ks); $col = $col[count($keys0) + $x];
                $def = null; foreach ($set['defs'] as $d) if (is_array($d) && isset($d['name']) && strtoupper(trim((string)$d['name'])) === $col) $def = $d;
                $bad[] = "row $i $col [" . ($def ? $def['formula'] . ' | ' . (isset($def['format']) ? $def['format'] : '') : '?') . '] A=' . json_encode($rows[$i]['A'] ?? null) . ' B=' . json_encode($rows[$i]['B'] ?? null)
                    . ' C=' . json_encode($rows[$i]['C'] ?? null) . ' D1=' . json_encode($rows[$i]['D1'] ?? null) . ' D2=' . json_encode($rows[$i]['D2'] ?? null)
                    . ' php=' . json_encode($v) . ' js=' . json_encode($want['vals'][$x]);
            }
        }
    }
    $cells += $n; $totalBad += count($bad);
    ok(!$bad && $n > 0 || (!$bad && in_array($set['id'], array('loop', 'missing', 'junk'), true)), 'P-' . $set['id'] . ' ' . $n . ' cells identical', count($bad) . ' differ: ' . implode(' ;; ', array_slice($bad, 0, 4)));
}
// rows whose keys differ: the plan is the first row's
$o = pnb_calc_apply_rows($fx['odd']['rows'], array(array('name' => 'S', 'formula' => '{A} + {B}'), array('name' => 'X2', 'formula' => '{EXTRA} + 1')));
// (a row lacking one of the first row's columns: JS holds it undefined, which JSON
// drops; PHP holds null - the same empty cell. Compared without the nulls.)
$oc = array_map(function ($r) { return is_array($r) ? array_filter($r, function ($v) { return $v !== null; }) : $r; }, $o);
ok(json_encode($oc) === json_encode($fx['odd']['out']) && !isset($o[1]['X2']), 'P-oddRows the first row decides the columns', json_encode($o) . ' vs ' . json_encode($fx['odd']['out']));
ok(function_exists('mb_strtolower'), 'S2 mbstring loaded, as production\'s php.ini loads it');
// the structural sets did what they are for
$by = array(); foreach ($fx['sets'] as $s) $by[$s['id']] = $s;
$k = isset($by['depOrder']) ? $by['depOrder']['out'][0]['keys'] : '';
ok(substr($k, -12) === '|Z3|Z2|Z1|Z4', 'P-listOrder columns go on in LIST order, worked out in dependency order', $k);
$k = isset($by['loop']) ? $by['loop']['out'][0]['keys'] : '';
ok(substr($k, -3) === '|L3' && strpos($k, 'L1') === false && strpos($k, 'L5') === false, 'P-loopLeftOut a loop (and what uses it) is left out', $k);
$k = isset($by['many']) ? $by['many']['out'][0]['keys'] : '';
ok(substr_count($k, '|N') === 20, 'P-max20 at most 20', $k);
// (2026-10-18, calcadj) adjustable values: the ones named exist, one no column carries is left out
$k = isset($by['inputs']) ? $by['inputs']['out'][0]['keys'] : '';
ok(substr($k, -18) === '|I1|I2|I4|I5|I6|I7' && strpos($k, 'I3') === false, 'P-inputsLeftOut a value no column carries leaves its column out; the rest stay', $k);
$d = pnb_calc_clean_def(array('name' => 'X', 'formula' => '{@K}', 'input' => array('name' => ' k ', 'value' => '7', 'min' => 0, 'max' => 5, 'step' => '0.5')));
ok(isset($d['input']) && $d['input'] === array('name' => 'K', 'value' => 5.0, 'min' => 0.0, 'max' => 5.0, 'step' => 0.5), 'P-inputClean a definition\'s value: named, numbered, within its bounds', json_encode($d));
$d = pnb_calc_clean_def(array('name' => 'X', 'formula' => '1', 'input' => array('name' => 'K', 'value' => '$5')));
ok(!isset($d['input']), 'P-inputBad a value that is not a plain number is no value', json_encode($d));
// (2026-10-19, round 5) a date value: read from a US spelling, kept as YYYY-MM-DD, bounded as text, the step in days
$k = isset($by['dateInputs']) ? $by['dateInputs']['out'][0]['keys'] : '';
ok(strpos($k, 'J6') === false && substr($k, -18) === '|J1|J2|J3|J4|J5|J7', 'P-dateInputsLeftOut a value that is neither a number nor a date leaves its column out', $k);
$d = pnb_calc_clean_def(array('name' => 'X', 'formula' => '{@K}', 'input' => array('name' => ' k ', 'value' => '10/15/2026', 'min' => '2026-01-01', 'max' => '2026-12-31', 'step' => '7')));
ok(isset($d['input']) && $d['input'] === array('name' => 'K', 'value' => '2026-10-15', 'kind' => 'date', 'min' => '2026-01-01', 'max' => '2026-12-31', 'step' => 7.0), 'P-inputDateClean a date value: named, dated, within its bounds', json_encode($d));
$d = pnb_calc_clean_def(array('name' => 'X', 'formula' => '{@K}', 'input' => array('name' => 'K', 'kind' => 'date', 'value' => '2027-06-01', 'max' => '2026-12-31')));
ok(isset($d['input']) && $d['input']['value'] === '2026-12-31', 'P-inputDateClamp a date over its highest is kept to it', json_encode($d));
echo "  INFO  $cells cells compared, $totalBad differ\n";
echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
