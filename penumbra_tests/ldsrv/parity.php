<?php
// ldsrv suite - the twin's half (2026-10-24).
//   php -n -d extension=<mbstring dll> parity.php <penumbra_layout.php> <parity.json>
// penumbra_layout.php over the page's corpus (parity.js through the candidate main.js's own code): the row's keys
// in the page's order (pnb_layout_js_keys == Object.keys), the map entry for entry (pnb_layout_by_name ==
// _pnbLayoutByName) and the lists it hands the by-place loops, in the row's own places (pnb_layout_state_here).
// PHP 5.6 syntax on purpose: run.py runs this file on 5.6 too (the stub's reader may run an old PHP).
// Every warning, notice or deprecation the TWIN raises over the corpus is recorded (P-S3-clean); the harness's own
// are not this suite's business
error_reporting(E_ALL);
$LIBWARN = array();
$LIBREAL = realpath($argv[1]);
set_error_handler(function ($no, $str, $file, $line) {
    global $LIBWARN, $LIBREAL;
    if ($LIBREAL !== false && realpath($file) === $LIBREAL) $LIBWARN[] = "$str (line $line)";
    return true;
});
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function done() { global $pass, $fail; echo "TOTAL pass=$pass fail=$fail\n"; echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n"; exit; }
function enc($x) { return json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
$lib = $argv[1];
if (!is_file($lib)) { ok(false, 'P-S0-lib penumbra_layout.php exists', $lib); done(); }
require $lib;
$fx = json_decode(file_get_contents($argv[2]), true);
ok(is_array($fx) && !empty($fx['fx']) && empty($fx['errors']), 'P-S0-page the page side ran', is_array($fx) ? enc($fx['errors']) : 'no json');
if (!is_array($fx) || empty($fx['fx'])) done();
$mb = function_exists('mb_strtoupper');
echo "  INFO  PHP " . PHP_VERSION . ($mb ? ' with' : ' WITHOUT') . " mbstring\n";

// the page's tokens for a list the map gave: a place -> N:<name at it>, any other entry -> E:<its JSON>
function toks($list, $names, $present) {
    if (!is_array($list) || !_pnb_layout_is_list($list)) return array('notList' => $present ? enc($list) : enc('__undefined__'));
    $o = array();
    foreach ($list as $x) $o[] = (is_int($x) && $x >= 0) ? 'N:' . (string)$names[$x] : 'E:' . enc($x);
    return $o;
}
foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error'])) { ok(false, "P-$id the page side built it", $f['error']); continue; }
    $row = json_decode($f['rowJson'], true);
    $keys = array_keys($row);
    $js = array();
    foreach (pnb_layout_js_keys($keys) as $k) $js[] = (string)$k;
    ok($js === $f['jsKeys'], "P-$id-keys the row's keys in the page's order", enc($js) . ' vs ' . enc($f['jsKeys']));
    $st = $f['state'];
    // without the page's upper case (no mbstring / PHP before 7.3) a name outside ASCII - saved or now: by place
    $fullUp = function_exists('mb_strtoupper') && version_compare(PHP_VERSION, '7.3.0', '>=');
    $savedNames = (isset($st['layoutColumnNames']) && is_array($st['layoutColumnNames'])) ? $st['layoutColumnNames'] : array();
    $hi = false;
    foreach (array_merge(array_values($savedNames), $f['jsKeys']) as $n) if (is_string($n) && preg_match('/[\x80-\xFF]/', $n)) $hi = true;
    if (!$fullUp && $hi && pnb_layout_dense_names($savedNames)) {
        ok(pnb_layout_by_name($st, $f['jsKeys']) === null && pnb_layout_state_here($st, $keys) === $st,
           "P-$id-noupper without the page's upper case, a name outside ASCII reads the lists by place");
        continue;
    }
    $lay = pnb_layout_by_name($st, $f['jsKeys']);
    if ($f['byName'] === null || $lay === null) {
        ok($f['byName'] === null && $lay === null, "P-$id-map both read it by place", enc($lay) . ' vs ' . enc($f['byName']));
    } else {
        $got = array('v' => toks($lay['visibleColumns'], $f['jsKeys'], array_key_exists('visibleColumns', $st)), 'o' => toks($lay['columnOrder'], $f['jsKeys'], true));
        ok($got === $f['byName'], "P-$id-map the same entries, place for place", enc($got) . ' vs ' . enc($f['byName']));
    }
    // ...and as handed on: the row's own places; of the other entries the ones the loops would read as a number dropped
    $here = pnb_layout_state_here($st, $keys);
    if ($f['byName'] === null) {
        ok($here === $st, "P-$id-asis the state as it came", enc($here));
        continue;
    }
    $want = array();
    foreach (array('v', 'o') as $w) {
        $want[$w] = $f['byName'][$w];
        if (isset($want[$w]['notList'])) continue;
        $keep = array();
        foreach ($want[$w] as $t) {
            if (strpos($t, 'E:') === 0 && is_numeric(json_decode(substr($t, 2), true))) continue;
            $keep[] = $t;
        }
        $want[$w] = $keep;
    }
    $gotH = array('v' => toks(isset($here['visibleColumns']) ? $here['visibleColumns'] : null, $keys, array_key_exists('visibleColumns', $here)),
                  'o' => toks($here['columnOrder'], $keys, true));
    ok($gotH === $want, "P-$id-here the lists in the row's own places", enc($gotH) . ' vs ' . enc($want));
    ok(!array_key_exists('layoutColumnNames', $here) && array_key_exists('layoutColumnNames', $st), "P-$id-names the names go with the old places");
    $rest = $here; $orig = $st;
    unset($rest['visibleColumns'], $rest['columnOrder'], $orig['visibleColumns'], $orig['columnOrder'], $orig['layoutColumnNames']);
    ok($rest === $orig && (array_key_exists('visibleColumns', $here) === array_key_exists('visibleColumns', $st)), "P-$id-rest nothing else in the state touched");
}

// ---- the pieces, by hand
$S = array(array('5', '5'), array(5, '5'), array(5.0, '5'), array(-0.0, '0'), array(1e20, '100000000000000000000'), array(2.5, '2.5'),
           array(true, 'true'), array(false, 'false'), array(null, 'null'), array(array(3), '3'), array(array(null, 2), ',2'),
           array(array(array(1, 2), 3), '1,2,3'), array(array('a' => 1), '[object Object]'), array(array(), ''));
$bad = array();
foreach ($S as $c) if (_pnb_layout_js_str($c[0]) !== $c[1]) $bad[] = enc($c[0]) . ' -> ' . enc(_pnb_layout_js_str($c[0]));
ok(!$bad, "P-jsstr JS's String() for what a decoded state holds", implode(' ; ', $bad));
$P = array(array(0, true), array('0', true), array('05', true), array(array(3), true), array(5.0, true), array(' 1', false), array("1\n", false),
           array('1.0', false), array(2.5, false), array(-1, false), array(true, false), array(null, false), array('', false), array('#', false));
$bad = array();
foreach ($P as $c) if (_pnb_layout_is_place($c[0]) !== $c[1]) $bad[] = enc($c[0]);
ok(!$bad, 'P-isplace the page\'s /^\\d+$/.test(String(x))', implode(' ; ', $bad));
ok(pnb_layout_js_keys(array('b', 10, 2, 'a', 0, '01', -3, 4294967295, 4294967294)) === array(0, 2, 10, 4294967294, 'b', 'a', '01', -3, 4294967295),
   'P-jskeys array indexes first (smallest first), the rest where they were', enc(pnb_layout_js_keys(array('b', 10, 2, 'a', 0, '01', -3, 4294967295, 4294967294))));
ok(pnb_layout_dense_names(array('A', 'B')) && !pnb_layout_dense_names(array()) && !pnb_layout_dense_names(array('A', '')) && !pnb_layout_dense_names(array('A', 1))
   && !pnb_layout_dense_names(array(1 => 'A')) && !pnb_layout_dense_names('A') && !pnb_layout_dense_names(null), 'P-dense a name, a non-empty string, at every place');
$cn = pnb_layout_calc_names(array('calcColumns' => array(array('name' => ' Net  Margin '), array('name' => 'pct'), 'junk', array('formula' => 'x'), array('name' => array('x')))));
ok(is_callable($cn) && $cn('NET_MARGIN') && $cn('Net_Margin') && $cn('PCT') && !$cn('NET MARGIN') && !$cn('V_ID')
   && pnb_layout_calc_names(array()) === null && pnb_layout_calc_names(array('calcColumns' => array())) === null && pnb_layout_calc_names(null) === null,
   'P-calcnames the calculated columns by penumbra_calc\'s name rule (trimmed, upper case, blanks as _)');
$st0 = array('columnOrder' => array(1, 0), 'visibleColumns' => array('#', 1), 'query' => 'x');
ok(pnb_layout_state_here($st0, array('A', 'B')) === $st0, 'P-nonames a state without the names comes back as it was');
$st1 = $st0; $st1['layoutColumnNames'] = array('B', 'A');
$thrower = function ($n) { throw new Exception('boom'); };
ok(pnb_layout_state_here($st1, array('A', 'B'), array(), $thrower) === $st1 && pnb_layout_by_name($st1, array('A', 'B'), $thrower) === null,
   'P-net anything failing in the map: read by place (the state as it came)');
$h = pnb_layout_state_here($st1, array('J1', 'A', 'B'), array('J1'));
ok($h['columnOrder'] === array(1, 2) && $h['visibleColumns'] === array('#', 1), 'P-skip a key the page never had is left out of the map, its place still counted', enc($h));
ok($LIBREAL !== false && !$LIBWARN, 'P-S3-clean the twin raised no warning, notice or deprecation over the corpus',
   $LIBREAL === false ? 'the twin\'s path does not resolve: nothing could be recorded' : implode(' ; ', array_slice($LIBWARN, 0, 5)));
done();
