<?php
/**
 * ignorecol - the "ignore" state for change columns (2026-10-13).
 *
 * A change-column list (options.change_columns, ?snapkeys=, the snapshot
 * dialog's Key list) may hold "!NAME" entries: NAME is IGNORED - a change in
 * it alone never makes a row Modified and never stops "Skip if no changes",
 * though its [was:]/[now:] still renders on a row that changed for another
 * reason. Lists without "!" entries must behave exactly as before.
 *
 * What this proves, against the runner's REAL functions (lifted by the shared
 * extractor - schedule_runner.php is never required; it sends mail):
 *   1. penumbra_split_change_columns - parsing, dedupe, "both ways" = ignored
 *   2. legacy lists are byte-identical to the PRE-change runner
 *      (signature + diff, lifted from --orig=<old runner>)
 *   3. diff: ignored-only change = Unchanged; mixed change = Modified with
 *      the ignored column still listed; ignore-only list pairs on the rest
 *   4. signature: ignore-only list signs every other column
 *   5. penumbra_pr_change_analysis: skip / no-skip decided by the ignore
 *   6. the email rendition shows [was:]/[now:] for the ignored column
 *
 *   php.exe -n run.php [--app=<app dir>] [--orig=<pre-change schedule_runner.php>]
 *                      [--control] [--mutant=diff|split] [--keep]
 *
 * --control adds one deliberately false assertion and MUST report FAIL 1.
 * --mutant=diff  removes the diff's ignore filter      -> sections 3 and 5 fail
 * --mutant=split reads "!NAME" as a plain key name      -> sections 1, 3, 4, 5 fail
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');

$CONTROL = in_array('--control', $argv, true);
$KEEP    = in_array('--keep', $argv, true);
$MUTANT  = null;
$APP     = null;
$ORIG    = null;
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0)    $APP = substr($a, 6);
    if (strpos($a, '--orig=') === 0)   $ORIG = substr($a, 7);
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
if ($APP === null) $APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP = rtrim($APP, '\\/');

$pass = 0; $fail = 0;
function t_ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}
function t_eq($got, $want, $label) {
    t_ok($got === $want, $label . '  (got ' . var_export($got, true) . ', want ' . var_export($want, true) . ')');
}
function section($title) { echo "== $title\n"; }

// ---------------------------------------------------------------------------
// 0. Mirror of the runner (never require the runner itself)
// ---------------------------------------------------------------------------
$runnerPath = $APP . '/schedule_runner.php';
if (!is_file($runnerPath)) { fwrite(STDERR, "FATAL: no runner under $APP\n"); exit(2); }
$extractor  = dirname(__DIR__) . '/pivotparity/extract_mirror.php';
$mirrorPath = __DIR__ . '/mirror.php';
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extractor) . ' ' . escapeshellarg($runnerPath) . ' ' . escapeshellarg($mirrorPath) . ' 2>&1';
$__cwd = getcwd(); @chdir(sys_get_temp_dir()); // cmd.exe refuses a UNC cwd
exec($cmd, $xo, $xc);
@chdir($__cwd);
if ($xc !== 0 || !is_file($mirrorPath)) { fwrite(STDERR, "FATAL: mirror extraction failed (exit $xc): " . implode("\n", $xo) . "\n"); exit(2); }
echo "mirror: " . trim(implode(' ', $xo)) . "\n";

if ($MUTANT !== null) {
    $m = file_get_contents($mirrorPath);
    if ($MUTANT === 'diff') {
        $m2 = preg_replace('/\R[ \t]*if \(!empty\(\$changed\) && !empty\(\$ignoreCols\) && !array_diff\(\$changed, \$ignoreCols\)\) \$changed = array\(\);/',
            "\n/* MUTANT: ignore filter removed */", $m, -1, $c);
    } elseif ($MUTANT === 'split') {
        $m2 = preg_replace('/if \(\$u\[0\] === \'!\'\) \{/', 'if (false) { /* MUTANT */', $m, -1, $c);
    } else { fwrite(STDERR, "FATAL: unknown mutant $MUTANT\n"); exit(2); }
    if ($c !== 1) { fwrite(STDERR, "FATAL: mutant '$MUTANT' applied $c times (need 1)\n"); exit(2); }
    $mirrorPath = __DIR__ . '/mirror_mutant.php';
    file_put_contents($mirrorPath, $m2);
    echo "mutant: $MUTANT\n";
}

