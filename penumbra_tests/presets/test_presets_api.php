<?php
/**
 * penumbra_tests/presets/test_presets_api.php - the shared-preset endpoint.
 *
 * Drives the SHIPPED manage_presets.php: the file is read, five things are
 * rewritten (the two require lines, the CSRF guard, the Content-Type header,
 * the php://input read) plus `exit;` -> a throw and http_response_code() -> a
 * recorder, and the result is included ONCE. Every scenario then calls
 * penumbraPresetsDispatch() directly with a fresh fake database. Each rewrite
 * is COUNTED and asserted, so a source edit that moves one fails the suite
 * instead of hollowing it out.
 *
 * The five gate helpers are LIFTED from the live db_connection.php and
 * report_auth.php by tokenizer, never copied - including userCanAccessReport(),
 * which this endpoint is the second consumer of and which was promoted into
 * db_connection.php for it. Only the database is faked. The fake emulates
 * Oracle's TRIM(SHORT_ID) = :bind (the COLUMN is trimmed, the bind is not),
 * because SHORT_ID is CHAR and that asymmetry has bitten before.
 *
 *   php.exe -n test_presets_api.php --app=<app dir> [--control] [--mutant]
 *
 * --control adds one deliberately false assertion, which MUST report FAIL.
 * A TARGETED MUTANT always runs too, in a child process: the write gate with
 * its owner clause removed. The owner-save scenario must then FAIL while the
 * grantee-save still passes - proving the gate assertions bite, and bite on the
 * right clause. A harness that has never been seen to fail has not been seen
 * to work.
 *
 * EXPECTED TAIL: "PASS 151   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$MUTANT  = in_array('--mutant',  $argv, true);
$APP = null;
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = substr($a, 6); }
if ($APP === null) $APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP = rtrim($APP, '\\/');

$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}
function eq($got, $want, $label) {
    ok($got === $want, $label . '  (got ' . var_export($got, true) . ', want ' . var_export($want, true) . ')');
}

/** Null-safe nested read: dig($a, 0, 'data', 'cols'). A missing key is null, never a fatal - the MUTANT run depends on it. */
function dig($a) {
    $keys = func_get_args(); array_shift($keys);
    foreach ($keys as $k) { if (!is_array($a) || !array_key_exists($k, $a)) return null; $a = $a[$k]; }
    return $a;
}
/** The most recent audit row (a scenario may log a refusal before the act it asserts). */
function lastAudit() { $a = FakeDb::$audits; return $a ? end($a) : array('rid' => null, 'action' => null, 'after' => null); }

$SRC_EP   = @file_get_contents($APP . '\\manage_presets.php');
$SRC_DB   = @file_get_contents($APP . '\\db_connection.php');
$SRC_AUTH = @file_get_contents($APP . '\\report_auth.php');
$SRC_SNAP = @file_get_contents($APP . '\\manage_snapshots.php');
foreach (array('manage_presets.php' => $SRC_EP, 'db_connection.php' => $SRC_DB,
               'report_auth.php' => $SRC_AUTH, 'manage_snapshots.php' => $SRC_SNAP) as $f => $s) {
    if ($s === false) { fwrite(STDERR, "FATAL: cannot read $f under $APP\n"); exit(2); }
}

