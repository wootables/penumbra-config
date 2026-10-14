<?php
/**
 * test_restore.php - the Version History restore path.
 *
 * WHY THIS SUITE EXISTS. An audit on 2026-09-01 found that
 * restore_server_report.php dispatched on four possible action names and handled
 * two of them. The audit ACTION rides through get_audit_data.php verbatim, so
 * ROLLBACK and CREATE arrived and matched NEITHER branch: the endpoint wrote
 * nothing, logged nothing, and still answered {"status":"success"}. The client
 * only checks status, so it printed "Restored - reloading..." and reloaded onto
 * an unchanged report. Because every restore logs its own ROLLBACK row, the one
 * path the confirm dialog promises - "you can always restore BACK from the
 * Changes view" - was the one guaranteed to do nothing.
 *
 * Two more of the same shape: a restore of a version saved before a RENAME
 * resolved its target by the short id FROZEN in the snapshot, missed, fell
 * through to the re-insert path, and moved the LIVE report's journal notes and
 * snapshots onto the duplicate it had just created. And SHORT_ID is CHAR, so the
 * padded value delete_server_report.php handed back matched no TRIM(SHORT_ID)
 * lookup - the id-conflict check and the post-insert id lookup both missed, which
 * cost every undelete its audit row and its re-link, silently.
 *
 * WHAT IS UNDER TEST. The SHIPPED restore_server_report.php, not a copy. The file
 * is read and exactly four things are rewritten - the require, the CSRF guard,
 * the Content-Type header and the php://input read - plus `exit;` -> a throw and
 * http_response_code() -> a recorder, so the response is observable from CLI.
 * Every one of those rewrites is COUNTED and asserted; a source edit that moves
 * them turns into a harness failure instead of a silently hollow pass.
 *
 * penumbraIsReportOwner, penumbraReportGrantMatches, penumbraWildcardMatch and
 * penumbraAuditChangeSummary are LIFTED from db_connection.php by the tokenizer,
 * so the permission rule and the change summary under test are the real ones.
 *
 * The database is a fake, and two details make it faithful:
 *   - Oracle's TRIM(SHORT_ID) = :bind trims the COLUMN, never the bind. Fixture
 *     rows therefore store PADDED short ids, exactly like the CHAR column does.
 *     Get this backwards and the padding bug becomes untestable.
 *   - A SELECT whose projection says TRIM(SHORT_ID) AS SHORT_ID hands back a
 *     trimmed value; every other read gives the padded one.
 * Writes are recorded, then applied to the row model, so a later read in the same
 * request sees what the write did.
 *
 *   php.exe -n test_restore.php --app=<webroot> [--control]
 *
 * --control runs one deliberately false assertion, which MUST report FAIL. A
 * harness that has never been seen to fail has not been seen to work.
 *
 * SEC (2026-09-04): nine more scenarios cover the security sweep's two restore
 * holes - the tautological owner test on re-insert and the missing save-time
 * scope rule on both branches. Six more helpers are lifted for them.
 *
 * RE-BASELINE (2026-09-16). The suite had drifted to PASS 128 FAIL 7 with NO
 * endpoint regression behind it. Bisected over the dated restore_server_report.php
 * backups (the 09-04 endpoint still scores 135/0 under the old suite), every
 * failure traces to a deliberate endpoint change made after this file's 09-04 edit:
 *   09-06 ACTION <> 'OPEN' on the 4b re-point: broke nothing, now pinned.
 *   09-06 PENUMBRA_AUDIT joined $relinkTables -> FAIL 5. The fake filed ANY
 *         "UPDATE PENUMBRA_AUDIT" as a re-point, so the numeric re-link (which runs
 *         first) became fx_first('REPOINT') and all five repoint asserts read the
 *         wrong statement. 4b itself was correct. Fixed in FakeStmt::kind().
 *   09-09 PENUMBRA_PRESETS joined $relinkTables -> FAIL 7. The two "four tables"
 *         counts are now the exact set, pnb_expected_relink_tables().
 * Three asserts were added. The rollback scenario also requires RELINK == 0: its
 * REPOINT == 0 used to reject every audit UPDATE, so without it the reclassification
 * would have weakened that scenario. The OPEN exclusion. And the re-point SQL really
 * comparing BEFORE and AFTER $.short_id: "matched on the report short id" only ever
 * checked the BIND, and a mutant that cut the comparison out but kept bindValue()
 * passed. Mutant-checked: removing either new table, the IS NULL / ID <= :srcid /
 * OPEN guards, the original-sid match, the live-prior guard, or either JSON_VALUE
 * half each fails exactly its named assert; listing PENUMBRA_AUDIT first or wrapping
 * the JSON_VALUEs in TRIM() stays green.
 *
 * EXPECTED TAIL: "PASS 138   FAIL 0" over 36 scenarios (--control: FAIL 1). Any
 * other tail is a failure - including a SMALLER pass count, which is what a broken
 * lift or a missed patch looks like (a harness error scores zero, it does not
 * report FAIL).
 */

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
$APP = null; $CONTROL = false;
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0) { $APP = rtrim(substr($a, 6), "\\/"); }
    if ($a === '--control') { $CONTROL = true; }
}
if ($APP === null) {
    fwrite(STDERR, "test_restore.php: --app=<webroot path> is required\n");
    exit(2);
}
$SRC_RESTORE = $APP . '/restore_server_report.php';
$SRC_DB      = $APP . '/db_connection.php';
foreach (array($SRC_RESTORE, $SRC_DB) as $f) {
    if (!is_file($f)) { fwrite(STDERR, "test_restore.php: cannot read $f\n"); exit(2); }
}

$PASS = 0; $FAIL = 0;

function ok($cond, $label) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; }
    else { $FAIL++; echo "    FAIL  $label\n"; }
}
function eq($actual, $expected, $label) {
    global $PASS, $FAIL;
    if ($actual === $expected) { $PASS++; return; }
    $FAIL++;
    echo "    FAIL  $label\n";
    echo "            expected: " . var_export($expected, true) . "\n";
    echo "            actual  : " . var_export($actual, true) . "\n";
}

