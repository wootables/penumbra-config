<?php
// ldsrv suite - the readers' half (2026-10-24).
//   php -n -d extension=<mbstring dll> hooks.php <index.php> <schedule_runner.php> <ref index.php> <ref schedule_runner.php>
//                                                <penumbra_layout.php> <parity.json>
// The readers' OWN blocks, lifted out of index.php (?json=1: from "1. Map Indices" up to the group mode) and
// schedule_runner.php (apply_state_logic's "2. Column Visibility & Ordering": the email, exports, file drops and
// snapshots) and run here - never the runner itself (it connects to Oracle and SENDS MAIL) - on the page's corpus
// (parity.js through the candidate main.js's own code), the rows as each reader has them (the report's
// calculated columns at the end, then the journal's columns):
//   H-json-<id>    the columns the API shows == the page's, in its order (the journal's last)
//   H-sched-<id>   the columns a scheduled output shows == the page's (the journal's leading; a hidden group
//                  column shown, at its place, for the grouping)
//   O-json-<id> / O-sched-<id>   a state the page reads by place (no names, names no save writes) reads exactly
//                  as in the reference cut (the files before ldsrv)
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
function done() { global $pass, $fail; echo "TOTAL pass=$pass fail=$fail\n"; echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n"; exit; }
function enc($x) { return json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function rd($p) { return str_replace("\r\n", "\n", (string)@file_get_contents($p)); }
function lift($src, $from, $to) {
    $i = strpos($src, $from); if ($i === false) return null;
    $j = strpos($src, $to, $i + strlen($from)); if ($j === false) return null;
    return substr($src, $i, $j - $i);
}
$ix = rd($argv[1]); $sr = rd($argv[2]); $ixRef = rd($argv[3]); $srRef = rd($argv[4]);
$LIBQ = var_export($argv[5], true);
function uselib($code) { global $LIBQ; return str_replace("__DIR__ . '/penumbra_layout.php'", $LIBQ, $code); }
$NOLIB = null;    // H-S2: the twin's file as a broken deploy could leave it (missing, empty)
function uselib2($code) { global $NOLIB; return $NOLIB !== null ? str_replace("__DIR__ . '/penumbra_layout.php'", var_export($NOLIB, true), $code) : uselib($code); }
$fx = json_decode((string)@file_get_contents($argv[6]), true);
ok($ix !== '' && $sr !== '' && $ixRef !== '' && $srRef !== '' && is_array($fx) && !empty($fx['fx']), 'H-S0 inputs read');
if (!is_array($fx) || empty($fx['fx'])) done();
$mb = function_exists('mb_strtoupper');

$IXA = "            // 1. Map Indices to Actual Column Names (0 => 'COL_A', 1 => 'COL_B')\n";
$IXB = "            // --- NEW: APPLY GROUP MODE ---\n";
$SRA = "    if ((isset(\$state['visibleColumns']) || isset(\$state['columnOrder'])) && !empty(\$data)) {\n";
$SRB = "    // 3. Row Limiting (Handled by API)\n";
$bIx = lift($ix, $IXA, $IXB); $bIxRef = lift($ixRef, $IXA, $IXB);
$bSr = lift($sr, $SRA, $SRB); $bSrRef = lift($srRef, $SRA, $SRB);
ok($bIx !== null && $bIxRef !== null && $bSr !== null && $bSrRef !== null, 'H-S0-found the column blocks are where they were',
   enc(array($bIx !== null, $bIxRef !== null, $bSr !== null, $bSrRef !== null)));
if ($bIx === null || $bIxRef === null || $bSr === null || $bSrRef === null) done();
// apply_state_logic's position in the runner: the block is still inside it, after the sort
$fnAt = strpos($sr, "function apply_state_logic(\$data, \$state, \$preserveCols = array()) {");
$fnNext = $fnAt === false ? false : strpos($sr, "\nfunction ", $fnAt + 10);
$blkAt = strpos($sr, $bSr);
ok($fnAt !== false && $blkAt > $fnAt && $blkAt < $fnNext, 'H-S0-place the scheduler block is apply_state_logic\'s');
ok(strpos($bIx, 'pnb_layout_state_here(') !== false && strpos($bIx, 'pnb_layout_state_here(') < strpos($bIx, "foreach (\$_ldState['visibleColumns']"),
   'H-S1-json the API reads the lists through pnb_layout_state_here, before its loops');
ok(strpos($bSr, 'pnb_layout_state_here(') !== false && strpos($bSr, 'pnb_layout_state_here(') < strpos($bSr, "\$visibleIndices = [];"),
   'H-S1-sched apply_state_logic reads the lists through pnb_layout_state_here, before its loops');
// the helpers the scheduler block calls for a grouping, lifted as they are (a name without ':' never reaches the registry)
foreach (array(array("function penumbra_group_levels(\$v) {", "\n}\n", "\n}\n"), array("function pivot_parse_field_token(\$tok) {", "\n}\n", "\n}\n"),
               array("function pivot_field_base(\$tok) {", "\n", "\n")) as $h) {
    $code = lift($sr, $h[0], $h[1]);
    ok($code !== null, 'H-S0-helper ' . substr($h[0], 9, 30));
    if ($code !== null) eval($code . $h[2]);
}
if (!function_exists('pivot_split_registry')) { function pivot_split_registry() { return array(); } }

function run_ix($blk, $state, $rows, $jcols) {
    $response = array('data' => $rows);
    $journal_toggle_cols = $jcols;
    eval(uselib2($blk));
    return $response['data'];
}
function run_sr($blk, $state, $data, $preserveCols) {
    $groupColumnWasHidden = false;
    $_gbHiddenKeys = array();
    eval(uselib2($blk));
    return array($data, $_gbHiddenKeys);
}
function keys_of($rows) { $o = array(); if (isset($rows[0]) && is_array($rows[0])) foreach (array_keys($rows[0]) as $k) $o[] = (string)$k; return $o; }

// ---- H-S2 (first, before anything loads the twin): its file missing - a lifted copy of the runner, a broken
// deploy - costs nothing but the names: the lists are read by place, never a fatal
$f0 = null;
foreach ($fx['fx'] as $f) if ($f['id'] === 'front' && !isset($f['error'])) $f0 = $f;
if ($f0 !== null) {
    $r0 = json_decode($f0['rowJson'], true); $rows0 = array($r0, $r0);
    $empty = tempnam(sys_get_temp_dir(), 'ldsrv_empty_');
    file_put_contents($empty, '');
    foreach (array('missing' => 'C:/ldsrv_no_such_dir/penumbra_layout.php', 'empty' => $empty) as $what => $path) {
        $NOLIB = $path;
        $a = run_ix($bIx, $f0['state'], $rows0, array()); $b = run_ix($bIxRef, $f0['state'], $rows0, array());
        $c = run_sr($bSr, $f0['state'], $rows0, array()); $d = run_sr($bSrRef, $f0['state'], $rows0, array());
        $NOLIB = null;
        ok($a === $b && $c === $d && !function_exists('pnb_layout_state_here'), "H-S2-$what the twin's file $what: the readers read by place, as before, never a fatal",
           enc(array(keys_of($a), keys_of($b))));
    }
    @unlink($empty);
}

foreach ($fx['fx'] as $f) {
    $id = $f['id'];
    if (isset($f['error'])) { ok(false, "H-json-$id the page side built it", $f['error']); continue; }
    if ($f['mb'] && !$mb) { echo "  SKIP  H-*-$id (needs mbstring)\n"; continue; }
    $row = json_decode($f['rowJson'], true);
    foreach ($f['journal'] as $j) $row[$j] = 'j_' . $j;
    $rows = array($row, $row, $row);
    $st = $f['state'];
    $byPlace = $f['byName'] === null;

    // ---- index.php ?json=1: the page's columns, then the journal's
    $out = run_ix($bIx, $st, $rows, $f['journal']);
    $got = keys_of($out);
    if ($f['page']) {
        $want = array_merge($f['shown'], $f['journal']);
        ok($got === $want, "H-json-$id the API shows the page's columns, in its order", enc($got) . ' vs ' . enc($want));
    }
    if ($byPlace) {
        $ref = run_ix($bIxRef, $st, $rows, $f['journal']);
        ok($out === $ref, "O-json-$id read by place, exactly as before", enc(keys_of($out)) . ' vs ' . enc(keys_of($ref)));
    }

    // ---- schedule_runner.php apply_state_logic: the journal's columns lead; a hidden group column shown at its place
    list($sd, $gh) = run_sr($bSr, $st, $rows, $f['journal']);
    $got = keys_of($sd);
    if ($f['page']) {
        $want = array();
        foreach ($f['pageOrder'] as $n) {
            if (in_array($n, $f['shown'], true) || ($f['group'] !== null && strtoupper($n) === strtoupper($f['group']))) $want[] = $n;
        }
        $want = array_merge($f['journal'], $want);
        $wantGh = ($f['group'] !== null && !in_array($f['group'], $f['shown'], true)) ? array($f['group']) : array();
        ok($got === $want && $gh === $wantGh, "H-sched-$id a scheduled output shows the page's columns, in its order", enc(array($got, $gh)) . ' vs ' . enc(array($want, $wantGh)));
    }
    if ($byPlace) {
        $ref = run_sr($bSrRef, $st, $rows, $f['journal']);
        ok(array($sd, $gh) === $ref, "O-sched-$id read by place, exactly as before", enc(keys_of($sd)) . ' vs ' . enc(keys_of($ref[0])));
    }
}
done();