// ---------------------------------------------------------------------------
// Lift the real gate helpers (tokenizer, never a copy)
// ---------------------------------------------------------------------------
function lift_function($src, $name) {
    $tokens = token_get_all($src);
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        if (!($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING && $tokens[$j][1] === $name)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $t = $tokens[$k]; $txt = is_array($t) ? $t[1] : $t;
            $buf .= $txt;
            if ($txt === '{') { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    return null;
}
foreach (array('penumbraIsReportOwner', 'penumbraWildcardMatch', 'penumbraReportGrantMatches', 'userCanAccessReport') as $fn) {
    $b = lift_function($SRC_DB, $fn);
    if ($b === null) { fwrite(STDERR, "FATAL: could not lift $fn() from db_connection.php\n"); exit(2); }
    eval($b);
}
foreach (array('extractAuthIdentifier', 'checkAuthorization') as $fn) {   // checkAuthorization() calls extractAuthIdentifier()
    $b = lift_function($SRC_AUTH, $fn);
    if ($b === null) { fwrite(STDERR, "FATAL: could not lift $fn() from report_auth.php\n"); exit(2); }
    eval($b);
}

echo "Lifted helpers\n";
ok(function_exists('userCanAccessReport'), 'userCanAccessReport() lifted from db_connection.php - the promotion landed');
ok(strpos($SRC_SNAP, "if (!function_exists('userCanAccessReport'))") !== false,
   "manage_snapshots.php's own copy is now function_exists()-guarded, so the promotion cannot redeclare");

// ---------------------------------------------------------------------------
// Patch the shipped endpoint into an includable core
// ---------------------------------------------------------------------------
class PnbHarnessExit extends Error {}

function pnb_build_core($src, $destFile, $mutant) {
    $lines = preg_split('/(?<=\n)/', $src);
    $out = array();
    $hit = array('require' => 0, 'csrf' => 0, 'header' => 0, 'input' => 0, 'exit' => 0, 'httpcode' => 0, 'mutant' => 0);
    foreach ($lines as $ln) {
        $t = trim($ln);
        if (strpos($t, "require_once 'db_connection.php';") === 0 || strpos($t, "require_once 'report_auth.php';") === 0) {
            $hit['require']++; $out[] = "// [harness] require stripped\n"; continue;
        }
        if (strpos($t, "penumbraCsrfGuard(array('list'));") === 0) {
            $hit['csrf']++; $out[] = "// [harness] csrf guard stripped (list exempt - asserted separately)\n"; continue;
        }
        if (strpos($t, "header('Content-Type: application/json');") === 0) {
            $hit['header']++; $out[] = "// [harness] header stripped\n"; continue;
        }
        if (strpos($t, '$input = json_decode(file_get_contents') === 0) {
            $hit['input']++; $out[] = "    \$input = \$GLOBALS['TEST_INPUT'];\n"; continue;
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
        if ($mutant && strpos($ln, 'if (penumbraIsReportOwner($ownerId, $userKey)) return true;') !== false) {
            // THE MUTANT: the write gate forgets that owners are authors.
            $hit['mutant']++;
            $ln = str_replace('if (penumbraIsReportOwner($ownerId, $userKey)) return true;', 'if (false) return true;', $ln);
        }
        $out[] = $ln;
    }
    file_put_contents($destFile, implode('', $out));
    return $hit;
}

$CORE = sys_get_temp_dir() . '/pnb_presets_core_' . getmypid() . ($MUTANT ? '_mut' : '') . '.php';
$hit  = pnb_build_core($SRC_EP, $CORE, $MUTANT);

echo "Patched manage_presets.php\n";
eq($hit['require'], 2, 'harness: both require lines stripped');
eq($hit['csrf'],    1, "harness: penumbraCsrfGuard(array('list')) stripped exactly once - and that IS the read exemption");
eq($hit['header'],  1, 'harness: Content-Type header stripped exactly once');
eq($hit['input'],   1, 'harness: php://input read redirected exactly once');
eq($hit['exit'],    2, 'harness: both bare exit; became throws (unauthenticated branch + tail)');
eq($hit['httpcode'], 2, 'harness: both http_response_code() calls recorded (the respond helper + the tail catch)');
if ($MUTANT) eq($hit['mutant'], 1, 'harness: mutant applied to the write gate exactly once');

$cwdWas = getcwd(); @chdir(sys_get_temp_dir());
$lintOut = array(); $lintRc = 0;
exec('"' . PHP_BINARY . '" -n -l ' . escapeshellarg($CORE) . ' 2>&1', $lintOut, $lintRc);
@chdir($cwdWas);
eq($lintRc, 0, 'harness: patched core parses (' . trim(implode(' ', $lintOut)) . ')');

// ---------------------------------------------------------------------------
// The fake database
// ---------------------------------------------------------------------------
class FakeDb {
    public static $reports = array();
    public static $presets = array();
    public static $tableExists = true;
    public static $ddlFail = null;       // null | 'all' (ORA-01031 on every DDL) | 'identity' (only the identity CREATE fails)
    public static $effects = array();
    public static $audits = array();
    public static $ddl = array();
    public static $nextId = 9001;
    public static $httpCode = 200;

    public static function reset() {
        // SHORT_ID is CHAR: fixture rows carry the padding the column does.
        self::$reports = array(
            array('ID' => 101, 'SHORT_ID' => 'awdspon        ', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'public'),
            array('ID' => 202, 'SHORT_ID' => 'private1       ', 'OWNER_ID' => 'owner2', 'AUTHORIZED' => 'owner2,viewer9'),
            array('ID' => 303, 'SHORT_ID' => 'noown          ', 'OWNER_ID' => '',       'AUTHORIZED' => 'public'),
        );
        self::$presets = array();
        self::$tableExists = true; self::$ddlFail = null;
        self::$effects = array(); self::$audits = array(); self::$ddl = array();
        self::$nextId = 9001; self::$httpCode = 200;
    }
    public static function fx($op, $data) { self::$effects[] = array('op' => $op, 'data' => $data); }
    public static function effectsOf($op) {
        return array_values(array_filter(self::$effects, function ($e) use ($op) { return $e['op'] === $op; }));
    }
    public static function reportBySid($sid) {
        foreach (self::$reports as $r) if (trim($r['SHORT_ID']) === $sid) return $r;   // column trimmed, bind not
        return null;
    }
    public static function reportById($id) {
        foreach (self::$reports as $r) if ((int)$r['ID'] === (int)$id) return $r;
        return null;
    }
    public static function seedPreset($rid, $ns, $name, $data, $by = 'owner1') {
        $row = array('ID' => self::$nextId++, 'REPORT_ID' => $rid, 'NS' => $ns, 'NAME' => $name,
                     'DATA' => is_string($data) ? $data : json_encode($data),
                     'CREATED_BY' => $by, 'UPDATED_BY' => $by, 'UPDATED_AT' => '2026-09-04T12:00:00');
        self::$presets[] = $row;
        return $row['ID'];
    }
    public static function presetNames($rid, $ns) {
        $o = array();
        foreach (self::$presets as $p) if ((int)$p['REPORT_ID'] === (int)$rid && $p['NS'] === $ns) $o[] = $p['NAME'];
        return $o;
    }
}
function pnb_http_code($c) { FakeDb::$httpCode = $c; return true; }

class FakeStmt {
    private $sql; private $binds = array(); private $deleted = 0;
    public function __construct($sql) { $this->sql = preg_replace('/\s+/', ' ', trim($sql)); }
    public function bindValue($n, $v, $t = null) { $this->binds[$n] = $v; return true; }
    public function execute() {
        if (strpos($this->sql, 'DELETE FROM PENUMBRA_PRESETS') !== false) {
            $keep = array(); $this->deleted = 0;
            foreach (FakeDb::$presets as $p) {
                $match = (int)$p['REPORT_ID'] === (int)$this->binds[':rid'] && $p['NS'] === $this->binds[':ns'] && $p['NAME'] === $this->binds[':name'];
                if ($match) { $this->deleted++; FakeDb::fx('DELETE', $p); } else { $keep[] = $p; }
            }
            FakeDb::$presets = $keep;
        }
        return true;
    }
    public function fetch($m = null) {
        if (strpos($this->sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID) = :sid') !== false) {
            $r = FakeDb::reportBySid($this->binds[':sid']);
            if (!$r) return false;
            $r['SHORT_ID'] = trim($r['SHORT_ID']);   // the projection asked for TRIM(SHORT_ID)
            return $r;
        }
        if (strpos($this->sql, 'FROM PENUMBRA_REPORTS WHERE ID = :rid') !== false) {
            $r = FakeDb::reportById($this->binds[':rid']);
            return $r ? array('OWNER_ID' => $r['OWNER_ID'], 'AUTHORIZED' => $r['AUTHORIZED']) : false;
        }
        return false;
    }
    public function fetchColumn() {
        if (strpos($this->sql, 'SELECT COUNT(*) FROM PENUMBRA_PRESETS') !== false) {
            return count(FakeDb::presetNames($this->binds[':rid'], $this->binds[':ns']));
        }
        if (strpos($this->sql, 'SELECT ID FROM PENUMBRA_PRESETS') !== false) {
            foreach (FakeDb::$presets as $p) {
                if ((int)$p['REPORT_ID'] === (int)$this->binds[':rid'] && $p['NS'] === $this->binds[':ns'] && $p['NAME'] === $this->binds[':name']) return $p['ID'];
            }
            return false;
        }
        return false;
    }
    public function fetchAll() { return array(); }
    public function rowCount() { return $this->deleted; }
}
class FakeConn {
    public function prepare($sql) { return new FakeStmt($sql); }
    public function query($sql) {
        if (strpos($sql, 'FROM PENUMBRA_PRESETS') !== false && !FakeDb::$tableExists) throw new Exception('ORA-00942: table or view does not exist');
        return new FakeStmt($sql);
    }
    public function exec($sql) {
        FakeDb::$ddl[] = preg_replace('/\s+/', ' ', trim($sql));   // recorded even when refused - the attempt is what we assert
        if (FakeDb::$ddlFail === 'all') throw new Exception('ORA-01031: insufficient privileges');
        if (FakeDb::$ddlFail === 'identity' && strpos($sql, 'IDENTITY') !== false) throw new Exception('ORA-02000: missing ( keyword');
        if (strpos($sql, 'CREATE TABLE PENUMBRA_PRESETS') !== false) FakeDb::$tableExists = true;
        return 0;
    }
}

function getConnectionForTable($t) { return new FakeConn(); }
function getOci8Connection() { throw new Exception('harness: oci8 must never be reached - penumbraPresetsFetchRows is faked'); }
function readClobViaOci8($tbl, $col, $whereCol, $whereVal) {
    foreach (FakeDb::$presets as $p) if ((int)$p['ID'] === (int)$whereVal) return $p['DATA'];
    return null;
}
function penumbraDenyUnauthenticated() { FakeDb::fx('DENY_UNAUTH', null); }
function logPenumbraAudit($rid, $action, $before, $after, $message = null, $extra = null) {
    FakeDb::$audits[] = array('rid' => $rid, 'action' => $action, 'after' => json_decode((string)$after, true));
}
function execClobInsert($c, $tbl, $cols, $clobCols, $rawCols = array(), $returnIdCol = null) {
    FakeDb::fx('INSERT', array('table' => $tbl, 'cols' => $cols, 'clob' => $clobCols, 'raw' => $rawCols));
    $row = $cols; $row['ID'] = FakeDb::$nextId++; $row['UPDATED_AT'] = '2026-09-05T00:00:00';
    FakeDb::$presets[] = $row;
    return $returnIdCol ? $row['ID'] : null;
}
function execClobUpdate($c, $tbl, $setCols, $clobCols, $where, $whereBinds, $extraSet = array()) {
    FakeDb::fx('UPDATE', array('table' => $tbl, 'set' => $setCols, 'where' => $where, 'binds' => $whereBinds, 'extra' => $extraSet));
    $id = isset($whereBinds[':w_id']) ? (int)$whereBinds[':w_id'] : null;
    foreach (FakeDb::$presets as $i => $p) {
        if ($id !== null && (int)$p['ID'] === $id) foreach ($setCols as $k => $v) FakeDb::$presets[$i][$k] = $v;
    }
}
// Pre-empts the endpoint's function_exists()-guarded oci8 reader.
function penumbraPresetsFetchRows($reportId) {
    $rows = array();
    foreach (FakeDb::$presets as $p) if ((int)$p['REPORT_ID'] === (int)$reportId) $rows[] = $p;
    usort($rows, function ($a, $b) {
        $c = strcmp($a['NS'], $b['NS']); if ($c !== 0) return $c;
        return strcmp(strtolower($a['NAME']), strtolower($b['NAME']));
    });
    return $rows;
}

// ---------------------------------------------------------------------------
// Include the core ONCE (its top-level dispatch runs with no action -> 400 ->
// exit-throw, which we swallow), then drive the dispatcher per scenario.
// ---------------------------------------------------------------------------
$currentUserKey = 'harness'; $isAdmin = false; $userGrants = array(); $GLOBALS['TEST_INPUT'] = null;
$_SERVER['REQUEST_METHOD'] = 'GET'; $_GET = array(); $_POST = array();
FakeDb::reset();
ob_start();
try { include $CORE; } catch (PnbHarnessExit $x) { /* expected */ }
$boot = ob_get_clean();
ok(strpos($boot, 'Unknown action') !== false, 'core included; the no-action boot path answered 400 Unknown action');

$GRANT_AWD = array('reports' => array(array('pattern' => 'awd*')));

/** Run one request. Returns [code, decoded json]. */
function run($action, $user, $admin, $grants, $get = array(), $body = null) {
    $GLOBALS['isAdmin'] = $admin;                 // checkAuthorization() reads this global
    FakeDb::$httpCode = 200;
    $_GET = $get; $_GET['action'] = $action;
    $_SERVER['REQUEST_METHOD'] = ($body === null) ? 'GET' : 'POST';
    ob_start();
    penumbraPresetsDispatch(new FakeConn(), $action, $body, $user, $admin, $grants, '');
    $out = ob_get_clean();
    return array(FakeDb::$httpCode, json_decode($out, true));
}

// ===========================================================================
echo "install\n";
FakeDb::reset(); FakeDb::$tableExists = false;
list($c, $r) = run('install', 'nobody', false, array(), array(), array());
eq($c, 403, 'install: a viewer is refused');
eq(count(FakeDb::$ddl), 0, 'install: ...and no DDL ran');

list($c, $r) = run('install', 'adm', true, array(), array(), array());
eq($c, 200, 'install: admin creates the table');
ok(count(FakeDb::$ddl) >= 1 && strpos(FakeDb::$ddl[0], 'CREATE TABLE PENUMBRA_PRESETS') === 0, 'install: DDL is CREATE TABLE PENUMBRA_PRESETS');
ok(strpos(FakeDb::$ddl[0], 'UNIQUE (REPORT_ID, NS, NAME)') !== false, 'install: unique key on (REPORT_ID, NS, NAME)');
ok(strpos(FakeDb::$ddl[0], 'REPORT_ID NUMBER NOT NULL') !== false, 'install: keyed by the NUMERIC report id, not the short id');
ok(strpos(FakeDb::$ddl[0], 'GENERATED BY DEFAULT ON NULL AS IDENTITY') !== false, 'install: identity column preferred (the form the journal tables use)');
ok(strpos(FakeDb::$ddl[0], 'NC_REPORTING.') === false, 'install: the app\'s OWN attempt is unqualified (CURRENT_SCHEMA resolves it)');
ok(strpos(FakeDb::$ddl[0], 'GRANT') === false && count(FakeDb::$ddl) === 1, 'install: ...and issues no GRANT (a grant to yourself is ORA-01749)');
eq(lastAudit()['action'], 'PRESET_INSTALL', 'install: audited as PRESET_INSTALL');
eq(dig(lastAudit(), 'after', 'ok'), true, 'install: ...with ok:true');
eq(dig($r, 'installed'), true, 'install: installed:true');

list($c, $r) = run('install', 'adm', true, array(), array(), array());
eq($c, 200, 'install: second call is a no-op');
eq(count(FakeDb::$ddl), 1, 'install: ...with no second DDL');

echo "install - the app account cannot CREATE (production: ORIED_RO)\n";
FakeDb::reset(); FakeDb::$tableExists = false; FakeDb::$ddlFail = 'all';
list($c, $r) = run('install', 'adm', true, array(), array(), array());
eq($c, 200, 'install refused: an expected state, not a 500');
eq(dig($r, 'status'), 'error', 'install refused: ...reported as status error');
eq(dig($r, 'needs_dba'), true, 'install refused: ...flagged needs_dba');
eq(dig($r, 'installed'), false, 'install refused: installed:false');
eq(FakeDb::$tableExists, false, 'install refused: table still absent');
eq(count(FakeDb::$ddl), 2, 'install refused: identity CREATE tried, then the legacy CREATE retried, nothing else');
ok(strpos(FakeDb::$ddl[1], 'ID NUMBER NOT NULL') !== false, 'install refused: the retry is the plain-ID form');
ok(is_string(dig($r, 'results', 'table')) && strpos($r['results']['table'], 'ORA-01031') !== false, 'install refused: the ORA text is in results');
ok(isset($r['results']['identity_note']), 'install refused: the retry is noted');
$sql = (string)dig($r, 'sql');
ok(strpos($sql, 'CREATE TABLE NC_REPORTING.PENUMBRA_PRESETS') !== false, 'install refused: the handout DDL is SCHEMA-QUALIFIED (an unqualified CREATE in SQL Developer lands where the app cannot see it)');
ok(strpos($sql, 'GRANT SELECT, INSERT, UPDATE, DELETE ON NC_REPORTING.PENUMBRA_PRESETS TO ORIED_RO') !== false, 'install refused: the handout grants the four DML privileges to the app account');
ok(strpos($sql, 'GENERATED BY DEFAULT ON NULL AS IDENTITY') !== false, 'install refused: the handout is the identity form');
ok(strpos($sql, 'UNIQUE (REPORT_ID, NS, NAME)') !== false, 'install refused: ...with the unique key');
ok(strpos($sql, 'CREATE SEQUENCE') === false, 'install refused: ...and no sequence/trigger in the pasteable script');
ok(strpos((string)dig($r, 'statements', 'identity', 'table'), 'NC_REPORTING.PENUMBRA_PRESETS') !== false, 'install refused: statements.identity qualified');
ok(dig($r, 'statements', 'identity', 'seq') === null, 'install refused: identity variant carries no sequence');
ok(strpos((string)dig($r, 'statements', 'legacy', 'seq'), 'CREATE SEQUENCE NC_REPORTING.PENUMBRA_PRESET_SEQ') === 0, 'install refused: legacy variant carries the qualified sequence');
ok(strpos((string)dig($r, 'statements', 'legacy', 'trigger'), 'ON NC_REPORTING.PENUMBRA_PRESETS FOR EACH ROW') !== false, 'install refused: ...and the qualified trigger');
ok(strpos((string)dig($r, 'statements', 'legacy', 'grant'), 'TO ORIED_RO') !== false, 'install refused: ...and the grant');
eq(lastAudit()['action'], 'PRESET_INSTALL', 'install refused: still audited');
eq(dig(lastAudit(), 'after', 'ok'), false, 'install refused: ...with ok:false');
$GLOBALS['ieprd_db_user'] = 'oried_ro_test';
list($c, $r) = run('install', 'adm', true, array(), array(), array('dry' => 1));
ok(strpos((string)dig($r, 'sql'), 'TO ORIED_RO_TEST') !== false, 'install: the GRANT target follows the configured app login, upper-cased');
unset($GLOBALS['ieprd_db_user']);

echo "install - dry run\n";
FakeDb::reset(); FakeDb::$tableExists = false;
list($c, $r) = run('install', 'adm', true, array(), array(), array('dry' => 1));
eq($c, 200, 'install dry: 200');
eq(dig($r, 'dry'), true, 'install dry: flagged');
eq(dig($r, 'installed'), false, 'install dry: installed:false');
eq(count(FakeDb::$ddl), 0, 'install dry: NO DDL ran');
ok(strpos((string)dig($r, 'sql'), 'CREATE TABLE NC_REPORTING.PENUMBRA_PRESETS') !== false, 'install dry: handout returned');
eq(FakeDb::$tableExists, false, 'install dry: table untouched');
eq(count(FakeDb::$audits), 0, 'install dry: nothing audited (nothing happened)');
list($c, $r) = run('install', 'nobody', false, array(), array(), array('dry' => 1));
eq($c, 403, 'install dry: still admin-only');
FakeDb::reset(); FakeDb::$tableExists = false;
list($c, $r) = run('install', 'adm', true, array(), array('dry' => '1'), array());
eq(count(FakeDb::$ddl), 0, 'install dry: ?dry=1 on the query string also runs nothing');

echo "install - identity rejected, legacy fallback\n";
FakeDb::reset(); FakeDb::$tableExists = false; FakeDb::$ddlFail = 'identity';
list($c, $r) = run('install', 'adm', true, array(), array(), array());
eq($c, 200, 'install legacy: 200');
eq(dig($r, 'status'), 'success', 'install legacy: the fallback created the table');
eq(FakeDb::$tableExists, true, 'install legacy: table exists');
eq(count(FakeDb::$ddl), 4, 'install legacy: identity attempt + table + sequence + trigger');
ok(strpos(FakeDb::$ddl[1], 'ID NUMBER NOT NULL') !== false, 'install legacy: plain ID column');
ok(strpos(FakeDb::$ddl[2], 'CREATE SEQUENCE PENUMBRA_PRESET_SEQ') === 0, 'install legacy: sequence');
ok(strpos(FakeDb::$ddl[3], 'CREATE OR REPLACE TRIGGER PENUMBRA_PRESET_BI') === 0, 'install legacy: trigger last');
ok(isset($r['results']['identity_note']), 'install legacy: the retry is noted in results');
eq(dig($r, 'results', 'seq'), 'ok', 'install legacy: sequence ok');
eq(dig(lastAudit(), 'after', 'ok'), true, 'install legacy: audited ok:true');

// ===========================================================================
echo "list - gates\n";
FakeDb::reset();
list($c, $r) = run('list', 'owner1', false, array());
eq($c, 400, 'list: no report_id -> 400');
list($c, $r) = run('list', 'owner1', false, array(), array('report_id' => 'doesnotexist'));
eq($c, 404, 'list: unknown short id -> 404');
list($c, $r) = run('list', 'nobody', false, array(), array('report_id' => 'private1'));
eq($c, 403, 'list: a viewer with no access to a private report -> 403');
list($c, $r) = run('list', 'viewer9', false, array(), array('report_id' => 'private1'));
eq($c, 200, 'list: an authorized viewer reads a private report');
eq($r['can_write'], false, 'list: ...but can_write is false for a plain viewer');
list($c, $r) = run('list', 'owner1', false, array(), array('report_id' => 'awdspon'));
eq($c, 200, 'list: owner on a public report');
eq($r['can_write'], true, 'list: owner -> can_write true');
eq($r['data'], array(), 'list: no presets yet -> empty list');
ok(dig($r, 'needs_install') === null, 'list: table present -> no needs_install flag');
list($c, $r) = run('list', 'grantee1', false, $GRANT_AWD, array('report_id' => 'awdspon'));
eq($r['can_write'], true, 'list: grant holder (awd*) -> can_write true');
list($c, $r) = run('list', 'nobody', false, array(), array('report_id' => 'awdspon'));
eq($c, 200, 'list: anyone reads a public report');
eq($r['can_write'], false, 'list: ...and can_write is false');
list($c, $r) = run('list', 'adm', true, array(), array('report_id' => 'private1'));
eq($r['can_write'], true, 'list: admin -> can_write true on any report');
list($c, $r) = run('list', 'owner1', false, array(), array('report_id' => '  awdspon  '));
eq($c, 200, 'list: a padded/spaced short id resolves (CHAR column, TRIM both sides)');
// The bare-owner seam: the client flag omits this case, the server must not.
list($c, $r) = run('list', 'owner1', false, array(), array('report_id' => 'awdspon'));
eq($r['can_write'], true, 'list: a bare owner WITHOUT a grant still gets can_write (the seam penumbra_vars.canEditReport has)');
// The empty-user-key trap penumbraIsReportOwner guards: an ownerless report must
// not make an anonymous key its owner.
list($c, $r) = run('list', '', false, array(), array('report_id' => 'noown'));
eq($r['can_write'], false, 'list: empty user key never owns an ownerless report');

echo "list - table missing\n";
FakeDb::reset(); FakeDb::$tableExists = false;
list($c, $r) = run('list', 'owner1', false, array(), array('report_id' => 'awdspon'));
eq($c, 200, 'list: missing table is NOT an error for the reader');
eq($r['data'], array(), 'list: ...empty list');
eq(dig($r, 'needs_install'), true, 'list: ...flagged needs_install so an admin UI can offer setup');
eq($r['can_write'], true, 'list: ...and can_write still answered');

echo "list - rows\n";
FakeDb::reset();
FakeDb::seedPreset(101, 'pivot', 'Zed',   array('v' => 2, 'rows' => array('COLLEGE')), 'owner1');
FakeDb::seedPreset(101, 'pivot', 'alpha', array('v' => 2, 'rows' => array('FY')),      'grantee1');
FakeDb::seedPreset(101, 'viz',   'Chart', array('type' => 'bar'),                       'owner1');
FakeDb::seedPreset(202, 'pivot', 'Other', array('v' => 2),                              'owner2');   // another report
FakeDb::seedPreset(101, 'search', 'Broken', '{not json', 'owner1');                                 // corrupt payload
list($c, $r) = run('list', 'nobody', false, array(), array('report_id' => 'awdspon'));
eq(count($r['data']), 3, 'list: three usable presets for this report (another report\'s row and a corrupt row excluded)');
eq(array_map(function ($p) { return $p['ns'] . '/' . $p['name']; }, $r['data']),
   array('pivot/alpha', 'pivot/Zed', 'viz/Chart'), 'list: ordered by namespace then case-insensitive name');
eq($r['data'][0]['data'], array('v' => 2, 'rows' => array('FY')), 'list: DATA comes back decoded');
eq($r['data'][0]['created_by'], 'grantee1', 'list: created_by carried');
ok(isset($r['data'][0]['updated_at']), 'list: updated_at carried');

// ===========================================================================
echo "save - gate\n";
FakeDb::reset();
$body = array('report_id' => 'awdspon', 'ns' => 'pivot', 'name' => 'Mine', 'data' => array('v' => 2, 'rows' => array('COLLEGE')));
list($c, $r) = run('save', 'nobody', false, array(), array(), $body);
eq($c, 403, 'save: a viewer is refused');
eq(count(FakeDb::effectsOf('INSERT')), 0, 'save: ...and nothing was written');
eq(lastAudit()['action'], 'PRESET_DENIED', 'save: ...and the refusal is audited');
list($c, $r) = run('save', 'viewer9', false, array(), array(), array_merge($body, array('report_id' => 'private1')));
eq($c, 403, 'save: an authorized READER who is not an author is still refused');

echo "save - authors\n";
FakeDb::reset();
list($c, $r) = run('save', 'owner1', false, array(), array(), $body);
eq($c, 200, 'save: OWNER saves');
eq(dig($r, 'mode'), 'create', 'save: ...as a create');
$ins = FakeDb::effectsOf('INSERT');
eq(count($ins), 1, 'save: one INSERT');
eq(dig($ins, 0, 'data', 'table'), 'PENUMBRA_PRESETS', 'save: into PENUMBRA_PRESETS');
eq(dig($ins, 0, 'data', 'cols', 'REPORT_ID'), 101, 'save: keyed by the numeric report id');
eq(dig($ins, 0, 'data', 'cols', 'NS'), 'pivot', 'save: namespace stored');
eq(dig($ins, 0, 'data', 'cols', 'CREATED_BY'), 'owner1', 'save: creator recorded');
eq(dig($ins, 0, 'data', 'clob'), array('DATA'), 'save: DATA written as the CLOB column');
eq(json_decode((string)dig($ins, 0, 'data', 'cols', 'DATA'), true), $body['data'], 'save: DATA round-trips');
eq(lastAudit()['action'], 'PRESET_SAVE', 'save: audited as PRESET_SAVE');
eq(lastAudit()['rid'], 101, 'save: ...against the report');

FakeDb::reset();
list($c, $r) = run('save', 'grantee1', false, $GRANT_AWD, array(), $body);
eq($c, 200, 'save: GRANT HOLDER saves');
FakeDb::reset();
list($c, $r) = run('save', 'adm', true, array(), array(), $body);
eq($c, 200, 'save: ADMIN saves');

echo "save - validation\n";
FakeDb::reset();
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('ns' => 'bogus')));
eq($c, 400, 'save: unknown namespace -> 400');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('name' => '   ')));
eq($c, 400, 'save: blank name -> 400');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('name' => str_repeat('x', 201))));
eq($c, 400, 'save: 201-character name -> 400');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('name' => "bad\x01name")));
eq($c, 400, 'save: control character in name -> 400');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('data' => 'just a string')));
eq($c, 400, 'save: data that is not an object -> 400');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('data' => array('a', 'b'))));
eq($c, 400, 'save: data that is a list -> 400');
unset($body2); $body2 = $body; unset($body2['data']);
list($c, $r) = run('save', 'owner1', false, array(), array(), $body2);
eq($c, 400, 'save: missing data -> 400');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('data' => array('big' => str_repeat('x', 200001)))));
eq($c, 413, 'save: oversized data -> 413');
eq(count(FakeDb::effectsOf('INSERT')), 0, 'save: none of the invalid payloads wrote anything');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('name' => '  Spaced  ')));
eq(FakeDb::presetNames(101, 'pivot'), array('Spaced'), 'save: the stored name is trimmed');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('report_id' => 'nope')));
eq($c, 404, 'save: unknown report -> 404');
FakeDb::$tableExists = false;
list($c, $r) = run('save', 'owner1', false, array(), array(), $body);
eq($c, 409, 'save: table missing -> 409 with needs_install (not a 500)');
eq(dig($r, 'needs_install'), true, 'save: ...flagged');