// ---------------------------------------------------------------------------
// Lift the real functions out of db_connection.php with the tokenizer.
// A test of a pasted copy proves nothing about the code that runs.
// ---------------------------------------------------------------------------
function pnb_lift($file, array $names) {
    $src  = file_get_contents($file);
    $toks = token_get_all($src);
    $n    = count($toks);
    $code = ''; $found = array();
    $off  = 0;
    for ($i = 0; $i < $n; $i++) {
        $t   = $toks[$i];
        $txt = is_array($t) ? $t[1] : $t;
        if (is_array($t) && $t[0] === T_FUNCTION) {
            $j = $i + 1;
            while ($j < $n && is_array($toks[$j]) &&
                   in_array($toks[$j][0], array(T_WHITESPACE, T_COMMENT, T_DOC_COMMENT), true)) { $j++; }
            if ($j < $n && is_array($toks[$j]) && $toks[$j][0] === T_STRING &&
                in_array($toks[$j][1], $names, true) && !isset($found[$toks[$j][1]])) {
                $depth = 0; $started = false; $scan = $off; $end = null;
                for ($k = $i; $k < $n; $k++) {
                    $ktxt = is_array($toks[$k]) ? $toks[$k][1] : $toks[$k];
                    if ($ktxt === '{') { $depth++; $started = true; }
                    elseif ($ktxt === '}') {
                        $depth--;
                        if ($started && $depth === 0) { $end = $scan + strlen($ktxt); break; }
                    }
                    $scan += strlen($ktxt);
                }
                if ($end !== null) {
                    $code .= substr($src, $off, $end - $off) . "\n\n";
                    $found[$toks[$j][1]] = true;
                }
            }
        }
        $off += strlen($txt);
    }
    return array('code' => $code, 'found' => array_keys($found));
}

$WANT = array('penumbraWildcardMatch', 'penumbraReportGrantMatches',
              'penumbraIsReportOwner', 'penumbraAuditChangeSummary',
              // SEC 2026-09-04: the save-time scope rule now runs on restore too,
              // so the extractor chain and the scope helpers are lifted as well.
              'penumbraExtractReportTables', 'penumbraExtractSqlTables',
              'penumbraExtractSqlTablesUncached', 'penumbraTablesOutOfScope',
              'penumbraScopeTableSet', 'penumbraHiddenAllowList');
$lift = pnb_lift($SRC_DB, $WANT);

echo "Lifted from db_connection.php\n";
sort($WANT);
$gotNames = $lift['found']; sort($gotNames);
eq($gotNames, $WANT, 'all ten helper functions lifted by the tokenizer');
if ($gotNames !== $WANT) {
    fwrite(STDERR, "test_restore.php: lift failed, cannot continue\n");
    exit(2);
}
$liftFile = sys_get_temp_dir() . '/pnb_restore_lift_' . getmypid() . '.php';
file_put_contents($liftFile, "<?php\n" . $lift['code']);
require $liftFile;

// Global allow-lists the lifted scope helpers read (SEC 2026-09-04). Small and
// explicit: AWARD is the table the fixture reports use; PS_PERSONAL_DATA stands
// in for HR data nobody in these scenarios holds a grant for.
$oracleTableNames = array('AWARD', 'DUAL');
$hrTableNames     = array('PS_PERSONAL_DATA');
$pinsTableNames   = array(); $infoEdTableNames = array(); $finTableNames = array();

// ---------------------------------------------------------------------------
// Build the patched core from the SHIPPED endpoint.
// ---------------------------------------------------------------------------
class PnbHarnessExit extends Error {}

function pnb_build_core($srcFile, $destFile) {
    $lines = file($srcFile);
    $out = array();
    $hit = array('require' => 0, 'csrf' => 0, 'header' => 0, 'input' => 0, 'exit' => 0, 'httpcode' => 0);
    foreach ($lines as $ln) {
        $t = trim($ln);
        if (strpos($t, "require_once 'db_connection.php';") === 0) {
            $hit['require']++; $out[] = "// [harness] require stripped\n"; continue;
        }
        if (strpos($t, 'penumbraCsrfGuard();') === 0) {
            $hit['csrf']++; $out[] = "// [harness] csrf guard stripped\n"; continue;
        }
        if (strpos($t, "header('Content-Type: application/json');") === 0) {
            $hit['header']++; $out[] = "// [harness] header stripped\n"; continue;
        }
        if (strpos($t, '$input = json_decode(file_get_contents') === 0) {
            $hit['input']++; $out[] = "\$input = \$GLOBALS['TEST_INPUT'];\n"; continue;
        }
        if ($t === 'exit;') {
            $hit['exit']++;
            $indent = substr($ln, 0, strlen($ln) - strlen(ltrim($ln)));
            $out[] = $indent . "throw new PnbHarnessExit();\n"; continue;
        }
        if (strpos($ln, 'http_response_code(') !== false) {
            $hit['httpcode'] += substr_count($ln, 'http_response_code(');
            $ln = str_replace('http_response_code(', 'pnb_http_code(', $ln);
        }
        $out[] = $ln;
    }
    file_put_contents($destFile, implode('', $out));
    return $hit;
}

$CORE = sys_get_temp_dir() . '/pnb_restore_core_' . getmypid() . '.php';
$hit  = pnb_build_core($SRC_RESTORE, $CORE);

echo "Patched restore_server_report.php\n";
// A harness error scores ZERO, not FAIL - the suite would simply get smaller and
// nobody would notice. Assert the shape of what was rewritten.
eq($hit['require'],  1, 'harness: db_connection require stripped exactly once');
eq($hit['csrf'],     1, 'harness: penumbraCsrfGuard() stripped exactly once');
eq($hit['header'],   1, 'harness: Content-Type header stripped exactly once');
eq($hit['input'],    1, 'harness: php://input read redirected exactly once');
ok($hit['exit']    >= 4, 'harness: every bare exit; became a throw (>= 4)');
ok($hit['httpcode'] >= 5, 'harness: every http_response_code() call recorded (>= 5)');
// Lint from a LOCAL cwd: cmd.exe refuses a UNC working directory and prints a
// "UNC paths are not supported" banner into the middle of the run otherwise.
$lintOut = array(); $lintRc = 0;
$cwdWas = getcwd();
@chdir(sys_get_temp_dir());
exec('"' . PHP_BINARY . '" -n -l ' . escapeshellarg($CORE) . ' 2>&1', $lintOut, $lintRc);
@chdir($cwdWas);
eq($lintRc, 0, 'harness: patched core parses (' . trim(implode(' ', $lintOut)) . ')');

