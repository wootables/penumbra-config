<?php
// nestsort suite - PHP half (2026-10-20). A nested-table (@@JSON) column sorts by how
// many rows its tables hold in a scheduled email (schedule_runner.php apply_state_logic)
// and in ?json=1 (index.php's saved-sort block), by penumbra_nested_row_count
// (penumbra_search.php) - the rule js/main.js penumbraNestedRowCount follows on the page.
//
//   php -n test_nestsort.php <app dir> <work dir>          (forward slashes)
// <work dir> holds runner_mirror.php - pivotparity/extract_mirror.php over
// <app>/schedule_runner.php: the runner itself is NEVER included (its top level opens
// Oracle, claims tasks and sends mail) - plus fixture.json, corpus.json and fuzz.json
// (run.py writes them). Prints one RESULTS_JSON: line; run.py reads the verdicts.
error_reporting(E_ALL);
$warn = array();
set_error_handler(function ($no, $str, $file, $line) use (&$warn) { $warn[] = $str . ' @' . basename($file) . ':' . $line; return true; });
$app = $argv[1];
$work = $argv[2];
$out = array('checks' => array(), 'fuzz' => array());
function chk(&$out, $id, $pass, $detail) { $out['checks'][] = array('id' => $id, 'pass' => (bool)$pass, 'detail' => $detail); }
// the fixture's rows in order: $cmp, then the original order (a stable sort)
function ns_order($members, $cmp) {
    $ix = $members;
    usort($ix, function ($a, $b) use ($cmp) { $r = $cmp($a, $b); return $r ? $r : $a - $b; });
    return $ix;
}