echo "save - upsert and cap\n";
FakeDb::reset();
run('save', 'owner1', false, array(), array(), $body);
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('data' => array('v' => 2, 'rows' => array('FY')))));
eq($c, 200, 'save: saving an existing name succeeds');
eq(dig($r, 'mode'), 'update', 'save: ...as an update');
eq(count(FakeDb::effectsOf('INSERT')), 1, 'save: ...with no second INSERT');
eq(count(FakeDb::effectsOf('UPDATE')), 1, 'save: ...one UPDATE');
eq(count(FakeDb::presetNames(101, 'pivot')), 1, 'save: still one preset');
$upd = FakeDb::effectsOf('UPDATE');
eq(json_decode((string)dig($upd, 0, 'data', 'set', 'DATA'), true), array('v' => 2, 'rows' => array('FY')), 'save: DATA replaced');
eq(dig($upd, 0, 'data', 'set', 'UPDATED_BY'), 'owner1', 'save: UPDATED_BY set');
ok(in_array('UPDATED_AT = CURRENT_TIMESTAMP', (array)dig($upd, 0, 'data', 'extra'), true), 'save: UPDATED_AT stamped');

FakeDb::reset();
for ($i = 1; $i <= 50; $i++) FakeDb::seedPreset(101, 'pivot', "p$i", array('i' => $i));
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('name' => 'Overflow')));
eq($c, 409, 'cap: the 51st preset in a namespace is refused');
eq(count(FakeDb::presetNames(101, 'pivot')), 50, 'cap: ...and the count is unchanged');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('name' => 'p7')));
eq($c, 200, 'cap: overwriting an EXISTING name at the cap is allowed');
eq(dig($r, 'mode'), 'update', 'cap: ...as an update');
list($c, $r) = run('save', 'owner1', false, array(), array(), array_merge($body, array('ns' => 'viz', 'name' => 'Chart1', 'data' => array('type' => 'bar'))));
eq($c, 200, 'cap: the cap is PER NAMESPACE - a viz preset saves while pivot is full');