// ---------------------------------------------------------------------------
// The fake database
// ---------------------------------------------------------------------------
class FakeDb {
    public static $rows = array();
    public static $effects = array();
    public static $nextId = 9001;
    public static $httpCode = 200;
    public static $logged = array();
    // The deleted report's DELETE audit row, as the restore's ownership proof
    // reads it (SEC 2026-09-04): sid -> matched by TRIM(JSON_VALUE(BEFORE,
    // '$.short_id')), id -> the row id, before -> the BEFORE snapshot that
    // readClobViaOci8() hands back. Default: the fixture owner deleted
    // 'grantprofiles' - every pre-existing undelete scenario runs as that owner.
    // A scenario overrides with a 'lineage' key (null = no delete history at all).
    public static $lineage = null;
    public static function defaultLineage() {
        return array('sid' => 'grantprofiles     ', 'id' => 5150, 'before' => json_encode(array(
            'report' => array('query' => 'SELECT 1', 'theme' => 'light'), 'report_id' => 4242,
            'short_id' => 'grantprofiles     ', 'title' => 'Grant Profiles',
            'authorized' => 'dept-a', 'owner_id' => 'owner@ncsu.edu'
        )));
    }

    public static function reset($rows) {
        self::$rows = $rows; self::$effects = array();
        self::$nextId = 9001; self::$httpCode = 200; self::$logged = array();
        self::$lineage = self::defaultLineage();
    }
    public static function fx($op, $data) { self::$effects[] = array('op' => $op, 'data' => $data); }
    /**
     * Oracle semantics: TRIM(SHORT_ID) = :bind trims the COLUMN, not the bind.
     * Fixture rows carry padded short ids because the CHAR column does.
     */
    public static function findBy($col, $val) {
        foreach (self::$rows as $r) {
            if ($col === 'ID' && (int)$r['ID'] === (int)$val) { return $r; }
            if ($col === 'SHORT_ID' && trim($r['SHORT_ID']) === $val) { return $r; }
        }
        return null;
    }
}
function pnb_http_code($c) { FakeDb::$httpCode = $c; return true; }
// Does the (whitespace-collapsed) SQL really compare JSON_VALUE("<col>", '$.short_id')
// to :sid? A TRIM() around the JSON_VALUE is allowed.
function pnb_sql_compares_sid($sql, $col) {
    return (bool)preg_match('/JSON_VALUE\(\s*"?' . $col . '"?\s*,\s*\'\$\.short_id\'\s*\)\s*\)?\s*=\s*:sid(?![A-Za-z0-9_])/i', $sql);
}

class FakeStmt {
    private $sql; private $binds = array();
    public function __construct($sql) { $this->sql = preg_replace('/\s+/', ' ', trim($sql)); }
    public function bindValue($n, $v, $t = null) { $this->binds[$n] = $v; return true; }
    /**
     * Which REPORT_ID write is this - 'REPOINT', 'RELINK' or null? ONE classifier,
     * shared by execute() AND rowCount(), so the two can never file the same
     * statement differently (they used to repeat the ordering by hand).
     *
     * Order matters: the audit re-point (4b) is ALSO an "UPDATE ... SET REPORT_ID",
     * so it is claimed BEFORE the generic re-link branch. But since 2026-09-06 two
     * different statements begin "UPDATE PENUMBRA_AUDIT SET REPORT_ID = :new":
     *   - 4b, the orphan re-point:  WHERE REPORT_ID IS NULL ... JSON_VALUE(...) = :sid
     *   - the numeric re-link, once PENUMBRA_AUDIT joined $relinkTables:
     *                               WHERE REPORT_ID = :old  (what every table gets)
     * Keyed on the table name alone, the re-point branch swallowed the numeric
     * re-link, which runs FIRST - fx_first('REPOINT') became the wrong statement and
     * five repoint asserts went red while 4b itself was correct. The re-link is told
     * apart by its OWN key, `REPORT_ID = :old`. Deliberately NOT by IS NULL,
     * JSON_VALUE or :srcid: those are what the repoint asserts check, and keying on
     * one would let a mutant that drops it slip out of REPOINT instead of failing
     * the assert that names it.
     */
    private function kind() {
        $isAudit = (strpos($this->sql, 'UPDATE PENUMBRA_AUDIT') !== false);
        $byOldId = (strpos($this->sql, 'REPORT_ID = :old') !== false);
        if ($isAudit && !$byOldId)                         { return 'REPOINT'; }
        if (strpos($this->sql, 'SET REPORT_ID') !== false) { return 'RELINK'; }
        return null;
    }
    public function execute() {
        $kind = $this->kind();
        if ($kind === 'RELINK') {
            preg_match('/UPDATE (\S+) SET/', $this->sql, $m);
            FakeDb::fx('RELINK', array('table' => isset($m[1]) ? $m[1] : '?',
                                       'new' => isset($this->binds[':new']) ? $this->binds[':new'] : null,
                                       'old' => isset($this->binds[':old']) ? $this->binds[':old'] : null));
        }
        if (strpos($this->sql, 'SET CREATED_AT') !== false) {
            FakeDb::fx('CREATED_AT', array('value' => $this->binds[':ca'], 'id' => $this->binds[':id']));
        }
        if ($kind === 'REPOINT') {
            FakeDb::fx('REPOINT', array(
                'new'   => isset($this->binds[':new']) ? $this->binds[':new'] : null,
                'sid'   => isset($this->binds[':sid']) ? $this->binds[':sid'] : null,
                'srcid' => isset($this->binds[':srcid']) ? $this->binds[':srcid'] : null,
                'onlyOrphans' => (strpos($this->sql, 'REPORT_ID IS NULL') !== false),
                'bounded'     => (strpos($this->sql, 'ID <= :srcid') !== false),
                // 2026-09-06: OPEN rows never carry a top-level short_id, so skipping
                // them changes no result - it spares Oracle a LOB read per orphaned
                // OPEN row. An EXCLUSION on purpose: an allow-list of actions that
                // forgets one silently strands that report's rows.
                'skipsOpen'   => (strpos($this->sql, "ACTION <> 'OPEN'") !== false),
                // 2026-09-16: 'sid' above is only the BIND. A mutant that cut the
                // short-id comparison out of the SQL - or just its BEFORE half - but
                // kept bindValue(':sid') passed on it. BEFORE is where a DELETE row
                // carries the id, AFTER is where a CREATE row does: lose either half
                // and those rows silently never come home.
                'sidBothHalves' => pnb_sql_compares_sid($this->sql, 'BEFORE')
                                && pnb_sql_compares_sid($this->sql, 'AFTER')
            ));
        }
        return true;
    }
    private function target() {
        if (array_key_exists(':id', $this->binds))       { return FakeDb::findBy('ID', $this->binds[':id']); }
        if (array_key_exists(':short_id', $this->binds)) { return FakeDb::findBy('SHORT_ID', $this->binds[':short_id']); }
        return null;
    }
    public function fetch($m = null) {
        $r = $this->target();
        if (!$r) { return false; }
        // Emulate the projection: only a SELECT that asks for TRIM gets it trimmed.
        if (strpos($this->sql, 'TRIM(SHORT_ID) AS SHORT_ID') !== false) { $r['SHORT_ID'] = trim($r['SHORT_ID']); }
        return $r;
    }
    public function fetchColumn() {
        // SEC 2026-09-04: the restore's ownership proof - the newest DELETE audit
        // row for this short id, matched TRIMMED because the CHAR column pads it.
        if (strpos($this->sql, 'FROM PENUMBRA_AUDIT') !== false && strpos($this->sql, "ACTION = 'DELETE'") !== false) {
            $sid = isset($this->binds[':sid']) ? trim((string)$this->binds[':sid']) : '';
            $ln = FakeDb::$lineage;
            return ($ln && trim((string)$ln['sid']) === $sid) ? $ln['id'] : false;
        }
        if (strpos($this->sql, 'COUNT(*)') !== false) { return $this->target() ? 1 : 0; }
        $r = $this->target();
        return $r ? $r['ID'] : false;
    }
    public function rowCount() {
        $kind = $this->kind();
        if ($kind === 'REPOINT') { return 4; }
        if ($kind === 'RELINK') {
            // The numeric AUDIT re-link matches nothing under today's schema:
            // FK_AUDIT_REPORT (ON DELETE SET NULL) blanked REPORT_ID on every audit
            // row of the deleted report, which is why 4b exists at all. Model that
            // rather than invent rows (it used to get the re-point's 4 by accident).
            // If the FK is ever dropped this becomes 3 like the others - and restore's
            // "(journal notes, toggles, snapshots, shared presets) re-linked" message
            // would then count audit rows it does not name.
            return (strpos($this->sql, 'UPDATE PENUMBRA_AUDIT') !== false) ? 0 : 3;
        }
        return 0;
    }
}
class FakeConn { public function prepare($sql) { return new FakeStmt($sql); } }

