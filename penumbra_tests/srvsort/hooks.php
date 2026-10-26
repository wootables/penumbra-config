<?php
// srvsort suite - the API's half (2026-10-24).
//   php -n -d extension=<mbstring dll> hooks.php <index.php> <ref index.php> <penumbra_layout.php> <journal_export.php>
//                                                <penumbra_search.php> <parity.json>
// index.php ?json=1's OWN sort block - from the journal's columns up to the columns envelope: the twin's call, the
// journal's names mapped, the decorate-sort-undecorate - lifted and run on the page's corpus (parity.js through the
// candidate main.js's own code), on the rows as the API has them (the query's columns, its calculated ones, then
// the journal's):
//   H-json-<id>   the rows come out in the order of the columns the page sorts by ('#' read as the API always
//                 has: not a column; a journal heading's as its column)
//   O-json-<id>   a state the page reads as before reads exactly as in the reference cut (the files before srvsort)
//   H-S1-json     the block reads the sort through pnb_sort_state_here before the journal's names and its loop
//   H-S2-*        the twin's file missing or empty: by place, as before, never a fatal
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function done() { global $pass, $fail; echo "TOTAL pass=$pass fail=$fail\n"; echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n"; exit; }
function enc($x) { return json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function rd($p) { return str_replace("\r\n", "\n", (string)@file_get_contents($p)); }
function lift($src, $from, $to) {
    $i = strpos($src, $from); if ($i === false) return null;
    $j = strpos($src, $to, $i + strlen($from)); if ($j === false) return null;
    return substr($src, $i + strlen($from), $j - $i - strlen($from));
}
$ix = rd($argv[1]); $ixRef = rd($argv[2]);
$LIB = $argv[3]; $SEARCH = $argv[5];
$fx = json_decode((string)@file_get_contents($argv[6]), true);
ok($ix !== '' && $ixRef !== '' && is_array($fx) && !empty($fx['fx']), 'H-S0 inputs read');
if (!is_array($fx) || empty($fx['fx'])) done();
$NOLIB = null;
function uselib($code) {
    global $LIB, $SEARCH, $NOLIB;
    $code = str_replace("__DIR__ . '/penumbra_layout.php'", var_export($NOLIB !== null ? $NOLIB : $LIB, true), $code);
    return str_replace("__DIR__ . '/penumbra_search.php'", var_export($SEARCH, true), $code);
}
$A = "            \$journal_toggle_resolver = isset(\$jt['resolver']) ? \$jt['resolver'] : null;\n        }\n";
$B = "        // columns (2026-09-30): the column names of this rowset BEFORE the search\n";
$blk = lift($ix, $A, $B); $blkRef = lift($ixRef, $A, $B);
ok($blk !== null && $blkRef !== null && strpos($blk, '// --- APPLY SAVED SORT ORDER') !== false, 'H-S0-found the sort blocks are where they were');
if ($blk === null || $blkRef === null) done();
$at = strpos($blk, 'pnb_sort_state_here(');
ok($at !== false && $at < strpos($blk, 'journalExportMapSortCriteria(') && $at < strpos($blk, '$criteria_keys = [];'),
   'H-S1-json the API reads the sort through pnb_sort_state_here, before the journal\'s names and its loop');
// the journal's mapping, lifted as it is
$jx = rd($argv[4]);
$jfn = lift($jx, "\n    function journalExportMapSortCriteria(\$criteria, \$resolver) {", "\n    }\n");
ok($jfn !== null, 'H-S0-journal journalExportMapSortCriteria lifted');
if ($jfn !== null) eval("function journalExportMapSortCriteria(\$criteria, \$resolver) {" . $jfn . "\n}\n");

// $calcAdded: what index.php's calculated-columns block (above the lifted one) records it added (H-calc-* check it)
function run_ix($blk, $state, $rows, $jcols, $hasId, $calcAdded = array()) {
    $response = array('data' => $rows);
    $_ssCalcAdded = $calcAdded;
    $journal_toggle_cols = $jcols;
    $journal_toggle_resolver = $jcols ? array('colMeta' => array(array('key' => 'k1', 'name' => 'Done')),
                                              'whoMeta' => array(array('kind' => 'by', 'key' => 'k1', 'name' => 'Done by'))) : null;
    if ($hasId) $_GET['id'] = 'srvfix'; else unset($_GET['id']);
    try { eval(uselib($blk)); }
    catch (Throwable $e) { return 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); }
    return $response['data'];
}
// rows for a fixture: every column its own order over the rows (a column named *TIE* in pairs, the journal's
// toggle 1/0), so the order the rows come out in names the columns they were sorted by
function rows_for($id, $keys) {
    mt_srand(crc32($id));
    $n = 8; $seen = array(); $cols = array();
    $ident = implode(',', range(0, $n - 1)); $rev = implode(',', range($n - 1, 0, -1));
    foreach ($keys as $k) {
        $ks = (string)$k;
        for ($try = 0; $try < 200; $try++) {
            $p = range(0, $n - 1);
            for ($i = $n - 1; $i > 0; $i--) { $j = mt_rand(0, $i); $t = $p[$i]; $p[$i] = $p[$j]; $p[$j] = $t; }
            $sig = implode(',', $p);
            if ($sig !== $ident && $sig !== $rev && !isset($seen[$sig])) break;
        }
        $seen[$sig] = true;
        $vals = array();
        foreach ($p as $r => $rank) {
            if ($ks === 'Done') $vals[$r] = (string)($rank % 2);
            elseif (stripos($ks, 'TIE') !== false) $vals[$r] = 't' . intdiv2($rank);
            else $vals[$r] = 'a' . sprintf('%02d', $rank);
        }
        $cols[$ks] = $vals;
    }
    $rows = array();
    for ($r = 0; $r < $n; $r++) { $row = array(); foreach ($keys as $k) $row[$k] = $cols[(string)$k][$r]; $rows[] = $row; }
    return $rows;
}
function intdiv2($x) { return (int)floor($x / 2); }
// the order the page's columns give (the readers compare these values as text: none is a number but the toggle)
function expect_order($rows, $plan) {
    $idx = range(0, count($rows) - 1);
    usort($idx, function ($a, $b) use ($rows, $plan) {
        foreach ($plan as $p) {
            $va = isset($rows[$a][$p[0]]) ? (string)$rows[$a][$p[0]] : '';
            $vb = isset($rows[$b][$p[0]]) ? (string)$rows[$b][$p[0]] : '';
            $c = strnatcasecmp($va, $vb);
            if ($c !== 0) return $p[1] === 'desc' ? -$c : $c;
        }
        return $a - $b;
    });
    return $idx;
}
function order_of($rows, $out) {
    if (!is_array($out)) return $out;
    $at = array();
    foreach ($rows as $i => $r) $at[json_encode($r)] = $i;
    $o = array();
    foreach ($out as $r) $o[] = isset($at[json_encode($r)]) ? $at[json_encode($r)] : -1;
    return $o;
}
// the page's plan as the API reads it: a column by its key, a journal heading's as its column, '#' not a column
function api_plan($plan) {
    $map = array('__JOURNAL_TOGGLE__k1' => 'Done', '__JOURNAL_BY__k1' => 'Done by');
    $o = array();
    foreach ($plan as $p) {
        if (isset($p['col'])) $o[] = array($p['col'], $p['dir']);
        elseif (isset($map[$p['virt']])) $o[] = array($map[$p['virt']], $p['dir']);
    }
    return $o;
}
function keys_for($f) { return array_merge(array_keys(json_decode($f['rowNow'], true)), $f['calc'], $f['journal']); }

// ---- H-S2 (first, before anything loads the twin): its file missing or empty - a broken deploy - costs nothing but
// the names: the sort is read by place, never a fatal
$f0 = null;
foreach ($fx['fx'] as $f) if ($f['id'] === 'front' && !isset($f['error'])) $f0 = $f;
if ($f0 !== null) {
    $rows0 = rows_for('front', keys_for($f0));
    $empty = tempnam(sys_get_temp_dir(), 'srvsort_empty_');
    file_put_contents($empty, '');
    foreach (array('missing' => 'C:/srvsort_no_such_dir/penumbra_layout.php', 'empty' => $empty) as $what => $path) {
        $NOLIB = $path;
        $a = run_ix($blk, $f0['state'], $rows0, array(), true);
        $NOLIB = null;
        $b = run_ix($blkRef, $f0['state'], $rows0, array(), true);
        ok(is_array($a) && $a === $b && !function_exists('pnb_sort_state_here'), "H-S2-$what the twin's file $what: the API sorts by place, as before, never a fatal",
           is_array($a) ? enc(order_of($rows0, $a)) . ' vs ' . enc(order_of($rows0, $b)) : (string)$a);
    }
    @unlink($empty);
}

// ---- H-calc-*: index.php's own calculated-columns block records the keys it added ($_ssCalcAdded): a ?state=
// link's are its viewer's own on the page - only the ones that worked out (review, 2026-10-24: one named like a
// real column never did)
$CALC = isset($argv[7]) ? $argv[7] : '';
function run_calc($blk, $rows, $defs) {
    global $CALC;
    $response = array('data' => $rows); $state = array('calcColumns' => $defs);
    try { eval(str_replace("__DIR__ . '/penumbra_calc.php'", var_export($CALC, true), $blk)); }
    catch (Throwable $e) { return 'THROWS ' . $e->getMessage(); }
    return isset($_ssCalcAdded) ? $_ssCalcAdded : 'unset';
}
$cblk = lift($ix, "        // Calculated columns saved with the report - or carried by a ?state= view\n", "        // Strip debug info from JSON API responses");
ok($cblk !== null && strpos($cblk, '$_ssCalcAdded') !== false, 'H-S1-calc the calculated-columns block records the columns it added');
if ($cblk !== null && $CALC !== '') {
    $cases = array(
        'added'   => array(array('V_ID' => '1', 'V_AMOUNT' => '5'), array(array('name' => 'MARGIN', 'formula' => '{V_AMOUNT} * 2')), array('MARGIN')),
        'clash'   => array(array('V_ID' => '1', 'V_AMOUNT' => '5'), array(array('name' => 'v_amount', 'formula' => '{V_ID} * 2'), array('name' => 'M2', 'formula' => '1')), array('M2')),
        'missing' => array(array('V_ID' => '1'), array(array('name' => 'X', 'formula' => '{V_GONE} + 1')), array()),
        'label'   => array(array('V_ID' => '1'), array(array('name' => 'net margin', 'formula' => '1')), array('net_margin')),
        'number'  => array(array('2021' => '7', 'V_ID' => '1'), array(array('name' => 'C1', 'formula' => '{2021} + 1'), array('name' => 'C2', 'formula' => '{V_ID}')), array('C1', 'C2')),
    );
    foreach ($cases as $what => $c) {
        $got = run_calc($cblk, array($c[0], $c[0]), $c[1]);
        ok($got === $c[2], "H-calc-$what the API records the calculated columns it added: " . enc($c[2]), enc($got));
    }
}

$mb = function_exists('mb_strtoupper');
foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error'])) { ok(false, "H-json-$id the page side built it", $f['error']); continue; }
    if ($f['mb'] && !$mb) { echo "  SKIP  H-json-$id (needs mbstring)\n"; continue; }
    $keys = keys_for($f);
    $rows = rows_for($id, $keys);
    $out = run_ix($blk, $f['state'], $rows, $f['journal'], !$f['link'], $f['calc']);
    if ($f['page']) {
        $want = expect_order($rows, api_plan($f['plan']));
        $got = order_of($rows, $out);
        ok($got === $want, "H-json-$id the API's rows in the order of the columns the page sorts by", enc($got) . ' vs ' . enc($want) . ' plan ' . enc(api_plan($f['plan'])));
    }
    if ($f['kind'] === 'GUARD') {
        $ref = run_ix($blkRef, $f['state'], $rows, $f['journal'], !$f['link'], $f['calc']);
        ok($out === $ref, "O-json-$id as before, exactly", enc(order_of($rows, $out)) . ' vs ' . enc(order_of($rows, $ref)));
    }
}
done();