// ===========================================================================
echo "delete\n";
FakeDb::reset();
FakeDb::seedPreset(101, 'pivot', 'Mine', array('v' => 2), 'owner1');
$del = array('report_id' => 'awdspon', 'ns' => 'pivot', 'name' => 'Mine');
list($c, $r) = run('delete', 'nobody', false, array(), array(), $del);
eq($c, 403, 'delete: a viewer is refused');
eq(count(FakeDb::presetNames(101, 'pivot')), 1, 'delete: ...and the row survives');
list($c, $r) = run('delete', 'grantee1', false, $GRANT_AWD, array(), $del);
eq($c, 200, 'delete: a GRANT HOLDER deletes a preset SOMEONE ELSE created (any-author rule, not creator-only)');
eq(count(FakeDb::presetNames(101, 'pivot')), 0, 'delete: ...row gone');
eq(lastAudit()['action'], 'PRESET_DELETE', 'delete: audited as PRESET_DELETE');
list($c, $r) = run('delete', 'owner1', false, array(), array(), $del);
eq($c, 404, 'delete: deleting again -> 404');
FakeDb::seedPreset(101, 'pivot', 'Mine', array('v' => 2), 'grantee1');
list($c, $r) = run('delete', 'owner1', false, array(), array(), $del);
eq($c, 200, 'delete: the OWNER deletes a grantee\'s preset');
FakeDb::seedPreset(101, 'pivot', 'Mine', array('v' => 2), 'owner1');
list($c, $r) = run('delete', 'adm', true, array(), array(), $del);
eq($c, 200, 'delete: ADMIN deletes');
list($c, $r) = run('delete', 'owner1', false, array(), array(), array_merge($del, array('ns' => 'bogus')));
eq($c, 400, 'delete: unknown namespace -> 400');

