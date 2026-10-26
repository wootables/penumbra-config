<?php
// srvsort suite - the twin's half (2026-10-24). PHP 5.6 syntax: run.py runs it on 8.2 (+mbstring), 7.4 (+mbstring)
// and 5.6 (none: P56-*).
//   php -n [-d extension=<mbstring dll>] parity.php <penumbra_layout.php> <parity.json>
// penumbra_layout.php's sort twin over the page's corpus (parity.js, through the candidate main.js's own code):
//   P-<id>-map        pnb_sort_by_name == the page's _pnbStateSortByName, level for level (and what it drops),
//                     given the page's own names, savedCount and notSaved
//   P-<id>-names-*    the page's places from the API's rows (the journal's left out) and a stub's (+ the calculated
//                     columns' tail): the names the page has, in its order
//   P-<id>-here-*     pnb_sort_state_here on the API's rows / a stub's: each level on the column the page sorts by,
//                     in the row's own places ('#' and the journal's as they are; a stub: none on a calculated one)
//   P-<id>-assaved    a pivot's chain, a sort that is not a list: the state as it came
//   P-S*              the functions load, raise no warning / notice / deprecation, the helpers read as the page does
error_reporting(E_ALL);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function done() { global $pass, $fail; echo "TOTAL pass=$pass fail=$fail\n"; echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n"; exit; }
function enc($x) { return json_encode($x); }
$lib = $argv[1];
$fx = json_decode((string)@file_get_contents($argv[2]), true);
ok(is_array($fx) && !empty($fx['fx']), 'P-S0-page the page side ran', is_array($fx) ? enc($fx['errors']) : 'no corpus');
if (!is_array($fx) || empty($fx['fx'])) done();
@include_once $lib;
$have = function_exists('pnb_sort_state_here') && function_exists('pnb_sort_by_name') && function_exists('pnb_sort_calc_tail') && function_exists('pnb_layout_js_keys');
ok($have, 'P-S0 the sort twin loads (pnb_sort_state_here, pnb_sort_by_name, pnb_sort_calc_tail)');
$full = $have && _pnb_layout_full_upper();
echo "  INFO  PHP " . PHP_VERSION . ', mbstring ' . (function_exists('mb_strtoupper') ? 'yes' : 'no') . ', full upper case ' . ($full ? 'yes' : 'no') . "\n";
// every warning, notice or deprecation the twin raises is a finding
$raised = array();
set_error_handler(function ($no, $str, $file, $line) use (&$raised) { $raised[] = "$str @" . basename($file) . ":$line"; return true; });

function upset($names) { $o = array(); foreach ($names as $n) $o[strtoupper((string)$n)] = true; return $o; }
function nonascii($a) { foreach ($a as $x) if (preg_match('/[\x80-\xFF]/', (string)$x)) return true; return false; }
function sv($v) { return $v === null ? 'null' : (is_bool($v) ? ($v ? 'true' : 'false') : (is_array($v) ? json_encode($v) : (string)$v)); }
// the page's plan with each level on its column's name; a level the twin hands on, in a row's places, the same way
function plan_of_state($criteria, $rowKeys) {
    $out = array();
    if (!is_array($criteria)) return array('notList' => true);
    foreach ($criteria as $c) {
        $dir = (is_array($c) && isset($c['direction']) && strtolower((string)$c['direction']) === 'desc') ? 'desc' : 'asc';
        if (is_array($c) && isset($c['colIndex']) && is_int($c['colIndex']) && isset($rowKeys[$c['colIndex']])) $out[] = 'C:' . (string)$rowKeys[$c['colIndex']] . '|' . $dir;
        elseif (is_array($c) && isset($c['colIndex']) && is_string($c['colIndex'])) $out[] = 'V:' . $c['colIndex'] . '|' . $dir;
        else $out[] = 'X:' . json_encode($c);
    }
    return $out;
}
function plan_of_page($plan, $dropCols = array()) {
    $out = array();
    foreach ($plan as $p) {
        if (isset($p['col'])) { if (!in_array($p['col'], $dropCols, true)) $out[] = 'C:' . $p['col'] . '|' . $p['dir']; }
        else $out[] = 'V:' . $p['virt'] . '|' . $p['dir'];
    }
    return $out;
}

if ($have) {
    // ---- the helpers, as the page reads a value
    $pl = array(array(5, 5.0), array('05', 5.0), array('5', 5.0), array(' 5', -1), array("5\n", -1), array('5.0', -1), array(5.0, 5.0),
                array(array(3), 3.0), array(array(array(3)), 3.0), array(true, -1), array(null, -1), array('1e3', -1), array(-1, -1), array('', -1),
                array(array('a' => 1), -1), array('99999999999999999999', 1e20));
    $bad = array();
    foreach ($pl as $t) { $got = _pnb_sort_place_of(array('colIndex' => $t[0])); if ($got !== $t[1] && !($got == $t[1] && is_float($got))) $bad[] = sv($t[0]) . '->' . sv($got); }
    if (_pnb_sort_place_of(array()) !== -1) $bad[] = 'missing';
    ok(!$bad, 'P-placeof a saved colIndex is a place as the page\'s /^\\d+$/.test(String(x)) reads it', implode('; ', $bad));
    $tr = array(array(array(), true), array(array('rows' => array()), true), array('', false), array('0', true), array('false', true), array(0, false),
                array(0.0, false), array(1, true), array(-1.5, true), array(false, false), array(true, true), array(null, false));
    $bad = array();
    foreach ($tr as $t) if (_pnb_sort_js_truthy($t[0]) !== $t[1]) $bad[] = sv($t[0]);
    ok(!$bad, 'P-truthy JS truthiness of a decoded value (an empty pivot {} is true)', implode('; ', $bad));
    $lv = array(array(array('colIdentifier' => 'A'), true), array(array('colIdentifier' => ''), false), array(array('colIdentifier' => null), false),
                array(array('colIndex' => 1), false), array(array('colIdentifier' => 0), true), array(array('colIdentifier' => false), true),
                array(array('colIdentifier' => array()), false), array(array('colIdentifier' => array(null)), false), array(array('colIdentifier' => array(1, 2)), true),
                array('A', false), array(5, false), array(null, false), array(array('A'), false));
    $bad = array();
    foreach ($lv as $t) if (_pnb_sort_is_level($t[0]) !== $t[1]) $bad[] = json_encode($t[0]);
    ok(!$bad, 'P-islevel a level is an object whose colIdentifier is neither null nor \'\' as text', implode('; ', $bad));
    $vt = array(array('#', true), array('__JOURNAL_TOGGLE__k1', true), array('__', true), array('_X', false), array('#1', false), array(3, false), array(array('#'), false));
    $bad = array();
    foreach ($vt as $t) if (_pnb_sort_is_virtual(array('colIdentifier' => 'X', 'colIndex' => $t[0])) !== $t[1]) $bad[] = json_encode($t[0]);
    if (_pnb_sort_is_virtual(array('colIdentifier' => 'X')) !== false) $bad[] = 'missing';
    ok(!$bad, 'P-isvirtual \'#\' and a \'__\' heading are not the result\'s columns', implode('; ', $bad));
    // ---- the calculated columns' tail (cleanDef, the first 20, a real column's name left out)
    $defs = array(array('name' => ' net  margin ', 'formula' => '{A} * 2'), array('name' => 'v_id', 'formula' => '1'), array('name' => '9X', 'formula' => '1'),
                  array('name' => 'EMPTY', 'formula' => '   '), array('name' => 'LONG', 'formula' => str_repeat('1', 501)), array('name' => 'OK500', 'formula' => str_repeat('1', 500)),
                  array('name' => 'net_margin', 'formula' => '2'), array('formula' => '1'), 'junk', array('name' => 0, 'formula' => '1'), array('name' => "TAB\tNAME", 'formula' => '1'));
    $got = pnb_sort_calc_tail(array('calcColumns' => $defs), array('V_ID', 'V_NAME'));
    // (' net  margin ' names a column the rows lack - but 'net_margin' later is the same name: it takes its place)
    ok($got === array('NET_MARGIN', 'OK500', 'TAB_NAME'), 'P-tail the report\'s calculated columns as cleanDef keeps them, less a real column\'s name', enc($got));
    // ...as penumbra_calc's plan works them out: references to the rows' columns or to calculated ones that work
    // out (any case, blanks inside the braces), quoted text no reference, adjustable values any definition carries
    $refs = array(array('name' => 'X', 'formula' => '{v_name} * 2'), array('name' => 'Y', 'formula' => '{V_GONE} + 1'), array('name' => 'Z', 'formula' => '{X} + {Y}'),
                  array('name' => 'W', 'formula' => '{ x } * 2'), array('name' => 'Q', 'formula' => '"{V_GONE}" & {V_ID}'), array('name' => 'U', 'formula' => '{V_ID * 2'),
                  array('name' => 'E', 'formula' => '{} + 1'), array('name' => 'S', 'formula' => '"abc & {V_ID}'), array('name' => 'I', 'formula' => '{@RATE} * 2'),
                  array('name' => 'R', 'formula' => '1', 'input' => array('name' => ' rate ', 'value' => 2)), array('name' => 'I2', 'formula' => '{@ rate } * {V_ID}'),
                  array('name' => 'E2', 'formula' => '{@} * 2'));
    $got = pnb_sort_calc_tail(array('calcColumns' => $refs), array('V_ID', 'V_NAME'));
    ok($got === array('X', 'W', 'Q', 'I', 'R', 'I2'), 'P-tailrefs a calculated column naming a column the rows and the others lack is left out, as the plan does', enc($got));
    $got = pnb_sort_calc_tail(array('calcColumns' => array(array('name' => 'X', 'formula' => '{Y}'), array('name' => 'Y', 'formula' => '{X} + 1'),
                                                           array('name' => 'W', 'formula' => '{X}'), array('name' => 'Z', 'formula' => '{V_ID}'))), array('V_ID'));
    ok($got === array('Z'), 'P-tailloop two that use each other are never worked out, nor one that uses them', enc($got));
    $got = pnb_sort_calc_tail(array('calcColumns' => array(array('name' => 'X', 'formula' => '{@NONE} * {V_ID}'))), array('V_ID'));
    ok($got === array(), 'P-tailinput an adjustable value no definition carries: left out', enc($got));
    $got = pnb_sort_calc_tail(array('calcColumns' => array(array('name' => 'M', 'formula' => '{V_GONE}'), array('name' => 'N', 'formula' => '1'), array('name' => 'm', 'formula' => '{V_ID}'))), array('V_ID'));
    ok($got === array('M', 'N'), 'P-taildup a later definition of a name takes the earlier one\'s place', enc($got));
    $many = array(); for ($i = 1; $i <= 22; $i++) $many[] = array('name' => 'C' . $i, 'formula' => '1');
    $got = pnb_sort_calc_tail(array('calcColumns' => $many), array('C3'));
    $want = array(); for ($i = 1; $i <= 20; $i++) if ($i !== 3) $want[] = 'C' . $i;
    ok($got === $want, 'P-tail20 the first 20 the page keeps (one of them a real column\'s name: left out, still counted)', enc($got));
    ok(pnb_sort_calc_tail(array(), array('A')) === array() && pnb_sort_calc_tail(array('calcColumns' => array('a' => array('name' => 'X', 'formula' => '1'))), array()) === array(),
       'P-tailnone no calculated columns (or not a list): none');
    if (!$full) ok(pnb_sort_calc_tail(array('calcColumns' => array(array('name' => 'ﬁx', 'formula' => '1'))), array()) === null, 'P-tail-noupper no full upper case and a name outside ASCII: cannot tell');
    // ---- a state the twin hands back as it came
    $st = array('sortCriteria' => array(array('colIdentifier' => 'B', 'colIndex' => 0, 'direction' => 'asc')), 'columnOrder' => array(0, 1));
    ok(pnb_sort_state_here($st, array('A', 'B'), array(), null, null) === $st, 'P-tailnull a tail it cannot tell: the state as it came');
    ok(pnb_sort_state_here($st, 'A,B') === $st && pnb_sort_state_here('x', array('A')) === 'x', 'P-badargs rows or a state that are not arrays: as they came');
}

$mb = function_exists('mb_strtoupper');
foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error'])) { ok(false, "P-$id the page side built it", $f['error']); continue; }
    if (!$have) { ok(false, "P-$id-map the twin is not there"); continue; }
    $st = $f['state'];
    $rowNow = json_decode($f['rowNow'], true);
    $nowKeys = array_keys($rowNow);
    $jsonKeys = array_merge($nowKeys, $f['calc'], $f['journal']);
    $pageNames = $f['pageNames'];
    $mine = upset(array_merge($f['link'] ? $f['calc'] : array(), $f['pageOnly']));
    $isCalc = function ($n) use ($mine) { return isset($mine[strtoupper((string)$n)]); };
    $ids = array();
    if (is_array($st) && isset($st['sortCriteria']) && is_array($st['sortCriteria'])) {
        foreach ($st['sortCriteria'] as $c) if (is_array($c) && isset($c['colIdentifier'])) $ids[] = sv($c['colIdentifier']);
    }
    // without the page's upper case (5.6 here: no mbstring) the twin reads a name outside ASCII as saved
    $noUpper = !$full && (nonascii($pageNames) || nonascii($ids));
    $raised = array();

    // ---- the map itself, given the page's names, savedCount and notSaved
    if ($f['direct'] !== null) {
        $r = pnb_sort_by_name($st['sortCriteria'], $pageNames, $f['savedCount'], $isCalc);
        if ($noUpper) {
            ok($r === null, "P-$id-map-noupper without the page's upper case a name outside ASCII: as saved", enc($r));
        } else {
            $got = null;
            if (is_array($r)) {
                $got = array('kept' => array(), 'dropped' => array());
                foreach ($r['kept'] as $c) $got['kept'][] = array('id' => sv($c['colIdentifier']), 'at' => is_int($c['colIndex']) ? $c['colIndex'] : 'V:' . sv($c['colIndex']), 'dir' => sv(isset($c['direction']) ? $c['direction'] : null));
                foreach ($r['dropped'] as $d) $got['dropped'][] = sv($d);
            }
            // the page's "undefined" direction of a kept '#' or journal level reads as the twin's null
            $want = $f['direct'];
            foreach ($want['kept'] as $i => $k) if ($k['dir'] === '__undefined__') $want['kept'][$i]['dir'] = 'null';
            ok($got === $want, "P-$id-map the twin keeps and drops the page's levels, level for level", enc($got) . ' vs ' . enc($want));
        }
    }
    // the API's notSaved for a ?state= link: the calculated columns it worked out (index.php $_ssCalcAdded)
    $calcKeys = $f['calc'];
    $notSaved = ($f['link'] && $calcKeys) ? function ($n) use ($calcKeys) { return in_array((string)$n, $calcKeys, true); } : null;
    if ($noUpper) {
        $h = pnb_sort_state_here($st, $jsonKeys, $f['journal'], $notSaved);
        ok($h === $st, "P-$id-here-noupper without the page's upper case: the state as it came (by place, as before)");
        continue;
    }

    // ---- the page's places from the API's rows (the journal's left out), and a stub's (+ the tail)
    $want = array_values(array_filter($pageNames, function ($n) use ($f) { return !in_array($n, $f['pageOnly'], true); }));
    $jsk = array(); foreach (pnb_layout_js_keys(array_values(array_filter($jsonKeys, function ($k) use ($f) { return !in_array((string)$k, $f['journal'], true); }))) as $k) $jsk[] = (string)$k;
    ok($jsk === $want, "P-$id-names-json the API's rows in the page's places", enc($jsk) . ' vs ' . enc($want));
    $tail = pnb_sort_calc_tail($st, $nowKeys);
    if ($f['stub']) {
        $sk = array(); foreach (pnb_layout_js_keys($nowKeys) as $k) $sk[] = (string)$k;
        $sk = array_merge($sk, is_array($tail) ? $tail : array());
        $wantU = array_map(function ($n) { return function_exists('mb_strtoupper') ? mb_strtoupper($n, 'UTF-8') : strtoupper($n); }, $want);
        $skU = array_map(function ($n) { return function_exists('mb_strtoupper') ? mb_strtoupper($n, 'UTF-8') : strtoupper($n); }, $sk);
        ok($skU === $wantU, "P-$id-names-stub a stub's rows and the calculated columns' tail in the page's places", enc($sk) . ' vs ' . enc($want));
    }

    // ---- the twin on the API's rows, and on a stub's
    $here = pnb_sort_state_here($st, $jsonKeys, $f['journal'], $notSaved);
    if (!$f['page']) {
        ok($here === $st, "P-$id-assaved the state as it came (a pivot's chain, a sort that is not a list)", enc(isset($here['sortCriteria']) ? $here['sortCriteria'] : null));
    } else {
        $got = isset($here['sortCriteria']) ? plan_of_state($here['sortCriteria'], $jsonKeys) : array();
        $wantP = plan_of_page($f['plan']);
        ok($got === $wantP, "P-$id-here-json on the API's rows: the columns the page sorts by, in its order", enc($got) . ' vs ' . enc($wantP));
        if ($f['stub']) {
            $hs = pnb_sort_state_here($st, $nowKeys, array(), null, $tail);
            $got = isset($hs['sortCriteria']) ? plan_of_state($hs['sortCriteria'], $nowKeys) : array();
            $wantS = plan_of_page($f['plan'], $f['calc']);
            ok($got === $wantS, "P-$id-here-stub on a stub's rows: the page's columns but its calculated ones", enc($got) . ' vs ' . enc($wantS));
        }
    }
    ok(!$raised, "P-$id-clean the twin raised no warning, notice or deprecation", implode(' | ', array_slice($raised, 0, 4)));
}
restore_error_handler();
done();
