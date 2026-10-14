<?php
/**
 * penumbra_tests/changepr/run.php - per-recipient Change Analysis (2026-09-16).
 *
 * A scheduled EMAIL task that uses per-recipient variables sends every
 * recipient a different slice. "Send as Change Analysis" and "Skip if no
 * changes" therefore diff each recipient against THEIR OWN last delivery,
 * stored in a task-scoped pool of PENUMBRA_SNAPS rows. This suite drives that
 * machinery end to end against a fake snapshots table:
 *
 *   - the penumbra_pr_* predicates (pool name, recipient key, notes marker,
 *     visibility gate) LIFTED from the live db_connection.php by tokenizer,
 *   - penumbra_pr_load_pool_index / penumbra_fetch_recipient_baseline /
 *     penumbra_pr_change_analysis / penumbra_pr_save_baselines /
 *     penumbra_pr_prune_orphans and the real diff functions they call, from
 *     mirror.php - the tokenizer-lifted, side-effect-free copy of
 *     schedule_runner.php's function declarations, regenerated EVERY run by
 *     ../pivotparity/extract_mirror.php. NEVER require schedule_runner.php:
 *     its top level opens Oracle, claims tasks and SENDS EMAIL.
 *
 * Only the database is faked (queryViaOci8 / execClobInsert / getOci8Connection
 * and the oci_* calls the rotation uses), with a small predicate evaluator so
 * a query whose WHERE clause changes changes the answer - which is what lets
 * the MUTANT bite.
 *
 *   php.exe -n run.php [--app=<app dir>] [--control] [--mutant] [--keep]
 *
 * --control adds one deliberately false assertion and MUST report FAIL 1.
 * --mutant rewrites the mirror so every recipient shares ONE baseline (the
 *   pre-feature behaviour) and MUST report failures in the isolation section.
 * --keep leaves mirror.php / mirror_mutant.php behind for inspection.
 *
 * EXPECTED TAIL: "PASS <n>   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$MUTANT  = in_array('--mutant',  $argv, true);
$KEEP    = in_array('--keep',    $argv, true);
$APP = null;
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = substr($a, 6); }
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
// 0. Sources
// ---------------------------------------------------------------------------
$runnerPath = $APP . '/schedule_runner.php';
$dbPath     = $APP . '/db_connection.php';
$srcDb = @file_get_contents($dbPath);
if ($srcDb === false || !is_file($runnerPath)) { fwrite(STDERR, "FATAL: cannot read the app under $APP\n"); exit(2); }

// ---------------------------------------------------------------------------
// 1. Regenerate the runner mirror (never require the runner itself)
// ---------------------------------------------------------------------------
$extractor  = dirname(__DIR__) . '/pivotparity/extract_mirror.php';
$mirrorPath = __DIR__ . '/mirror.php';
if (!is_file($extractor)) { fwrite(STDERR, "FATAL: extractor not found at $extractor\n"); exit(2); }
$cmd = escapeshellarg(PHP_BINARY) . ' -n ' . escapeshellarg($extractor) . ' ' . escapeshellarg($runnerPath) . ' ' . escapeshellarg($mirrorPath) . ' 2>&1';
$__cwd = getcwd(); @chdir(sys_get_temp_dir()); // exec() spawns cmd.exe, which refuses a UNC cwd
exec($cmd, $xo, $xc);
@chdir($__cwd);
if ($xc !== 0 || !is_file($mirrorPath)) { fwrite(STDERR, "FATAL: mirror extraction failed (exit $xc): " . implode("\n", $xo) . "\n"); exit(2); }
echo "mirror: " . trim(implode(' ', $xo)) . "\n";

if ($MUTANT) {
    // The mutant: one shared baseline for everyone - exactly what the feature
    // replaces. The pool index files every marked row under one key and the
    // fetch falls back to it, so recipient B diffs against whoever's row is
    // newest. Both rewrites are counted; a mirror that no longer carries the
    // expected lines fails loudly rather than "passing" an un-mutated file.
    $m = file_get_contents($mirrorPath);
    $m1 = preg_replace(
        '/(\$key = penumbra_pr_key_from_notes\(isset\(\$row\[\'NOTES\'\]\) \? \$row\[\'NOTES\'\] : \'\'\);)(\R\s*)(if \(\$key === \'\' \|\| isset\(\$index\[\$key\]\)\) continue;)/',
        '$1$2if ($key !== \'\') $key = \'anyone\'; /* MUTANT */$2$3', $m, -1, $c1);
    $m2 = preg_replace(
        '/if \(\$key === \'\' \|\| !is_array\(\$poolIndex\) \|\| !isset\(\$poolIndex\[\$key\]\)\) return null;/',
        'if ($key === \'\' || !is_array($poolIndex)) return null; if (!isset($poolIndex[$key])) { if (!isset($poolIndex[\'anyone\'])) return null; $key = \'anyone\'; } /* MUTANT */', $m1, -1, $c2);
    if ($c1 !== 1 || $c2 !== 1) { fwrite(STDERR, "FATAL: mutant rewrites applied $c1/$c2 times (need 1/1)\n"); exit(2); }
    $mirrorPath = __DIR__ . '/mirror_mutant.php';
    file_put_contents($mirrorPath, $m2);
    echo "mutant: shared-baseline rewrite applied\n";
}

// ---------------------------------------------------------------------------
// 2. Fake database - defined BEFORE the mirror so nothing real is reachable
// ---------------------------------------------------------------------------
if (!defined('OCI_NO_AUTO_COMMIT'))    define('OCI_NO_AUTO_COMMIT', 0);
if (!defined('OCI_COMMIT_ON_SUCCESS')) define('OCI_COMMIT_ON_SUCCESS', 32);

class FakeSnaps {
    public static $rows = array();        // id => row (assoc, UPPERCASE column keys)
    public static $nextId = 100;
    public static $clock = 0;
    public static $sqlLog = array();
    public static $staged = array();      // ids deleted under OCI_NO_AUTO_COMMIT, awaiting commit
    public static $insertThrow = null;    // set to a message to make the next insert fail
    public static $inserted = array();