function getConnectionForTable($t) { return new FakeConn(); }
function readClobViaOci8($tbl, $col, $whereCol, $whereVal) {
    if ($tbl === 'PENUMBRA_AUDIT') {
        // SEC 2026-09-04: the DELETE row's BEFORE snapshot (see FakeDb::$lineage).
        $ln = FakeDb::$lineage;
        return ($ln && (int)$ln['id'] === (int)$whereVal) ? $ln['before'] : null;
    }
    $r = FakeDb::findBy('ID', $whereVal);
    return $r ? $r['STATE_DATA'] : null;
}
function execClobUpdate($c, $tbl, $setCols, $clobCols, $where, $whereBinds, $extraSet = array()) {
    FakeDb::fx('UPDATE', array('table' => $tbl, 'set' => $setCols, 'where' => $where, 'binds' => $whereBinds));
    $id = isset($whereBinds[':w_id']) ? (int)$whereBinds[':w_id'] : null;
    if ($id !== null) {
        foreach (FakeDb::$rows as $i => $r) {
            if ((int)$r['ID'] === $id) { foreach ($setCols as $k => $v) { FakeDb::$rows[$i][$k] = $v; } }
        }
    }
}
function execClobInsert($c, $tbl, $cols, $clobCols, $rawCols = array(), $returnIdCol = null) {
    FakeDb::fx('INSERT', array('table' => $tbl, 'cols' => $cols, 'raw' => $rawCols));
    $row = $cols;
    $row['ID'] = FakeDb::$nextId++;
    $row['CREATED_AT'] = 'RESTORE-TIME';
    FakeDb::$rows[] = $row;
}
function logPenumbraAudit($rid, $action, $before, $after, $message = null, $extra = null) {
    FakeDb::fx('AUDIT', array(
        'report_id' => $rid,
        'action'    => $action,
        'before'    => ($before === null ? null : json_decode($before, true)),
        'after'     => ($after  === null ? null : json_decode($after,  true)),
        'message'   => $message,
        'extra'     => $extra
    ));
}