// The mirror may reference helpers from other files; stub the ones the
// functions under test can reach.
if (!function_exists('journalStripWhoCols')) { function journalStripWhoCols($rows, $api = null) { return $rows; } }
require $mirrorPath;
foreach (array('penumbra_split_change_columns', 'generate_snapshot_signature', 'penumbra_compute_snapshot_diff',
               'penumbra_pr_change_analysis', 'penumbra_build_diff_groups') as $fn) {
    if (!function_exists($fn)) { fwrite(STDERR, "FATAL: $fn missing from the mirror\n"); exit(2); }
}

// The PRE-change runner's two functions, renamed, for the legacy byte check.
$origSig = null; $origDiff = null;
if ($ORIG !== null) {
    $srcOrig = @file_get_contents($ORIG);
    if ($srcOrig === false) { fwrite(STDERR, "FATAL: cannot read --orig $ORIG\n"); exit(2); }
    foreach (array('generate_snapshot_signature' => 'orig_generate_snapshot_signature',
                   'penumbra_compute_snapshot_diff' => 'orig_penumbra_compute_snapshot_diff') as $fn => $as) {
        if (!preg_match('/\nfunction ' . $fn . '\(/', $srcOrig, $mm, PREG_OFFSET_CAPTURE)) { fwrite(STDERR, "FATAL: $fn not in --orig\n"); exit(2); }
        $start = $mm[0][1] + 1;
        $toks = token_get_all('<?php ' . substr($srcOrig, $start));
        $buf = ''; $depth = 0; $started = false;
        foreach ($toks as $i => $tt) {
            if ($i === 0) continue; // the open tag
            $txt = is_array($tt) ? $tt[1] : $tt;
            $buf .= $txt;
            if ($txt === '{' || (is_array($tt) && ($tt[0] === T_CURLY_OPEN || $tt[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) break; }
        }
        eval(preg_replace('/^function ' . $fn . '\(/', 'function ' . $as . '(', $buf));
    }
    $origSig = 'orig_generate_snapshot_signature';
    $origDiff = 'orig_penumbra_compute_snapshot_diff';
}

// ---------------------------------------------------------------------------
// Fixtures - the COI DOE shape: one row per person per proposal.
// ---------------------------------------------------------------------------
function row($p, $u, $done, $tasks, $name = 'X') {
    return array('PROPOSALNUMBER' => $p, 'UNIQUE_ID' => $u, 'LASTNAME' => $name, 'PERSONNELCOMPLETED' => $done, 'TASKS' => $tasks);
}
$baseline = array(
    row('P1', 'u1', '0', 'No Tasks', 'Ade'),        // only TASKS changes
    row('P1', 'u2', '0', 'No Tasks', 'OConnor'),    // COMPLETED flips AND TASKS changes
    row('P2', 'u3', '0', 'OCOI Review', 'Kelley'),  // only COMPLETED flips
    row('P3', 'u4', '1', 'No Tasks', 'Gone'),       // removed
    row('P4', 'u5', '1', 'No Tasks', 'Same'),       // unchanged
);
$current = array(
    row('P1', 'u1', '0', 'OCOI Review', 'Ade'),
    row('P1', 'u2', '1', 'OCOI Review', 'OConnor'),
    row('P2', 'u3', '1', 'OCOI Review', 'Kelley'),
    row('P4', 'u5', '1', 'No Tasks', 'Same'),
    row('P5', 'u6', '0', 'No Tasks', 'New'),        // new
);
function keysOf($rows) { $o = array(); foreach ($rows as $r) { $o[] = $r['PROPOSALNUMBER'] . '/' . $r['UNIQUE_ID']; } sort($o); return $o; }
function modKeys($diff) { $o = array(); foreach ($diff['modified'] as $m) { $o[] = $m['row']['PROPOSALNUMBER'] . '/' . $m['row']['UNIQUE_ID']; } sort($o); return $o; }
function modCols($diff, $key) {
    foreach ($diff['modified'] as $m) {
        if ($m['row']['PROPOSALNUMBER'] . '/' . $m['row']['UNIQUE_ID'] === $key) { $c = $m['changedCols']; sort($c); return $c; }
    }
    return null;
}

// ---------------------------------------------------------------------------
section('1. penumbra_split_change_columns');
t_eq(penumbra_split_change_columns(null), array('keys' => array(), 'ignore' => array()), 'null -> empty');
t_eq(penumbra_split_change_columns(array('ProposalNumber', 'unique_id')), array('keys' => array('PROPOSALNUMBER', 'UNIQUE_ID'), 'ignore' => array()), 'legacy list = keys only, uppercased');
t_eq(penumbra_split_change_columns(array('ID', '!tasks', ' ! TaskCount ')), array('keys' => array('ID'), 'ignore' => array('TASKS', 'TASKCOUNT')), '"!" entries split out (case + spaces)');
t_eq(penumbra_split_change_columns(array('A', '!A', 'B')), array('keys' => array('B'), 'ignore' => array('A')), 'a column marked both ways is ignored, not a key');
t_eq(penumbra_split_change_columns(array('#', '!', '!#', '', 'A', 'A', '!B', '!B')), array('keys' => array('A'), 'ignore' => array('B')), '"#", bare "!", blanks and dupes dropped');
t_eq(penumbra_split_change_columns(array('!TASKS')), array('keys' => array(), 'ignore' => array('TASKS')), 'ignore-only list');

// ---------------------------------------------------------------------------
section('2. legacy lists are unchanged vs the pre-change runner');
if ($origSig === null) {
    echo "    (skipped - pass --orig=<pre-change schedule_runner.php>)\n";
} else {
    $lists = array(null, array(), array('PROPOSALNUMBER'), array('proposalnumber', 'UNIQUE_ID'), array('UNIQUE_ID', 'TASKS'), array('NOPE'), array('NOPE', 'UNIQUE_ID'));
    foreach ($lists as $li => $l) {
        t_eq(generate_snapshot_signature($current, $l), $origSig($current, $l), "signature identical, list #$li");
        t_eq(serialize(penumbra_compute_snapshot_diff($current, $baseline, $l)), serialize($origDiff($current, $baseline, $l)), "diff identical, list #$li");
    }
    // Column-set mismatch (all-columns intersection path) must also be untouched.
    $narrow = array_map(function ($r) { unset($r['TASKS']); return $r; }, $baseline);
    t_eq(serialize(penumbra_compute_snapshot_diff($current, $narrow, null)), serialize($origDiff($current, $narrow, null)), 'diff identical, all-columns with a column-set mismatch');
}

// ---------------------------------------------------------------------------
section('3. diff with ignored columns');
$K = array('PROPOSALNUMBER', 'UNIQUE_ID');
$plain = penumbra_compute_snapshot_diff($current, $baseline, $K);
t_eq(modKeys($plain), array('P1/u1', 'P1/u2', 'P2/u3'), 'control: without ignore, the TASKS-only row is Modified');

$ign = penumbra_compute_snapshot_diff($current, $baseline, array_merge($K, array('!TASKS')));
t_eq(modKeys($ign), array('P1/u2', 'P2/u3'), 'with !TASKS: only rows whose COMPLETED changed are Modified');
t_eq(keysOf($ign['unchanged']), array('P1/u1', 'P4/u5'), 'with !TASKS: the TASKS-only row is Unchanged');
t_eq(keysOf($ign['new']), array('P5/u6'), 'New unaffected');
t_eq(keysOf($ign['removed']), array('P3/u4'), 'Removed unaffected');
t_eq(modCols($ign, 'P1/u2'), array('PERSONNELCOMPLETED', 'TASKS'), 'mixed row still lists the ignored column (for [was:]/[now:])');
t_eq(modCols($ign, 'P2/u3'), array('PERSONNELCOMPLETED'), 'COMPLETED-only row lists just COMPLETED');
t_eq($ign['unchangedCount'], 2, 'unchangedCount follows');

$ignLower = penumbra_compute_snapshot_diff($current, $baseline, array('proposalnumber', 'unique_id', '!tasks'));
t_eq(serialize($ignLower), serialize($ign), 'lower-case list (as typed in a URL) = same diff');
$ignAbsent = penumbra_compute_snapshot_diff($current, $baseline, array_merge($K, array('!NO_SUCH_COL')));
t_eq(serialize($ignAbsent), serialize($plain), 'ignoring a column the data lacks changes nothing');

// Ignore-only list: rows pair on every other column.
$only = penumbra_compute_snapshot_diff($current, $baseline, array('!TASKS'));
t_ok($only !== null, 'ignore-only list is comparable');
if ($only === null) $only = array('new' => array(), 'removed' => array(), 'modified' => array('x'), 'unchanged' => array());
t_eq(keysOf($only['unchanged']), array('P1/u1', 'P4/u5'), 'ignore-only: TASKS-only row pairs as Unchanged');
t_eq(keysOf($only['new']), array('P1/u2', 'P2/u3', 'P5/u6'), 'ignore-only: a COMPLETED flip is a New + Removed pair (no key)');
t_eq(keysOf($only['removed']), array('P1/u2', 'P2/u3', 'P3/u4'), 'ignore-only: ... and its Removed half');
t_eq(count($only['modified']), 0, 'ignore-only: no Modified (no key to pair on)');
$allIgnored = penumbra_compute_snapshot_diff(array(array('A' => 1)), array(array('A' => 2)), array('!A'));
t_eq($allIgnored, null, 'every column ignored -> not comparable (null), never a silent match');

// ---------------------------------------------------------------------------
section('4. signature');
$tasksOnly = array_map(function ($r) { $r['TASKS'] = 'changed'; return $r; }, $baseline);
t_eq(generate_snapshot_signature($tasksOnly, array('!TASKS')), generate_snapshot_signature($baseline, array('!TASKS')), 'ignore-only: a TASKS change keeps the signature');
$flip = $baseline; $flip[0]['PERSONNELCOMPLETED'] = '1';
t_ok(generate_snapshot_signature($flip, array('!TASKS')) !== generate_snapshot_signature($baseline, array('!TASKS')), 'ignore-only: a COMPLETED change moves the signature');
t_ok(generate_snapshot_signature($tasksOnly, null) !== generate_snapshot_signature($baseline, null), 'control: all-columns signature sees the TASKS change');
t_eq(generate_snapshot_signature($current, array_merge($K, array('!TASKS'))), generate_snapshot_signature($current, $K), 'keys + ignore signs the keys only (as before)');

// ---------------------------------------------------------------------------
section('5. per-recipient decision (skip + analysis)');
$opts = array('changes_only' => true, 'skip_no_change' => true, 'change_mode' => 'custom', 'snap_clauses' => array('has' => false));
$base5 = array('id' => 7, 'signature' => 'x', 'rows' => $baseline);
$cur5 = $tasksOnly; // only TASKS moved since the baseline
$r = penumbra_pr_change_analysis($cur5, 'standard', $cur5, $base5, $opts + array('change_columns' => array_merge($K, array('!TASKS'))));
t_eq($r['skip'], true, 'only an ignored column changed -> skipped');
t_ok(strpos($r['skip_reason'], 'no row changes') !== false, 'skip reason names the empty diff');
$r = penumbra_pr_change_analysis($cur5, 'standard', $cur5, $base5, $opts + array('change_columns' => $K));
t_eq($r['skip'], false, 'control: same data without the ignore -> sent');
t_eq(count($r['diff']['modified']), 5, 'control: all five rows Modified');
$cur5b = $tasksOnly; $cur5b[2]['PERSONNELCOMPLETED'] = '1';
$r = penumbra_pr_change_analysis($cur5b, 'standard', $cur5b, $base5, $opts + array('change_columns' => array_merge($K, array('!TASKS'))));
t_eq($r['skip'], false, 'a real flip alongside ignored changes -> sent');
t_eq(count($r['diff']['modified']), 1, 'exactly the flipped row is Modified');
t_eq($r['advance'], true, 'baseline advances on the changed send');
$r = penumbra_pr_change_analysis($cur5, 'standard', $cur5, $base5, array('changes_only' => false, 'skip_no_change' => true, 'change_mode' => 'custom',
    'change_columns' => array('!TASKS'), 'snap_clauses' => array('has' => false)));
t_eq($r['skip'], true, 'skip-only, ignore-only list: TASKS change alone -> skipped');

// ---------------------------------------------------------------------------
section('6. email rendition keeps [was:]/[now:] for the ignored column');
$cols = array('PROPOSALNUMBER', 'UNIQUE_ID', 'LASTNAME', 'PERSONNELCOMPLETED', 'TASKS');
$groups = penumbra_build_diff_groups($ign, $cols, true);
$modGroup = null;
foreach ($groups as $gName => $gRows) { if (strpos($gName, 'Modified') === 0) $modGroup = $gRows; }
t_ok(is_array($modGroup) && count($modGroup) === 2, 'Modified group holds the two real changes');
$mixed = null;
if (is_array($modGroup)) { foreach ($modGroup as $mr) { if ($mr['UNIQUE_ID'] === 'u2') $mixed = $mr; } }
t_ok($mixed !== null && strpos($mixed['TASKS'], '[was:]') !== false && strpos($mixed['TASKS'], 'No Tasks') !== false, 'TASKS shows [was:] No Tasks on the mixed row');
t_ok($mixed !== null && strpos($mixed['PERSONNELCOMPLETED'], '[now:]') !== false, 'COMPLETED shows [now:] on the mixed row');
$unch = null;
foreach ($groups as $gName => $gRows) { if (strpos($gName, 'Unchanged') === 0) $unch = $gRows; }
t_ok(is_array($unch) && count($unch) === 2, 'Unchanged group holds the TASKS-only row and the steady row');

if ($CONTROL) {
    section('control');
    t_ok(false, 'deliberately false assertion (must be the only FAIL)');
}

if (!$KEEP) { @unlink(__DIR__ . '/mirror.php'); @unlink(__DIR__ . '/mirror_mutant.php'); }
echo "\nPASS $pass   FAIL $fail\n";
exit($fail ? 1 : 0);