    static function reset() {
        self::$rows = array(); self::$nextId = 100; self::$clock = 0; self::$sqlLog = array();
        self::$staged = array(); self::$insertThrow = null; self::$inserted = array();
    }
    static function stamp() { self::$clock++; return sprintf('2026-09-16 %02d:%02d:00', intdiv(self::$clock, 60) % 24, self::$clock % 60); }
    /** Seed a row with explicit fields; ID and CREATED_AT default when absent. */
    static function seed($fields) {
        $row = array_merge(array(
            'ID' => self::$nextId++, 'REPORT_ID' => 0, 'SNAP_NAME' => '', 'SNAP_DATA' => '', 'ROW_COUNT' => 0,
            'COLUMN_COUNT' => '', 'TABLES_USED' => '', 'SEARCH_TERM' => '', 'DATA_SIGNATURE' => null, 'NOTES' => '',
            'COLUMN_NAMES' => '', 'PROMPTS_JSON' => '', 'CREATED_BY' => '', 'PINNED_BY' => null, 'CREATED_AT' => self::stamp()
        ), $fields);
        if (isset($fields['ID'])) { self::$nextId = max(self::$nextId, (int)$fields['ID'] + 1); }
        self::$rows[(int)$row['ID']] = $row;
        return (int)$row['ID'];
    }
    static function ids($filter) {
        $out = array();
        foreach (self::$rows as $id => $r) { if ($filter($r)) $out[] = $id; }
        sort($out);
        return $out;
    }
    /** The predicate evaluator: WHERE a = :b AND c IS NULL ... ORDER BY x DESC, y ASC */
    static function query($sql, $binds) {
        self::$sqlLog[] = $sql;
        if (stripos($sql, 'FROM PENUMBRA_SNAPS') === false) throw new Exception('FakeSnaps: unexpected SQL ' . $sql);
        $where = ''; $order = ''; $limit = null;
        if (preg_match('/\bWHERE\b(.*?)(\bORDER BY\b(.*))?$/is', $sql, $m)) {
            $where = trim($m[1]);
            $order = isset($m[3]) ? trim($m[3]) : '';
        }
        $preds = array();
        if ($where !== '') {
            foreach (preg_split('/\s+AND\s+/i', $where) as $p) {
                $p = trim($p);
                if (preg_match('/^ROWNUM\s*=\s*(\d+)$/i', $p, $pm)) { $limit = (int)$pm[1]; continue; }
                if (preg_match('/^([A-Z_]+)\s*=\s*(:[a-z_]+)$/i', $p, $pm)) { $preds[] = array('eq', strtoupper($pm[1]), $pm[2]); continue; }
                if (preg_match('/^([A-Z_]+)\s+IS\s+NULL$/i', $p, $pm)) { $preds[] = array('null', strtoupper($pm[1])); continue; }
                if (preg_match('/^([A-Z_]+)\s+IS\s+NOT\s+NULL$/i', $p, $pm)) { $preds[] = array('notnull', strtoupper($pm[1])); continue; }
                throw new Exception('FakeSnaps: unsupported predicate ' . $p);
            }
        }
        $hits = array();
        foreach (self::$rows as $r) {
            $ok = true;
            foreach ($preds as $pr) {
                $col = $pr[1];
                $v = array_key_exists($col, $r) ? $r[$col] : null;
                if ($pr[0] === 'eq') {
                    if (!array_key_exists($pr[2], $binds)) throw new Exception('FakeSnaps: missing bind ' . $pr[2]);
                    if ((string)$v !== (string)$binds[$pr[2]]) { $ok = false; break; }
                } elseif ($pr[0] === 'null') { if ($v !== null && $v !== '') { $ok = false; break; } }
                elseif ($pr[0] === 'notnull') { if ($v === null || $v === '') { $ok = false; break; } }
            }
            if ($ok) $hits[] = $r;
        }
        if ($order !== '') {
            $keys = array();
            foreach (explode(',', $order) as $o) {
                $o = trim($o);
                if (preg_match('/^([A-Z_]+)(?:\s+(ASC|DESC))?$/i', $o, $om)) $keys[] = array(strtoupper($om[1]), isset($om[2]) && strtoupper($om[2]) === 'DESC' ? -1 : 1);
            }
            usort($hits, function ($a, $b) use ($keys) {
                foreach ($keys as $k) {
                    $x = isset($a[$k[0]]) ? $a[$k[0]] : ''; $y = isset($b[$k[0]]) ? $b[$k[0]] : '';
                    $c = is_numeric($x) && is_numeric($y) ? ($x <=> $y) : strcmp((string)$x, (string)$y);
                    if ($c !== 0) return $c * $k[1];
                }
                return 0;
            });
        }
        if ($limit !== null) $hits = array_slice($hits, 0, $limit);
        return $hits;
    }
    static function insert($cols, $raw) {
        if (self::$insertThrow !== null) { $msg = self::$insertThrow; self::$insertThrow = null; throw new Exception($msg); }
        $row = array();
        foreach ($cols as $k => $v) { $row[strtoupper($k)] = $v; }
        $row['ID'] = self::$nextId++;
        $row['CREATED_AT'] = self::stamp();
        if (!array_key_exists('PINNED_BY', $row)) $row['PINNED_BY'] = null;
        self::$rows[$row['ID']] = $row;
        self::$inserted[] = $row['ID'];
        return $row['ID'];
    }
}
function queryViaOci8($sql, $binds = array()) { return FakeSnaps::query($sql, $binds); }
function getOci8Connection() { return 'OCI-FAKE'; }
function execClobInsert($pdoConn, $table, $cols, $clobCols, $rawCols = array(), $returnIdCol = null) {
    if ($table !== 'PENUMBRA_SNAPS') throw new Exception('FakeSnaps: unexpected table ' . $table);
    return FakeSnaps::insert($cols, $rawCols);
}
if (!function_exists('oci_parse')) {
    function oci_parse($conn, $sql) { return array('sql' => $sql, 'binds' => array()); }
    function oci_bind_by_name(&$stmt, $name, &$var) { $stmt['binds'][$name] = $var; return true; }
    function oci_execute($stmt, $mode = 32) {
        FakeSnaps::$sqlLog[] = $stmt['sql'];
        if (!preg_match('/^DELETE FROM PENUMBRA_SNAPS WHERE ID = :sid$/', $stmt['sql'])) throw new Exception('FakeSnaps: unexpected oci sql ' . $stmt['sql']);
        $id = (int)$stmt['binds'][':sid'];
        if (!isset(FakeSnaps::$rows[$id])) return false;
        if ($mode === OCI_NO_AUTO_COMMIT) { FakeSnaps::$staged[$id] = FakeSnaps::$rows[$id]; }
        unset(FakeSnaps::$rows[$id]);
        return true;
    }
    function oci_free_statement($stmt) { return true; }
    function oci_commit($conn) { FakeSnaps::$staged = array(); return true; }
    function oci_rollback($conn) { foreach (FakeSnaps::$staged as $id => $row) { FakeSnaps::$rows[$id] = $row; } FakeSnaps::$staged = array(); return true; }
    function oci_error($x = null) { return array('message' => 'fake oci error'); }
}
$conn = 'PDO-FAKE';

