<?php
// srvsort suite - the stub's half (2026-10-24). PHP 7.0 syntax: run.py runs it on 8.2 and again on 7.4 (a stub runs
// on its reader's own PHP; 7.x sorts unstably, so there the rows are checked sorted, not placed: --sorted).
//   php -n -d extension=<mbstring dll> stubhook.php <generate_stub.php> <penumbra_layout.php> <ref generate_stub.php>
//                                                   <ref penumbra_layout.php> <parity.json> <out: the generated stub> [--sorted]
// generate_stub.php's stub GENERATED - its heredoc evaluated with the generator's own preamble, the twin read from
// the candidate's file - and written out for run.py to lint; then the stub's OWN "1. Sort" block run, with the twin
// the stub carries, on the page's corpus. A stub's rows come straight from query.php: no calculated columns (a stub
// does not work them out: a level on one has nothing to sort by), no journal's.
//   H-stub-embed  the stub carries penumbra_layout.php as it is
//   H-stub-<id>   the rows come out in the order of the columns the page sorts by (but a calculated one)
//   O-stub-<id>   a state the page reads as before reads exactly as in the reference stub (the files before srvsort)
//   H-stub-S2     a stub generated without the twin's file sorts by place, as before
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function done() { global $pass, $fail; echo "TOTAL pass=$pass fail=$fail\n"; echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n"; exit; }
function enc($x) { return json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function lift($src, $from, $to) {
    $i = strpos($src, $from); if ($i === false) return null;
    $j = strpos($src, $to, $i + strlen($from)); if ($j === false) return null;
    return substr($src, $i, $j - $i);
}
$SORTED = in_array('--sorted', $argv, true);
$P = $SORTED ? 'H74-stub' : 'H-stub';
$O = $SORTED ? 'O74-stub' : 'O-stub';
// The generator from the line before its preamble to the heredoc's end, run as the request would run it
function gen($path, $libPath) {
    $src = (string)@file_get_contents($path);
    $from = "\$safe_theme         = addslashes(\$theme_name);";
    $i = strpos($src, $from);
    $j = $i === false ? false : strpos($src, "\nEOT;", $i);
    if ($i === false || $j === false) return null;
    $code = substr($src, $i + strlen($from), $j + 5 - ($i + strlen($from))) . "\n";
    $code = str_replace("__DIR__ . '/penumbra_layout.php'", var_export($libPath, true), $code);
    $generation_date = '2026-10-24 12:00:00'; $user_fullname = 'srvsort suite'; $safe_report_id = 'srvfix'; $safe_subject = 'srvsort fixture';
    $safe_email = 'nobody@example.invalid'; $safe_display_url = 'https://example.invalid/index.php?id=srvfix';
    $safe_api_url = 'https://example.invalid/index.php?id=srvfix&json=1'; $safe_theme = 'theme-default';
    $theme_styles_exported = var_export(array('theme-default' => array('headerBg' => '#336699')), true);
    $exemption_list_exported = var_export(array(), true); $link_instruction = 'View the live version.'; $link_subtext = '';
    $stub_script = null;
    eval($code);
    return $stub_script;
}
$lib = $argv[2];
$stub = gen($argv[1], $lib);
$stubRef = gen($argv[3], $argv[4]);
$stubNoLib = gen($argv[1], 'C:/srvsort_no_such_dir/penumbra_layout.php');
ok(is_string($stub) && is_string($stubRef) && is_string($stubNoLib) && strpos($stub, '<?php') === 0, "$P-S0 the stubs generate");
if (!is_string($stub) || !is_string($stubRef) || !is_string($stubNoLib)) done();
file_put_contents($argv[6], $stub);
$fx = json_decode((string)@file_get_contents($argv[5]), true);
if (!is_array($fx) || empty($fx['fx'])) { ok(false, "$P-S0 the page side ran"); done(); }
$lf = function ($s) { return str_replace("\r\n", "\n", $s); };

$A = "            // 1. Sort\n"; $Z = "            // 2. Column Visibility & Order\n";
$blk = lift($lf($stub), $A, $Z); $blkRef = lift($lf($stubRef), $A, $Z); $blkNoLib = lift($lf($stubNoLib), $A, $Z);
ok($blk !== null && $blkRef !== null && $blkNoLib !== null, "$P-S0-found the stub's sort block is where it was");
if ($blk === null || $blkRef === null || $blkNoLib === null) done();
ok(strpos($blk, 'pnb_sort_state_here(') !== false && strpos($blk, 'pnb_sort_state_here(') < strpos($blk, "usort(\$results"),
   "$P-S1 the stub reads the sort through pnb_sort_state_here, before its usort");
// the stub's own comparator helper
$cmp = lift($lf($stub), "function get_custom_sort_comparator(\$customSortOrders, \$columnName) {", "\n}\n");
ok($cmp !== null, "$P-S0-helper get_custom_sort_comparator");
if ($cmp !== null) eval($cmp . "\n}\n");
function run_stub($blk, $decrypted_state, $results) {
    try { eval($blk); }
    catch (Throwable $e) { return 'THROWS ' . get_class($e) . ': ' . $e->getMessage(); }
    return $results;
}
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
        foreach ($p as $r => $rank) $vals[$r] = stripos($ks, 'TIE') !== false ? 't' . (int)floor($rank / 2) : 'a' . sprintf('%02d', $rank);
        $cols[$ks] = $vals;
    }
    $rows = array();
    for ($r = 0; $r < $n; $r++) { $row = array(); foreach ($keys as $k) $row[$k] = $cols[(string)$k][$r]; $rows[] = $row; }
    return $rows;
}
function plan_cmp($rows, $plan) {
    return function ($a, $b) use ($rows, $plan) {
        foreach ($plan as $p) {
            $va = isset($rows[$a][$p[0]]) ? (string)$rows[$a][$p[0]] : '';
            $vb = isset($rows[$b][$p[0]]) ? (string)$rows[$b][$p[0]] : '';
            $c = strnatcasecmp($va, $vb);
            if ($c !== 0) return $p[1] === 'desc' ? -$c : $c;
        }
        return 0;
    };
}
function expect_order($rows, $plan) {
    $idx = range(0, count($rows) - 1);
    $c = plan_cmp($rows, $plan);
    usort($idx, function ($a, $b) use ($c) { $r = $c($a, $b); return $r !== 0 ? $r : $a - $b; });
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
function sorted_by($rows, $order, $plan) {
    if (!is_array($order) || count($order) !== count($rows) || in_array(-1, $order, true)) return false;
    $c = plan_cmp($rows, $plan);
    for ($i = 1; $i < count($order); $i++) if ($c($order[$i - 1], $order[$i]) > 0) return false;
    return true;
}
// the page's plan as a stub reads it: no calculated column, no journal's, '#' not a column
function stub_plan($plan, $calc) {
    $o = array();
    foreach ($plan as $p) if (isset($p['col']) && !in_array($p['col'], $calc, true)) $o[] = array($p['col'], $p['dir']);
    return $o;
}

// ---- H-stub-S2 (first, before the twin is loaded here): a stub generated when the twin's file was missing
$f0 = null;
foreach ($fx['fx'] as $f) if ($f['id'] === 'front' && !isset($f['error'])) $f0 = $f;
if ($f0 !== null) {
    $rows0 = rows_for('front', array_keys(json_decode($f0['rowNow'], true)));
    $a = run_stub($blkNoLib, $f0['state'], $rows0); $b = run_stub($blkRef, $f0['state'], $rows0);
    ok(is_array($a) && $a === $b && !function_exists('pnb_sort_state_here') && strpos($stubNoLib, 'function pnb_sort_state_here(') === false,
       "$P-S2 a stub generated without the twin's file sorts by place, as before", enc(order_of($rows0, $a)) . ' vs ' . enc(order_of($rows0, $b)));
}

// the twin, as the stub carries it
$B = '// ===== BEGIN penumbra_layout.php ====='; $E = '// ===== END penumbra_layout.php =====';
$libSrc = $lf((string)@file_get_contents($lib));
$inStub = lift($stub, $B, $E); $inLib = lift($libSrc, $B, $E);
ok($inStub !== null && $inLib !== null && $lf($inStub) === $inLib, "$P-embed the stub carries penumbra_layout.php as it is",
   $inStub === null ? 'no twin in the stub' : strlen($inStub) . ' vs ' . strlen((string)$inLib) . ' bytes');
if ($inStub !== null) eval($inStub . $E . "\n");
ok(function_exists('pnb_sort_state_here') && function_exists('pnb_sort_calc_tail'), "$P-S1-twin the twin the stub carries defines the sort's functions");

$mb = function_exists('mb_strtoupper');
foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error'])) { ok(false, "$P-$id the page side built it", $f['error']); continue; }
    if (!$f['stub']) continue;
    if ($f['mb'] && !$mb) { echo "  SKIP  $P-$id (needs mbstring)\n"; continue; }
    $rows = rows_for($id, array_keys(json_decode($f['rowNow'], true)));
    $out = run_stub($blk, $f['state'], $rows);
    if ($f['page']) {
        $plan = stub_plan($f['plan'], $f['calc']);
        $got = order_of($rows, $out);
        // 7.x sorts unstably: sorted by the page's columns - or, none left, exactly as they came (no usort at all)
        if ($SORTED && $plan) ok(sorted_by($rows, $got, $plan), "$P-$id the stub's rows sorted by the columns the page sorts by", enc($got) . ' plan ' . enc($plan));
        elseif ($SORTED) ok($got === range(0, count($rows) - 1), "$P-$id no column left to sort by: the stub's rows as they came", enc($got));
        else {
            $want = expect_order($rows, $plan);
            ok($got === $want, "$P-$id the stub's rows in the order of the columns the page sorts by", enc($got) . ' vs ' . enc($want) . ' plan ' . enc($plan));
        }
    }
    if ($f['kind'] === 'GUARD') {
        $ref = run_stub($blkRef, $f['state'], $rows);
        ok($out === $ref, "$O-$id as before, exactly", enc(order_of($rows, $out)) . ' vs ' . enc(order_of($rows, $ref)));
    }
}
done();