// ---------------------------------------------------------------------------
// Effect helpers
// ---------------------------------------------------------------------------
function fx_count($op) { $n = 0; foreach (FakeDb::$effects as $e) { if ($e['op'] === $op) { $n++; } } return $n; }
function fx_first($op) { foreach (FakeDb::$effects as $e) { if ($e['op'] === $op) { return $e['data']; } } return null; }
function fx_writes() { $n = 0; foreach (FakeDb::$effects as $e) { if ($e['op'] === 'UPDATE' || $e['op'] === 'INSERT') { $n++; } } return $n; }
function state_of($json) { $d = json_decode($json, true); return is_array($d) ? $d : array(); }
// Every table a re-link UPDATE was issued against, sorted, duplicates KEPT - so a
// table re-linked twice shows up instead of hiding inside a count.
function fx_relink_tables() {
    $t = array();
    foreach (FakeDb::$effects as $e) { if ($e['op'] === 'RELINK') { $t[] = $e['data']['table']; } }
    sort($t);
    return $t;
}
// restore_server_report.php's $relinkTables: every table keyed on the NUMERIC report
// id, moved from the dead id to the one the re-insert mints. It was FOUR when this
// suite was written on 2026-09-04 (the three journal tables + PENUMBRA_SNAPS); two
// joined ON PURPOSE since, so the expectation follows them instead of the old count:
//   PENUMBRA_AUDIT   2026-09-06  the report's own audit rows, by the old number, so
//                    EVERY row can come home (OPEN / EXPORT / DENIED too, which the 4b
//                    snapshot re-point can never find). Matches nothing while the
//                    FK_AUDIT_REPORT SET NULL constraint exists; it is what keeps
//                    Version History alive once that FK is dropped (README section 6).
//   PENUMBRA_PRESETS 2026-09-09  shared presets key on the numeric id like snapshots;
//                    without it a restored report's presets all turn invisible.
// The exact SET, not a count: a count cannot tell a new table from a swapped one.
function pnb_expected_relink_tables() {
    $t = array('PENUMBRA_JOURNAL', 'PENUMBRA_JOURNAL_SEEN', 'PENUMBRA_JOURNAL_TOGGLE',
               'PENUMBRA_SNAPS', 'PENUMBRA_PRESETS', 'PENUMBRA_AUDIT');
    sort($t);
    return $t;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// SHORT_ID values are stored PADDED on purpose - the column is CHAR.
function live_report($over = array()) {
    return array_merge(array(
        'ID'         => 4242,
        'SHORT_ID'   => 'grantprofiles     ',
        'TITLE'      => 'Grant Profiles (today)',
        'AUTHORIZED' => 'dept-a,dept-b',
        'OWNER_ID'   => 'owner@ncsu.edu',
        'CREATED_AT' => '01-JAN-2026',
        'STATE_DATA' => '{"query":"SELECT 2","theme":"dark"}'
    ), $over);
}
function payload($action, $over = array()) {
    $p = array_merge(array(
        'restore_action'  => $action,
        'short_id'        => 'grantprofiles',
        'title'           => 'Grant Profiles (old)',
        'authorized'      => 'dept-a',
        'owner_id'        => 'owner@ncsu.edu',
        'state_data'      => array('query' => 'SELECT 1', 'theme' => 'light'),
        'prior_report_id' => 4242
    ), $over);
    foreach ($over as $k => $v) { if ($v === '__UNSET__') { unset($p[$k]); } }
    return $p;
}

// ---------------------------------------------------------------------------
// Scenarios. Each is [label, rows, input, globals, assertions-closure].
// ---------------------------------------------------------------------------
$OWNER  = 'owner@ncsu.edu';
$GRANTEE = 'granted@ncsu.edu';
$NOGRANTS = array('reports' => array());
$GPGRANT  = array('reports' => array(array('pattern' => 'grantprofiles')));

$SCENARIOS = array();

$SCENARIOS['F1 UPDATE row restores'] = array(
    'rows' => array(live_report()), 'in' => payload('UPDATE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'UPDATE: success');
        eq(fx_count('UPDATE'), 1, 'UPDATE: one UPDATE issued');
        eq(fx_count('INSERT'), 0, 'UPDATE: nothing inserted');
        $u = fx_first('UPDATE');
        eq($u['set']['TITLE'], 'Grant Profiles (old)', 'UPDATE: snapshot title written');
        eq($u['set']['AUTHORIZED'], 'dept-a', 'UPDATE: snapshot access list written');
        eq(state_of($u['set']['STATE_DATA']), array('query' => 'SELECT 1', 'theme' => 'light'),
           'UPDATE: snapshot state written wholesale');
        eq(fx_first('AUDIT')['action'], 'ROLLBACK', 'UPDATE: logged as ROLLBACK');
        eq(fx_first('AUDIT')['report_id'], 4242, 'UPDATE: logged against the live id');
    }
);

$SCENARIOS['F1 ROLLBACK row restores (was a silent no-op)'] = array(
    'rows' => array(live_report()), 'in' => payload('ROLLBACK'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'ROLLBACK: success');
        eq(fx_count('UPDATE'), 1, 'ROLLBACK: the write actually happened');
        ok($resp['message'] !== '', 'ROLLBACK: a real message, not the empty no-op one');
        eq(state_of(fx_first('UPDATE')['set']['STATE_DATA'])['query'], 'SELECT 1',
           'ROLLBACK: the snapshot state reached the report');
        eq(fx_count('AUDIT'), 1, 'ROLLBACK: an audit row was written, so it is reversible');
    }
);

$SCENARIOS['F1 CREATE row restores (was a silent no-op)'] = array(
    'rows' => array(live_report()), 'in' => payload('CREATE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'CREATE: success');
        eq(fx_count('UPDATE'), 1, 'CREATE: the write actually happened');
        eq(fx_count('AUDIT'), 1, 'CREATE: audited');
    }
);

$SCENARIOS['F1 action is normalized for case and padding'] = array(
    'rows' => array(live_report()), 'in' => payload('  rollback  '),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'normalize: success');
        eq(fx_count('UPDATE'), 1, 'normalize: the write happened');
    }
);

$SCENARIOS['F1 unknown action is refused, never silently succeeds'] = array(
    'rows' => array(live_report()), 'in' => payload('SCHEDULE_UPDATE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'unknown action: refused');
        eq(FakeDb::$httpCode, 400, 'unknown action: 400, not 200');
        eq(fx_writes(), 0, 'unknown action: nothing written');
        eq(fx_count('AUDIT'), 0, 'unknown action: nothing logged');
    }
);

$SCENARIOS['F2 restore after a rename updates the LIVE report'] = array(
    'rows' => array(live_report(array('SHORT_ID' => 'grant_profiles_v2  '))),
    'in' => payload('UPDATE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'rename: success');
        eq(fx_count('UPDATE'), 1, 'rename: the live report was updated');
        eq(fx_count('INSERT'), 0, 'rename: NO duplicate report was created');
        eq(fx_count('RELINK'), 0, 'rename: the live report kept its journal notes and snapshots');
        eq(fx_first('UPDATE')['binds'][':w_id'], 4242, 'rename: resolved by numeric id');
        eq(fx_first('AUDIT')['after']['short_id'], 'grant_profiles_v2',
           'rename: the audit records the CURRENT short id, not the stale one');
        eq(fx_first('AUDIT')['action'], 'ROLLBACK', 'rename: logged as a rollback, not a restore');
    }
);

$SCENARIOS['F2 a genuinely deleted report is re-inserted and re-linked'] = array(
    'rows' => array(), 'in' => payload('UPDATE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'deleted: success');
        eq(fx_count('INSERT'), 1, 'deleted: re-inserted');
        eq(fx_relink_tables(), pnb_expected_relink_tables(),
           'deleted: every numeric-keyed table re-linked (journal x3, snapshots, presets, audit)');
        eq(fx_first('RELINK')['old'], 4242, 'deleted: re-linked FROM the dead id');
        eq(fx_first('AUDIT')['action'], 'RESTORE', 'deleted: logged as RESTORE');
    }
);

$SCENARIOS['F2 a reused short id is not overwritten'] = array(
    // The report the entry belongs to (4242) is gone; a DIFFERENT report has
    // since taken its short id. Overwriting that one would be a restore onto
    // the wrong report.
    'rows' => array(live_report(array('ID' => 7777, 'TITLE' => 'Someone else\'s report'))),
    'in' => payload('UPDATE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq(fx_count('UPDATE'), 0, 'reused id: the unrelated report was NOT overwritten');
        eq(fx_count('INSERT'), 1, 're-used id: re-inserted instead');
        $ins = fx_first('INSERT');
        ok(strpos($ins['cols']['SHORT_ID'], 'grantprofiles_restored_') === 0,
           'reused id: the conflict was detected and the id suffixed');
        ok(strpos($ins['cols']['TITLE'], '(Restored from grantprofiles)') !== false,
           'reused id: the title says where it came from');
    }
);