// ---------------------------------------------------------------------------
// 3. Lift the shared predicates from the LIVE db_connection.php (tokenizer)
// ---------------------------------------------------------------------------
function lift_function($src, $name) {
    $tokens = token_get_all($src); $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        $t = $tokens[$i];
        if (!is_array($t) || $t[0] !== T_FUNCTION) continue;
        $k = $i + 1;
        while ($k < $n && is_array($tokens[$k]) && $tokens[$k][0] === T_WHITESPACE) $k++;
        if (!($k < $n && is_array($tokens[$k]) && $tokens[$k][0] === T_STRING && $tokens[$k][1] === $name)) continue;
        $buf = ''; $depth = 0; $started = false;
        for ($j = $i; $j < $n; $j++) {
            $tt = $tokens[$j]; $txt = is_array($tt) ? $tt[1] : $tt;
            $buf .= $txt;
            if ($txt === '{' || (is_array($tt) && ($tt[0] === T_CURLY_OPEN || $tt[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
        return null;
    }
    return null;
}
$predicates = array('penumbra_pr_pool', 'penumbra_pr_is_pool_row', 'penumbra_pr_recipient_key', 'penumbra_pr_notes_key', 'penumbra_pr_key_from_notes', 'penumbra_pr_row_visible_to');
foreach ($predicates as $fn) {
    $code = lift_function($srcDb, $fn);
    if ($code === null) { fwrite(STDERR, "FATAL: $fn not found in db_connection.php\n"); exit(2); }
    if (!function_exists($fn)) eval($code);
}

require $mirrorPath;
foreach (array('penumbra_pr_load_pool_index', 'penumbra_fetch_recipient_baseline', 'penumbra_pr_change_analysis', 'penumbra_pr_save_baselines', 'penumbra_pr_prune_orphans', 'penumbra_pr_orphan_ids', 'penumbra_pr_normalize_snapshot_rows', 'penumbra_compute_snapshot_diff', 'penumbra_build_diff_groups', 'penumbra_filter_diff_groups', 'penumbra_extract_snap_type_clauses', 'generate_snapshot_signature', 'penumbra_snaps_pin_supported', 'penumbra_pr_has_recipient_token', 'penumbra_pr_compare_link_allowed', 'penumbra_pr_compare_url', 'penumbra_pr_compare_links_html', 'penumbra_pr_compare_note_html') as $fn) {
    if (!function_exists($fn)) { fwrite(STDERR, "FATAL: $fn missing from the mirror - is the runner change deployed?\n"); exit(2); }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
$RID = 77; $TASK = 1234; $POOL = penumbra_pr_pool($TASK); $PW = null;
$A = 'alice@ncsu.edu'; $B = 'bob@ncsu.edu'; $C = 'carol@ncsu.edu';
$rowsA = array(array('ID' => '1', 'NAME' => 'Alpha', 'AMOUNT' => '100'), array('ID' => '2', 'NAME' => 'Beta', 'AMOUNT' => '250'), array('ID' => '3', 'NAME' => 'Gamma', 'AMOUNT' => '75'));
$rowsB = array(array('ID' => '9', 'NAME' => 'Omega', 'AMOUNT' => '10'), array('ID' => '10', 'NAME' => 'Psi', 'AMOUNT' => '20'));
function payload($rows) { return json_encode(penumbra_pr_normalize_snapshot_rows($rows)); }
function sig($rows, $keys = null) { return generate_snapshot_signature($rows, $keys); }
function baseline($id, $rows, $sigOverride = null) {
    return array('id' => $id, 'signature' => ($sigOverride !== null ? $sigOverride : sig($rows)), 'name' => 'b', 'created_at' => '', 'rows' => $rows, 'log' => array());
}
$OPTS_CA   = array('changes_only' => true,  'skip_no_change' => false, 'change_mode' => 'all');
$OPTS_BOTH = array('changes_only' => true,  'skip_no_change' => true,  'change_mode' => 'all');
$OPTS_SKIP = array('changes_only' => false, 'skip_no_change' => true,  'change_mode' => 'all');

// ---------------------------------------------------------------------------
section('1. shared predicates (db_connection.php)');
// ---------------------------------------------------------------------------
t_eq(penumbra_pr_pool(1234), 'SCHEDULER_PR_1234', 'pool name is task-scoped');
t_eq(penumbra_pr_pool('12abc'), 'SCHEDULER_PR_12', 'pool name casts the id');
t_eq(penumbra_pr_is_pool_row('SCHEDULER_PR_7'), true, 'pool row detected');
t_eq(penumbra_pr_is_pool_row('SCHEDULER'), false, 'plain scheduler pool is not a pr row');
t_eq(penumbra_pr_is_pool_row('SCHEDULER_DBDUMP_7'), false, 'db dump pool is not a pr row');
t_eq(penumbra_pr_recipient_key(' Alice@NCSU.edu '), 'alice@ncsu.edu', 'key lowercases and trims');
t_eq(penumbra_pr_recipient_key('bplimon'), 'bplimon@ncsu.edu', 'bare unity id becomes ncsu email');
t_eq(penumbra_pr_recipient_key('not an email'), '', 'junk yields empty key');
t_eq(penumbra_pr_recipient_key(''), '', 'empty yields empty key');
t_eq(penumbra_pr_notes_key('alice@ncsu.edu'), 'recipient:alice@ncsu.edu', 'notes marker');
t_eq(penumbra_pr_key_from_notes('recipient:alice@ncsu.edu'), 'alice@ncsu.edu', 'marker round-trips');
t_eq(penumbra_pr_key_from_notes('my own note'), '', 'a human note is not a marker');
t_eq(penumbra_pr_row_visible_to('SCHEDULER', 'anything', false, array('x@ncsu.edu')), true, 'non-pool rows are not gated here');
t_eq(penumbra_pr_row_visible_to('SCHEDULER_PR_1', 'recipient:alice@ncsu.edu', true, array()), true, 'admin sees every pool row');
t_eq(penumbra_pr_row_visible_to('SCHEDULER_PR_1', 'recipient:alice@ncsu.edu', false, array('ALICE@ncsu.edu')), true, 'the recipient sees their own row (case-folded)');
t_eq(penumbra_pr_row_visible_to('SCHEDULER_PR_1', 'recipient:alice@ncsu.edu', false, array('alice')), true, 'unity id form matches too');
t_eq(penumbra_pr_row_visible_to('SCHEDULER_PR_1', 'recipient:alice@ncsu.edu', false, array('bob@ncsu.edu', 'bob')), false, 'another recipient is refused');
t_eq(penumbra_pr_row_visible_to('SCHEDULER_PR_1', '', false, array('alice@ncsu.edu')), false, 'an unmarked pool row is refused to non-admins');

// ---------------------------------------------------------------------------
section('2. the pure decision');
// ---------------------------------------------------------------------------
$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, null, array('changes_only' => false, 'skip_no_change' => false));
t_eq($r['skip'], false, 'neither option: never skips');
t_eq($r['advance'], false, 'neither option: never advances');
t_eq($r['email_data'], null, 'neither option: full report');

$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, null, $OPTS_CA);
t_eq($r['skip'], false, 'no baseline: sends');
t_eq($r['advance'], true, 'no baseline: advances (becomes the baseline)');
t_eq($r['email_data'], null, 'no baseline: full report body');
t_eq($r['signature'], sig($rowsA), 'no baseline: signature is the flat-rows signature');
t_ok(count($r['log']) === 1 && strpos($r['log'][0], 'no baseline') !== false, 'no baseline: log says so');

$unreadable = array('id' => 5, 'signature' => sig($rowsA), 'name' => '', 'created_at' => '', 'rows' => null, 'log' => array('failed to decrypt baseline #5 - cannot diff.'));
$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, $unreadable, $OPTS_BOTH);
t_eq($r['skip'], true, 'unreadable rows + matching signature + skip: skips');
t_ok(strpos($r['skip_reason'], 'signature match') !== false, 'unreadable: reason names the signature match');
t_ok(in_array('failed to decrypt baseline #5 - cannot diff.', $r['log'], true), 'unreadable: fetch log is carried through');
$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, $unreadable, $OPTS_CA);
t_eq($r['skip'], false, 'unreadable rows without skip: sends');
t_eq($r['advance'], true, 'unreadable rows: advances with a full send');
t_eq($r['email_data'], null, 'unreadable rows: full report body');
$unreadable2 = $unreadable; $unreadable2['signature'] = 'different';
$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, $unreadable2, $OPTS_BOTH);
t_eq($r['skip'], false, 'unreadable rows + different signature + skip: sends');
t_eq($r['advance'], true, 'unreadable rows + different signature: advances');