// ===========================================================================
echo "misc\n";
FakeDb::reset();
list($c, $r) = run('frobnicate', 'adm', true, array(), array(), array());
eq($c, 400, 'unknown action -> 400');
eq(substr_count($SRC_EP, "penumbraCsrfGuard(array('list'))"), 1, "source: `list` is the ONE action declared read-only to the CSRF guard");
ok(strpos($SRC_EP, "require_once 'report_auth.php';") !== false, 'source: report_auth.php required (checkAuthorization for the read gate)');
ok(strpos($SRC_EP, "if (!function_exists('penumbraPresetsFetchRows'))") !== false, 'source: the oci8 reader is function_exists()-guarded so this harness could pre-empt it');

// ===========================================================================
if ($CONTROL) { echo "control\n"; ok(false, 'CONTROL: this assertion is deliberately false and must be reported'); }

// The mutant runs in a child process: the include-once core cannot be redefined.
if (!$MUTANT) {
    echo "mutant (child process: write gate without its owner clause)\n";
    $cmd = '"' . PHP_BINARY . '" -n ' . escapeshellarg(__FILE__) . ' --mutant ' . escapeshellarg('--app=' . $APP);
    $mo = array(); $mrc = 0;
    $cwdWas = getcwd(); @chdir(sys_get_temp_dir());
    exec($cmd . ' 2>&1', $mo, $mrc);
    @chdir($cwdWas);
    $mtxt = implode("\n", $mo);
    ok(preg_match('/PASS (\d+)\s+FAIL (\d+)/', $mtxt, $mm) === 1, 'mutant: child produced a tally');
    $mfail = isset($mm[2]) ? (int)$mm[2] : 0;
    ok($mfail >= 1, "mutant: child reported failures ($mfail) - the gate assertions can bite");
    ok(strpos($mtxt, 'FAIL  save: OWNER saves') !== false, 'mutant: it is the OWNER-save assertion that failed');
    ok(strpos($mtxt, 'FAIL  save: GRANT HOLDER saves') === false, 'mutant: ...while the grant-holder path still passed (the mutant hit ONLY the owner clause)');
    ok(strpos($mtxt, 'FAIL  save: ADMIN saves') === false, 'mutant: ...and admin still passed');
}

@unlink($CORE);
echo "\nPASS $pass   FAIL $fail" . ($MUTANT ? "   [MUTANT: failures are REQUIRED]" : '') . "\n";
exit($fail === 0 ? 0 : 1);