$SCENARIOS['F3 undelete with a padded short id inserts a clean one'] = array(
    'rows' => array(), 'in' => payload('DELETE', array('short_id' => 'grantprofiles     ')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'padded undelete: success');
        eq(fx_first('INSERT')['cols']['SHORT_ID'], 'grantprofiles', 'padded undelete: short id trimmed');
        eq(fx_count('AUDIT'), 1, 'padded undelete: the RESTORE was audited (id lookup found the row)');
        eq(fx_relink_tables(), pnb_expected_relink_tables(),
           'padded undelete: journal notes, snapshots, presets and audit rows re-linked');
        ok(strpos($resp['message'], 're-linked') !== false, 'padded undelete: the message reports the re-link');
    }
);

$SCENARIOS['F3 undelete with a padded short id still detects a conflict'] = array(
    'rows' => array(live_report()), 'in' => payload('DELETE', array('short_id' => 'grantprofiles     ')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        $ins = fx_first('INSERT');
        ok(strpos($ins['cols']['SHORT_ID'], 'grantprofiles_restored_') === 0,
           'padded conflict: detected and suffixed, no duplicate id');
        eq(fx_count('AUDIT'), 1, 'padded conflict: audited');
    }
);

$SCENARIOS['F2 no re-link while the prior id is still live'] = array(
    // Defence in depth: re-linking here would strip a live report of its notes.
    'rows' => array(live_report(array('SHORT_ID' => 'other_report  '))),
    'in' => payload('DELETE'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq(fx_count('INSERT'), 1, 'live prior: inserted');
        eq(fx_count('RELINK'), 0, 'live prior: NOTHING re-linked off the live report');
    }
);

$SCENARIOS['F4 a grant holder rollback records the real owner'] = array(
    'rows' => array(live_report()), 'in' => payload('ROLLBACK'),
    'user' => $GRANTEE, 'admin' => false, 'grants' => $GPGRANT,
    'check' => function ($resp) use ($OWNER) {
        eq($resp['status'], 'success', 'grant rollback: allowed');
        $u = fx_first('UPDATE');
        ok(!array_key_exists('OWNER_ID', $u['set']), 'grant rollback: OWNER_ID is never written');
        $a = fx_first('AUDIT');
        eq($a['after']['owner_id'], $OWNER, 'grant rollback: the audit AFTER names the REAL owner');
        eq($a['before']['owner_id'], $OWNER, 'grant rollback: the audit BEFORE names the real owner');
        $sum = penumbraAuditChangeSummary($a['before'], $a['after']);
        ok(!in_array('owner_id', $sum['changed']['keys'], true),
           'grant rollback: no phantom ownership change in the version-list summary');
    }
);

$SCENARIOS['F9 a missing short id is refused'] = array(
    'rows' => array(live_report()), 'in' => payload('UPDATE', array('short_id' => '__UNSET__')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'missing short id: refused');
        eq(FakeDb::$httpCode, 400, 'missing short id: 400');
        eq(fx_writes(), 0, 'missing short id: no NULL-id row inserted');
    }
);

$SCENARIOS['F9 a blank short id is refused'] = array(
    'rows' => array(live_report()), 'in' => payload('UPDATE', array('short_id' => '   ')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'blank short id: refused');
        eq(fx_writes(), 0, 'blank short id: nothing written');
    }
);

$SCENARIOS['F9 an omitted title does not blank the live one'] = array(
    'rows' => array(live_report()), 'in' => payload('UPDATE', array('title' => '__UNSET__')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'no title: success');
        eq(fx_first('UPDATE')['set']['TITLE'], 'Grant Profiles (today)',
           'no title: the live title survived');
    }
);

$SCENARIOS['field restore works from a ROLLBACK row'] = array(
    'rows' => array(live_report()),
    'in' => payload('ROLLBACK', array('restore_fields' => array('query'))),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'field restore: success');
        eq(fx_count('UPDATE'), 1, 'field restore: written');
        $st = state_of(fx_first('UPDATE')['set']['STATE_DATA']);
        eq($st['query'], 'SELECT 1', 'field restore: the named field came from the version');
        eq($st['theme'], 'dark', 'field restore: every other setting kept its current value');
        eq(fx_first('UPDATE')['set']['TITLE'], 'Grant Profiles (today)', 'field restore: title untouched');
        eq(fx_first('UPDATE')['set']['AUTHORIZED'], 'dept-a,dept-b', 'field restore: access list untouched');
        ok(strpos($resp['message'], 'query') !== false, 'field restore: the message names the field');
    }
);

$SCENARIOS['field restore into a deleted report is refused'] = array(
    'rows' => array(), 'in' => payload('UPDATE', array('restore_fields' => array('query'))),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'field restore, gone: refused');
        eq(fx_writes(), 0, 'field restore, gone: nothing written');
    }
);

$SCENARIOS['a malformed restore_fields is refused, not widened'] = array(
    'rows' => array(live_report()), 'in' => payload('UPDATE', array('restore_fields' => 'query')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'bad restore_fields: refused');
        eq(fx_writes(), 0, 'bad restore_fields: did NOT fall back to a whole-snapshot write');
    }
);

$SCENARIOS['F5 undelete reconnects the pre-delete version history'] = array(
    // Deleting a report NULLs PENUMBRA_AUDIT.REPORT_ID on all of its rows, so the
    // pre-delete history is under NO id and the version list comes back EMPTY.
    // The restore re-points those orphaned rows to the new id.
    'rows' => array(), 'in' => payload('DELETE', array('source_audit_id' => 5150)),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'repoint: success');
        eq(fx_count('REPOINT'), 1, 'repoint: issued once');
        $rp = fx_first('REPOINT');
        eq($rp['sid'], 'grantprofiles', 'repoint: matched on the report short id');
        ok($rp['sidBothHalves'], 'repoint: the SQL really compares BEFORE and AFTER $.short_id to :sid, not just binds it');
        eq($rp['new'], 9001, 'repoint: pointed at the NEW report id');
        eq($rp['srcid'], 5150, 'repoint: bounded by the source audit id');
        ok($rp['onlyOrphans'], 'repoint: only touches rows the delete orphaned (REPORT_ID IS NULL)');
        ok($rp['bounded'], 'repoint: bounded by ID <= the DELETE entry');
        ok($rp['skipsOpen'], "repoint: skips OPEN rows by EXCLUSION (ACTION <> 'OPEN', 2026-09-06), never an action allow-list");
        ok(strpos($resp['message'], 'reconnected') !== false,
           'repoint: the message reports the reconnected versions');
    }
);

$SCENARIOS['F5 a suffixed restore still finds its own history'] = array(
    // An id conflict rewrites $short_id to <id>_restored_<time>, but the orphaned
    // audit rows carry the name the report had when they were written.
    'rows' => array(live_report()), 'in' => payload('DELETE', array('source_audit_id' => 5151)),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        $ins = fx_first('INSERT');
        ok(strpos($ins['cols']['SHORT_ID'], 'grantprofiles_restored_') === 0,
           'suffixed repoint: the report came back renamed');
        eq(fx_first('REPOINT')['sid'], 'grantprofiles',
           'suffixed repoint: matched on the ORIGINAL short id, not the suffixed one');
    }
);