$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, baseline(6, $rowsA), $OPTS_CA);
t_eq($r['skip'], false, 'unchanged, analysis only: sends');
t_eq($r['advance'], false, 'unchanged: never advances (no pool churn)');
t_eq(array_keys($r['email_data']), array('Unchanged Rows'), 'unchanged: one Unchanged Rows group');
t_eq(count($r['email_data']['Unchanged Rows']), 3, 'unchanged: every row in it');
t_eq($r['count_text'], '0 new, 0 removed, 0 modified (3 unchanged)', 'unchanged: counts text');
t_eq($r['baseline_id'], 6, 'unchanged: baseline id reported');
$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, baseline(6, $rowsA), $OPTS_BOTH);
t_eq($r['skip'], true, 'unchanged + skip: skips');
t_ok(strpos($r['skip_reason'], 'diff empty') !== false, 'unchanged + skip: reason is the empty diff');
t_eq($r['advance'], false, 'unchanged + skip: no advance');

$rowsA2 = $rowsA; $rowsA2[1]['AMOUNT'] = '999';
$optsKey = array('changes_only' => true, 'skip_no_change' => true, 'change_mode' => 'custom', 'change_columns' => array('ID'));
$r = penumbra_pr_change_analysis($rowsA2, 'standard', $rowsA2, baseline(6, $rowsA, sig($rowsA, array('ID'))), $optsKey);
t_eq($r['skip'], false, 'one modified row (key mode): sends');
t_eq($r['advance'], true, 'one modified row: advances');
t_eq(array_keys($r['email_data']), array('Modified Rows', 'Unchanged Rows'), 'modified: groups in client order, empty groups omitted');
t_eq(count($r['email_data']['Modified Rows']), 1, 'modified: one row in Modified');
$modCell = $r['email_data']['Modified Rows'][0]['AMOUNT'];
t_ok(strpos($modCell, '[was:]') !== false && strpos($modCell, '250') !== false && strpos($modCell, '999') !== false, 'modified: email cell carries [was:] old and new');
t_ok(isset($r['export_data']['Modified Rows'][0]['CHANGE_TYPE']), 'modified: export rendition adds the CHANGE_TYPE column');
t_eq($r['count_text'], '0 new, 0 removed, 1 modified (2 unchanged)', 'modified: counts text');
t_eq($r['signature'], sig($rowsA2, array('ID')), 'key mode: signature restricted to the key columns');