try {
    require $work . '/runner_mirror.php';
    // the mirror holds only what the runner itself declares; its search engine comes from
    // its own include (the live order: mirror first, the include guarded on a function)
    if (!function_exists('php_parse_search_query')) require $app . '/penumbra_search.php';
    $hasCount = function_exists('penumbra_nested_row_count');

    // ---- the count rule, case by case (the browser half reads the same corpus.json)
    $corpus = json_decode(file_get_contents($work . '/corpus.json'), true);
    $bad = array();
    foreach ($corpus as $c) {
        $got = $hasCount ? penumbra_nested_row_count($c['raw']) : null;
        if ($got !== $c['expect']) $bad[] = $c['why'] . ': got ' . var_export($got, true) . ', want ' . $c['expect'];
    }
    chk($out, 'P-corpus', $hasCount && !$bad, $hasCount ? (count($corpus) - count($bad)) . '/' . count($corpus) . ' cases' . ($bad ? ' - ' . implode('; ', array_slice($bad, 0, 4)) : '') : 'penumbra_nested_row_count() missing');

    $fx = json_decode(file_get_contents($work . '/fixture.json'), true);
    $rows = $fx['rows'];
    $n = count($rows);
    $EX = $fx['expect'];

    // json_decode is only the fast path: the walk must give the same number on every
    // value it decodes (the corpus and every fixture value: quotes, brackets, 73 items)
    $wbad = array(); $wn = 0;
    if ($hasCount && function_exists('_penumbra_json_rows')) {
        $vals = array();
        foreach ($corpus as $c) $vals[] = $c['raw'];
        foreach ($rows as $r) { $vals[] = $r['N_JSON']; $vals[] = $r['H_JSON']; $vals[] = $r['L_JSON']; }
        foreach ($vals as $v) {
            $s = (string)$v; $p = strpos($s, '@@JSON');
            if ($p === false) continue;
            $wn++;
            $w = _penumbra_json_rows($s, $p + 6); $d = penumbra_nested_row_count($s);
            if ($w !== $d) $wbad[] = substr($s, 0, 40) . ': walk ' . $w . ', count ' . $d;
        }
    }
    chk($out, 'P-walkSame', $hasCount && $wn > 0 && !$wbad, $wn . ' values' . ($wbad ? ' - ' . implode('; ', array_slice($wbad, 0, 3)) : ''));
    // and the fixture's own counts (made as each value was built) agree with the rule
    $fbad = array();
    foreach (array('N_JSON', 'H_JSON', 'L_JSON') as $col) {
        foreach ($rows as $i => $r) {
            $got = $hasCount ? penumbra_nested_row_count($r[$col]) : null;
            if ($got !== $EX[$col][$i]) { $fbad[] = $col . ' row ' . ($i + 1) . ': got ' . var_export($got, true) . ', want ' . $EX[$col][$i]; }
        }
    }
    chk($out, 'P-fixture', $hasCount && !$fbad, $fbad ? implode('; ', array_slice($fbad, 0, 3)) : '3 x ' . $n . ' values');

    $fuzz = json_decode(file_get_contents($work . '/fuzz.json'), true);
    $out['fuzz'] = $hasCount ? array_map('penumbra_nested_row_count', $fuzz) : array();

    // ---- the scheduled email's sort (apply_state_logic, step 1)
    $idOf = array();
    foreach ($rows as $i => $r) $idOf[$r['V_ID']] = $i;
    $all = range(0, $n - 1);
    $NUM = array_map(function ($r) { return (int)$r['V_NUM']; }, $rows);
    $byN = function ($dir, $col = 'N_JSON') use ($EX) {
        $e = $EX[$col];
        return function ($a, $b) use ($e, $dir) { return $dir === 'desc' ? $e[$b] - $e[$a] : $e[$a] - $e[$b]; };
    };
    $byNum = function ($dir) use ($NUM) {
        return function ($a, $b) use ($NUM, $dir) { return $dir === 'desc' ? $NUM[$b] - $NUM[$a] : $NUM[$a] - $NUM[$b]; };
    };
    $chain = function ($f, $g) { return function ($a, $b) use ($f, $g) { $r = $f($a, $b); return $r ? $r : $g($a, $b); }; };
    $crit = function ($col, $idx, $dir) { return array('colIdentifier' => $col, 'colIndex' => $idx, 'direction' => $dir); };
    $ids = function ($list) use ($idOf) { return array_map(function ($r) use ($idOf) { return $idOf[$r['V_ID']]; }, array_values($list)); };
    $top = function ($ixs, $col = 'N_JSON') use ($EX) { return implode(',', array_map(function ($i) use ($EX, $col) { return $EX[$col][$i]; }, array_slice($ixs, 0, 6))); };
    $email = function ($state) use ($rows) { return apply_state_logic($rows, $state); };

    $r = $email(array('sortCriteria' => array($crit('N_JSON', 3, 'desc'))));
    $got = $ids($r['data']);
    chk($out, 'R-desc', $got === ns_order($all, $byN('desc')), 'first counts ' . $top($got) . ' (want ' . $top(ns_order($all, $byN('desc'))) . ')');
    $r = $email(array('sortCriteria' => array($crit('N_JSON', 3, 'asc'))));
    $got = $ids($r['data']);
    chk($out, 'R-asc', $got === ns_order($all, $byN('asc')), 'first counts ' . $top($got));
    $r = $email(array('sortCriteria' => array($crit('N_JSON', 3, 'desc'), $crit('V_NUM', 4, 'asc'))));
    chk($out, 'R-chain', $ids($r['data']) === ns_order($all, $chain($byN('desc'), $byNum('asc'))), 'N_JSON most first, then V_NUM');
    $r = $email(array('sortCriteria' => array($crit('V_NUM', 4, 'asc'), $crit('N_JSON', 3, 'desc'))));
    chk($out, 'R-chainUnder', $ids($r['data']) === ns_order($all, $chain($byNum('asc'), $byN('desc'))), 'V_NUM, then N_JSON most first');
    $r = $email(array('sortCriteria' => array($crit('H_JSON', 6, 'asc'))));
    chk($out, 'R-hidden', $ids($r['data']) === ns_order($all, $byN('asc', 'H_JSON')), 'H_JSON fewest first');
    $r = $email(array('sortCriteria' => array($crit('N_JSON', 3, 'desc')), 'customSortOrders' => array('N_JSON' => array('values' => array('zzz', '@@JSON[]')))));
    chk($out, 'R-custom', $ids($r['data']) === ns_order($all, $byN('desc')), 'a custom order on the column does not replace its counts');
    $r = $email(array('sortCriteria' => array($crit('V_NUM', 4, 'desc'))));
    chk($out, 'R-plain', $ids($r['data']) === ns_order($all, $byNum('desc')), 'a number column sorts as before');
    $r = $email(array('groupBy' => 'V_STATUS', 'sortCriteria' => array($crit('N_JSON', 3, 'desc'))));
    $gOk = isset($r['viewMode']) && $r['viewMode'] === 'grouped' && is_array($r['data']) && count($r['data']) > 1;
    $gN = 0;
    if ($gOk) {
        foreach ($r['data'] as $label => $g) {
            $list = (is_array($g) && isset($g['rows']) && is_array($g['rows'])) ? $g['rows'] : $g;
            $got = $ids($list); $gN++;
            if (!$got || $got !== ns_order($got, $byN('desc'))) { $gOk = false; }
        }
    }
    chk($out, 'R-grouped', $gOk, $gN . ' groups, each most rows first');

    // ---- ?json=1: index.php's saved-sort block, cut out by its own comments and run here
    $ix = file_get_contents($app . '/index.php');
    $a = strpos($ix, '// --- APPLY SAVED SORT ORDER (Enhanced with Date Support) ---');
    $b = ($a === false) ? false : strpos($ix, 'unset($sort_keys, $sort_order, $sorted_data', $a);
    $e = ($b === false) ? false : strpos($ix, "\n", $b);
    $close = ($e === false) ? false : strpos($ix, '}', $e);
    if ($close === false) throw new Exception('index.php: the saved-sort block was not found');
    $block = substr($ix, $a, $close + 1 - $a);
    $block = str_replace("__DIR__ . '/penumbra_search.php'", var_export($app . '/penumbra_search.php', true), $block);
    $api = function ($criteria) use ($rows, $block) {
        $response = array('data' => $rows);
        $state = array('sortCriteria' => $criteria);
        eval($block);
        return $response['data'];
    };
    $got = $ids($api(array($crit('N_JSON', 3, 'desc'))));
    chk($out, 'J-desc', $got === ns_order($all, $byN('desc')), 'first counts ' . $top($got));
    chk($out, 'J-chain', $ids($api(array($crit('N_JSON', 3, 'desc'), $crit('V_NUM', 4, 'asc')))) === ns_order($all, $chain($byN('desc'), $byNum('asc'))), 'N_JSON most first, then V_NUM');
    chk($out, 'J-hidden', $ids($api(array($crit('H_JSON', 6, 'asc')))) === ns_order($all, $byN('asc', 'H_JSON')), 'H_JSON fewest first');
    chk($out, 'J-plain', $ids($api(array($crit('V_NUM', 4, 'desc')))) === ns_order($all, $byNum('desc')), 'a number column sorts as before');
} catch (Throwable $ex) {
    $out['fatal'] = get_class($ex) . ': ' . $ex->getMessage() . ' @' . basename($ex->getFile()) . ':' . $ex->getLine();
}
$out['warnings'] = array_slice($warn, 0, 10);
$out['warningCount'] = count($warn);
echo 'RESULTS_JSON:' . json_encode($out) . "\n";