$SCENARIOS['F5 a rollback never re-points anything'] = array(
    // Only a re-insert changes the id. An in-place rollback has nothing to reconnect.
    'rows' => array(live_report()), 'in' => payload('ROLLBACK'),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq(fx_count('REPOINT'), 0, 'rollback: no audit rows touched');
        // Until 2026-09-16 the fake filed EVERY "UPDATE PENUMBRA_AUDIT" as a REPOINT,
        // so the line above rejected both kinds. The numeric audit re-link now files
        // under RELINK; without this line the reclassification would have WEAKENED
        // the scenario. A rollback keeps its id, so nothing may be re-linked either.
        eq(fx_count('RELINK'), 0, 'rollback: no numeric re-link either (PENUMBRA_AUDIT included)');
    }
);

$SCENARIOS['F7 undelete puts the original creation date back'] = array(
    'rows' => array(), 'in' => payload('DELETE', array('created_at' => '2026-01-15 09:30:00')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'created_at: success');
        eq(fx_count('CREATED_AT'), 1, 'created_at: written back');
        eq(fx_first('CREATED_AT')['value'], '2026-01-15 09:30:00',
           'created_at: the snapshot date, not today');
    }
);

$SCENARIOS['F7 an Oracle-default creation date is normalized'] = array(
    // Snapshots written before delete_server_report.php used an explicit mask
    // carry the session's NLS default, dots and all.
    'rows' => array(), 'in' => payload('DELETE', array('created_at' => '15-JAN-26 09.30.00.000000 AM')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'legacy created_at: success');
        eq(fx_count('CREATED_AT'), 1, 'legacy created_at: parsed and written back');
        ok(strpos((string)fx_first('CREATED_AT')['value'], '2026-01-15') === 0,
           'legacy created_at: normalized to the canonical form');
    }
);

$SCENARIOS['F7 an unparseable creation date never costs the restore'] = array(
    'rows' => array(), 'in' => payload('DELETE', array('created_at' => 'not a date at all')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'bad created_at: the report still comes back');
        eq(fx_count('INSERT'), 1, 'bad created_at: inserted');
        eq(fx_count('CREATED_AT'), 0, 'bad created_at: no date write attempted');
    }
);

$SCENARIOS['F8 an unencodable state is refused, never written as blank'] = array(
    // json_encode() returns FALSE on malformed UTF-8. Writing that to the CLOB
    // would blank the report's entire state - the field-level path has always
    // guarded this; the whole-snapshot path did not.
    'rows' => array(live_report()),
    'in' => payload('UPDATE', array('state_data' => array('query' => "SELECT \xB1\x31"))),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'unencodable state: refused');
        eq(fx_writes(), 0, 'unencodable state: the report was NOT blanked');
        ok(strpos($resp['message'], 'nothing was changed') !== false,
           'unencodable state: the message says nothing changed');
    }
);

$SCENARIOS['F8 a raw JSON string state is written through'] = array(
    // The deleted-report handback sends state_data as raw CLOB TEXT, not an
    // object. It must survive the sanitiser untouched and reach the column as-is.
    'rows' => array(),
    'in' => payload('DELETE', array('state_data' => '{"query":"SELECT 1","theme":"light"}')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'string state: success');
        eq(fx_first('INSERT')['cols']['STATE_DATA'], '{"query":"SELECT 1","theme":"light"}',
           'string state: written through byte for byte');
    }
);

$SCENARIOS['a non-owner without a grant is refused'] = array(
    'rows' => array(live_report()), 'in' => payload('UPDATE'),
    'user' => 'stranger@ncsu.edu', 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'stranger: refused');
        eq(fx_writes(), 0, 'stranger: nothing written');
        ok(strpos($resp['message'], 'Permission denied') !== false, 'stranger: says permission denied');
    }
);

// ---------------------------------------------------------------------------
// SEC (2026-09-04): the two restore-path holes from the whole-app security
// sweep. (1) The DELETE branch's owner test was a tautology ($owner_id IS the
// caller for every non-admin), so any signed-in user could re-insert an
// arbitrary state under their own name - with a scope_tables list of their
// choosing, which query.php then honoured. (2) Neither branch applied the
// save-time scope rule, so a rollback or undelete could smuggle tables in.
// Ownership of a deleted report is now proven from its DELETE audit row (the
// server-written BEFORE snapshot), and both branches hold the restored state
// to (sql grants + the report's own tables). Admins stay unrestricted, as on save.
// ---------------------------------------------------------------------------
function lineage_of($owner, $state, $sid = 'grantprofiles     ', $id = 5150) {
    return array('sid' => $sid, 'id' => $id, 'before' => json_encode(array(
        'report' => $state, 'report_id' => 4242, 'short_id' => $sid,
        'title' => 'Grant Profiles', 'authorized' => 'dept-a', 'owner_id' => $owner
    )));
}

$SCENARIOS['SEC a stranger cannot re-insert a report they never owned'] = array(
    'rows' => array(), 'in' => payload('DELETE'),
    'user' => 'stranger@ncsu.edu', 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'sec stranger undelete: refused');
        eq(fx_writes(), 0, 'sec stranger undelete: nothing written');
        ok(strpos($resp['message'], 'Permission denied') !== false, 'sec stranger undelete: says permission denied');
        $a = fx_first('AUDIT');
        eq($a ? $a['action'] : null, 'DENIED_SCOPE', 'sec stranger undelete: refusal audited as DENIED_SCOPE');
        eq($a ? $a['after']['reason'] : null, 'not_prior_owner_no_report_grant', 'sec stranger undelete: audit names the reason');
    }
);

$SCENARIOS['SEC a short id with no delete history is refused to a grant-less user'] = array(
    // The attack shape: "restore" a report that never existed, i.e. create one.
    'rows' => array(), 'in' => payload('DELETE'), 'lineage' => null,
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'sec no-lineage: refused');
        eq(fx_writes(), 0, 'sec no-lineage: nothing written');
    }
);

$SCENARIOS['SEC the prior owner may undelete a report over its own tables'] = array(
    'rows' => array(),
    'in' => payload('DELETE', array('state_data' => array('query' => 'SELECT * FROM AWARD'))),
    'lineage' => lineage_of($OWNER, array('query' => 'SELECT * FROM AWARD')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'sec owner undelete: success');
        eq(fx_count('INSERT'), 1, 'sec owner undelete: inserted');
        ok(strpos(fx_first('INSERT')['cols']['STATE_DATA'], 'AWARD') !== false, 'sec owner undelete: the report keeps its own table');
    }
);