$rowsA3 = array($rowsA[0], $rowsA[2], array('ID' => '4', 'NAME' => 'Delta', 'AMOUNT' => '5'));
$r = penumbra_pr_change_analysis($rowsA3, 'standard', $rowsA3, baseline(6, $rowsA), $OPTS_CA);
t_eq(array_keys($r['email_data']), array('New Rows', 'Removed Rows', 'Unchanged Rows'), 'all-columns mode: new + removed + unchanged');
t_eq($r['count_text'], '1 new, 1 removed, 0 modified (2 unchanged)', 'all-columns: counts text');
t_eq($r['advance'], true, 'all-columns change: advances');

$clauses = penumbra_extract_snap_type_clauses("__SNAP_TYPE = 'New Rows'");
$optsClause = $OPTS_CA; $optsClause['snap_clauses'] = $clauses;
$r = penumbra_pr_change_analysis($rowsA3, 'standard', $rowsA3, baseline(6, $rowsA), $optsClause);
t_eq(array_keys($r['email_data']), array('New Rows'), '__SNAP_TYPE include narrows the delivered groups');
t_eq(array_keys($r['export_data']), array('New Rows'), '__SNAP_TYPE narrows the export rendition too');
t_eq($r['count_text'], '1 new, 1 removed, 0 modified (2 unchanged)', '__SNAP_TYPE: counts still describe the FULL diff');
t_eq($r['advance'], true, '__SNAP_TYPE: advance still follows the full diff');
t_ok((bool)preg_grep('/group filter kept: New Rows/', $r['log']), '__SNAP_TYPE: log names the kept groups');

$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, baseline(6, array(array('OTHER' => 'x'))), $OPTS_CA);
t_eq($r['email_data'], null, 'not comparable (no shared columns): full report');
t_eq($r['advance'], true, 'not comparable: advances');
t_ok((bool)preg_grep('/not comparable/', $r['log']), 'not comparable: log says why');
$r = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, baseline(6, array(array('OTHER' => 'x')), sig($rowsA)), $OPTS_BOTH);
t_eq($r['skip'], true, 'not comparable + matching signature + skip: skips');

$grouped = array('G1' => array($rowsA[0], $rowsA[1]), 'G2' => array($rowsA[2]));
$r = penumbra_pr_change_analysis($grouped, 'grouped', $rowsA, baseline(6, $rowsA), $OPTS_CA);
t_eq($r['signature'], sig($rowsA), 'grouped input is flattened for the signature');
t_eq($r['advance'], false, 'grouped input, unchanged: no advance');
$r = penumbra_pr_change_analysis($rowsA3, 'pivot', $rowsA3, baseline(6, $rowsA), $OPTS_CA);
t_ok((bool)preg_grep('/pivot mode/', $r['log']), 'pivot view: log notes the flat-diff rendering');
t_ok(is_array($r['email_data']), 'pivot view: still delivers the diff groups');

$r = penumbra_pr_change_analysis($rowsA3, 'standard', $rowsA3, baseline(6, $rowsA), $OPTS_SKIP);
t_eq($r['skip'], false, 'skip-only mode, changed: sends');
t_eq($r['advance'], true, 'skip-only mode, changed: advances');
t_eq($r['email_data'], null, 'skip-only mode: the normal report goes out');
t_eq($r['count_text'], null, 'skip-only mode: the normal row count applies');

$empty = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, baseline(6, array()), $OPTS_CA);
t_eq(isset($empty['email_data']['New Rows']) ? count($empty['email_data']['New Rows']) : -1, 3, 'an EMPTY baseline is real: everything is New');

