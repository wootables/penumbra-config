<?php
// ldsrv suite - the stub's half (2026-10-24).
//   php -n -d extension=<mbstring dll> stubhook.php <generate_stub.php> <penumbra_layout.php> <ref generate_stub.php>
//                                                   <parity.json> <out: the generated stub>
// generate_stub.php's stub GENERATED - its heredoc evaluated with the generator's own preamble (the twin read in,
// the file's path pointed at the candidate's) and written out for run.py to lint - then the stub's OWN "2. Column
// Visibility & Order" block run, with the twin the stub carries, on the page's corpus. A stub's rows come straight
// from query.php: no calculated columns (a stub does not work them out), no journal columns.
//   H-stub-embed  the stub carries penumbra_layout.php as it is
//   H-stub-<id>   the columns the stub shows == the page's, in its order (less the calculated ones; a hidden group
//                 column shown, at its place, for the grouping)
//   O-stub-<id>   a state the page reads by place reads exactly as in the reference stub
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
// The generator from the line before its preamble to the heredoc's end, run as the request would run it
function gen($path, $libPath) {
    $src = (string)@file_get_contents($path);
    $from = "\$safe_theme         = addslashes(\$theme_name);";
    $i = strpos($src, $from);
    $j = $i === false ? false : strpos($src, "\nEOT;", $i);
    if ($i === false || $j === false) return null;
    $code = substr($src, $i + strlen($from), $j + 5 - ($i + strlen($from))) . "\n";
    $code = str_replace("__DIR__ . '/penumbra_layout.php'", var_export($libPath, true), $code);
    $generation_date = '2026-10-24 12:00:00'; $user_fullname = 'ldsrv suite'; $safe_report_id = 'ldfix'; $safe_subject = 'ldsrv fixture';
    $safe_email = 'nobody@example.invalid'; $safe_display_url = 'https://example.invalid/index.php?id=ldfix';
    $safe_api_url = 'https://example.invalid/index.php?id=ldfix&json=1'; $safe_theme = 'theme-default';
    $theme_styles_exported = var_export(array('theme-default' => array('headerBg' => '#336699')), true);
    $exemption_list_exported = var_export(array(), true); $link_instruction = 'View the live version.'; $link_subtext = '';
    $stub_script = null;
    eval($code);
    return $stub_script;
}
$lib = $argv[2];
$stub = gen($argv[1], $lib);
$stubRef = gen($argv[3], $lib);
ok(is_string($stub) && is_string($stubRef) && strpos($stub, '<?php') === 0, 'H-stub-S0 the stubs generate');
if (!is_string($stub) || !is_string($stubRef)) done();
file_put_contents($argv[5], $stub);
$fx = json_decode((string)@file_get_contents($argv[4]), true);
if (!is_array($fx) || empty($fx['fx'])) { ok(false, 'H-stub-S0 the page side ran'); done(); }
$mb = function_exists('mb_strtoupper');

// the twin, as the stub carries it
$B = '// ===== BEGIN penumbra_layout.php ====='; $E = '// ===== END penumbra_layout.php =====';
$lf = function ($s) { return str_replace("\r\n", "\n", $s); };
$libSrc = $lf((string)@file_get_contents($lib));
$inStub = lift($stub, $B, $E); $inLib = lift($libSrc, $B, $E);
ok($inStub !== null && $inLib !== null && $lf($inStub) === $inLib, 'H-stub-embed the stub carries penumbra_layout.php as it is',
   $inStub === null ? 'no twin in the stub' : strlen($inStub) . ' vs ' . strlen((string)$inLib) . ' bytes');
if ($inStub !== null) eval($inStub . $E . "\n");
ok($inStub === null || (function_exists('pnb_layout_state_here') && function_exists('pnb_layout_calc_names')), 'H-stub-S1 the twin the stub carries defines its functions');

$A = "            // 2. Column Visibility & Order\n"; $Z = "            // 3. Grouping\n";
$blk = lift($lf($stub), $A, $Z); $blkRef = lift($lf($stubRef), $A, $Z);
ok($blk !== null && $blkRef !== null, 'H-stub-S0-found the stub\'s column block is where it was');
if ($blk === null || $blkRef === null) done();
function run_stub($blk, $decrypted_state, $results) {
    $groupColumnWasHidden = false;
    eval($blk);
    return array($results, $groupColumnWasHidden);
}
function keys_of($rows) { $o = array(); if (isset($rows[0]) && is_array($rows[0])) foreach (array_keys($rows[0]) as $k) $o[] = (string)$k; return $o; }
foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error'])) { ok(false, "H-stub-$id the page side built it", $f['error']); continue; }
    if ($f['mb'] && !$mb) { echo "  SKIP  H-stub-$id (needs mbstring)\n"; continue; }
    $row = json_decode($f['rowJson'], true);
    foreach ($f['calc'] as $c) unset($row[$c]);
    $rows = array($row, $row, $row);
    $st = $f['state'];
    list($out, $gh) = run_stub($blk, $st, $rows);
    $got = keys_of($out);
    if ($f['page']) {
        $want = array();
        foreach ($f['pageOrder'] as $n) {
            if (in_array($n, $f['calc'], true)) continue;
            if (in_array($n, $f['shown'], true) || ($f['group'] !== null && strtoupper($n) === strtoupper($f['group']))) $want[] = $n;
        }
        // the stub's own rule (before ldsrv too): nothing to show = the rows as they came, every column
        if (!$want) $want = keys_of($rows);
        $wantGh = ($f['group'] !== null && !in_array($f['group'], $f['shown'], true));
        ok($got === $want && $gh === $wantGh, "H-stub-$id the stub shows the page's columns, in its order", enc(array($got, $gh)) . ' vs ' . enc(array($want, $wantGh)));
    }
    if ($f['byName'] === null) {
        $ref = run_stub($blkRef, $st, $rows);
        ok(array($out, $gh) === $ref, "O-stub-$id read by place, exactly as before", enc($got) . ' vs ' . enc(keys_of($ref[0])));
    }
}
done();