$SCENARIOS['SEC an undelete cannot smuggle a scope_tables list'] = array(
    'rows' => array(),
    'in' => payload('DELETE', array('state_data' => array('query' => 'SELECT 1', 'scope_tables' => array('PS_PERSONAL_DATA')))),
    'lineage' => lineage_of($OWNER, array('query' => 'SELECT * FROM AWARD')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'sec scope_tables undelete: refused');
        eq(fx_writes(), 0, 'sec scope_tables undelete: nothing written');
        ok(strpos($resp['message'], 'PS_PERSONAL_DATA') !== false, 'sec scope_tables undelete: names the blocked table');
        $a = fx_first('AUDIT');
        eq($a ? $a['after']['blocked_tables'] : null, array('PS_PERSONAL_DATA'), 'sec scope_tables undelete: audit lists the blocked table');
    }
);

$SCENARIOS['SEC an undelete cannot add a table the report never used'] = array(
    'rows' => array(),
    'in' => payload('DELETE', array('state_data' => array('query' => 'SELECT * FROM AWARD a, PS_PERSONAL_DATA p'))),
    'lineage' => lineage_of($OWNER, array('query' => 'SELECT * FROM AWARD')),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'sec extra-table undelete: refused');
        eq(fx_writes(), 0, 'sec extra-table undelete: nothing written');
        ok(strpos($resp['message'], 'PS_PERSONAL_DATA') !== false, 'sec extra-table undelete: names the new table');
        ok(strpos($resp['message'], 'AWARD') === false, 'sec extra-table undelete: the report\'s own table is not blocked');
    }
);

$SCENARIOS['SEC a report grant may re-insert without delete history, within its scope'] = array(
    'rows' => array(), 'in' => payload('DELETE'), 'lineage' => null,
    'user' => $GRANTEE, 'admin' => false, 'grants' => $GPGRANT,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'sec grantee create: success');
        eq(fx_count('INSERT'), 1, 'sec grantee create: inserted');
    }
);

$SCENARIOS['SEC a rollback cannot smuggle scope_tables into a live report'] = array(
    'rows' => array(live_report()),
    'in' => payload('UPDATE', array('state_data' => array('query' => 'SELECT 2', 'scope_tables' => array('PS_PERSONAL_DATA')))),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'error', 'sec scope_tables rollback: refused');
        eq(fx_writes(), 0, 'sec scope_tables rollback: nothing written');
        ok(strpos($resp['message'], 'PS_PERSONAL_DATA') !== false, 'sec scope_tables rollback: names the blocked table');
        $a = fx_first('AUDIT');
        eq($a ? $a['action'] : null, 'DENIED_SCOPE', 'sec scope_tables rollback: audited as DENIED_SCOPE');
        eq($a ? $a['report_id'] : null, 4242, 'sec scope_tables rollback: audited against the live id');
    }
);

$SCENARIOS['SEC a rollback within the live report\'s own tables succeeds'] = array(
    'rows' => array(live_report(array('STATE_DATA' => '{"query":"SELECT * FROM AWARD","theme":"dark"}'))),
    'in' => payload('UPDATE', array('state_data' => array('query' => 'SELECT * FROM AWARD WHERE 1=1'))),
    'user' => $OWNER, 'admin' => false, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'sec in-scope rollback: success');
        eq(fx_count('UPDATE'), 1, 'sec in-scope rollback: written');
    }
);

$SCENARIOS['SEC an admin restore is not scope-checked'] = array(
    'rows' => array(), 'lineage' => null,
    'in' => payload('DELETE', array('state_data' => array('query' => 'SELECT * FROM PS_PERSONAL_DATA'))),
    'user' => 'admin@ncsu.edu', 'admin' => true, 'grants' => $NOGRANTS,
    'check' => function ($resp) {
        eq($resp['status'], 'success', 'sec admin undelete: unrestricted, as on save');
        eq(fx_count('INSERT'), 1, 'sec admin undelete: inserted');
    }
);

// ---------------------------------------------------------------------------
// Run. The core is included at GLOBAL scope on purpose - it reads $isAdmin,
// $currentUserKey and $userGrants as plain locals, which only resolve here.
// ---------------------------------------------------------------------------
echo "\nScenarios\n";
foreach ($SCENARIOS as $NAME => $SC) {
    FakeDb::reset($SC['rows']);
    if (array_key_exists('lineage', $SC)) { FakeDb::$lineage = $SC['lineage']; }
    $GLOBALS['TEST_INPUT'] = $SC['in'];
    $isAdmin        = $SC['admin'];
    $currentUserKey = $SC['user'];
    $userGrants     = $SC['grants'];
    // Nothing may survive from the previous include.
    unset($report, $before_data_raw, $before_state_clob, $before_state_decoded,
          $merged, $merged_json, $applied_fields, $snap_state, $relinked, $original_short_id,
          $restored_created_at, $prior_still_live, $auditExtra, $new_report,
          $lineageSid, $priorOwner, $lineageTables, $lnStmt, $lnId, $lnJson, $lnSnap, $lnState,
          $restoreTables, $existingTables, $oosTables);

    ob_start();
    $fatal = null;
    try {
        include $CORE;
    } catch (PnbHarnessExit $e) {
        // an early 400 - the response is already in the buffer
    } catch (Throwable $e) {
        $fatal = $e;
    }
    $raw = ob_get_clean();

    echo "  $NAME\n";
    if ($fatal !== null) {
        $FAIL++;
        echo "    FAIL  uncaught " . get_class($fatal) . ': ' . $fatal->getMessage() . "\n";
        continue;
    }
    $resp = json_decode($raw, true);
    if (!is_array($resp) || !isset($resp['status'])) {
        $FAIL++;
        echo "    FAIL  no JSON response (got: " . substr(trim($raw), 0, 200) . ")\n";
        continue;
    }
    if (!isset($resp['message'])) { $resp['message'] = ''; }
    $SC['check']($resp);
}

// The control assertion. A harness that has never been seen to fail has not been
// seen to work.
if ($CONTROL) {
    echo "\nControl (must FAIL)\n";
    eq('restored', 'not restored', 'control: a deliberately false assertion');
}

@unlink($CORE);
@unlink($liftFile);

echo "\n";
echo "PASS $PASS   FAIL $FAIL\n";
exit($FAIL > 0 ? 1 : 0);