// ---------------------------------------------------------------------------
section('3. pool index + fetch against the fake table');
// ---------------------------------------------------------------------------
FakeSnaps::reset();
$idB  = FakeSnaps::seed(array('ID' => 11, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($B), 'SNAP_DATA' => payload($rowsB), 'DATA_SIGNATURE' => sig($rowsB), 'CREATED_AT' => '2026-09-15 09:00:00'));
$idA1 = FakeSnaps::seed(array('ID' => 10, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'SNAP_DATA' => payload(array($rowsA[0])), 'DATA_SIGNATURE' => 'old', 'CREATED_AT' => '2026-09-14 09:00:00'));
$idA2 = FakeSnaps::seed(array('ID' => 12, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'SNAP_DATA' => payload($rowsA), 'DATA_SIGNATURE' => sig($rowsA), 'CREATED_AT' => '2026-09-16 10:00:00'));
FakeSnaps::seed(array('ID' => 13, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => 'hand-written note', 'SNAP_DATA' => payload($rowsA), 'CREATED_AT' => '2026-09-16 11:00:00'));
FakeSnaps::seed(array('ID' => 14, 'REPORT_ID' => $RID, 'CREATED_BY' => 'SCHEDULER', 'NOTES' => penumbra_pr_notes_key($A), 'SNAP_DATA' => payload($rowsB), 'CREATED_AT' => '2026-09-16 12:00:00'));
FakeSnaps::seed(array('ID' => 15, 'REPORT_ID' => 78, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'SNAP_DATA' => payload($rowsB), 'CREATED_AT' => '2026-09-16 13:00:00'));
FakeSnaps::$sqlLog = array();
$index = penumbra_pr_load_pool_index($RID, $POOL);
t_eq(count(FakeSnaps::$sqlLog), 1, 'index: exactly one metadata query for the whole pool');
t_ok(stripos(FakeSnaps::$sqlLog[0], 'SNAP_DATA') === false, 'index: the metadata query never pulls SNAP_DATA');
$ik = array_keys($index); sort($ik);
t_eq($ik, array($A, $B), 'index: one entry per marked recipient, other pools and reports excluded');
t_eq(isset($index[$A]['id']) ? $index[$A]['id'] : null, 12, 'index: alice maps to her NEWEST row');
t_eq(isset($index[$B]['id']) ? $index[$B]['id'] : null, 11, 'index: bob maps to his row');
t_eq(isset($index[$A]['signature']) ? $index[$A]['signature'] : null, sig($rowsA), 'index: signature carried');
$fa = penumbra_fetch_recipient_baseline($index, $A, $PW);
t_eq(is_array($fa) ? $fa['rows'] : null, penumbra_pr_flatten_rows(array_map(function ($x) { return $x['rowData']; }, penumbra_pr_normalize_snapshot_rows($rowsA)), 'standard'), 'fetch: alice gets her stored rows (normalized shape)');
$fb = penumbra_fetch_recipient_baseline($index, $B, $PW);
t_eq(is_array($fb) ? $fb['id'] : null, 11, 'fetch: bob gets his own row');
t_eq(penumbra_fetch_recipient_baseline($index, $C, $PW), null, 'fetch: carol has no baseline');
t_eq(penumbra_fetch_recipient_baseline($index, '', $PW), null, 'fetch: empty key is never a baseline');
FakeSnaps::seed(array('ID' => 20, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($C), 'SNAP_DATA' => 'PENUMBRA_GCM::AAAA', 'DATA_SIGNATURE' => 'encsig', 'CREATED_AT' => '2026-09-16 14:00:00'));
FakeSnaps::seed(array('ID' => 21, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => 'recipient:dave@ncsu.edu', 'SNAP_DATA' => '{not json', 'DATA_SIGNATURE' => 'x', 'CREATED_AT' => '2026-09-16 14:01:00'));
FakeSnaps::seed(array('ID' => 22, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => 'recipient:erin@ncsu.edu', 'SNAP_DATA' => '[]', 'DATA_SIGNATURE' => 'e', 'CREATED_AT' => '2026-09-16 14:02:00'));
FakeSnaps::seed(array('ID' => 23, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => 'recipient:fay@ncsu.edu', 'SNAP_DATA' => '[{"foo":1}]', 'DATA_SIGNATURE' => 'f', 'CREATED_AT' => '2026-09-16 14:03:00'));
$index = penumbra_pr_load_pool_index($RID, $POOL);
$fc = penumbra_fetch_recipient_baseline($index, $C, null);
t_eq(is_array($fc) ? $fc['rows'] : 'missing', null, 'fetch: encrypted payload without a password -> rows unreadable');
t_eq(is_array($fc) ? $fc['signature'] : null, 'encsig', 'fetch: ... but the signature survives for the skip rule');
t_ok(is_array($fc) && (bool)preg_grep('/encrypted/', $fc['log']), 'fetch: encrypted case is logged');
$fd = penumbra_fetch_recipient_baseline($index, 'dave@ncsu.edu', null);
t_eq(is_array($fd) ? $fd['rows'] : 'missing', null, 'fetch: corrupt JSON -> rows unreadable');
$fe = penumbra_fetch_recipient_baseline($index, 'erin@ncsu.edu', null);
t_eq(is_array($fe) ? $fe['rows'] : 'missing', array(), 'fetch: an empty array payload is a real, empty baseline');
$ff = penumbra_fetch_recipient_baseline($index, 'fay@ncsu.edu', null);
t_eq(is_array($ff) ? $ff['rows'] : 'missing', null, 'fetch: a legacy shape without rowData is unreadable');

// ---------------------------------------------------------------------------
section('4. isolation - each recipient diffs against THEIR baseline (mutant target)');
// ---------------------------------------------------------------------------
// Alice's baseline (#12) is newer than Bob's (#11). A shared-baseline
// implementation hands Bob Alice's rows; the real one must not.
$index = penumbra_pr_load_pool_index($RID, $POOL);
$rowsB2 = $rowsB; $rowsB2[0]['AMOUNT'] = '11';
$rb = penumbra_pr_change_analysis($rowsB2, 'standard', $rowsB2, penumbra_fetch_recipient_baseline($index, $B, $PW), $OPTS_CA);
t_eq($rb['baseline_id'], 11, 'isolation: bob diffs against HIS baseline, not the newest in the pool');
t_eq($rb['count_text'], '1 new, 1 removed, 0 modified (1 unchanged)', 'isolation: bob sees exactly his one changed row');
$ra = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, penumbra_fetch_recipient_baseline($index, $A, $PW), $OPTS_BOTH);
t_eq($ra['skip'], true, 'isolation: alice, unchanged against her own baseline, is skipped');
$rn = penumbra_pr_change_analysis($rowsA, 'standard', $rowsA, penumbra_fetch_recipient_baseline($index, 'nobody@ncsu.edu', $PW), $OPTS_CA);
t_eq($rn['baseline_id'], null, 'isolation: a recipient with no baseline never inherits someone else\'s');
t_eq($rn['advance'], true, 'isolation: ... and gets the full report as their first baseline');

// ---------------------------------------------------------------------------
section('5. saving baselines after the sends');
// ---------------------------------------------------------------------------
FakeSnaps::reset();
$meta = array('tables_used' => 'NC_REPORTING.AWARDS', 'prompts_json' => '[{"name":"FY","value":"2026"}]');
$pending = array(
    $A => array('signature' => sig($rowsA), 'rows' => $rowsA, 'sent' => true,  'search_term' => 'STATUS = Active'),
    $B => array('signature' => sig($rowsB), 'rows' => $rowsB, 'sent' => false, 'search_term' => ''),
    $C => array('signature' => null,        'rows' => $rowsA, 'sent' => true,  'search_term' => ''),
);
ob_start();
$sv = penumbra_pr_save_baselines($conn, $RID, $POOL, $pending, $meta, $PW, 2);
$noise = ob_get_clean();
t_eq($noise, '', 'save: writes nothing to stdout (no stray logging)');
t_eq($sv['saved'], 1, 'save: only the SENT recipient with a signature is written');
t_eq($sv['failed'], 0, 'save: no failures');
$poolIds = FakeSnaps::ids(function ($r) use ($POOL) { return $r['CREATED_BY'] === $POOL; });
t_eq(count($poolIds), 1, 'save: exactly one pool row exists');
$row = FakeSnaps::$rows[$poolIds[0]];
t_eq($row['NOTES'], penumbra_pr_notes_key($A), 'save: NOTES carries the recipient marker');
t_eq($row['CREATED_BY'], $POOL, 'save: CREATED_BY is the task pool');
t_eq($row['DATA_SIGNATURE'], sig($rowsA), 'save: DATA_SIGNATURE stored');
t_eq($row['ROW_COUNT'], 3, 'save: ROW_COUNT');
t_eq($row['COLUMN_NAMES'], 'AMOUNT,ID,NAME', 'save: sorted column names');
t_eq($row['SEARCH_TERM'], 'STATUS = Active', 'save: the recipient-resolved filter is recorded');
t_eq($row['TABLES_USED'], 'NC_REPORTING.AWARDS', 'save: task-level tables carried');
t_eq($row['PROMPTS_JSON'], $meta['prompts_json'], 'save: task-level prompts carried');
t_ok(strpos($row['SNAP_NAME'], 'Auto (per-recipient)') === 0, 'save: snapshot name marks the pool');
t_eq(json_decode($row['SNAP_DATA'], true), penumbra_pr_normalize_snapshot_rows($rowsA), 'save: payload is the normalized {signature,rowData} shape');
t_ok(count($sv['log']) === 1 && strpos($sv['log'][0], $A) !== false, 'save: one log line naming the recipient');

// Rotation: alice already has two rows -> the oldest unpinned goes, the pinned one never does.
FakeSnaps::reset();
FakeSnaps::seed(array('ID' => 30, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'CREATED_AT' => '2026-09-10 09:00:00'));
FakeSnaps::seed(array('ID' => 31, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'CREATED_AT' => '2026-09-11 09:00:00', 'PINNED_BY' => 'bplimon'));
FakeSnaps::seed(array('ID' => 32, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'CREATED_AT' => '2026-09-12 09:00:00'));
FakeSnaps::seed(array('ID' => 33, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($B), 'CREATED_AT' => '2026-09-12 10:00:00'));
FakeSnaps::seed(array('ID' => 34, 'REPORT_ID' => $RID, 'CREATED_BY' => 'SCHEDULER', 'CREATED_AT' => '2026-09-01 10:00:00'));
$sv = penumbra_pr_save_baselines($conn, $RID, $POOL, array($A => array('signature' => 's', 'rows' => $rowsA, 'sent' => true)), $meta, $PW, 2);
t_eq($sv['saved'], 1, 'rotation: saved');
t_eq($sv['deleted'], 1, 'rotation: one row rotated out');
t_ok(!isset(FakeSnaps::$rows[30]), 'rotation: the OLDEST unpinned alice row is gone');
t_ok(isset(FakeSnaps::$rows[31]), 'rotation: the pinned alice row survives');
t_ok(isset(FakeSnaps::$rows[32]), 'rotation: the newer alice row survives');
t_ok(isset(FakeSnaps::$rows[33]), 'rotation: bob\'s row is untouched');
t_ok(isset(FakeSnaps::$rows[34]), 'rotation: the broadcast pool is untouched');
$aliceUnpinned = FakeSnaps::ids(function ($r) use ($POOL, $A) { return $r['CREATED_BY'] === $POOL && $r['NOTES'] === penumbra_pr_notes_key($A) && empty($r['PINNED_BY']); });
t_eq(count($aliceUnpinned), 2, 'rotation: alice keeps exactly keep=2 unpinned rows');

// Failure: the insert throws -> the staged delete is rolled back, nothing lost.
FakeSnaps::reset();
FakeSnaps::seed(array('ID' => 40, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'CREATED_AT' => '2026-09-10 09:00:00'));
FakeSnaps::seed(array('ID' => 41, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A), 'CREATED_AT' => '2026-09-11 09:00:00'));
FakeSnaps::$insertThrow = 'ORA-01653 unable to extend';
$sv = penumbra_pr_save_baselines($conn, $RID, $POOL, array($A => array('signature' => 's', 'rows' => $rowsA, 'sent' => true)), $meta, $PW, 2);
t_eq($sv['saved'], 0, 'insert failure: nothing saved');
t_eq($sv['failed'], 1, 'insert failure: reported');
t_ok(isset(FakeSnaps::$rows[40]) && isset(FakeSnaps::$rows[41]), 'insert failure: the rotation delete was rolled back');
t_ok((bool)preg_grep('/FAILED.*ORA-01653/', $sv['log']), 'insert failure: log carries the error');

t_eq(penumbra_pr_save_baselines($conn, $RID, $POOL, array(), $meta, $PW, 2), array('saved' => 0, 'deleted' => 0, 'failed' => 0, 'log' => array()), 'save: empty pending is a no-op');

// ---------------------------------------------------------------------------
section('6. pruning orphaned baselines');
// ---------------------------------------------------------------------------
FakeSnaps::reset();
FakeSnaps::seed(array('ID' => 50, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($A)));
FakeSnaps::seed(array('ID' => 51, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($B)));
FakeSnaps::seed(array('ID' => 52, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key($C)));
FakeSnaps::seed(array('ID' => 53, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => penumbra_pr_notes_key('gone@ncsu.edu'), 'PINNED_BY' => 'bplimon'));
FakeSnaps::seed(array('ID' => 54, 'REPORT_ID' => $RID, 'CREATED_BY' => $POOL, 'NOTES' => 'a human note'));
FakeSnaps::seed(array('ID' => 55, 'REPORT_ID' => $RID, 'CREATED_BY' => 'SCHEDULER', 'NOTES' => penumbra_pr_notes_key($C)));
t_eq(penumbra_pr_prune_orphans($RID, $POOL, array()), 0, 'prune: an empty recipient list is a no-op');
t_eq(count(FakeSnaps::$rows), 6, 'prune: ... and deletes nothing');
t_eq(penumbra_pr_prune_orphans($RID, $POOL, array('Alice@ncsu.edu', 'bob')), 1, 'prune: exactly the orphaned recipient row is deleted');
t_ok(!isset(FakeSnaps::$rows[52]), 'prune: carol\'s row is gone');
t_ok(isset(FakeSnaps::$rows[50]) && isset(FakeSnaps::$rows[51]), 'prune: active recipients keep their rows (case-folded, unity form)');
t_ok(isset(FakeSnaps::$rows[53]), 'prune: a pinned orphan is never deleted');
t_ok(isset(FakeSnaps::$rows[54]), 'prune: an unmarked pool row is never deleted');
t_ok(isset(FakeSnaps::$rows[55]), 'prune: the broadcast pool is never touched');
t_eq(penumbra_pr_orphan_ids(array(array('ID' => 1, 'NOTES' => 'recipient:x@ncsu.edu'), array('ID' => 2, 'NOTES' => '')), array('y@ncsu.edu' => true)), array(1), 'orphan ids: pure helper');

// ---------------------------------------------------------------------------
section('7. the per-recipient compare link');
// ---------------------------------------------------------------------------
t_eq(penumbra_pr_compare_link_allowed(false, true, array()), true, 'link: filter-variable task always allowed');
t_eq(penumbra_pr_compare_link_allowed(false, false, array()), false, 'link: no variables at all - nothing to link per recipient');
t_eq(penumbra_pr_compare_link_allowed(true, false, array('username' => '{USERNAME}')), true, 'link: query vars via a me() mapping to a recipient variable');
t_eq(penumbra_pr_compare_link_allowed(true, false, array('ouc' => '06')), false, 'link: me() mapped to a literal is not per-recipient');
t_eq(penumbra_pr_compare_link_allowed(true, false, array()), false, 'link: literal tokens in SQL cannot run live - no link');
t_eq(penumbra_pr_compare_link_allowed(true, true, 'junk'), false, 'link: a junk me map is treated as none');

$base = 'https://www3.acs.ncsu.edu/sponsor_migration/penumbra/index.php';
$u = penumbra_pr_compare_url($base, 'zz-prcheck', 42, $OPTS_CA, '', null);
t_eq($u['url'], $base . '?id=zz-prcheck&snapcmp=42', 'url: id + baseline only');
t_eq(penumbra_pr_compare_url($base, 'zz', 0, $OPTS_CA, '', null), array('url' => '', 'log' => array()), 'url: no baseline id -> no link');
$u = penumbra_pr_compare_url($base, 'zz', 7, array('change_mode' => 'custom', 'change_columns' => array('ID', 'NAME')), "OWNER_UID = bplimon and __SNAP_TYPE != 'Unchanged Rows'", null);
t_eq($u['url'], $base . '?id=zz&snapcmp=7&snapkeys=ID%2CNAME&search=OWNER_UID%20%3D%20bplimon%20and%20__SNAP_TYPE%20%21%3D%20%27Unchanged%20Rows%27', 'url: key columns + the recipient-resolved filter ride along');
$u = penumbra_pr_compare_url($base, 'zz', 7, $OPTS_CA, '', array('FY' => '2026', 'search' => 'x', 'empty' => '', 'Dept' => 'A&B'));
t_eq($u['url'], $base . '?id=zz&snapcmp=7&FY=2026&Dept=A%26B', 'url: named prompts pre-answered, reserved and empty names skipped');
t_ok((bool)preg_grep("/'search' collides/", $u['log']), 'url: the reserved collision is logged');
$many = array(); for ($i = 0; $i < 60; $i++) { $many['p' . $i] = str_repeat('v', 40); }
$u = penumbra_pr_compare_url($base, 'zz', 7, $OPTS_CA, '', $many);
t_ok(strlen($u['url']) < 1900 && (bool)preg_grep('/length cap/', $u['log']), 'url: the 1800-character cap stops the prompt list');

$note = penumbra_pr_compare_note_html(array('id' => 9, 'name' => 'Auto (per-recipient): 2026-09-16 14:05', 'created_at' => '2026-09-16 14:05:00'), strtotime('2026-09-16 16:20:00'));
t_ok(strpos($note, 'Compared against &ldquo;Auto (per-recipient): 2026-09-16 14:05&rdquo;') !== false, 'note: names the baseline');
t_ok(strpos($note, '(2 hours, 15 minutes earlier)') !== false, 'note: says how far back');
t_eq(penumbra_pr_compare_note_html(null), '', 'note: no baseline -> empty');
$note2 = penumbra_pr_compare_note_html(array('id' => 9, 'name' => '', 'created_at' => ''), 1);
t_ok(strpos($note2, 'snapshot #9') !== false && strpos($note2, ' from ') === false, 'note: unnamed, undated baseline degrades to its id');
$html = penumbra_pr_compare_links_html($base . '?id=zz&snapcmp=7&a=1', array('tsColor' => '#aaa', 'titleColor' => '#123'));
t_ok(strpos($html, "href='https://www3.acs.ncsu.edu/sponsor_migration/penumbra/index.php?id=zz&amp;snapcmp=7&amp;a=1'") !== false, 'links html: the URL is html-escaped');
t_ok(strpos($html, 'View the comparison analysis.') !== false && strpos($html, '#123') !== false, 'links html: the label and palette');
t_eq(penumbra_pr_compare_links_html('', array()), '', 'links html: no url -> nothing');

// ---------------------------------------------------------------------------
if ($CONTROL) { section('8. control'); t_ok(false, 'CONTROL - this assertion is meant to fail'); }
// ---------------------------------------------------------------------------
if (!$KEEP) { @unlink(__DIR__ . '/mirror.php'); @unlink(__DIR__ . '/mirror_mutant.php'); }
echo "\n" . ($MUTANT ? '[MUTANT] ' : '') . "PASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
