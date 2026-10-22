<?php
// =============================================================================
// searchrank (2026-10-21) - SERVER suite for get_server_reports.php's report search ORDER:
// relevance first (penumbraReportSearchRankSql), then UPDATED_AT DESC, in MODE search
// (the repository) and MODE quicksearch (home screen, Quick actions, dashboard tile editor,
// Tags tool). Tiers: 0 the short id IS the term, 1 the id starts with it, 2 it starts a word
// of the id or title, 3 the id or title holds it, 4 a tag / owner (or owner-by-name) / access
// list hit, 5 the rest (SQL / snippet / options, task recipients).
//
// Lifts the endpoint's helpers by NAME (tokenizer brace match) and its two mode blocks
// VERBATIM (the text between their `} else if ($mode === ...` heads), and runs them against
// a fake connection that
//   (1) holds every statement to OCI8's bind discipline on the ORACLE text: a bound name the
//       SQL lacks is ORA-01036 (the trap of the search COUNT, which reuses the WHERE's binds),
//       a placeholder left unbound is ORA-01008;
//   (2) then EXECUTES it in SQLite (pdo_sqlite) after a few dialect rewrites - DBMS_LOB.INSTR,
//       FETCH FIRST, LISTAGG, KEEP, and TO_CHAR / NVL / REGEXP_LIKE as PHP functions (PCRE
//       standing in for Oracle's POSIX regex) - over fixture reports modelled on the 10-21
//       "EPA" case (62 hits, 54 only inside STATE_DATA; epa-perm older than all of those).
// SQLite folds ASCII only and is not Oracle: the ranking text also runs on Oracle itself in
// the live DUAL probe (README.md), and on the endpoint after the deploy.
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=pdo_sqlite
//       -d date.timezone=America/New_York test.php --file <get_server_reports.php>
// Prints one JSON object: {"asserts": [{"id", "ok", "detail"}, ...]}. run.php drives it.
// =============================================================================
error_reporting(E_ALL);
$o = getopt('', array('file:'));
$file = isset($o['file']) ? $o['file'] : '';
$out = array('asserts' => array());
function t($id, $ok, $detail) { global $out; $out['asserts'][] = array('id' => $id, 'ok' => (bool)$ok, 'detail' => (string)$detail); }
function finish() { global $out; echo json_encode($out); exit(0); }
set_error_handler(function ($no, $str, $f, $l) {
    if (!(error_reporting() & $no)) return false;   // an @-silenced call
    throw new ErrorException($str, 0, $no, $f, $l);
});

$src = @file_get_contents($file);
if ($src === false || $src === '') { t('P-lift', false, 'cannot read ' . $file); finish(); }
$src = str_replace("\r\n", "\n", $src);
if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) { t('P-lift', false, 'pdo_sqlite is not loaded (see the header for the -d flags)'); finish(); }

// ---------------------------------------------------------------- lifting
/** A top-level named function's text (tokenizer: braces inside strings never count). */
function lift_fn($src, $name) {
    $tok = token_get_all($src);
    $n = count($tok);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tok[$i]) || $tok[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($tok[$j]) && $tok[$j][0] === T_WHITESPACE) $j++;
        if (!($j < $n && is_array($tok[$j]) && $tok[$j][0] === T_STRING && $tok[$j][1] === $name)) continue;
        $buf = ''; $depth = 0; $started = false;
        for ($k = $i; $k < $n; $k++) {
            $tx = is_array($tok[$k]) ? $tok[$k][1] : $tok[$k];
            $buf .= $tx;
            if (!is_array($tok[$k]) && $tok[$k] === '{') { $depth++; $started = true; }
            else if (is_array($tok[$k]) && ($tok[$k][0] === T_CURLY_OPEN || $tok[$k][0] === T_DOLLAR_OPEN_CURLY_BRACES)) { $depth++; }
            else if (!is_array($tok[$k]) && $tok[$k] === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
        return null;
    }
    return null;
}
/** The text between two anchors, each of which must occur exactly once. */
function between($src, $a, $b, &$why) {
    if (substr_count($src, $a) !== 1) { $why = 'start anchor x' . substr_count($src, $a) . ': ' . trim($a); return null; }
    $i = strpos($src, $a) + strlen($a);
    $j = strpos($src, $b, $i);
    if ($j === false || substr_count($src, $b) !== 1) { $why = 'end anchor x' . substr_count($src, $b) . ': ' . trim($b); return null; }
    return substr($src, $i, $j - $i);
}
$why = '';
$headS = "    } else if (\$mode === 'search' && strlen(\$searchTerm) >= 3) {\n";
$headQ = "    } else if (\$mode === 'quicksearch' && strlen(\$searchTerm) >= 3) {\n";
$headT = "    } else if (\$mode === 'bytable') {\n";
$blockS = between($src, $headS, $headQ, $why);
$blockQ = $blockS === null ? null : between($src, $headQ, $headT, $why);
$pre = $blockQ === null ? null : between($src, "    \$tagExact = '';\n", "\n\n    // ---------------------------------------------------------------\n    // Total Count", $why);
if ($pre !== null) $pre = "\$tagExact = '';\n" . $pre;   // the anchor line itself is the initialiser
$joinM = array();
$tagsJoinSrc = preg_match('/\$tagsJoin = (" LEFT JOIN \(SELECT REPORT_ID.*?t_agg\.REPORT_ID = r\.ID");/s', $src, $joinM) ? $joinM[1] : null;
$fns = array();
foreach (array('penumbraKnownReportsSql', 'penumbraReportTextMatchSql', 'buildAuthFilter') as $fn) { $fns[$fn] = lift_fn($src, $fn); }
$rankFn = lift_fn($src, 'penumbraReportSearchRankSql');   // absent before 2026-10-21 (the control)
$lifted = $blockS !== null && $blockQ !== null && $pre !== null && $tagsJoinSrc !== null && !in_array(null, $fns, true);
t('P-lift', $lifted, $lifted ? ('search ' . strlen($blockS) . ' B, quicksearch ' . strlen($blockQ) . ' B, helpers ' . implode(' ', array_keys($fns)) . ($rankFn ? ' + penumbraReportSearchRankSql' : ' (no rank helper)'))
                             : ('lift failed: ' . ($why !== '' ? $why : 'a helper or the tags join is missing')));
if (!$lifted) finish();

// ---------------------------------------------------------------- stubs (db_connection.php / penumbra_*.php)
function penumbraReportDiscoveryAllowed($isAdmin) { return (bool)$isAdmin; }   // penumbra_discovery.php, verbatim
function penumbraSystemShortIds() { return array('__HOME__', '__HEALTH__'); }
function penumbraShortIdSqlList($ids) { $q = array(); foreach ((array)$ids as $id) { $q[] = "'" . $id . "'"; } return implode(',', $q); }
function penumbraTagNormalize($raw) { $t = strtoupper(trim((string)$raw)); $t = preg_replace('/[\s\-\.]+/', '_', $t); return trim(preg_replace('/_+/', '_', $t), '_'); }
function penumbraPeopleUnityByName($conn, $term, $limit = 50) { return strtolower(trim($term)) === 'smith' ? array('jqs123') : array(); }   // the directory: "John Q. Smith" = jqs123
function enrichReports($conn, $rows) { return $rows; }   // order-preserving, like the real one
$userGrants = array();
$_SERVER['HTTP_SHIB_MAIL'] = 'viewer1@ncsu.edu';
eval(implode("\n", $fns) . "\n" . ($rankFn ? $rankFn : ''));
$tagsJoinText = eval('return ' . $tagsJoinSrc . ';');

// ---------------------------------------------------------------- SQLite standing in for Oracle
$REGEX_ERR = null;
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->sqliteCreateFunction('PNB_INSTR4', function ($h, $n, $off = 1, $occ = 1) {
    if ($h === null || $n === null) return null;
    $p = strpos((string)$h, (string)$n);
    return $p === false ? 0 : $p + 1;
}, 4);
$db->sqliteCreateFunction('TO_CHAR', function ($x, $fmt = null) { return $x; }, 2);
$db->sqliteCreateFunction('NVL', function ($a, $b) { return $a === null ? $b : $a; }, 2);
$db->sqliteCreateFunction('REGEXP_LIKE', function ($s, $p) {
    global $REGEX_ERR;
    if ($s === null || $p === null) return null;
    $r = @preg_match('~' . str_replace('~', '\\~', (string)$p) . '~', (string)$s);
    if ($r === false) { $REGEX_ERR = 'ORA-12725 stand-in: the pattern ' . $p . ' does not compile'; return 0; }
    return $r;
}, 2);
$db->exec('CREATE TABLE PENUMBRA_REPORTS (ID INTEGER, SHORT_ID TEXT, TITLE TEXT, OWNER_ID TEXT, AUTHORIZED TEXT, STATE_DATA TEXT, CREATED_AT TEXT, UPDATED_AT TEXT)');
$db->exec('CREATE TABLE PENUMBRA_REPORT_TAGS (REPORT_ID INTEGER, TAG TEXT)');
$db->exec('CREATE TABLE PENUMBRA_AUDIT (ID INTEGER, REPORT_ID INTEGER, USER_ID TEXT, ACTION TEXT, "TIMESTAMP" TEXT)');
$db->exec('CREATE TABLE PENUMBRA_SNAPS (REPORT_ID INTEGER, CREATED_AT TEXT, CREATED_BY TEXT)');
$db->exec('CREATE TABLE PENUMBRA_SCHEDULED_TASKS (ID INTEGER, REPORT_ID TEXT, RECIPIENTS TEXT, OPTIONS TEXT)');

function to_sqlite($sql) {
    $s = str_replace('DBMS_LOB.INSTR(', 'PNB_INSTR4(', $sql);
    $s = preg_replace('/FETCH FIRST (:[A-Za-z_][A-Za-z0-9_]*|\d+) ROWS ONLY/', 'LIMIT $1', $s);
    $s = preg_replace('/\s+KEEP \(DENSE_RANK LAST ORDER BY [^)]*\)/', '', $s);
    $s = preg_replace("/LISTAGG\\(TAG, '\\|' ON OVERFLOW TRUNCATE\\) WITHIN GROUP \\(ORDER BY TAG\\)/", "GROUP_CONCAT(TAG, '|')", $s);
    return $s;
}
/** The bind placeholders of an Oracle statement (string literals stripped first: '(^|[^[:alnum:]])', 'HH24:MI:SS'). */
function placeholders($sql) {
    $s = preg_replace("/'(?:''|[^'])*'/", "''", $sql);
    preg_match_all('/(?<![A-Za-z0-9_:]):([A-Za-z_][A-Za-z0-9_]*)/', $s, $m);
    return array_values(array_unique(array_map(function ($x) { return ':' . strtolower($x); }, $m[1])));
}
class FakeConn {
    public $db; public $log = array();
    function __construct($db) { $this->db = $db; }
    function prepare($sql) { return new FakeStmt($this, $sql); }
    function query($sql) { $s = $this->prepare($sql); $s->execute(); return $s; }
}
class FakeStmt {
    private $c; public $sql; private $binds = array(); private $rows = array();
    function __construct($c, $sql) { $this->c = $c; $this->sql = $sql; }
    function bindValue($k, $v, $type = PDO::PARAM_STR) { $k = (string)$k; if ($k[0] !== ':') $k = ':' . $k; $this->binds[strtolower($k)] = array($v, $type); return true; }
    function execute($p = null) {
        global $REGEX_ERR;
        $entry = array('sql' => $this->sql, 'binds' => array_map(function ($b) { return $b[0]; }, $this->binds), 'error' => null);
        $ph = placeholders($this->sql);
        $unused = array_diff(array_keys($this->binds), $ph);
        $unbound = array_diff($ph, array_keys($this->binds));
        if ($unused) $entry['error'] = 'ORA-01036 illegal variable name/number (bound, not in the SQL: ' . implode(' ', $unused) . ')';
        else if ($unbound) $entry['error'] = 'ORA-01008 not all variables bound (' . implode(' ', $unbound) . ')';
        if ($entry['error'] === null) {
            $REGEX_ERR = null;
            try {
                $st = $this->c->db->prepare(to_sqlite($this->sql));
                foreach ($this->binds as $k => $b) { $st->bindValue($k, $b[0], $b[1] === PDO::PARAM_INT ? PDO::PARAM_INT : PDO::PARAM_STR); }
                $st->execute();
                $this->rows = $st->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e) { $entry['error'] = 'SQLite: ' . $e->getMessage(); }
            if ($REGEX_ERR !== null) $entry['error'] = $REGEX_ERR;
        }
        $this->c->log[] = $entry;
        if ($entry['error'] !== null) throw new Exception($entry['error']);
        return true;
    }
    function fetchAll($m = null) { return $this->rows; }
    function fetch($m = null) { return $this->rows ? array_shift($this->rows) : false; }
    function fetchColumn($i = 0) { if (!$this->rows) return false; $r = array_values($this->rows[0]); return $r[$i]; }
}

// ---------------------------------------------------------------- fixtures
$REP = array();
function rep($id, $sid, $title, $upd, $state = '{}', $owner = 'owner1', $auth = 'public') {
    global $REP;
    $REP[$id] = array('ID' => $id, 'SHORT_ID' => $sid, 'TITLE' => $title, 'OWNER_ID' => $owner, 'AUTHORIZED' => $auth, 'STATE_DATA' => $state, 'CREATED_AT' => $upd, 'UPDATED_AT' => $upd);
}
// The "EPA" case: 4 real EPA reports (epa-perm the oldest of them), 4 "Department" titles,
// 54 reports matching only inside STATE_DATA (46 DEPARTMENT, 8 the hidePagination option),
// all 54 edited after epa-perm - so by date alone epa-perm sorts far below the 8-row lists.
rep(1, 'epa-perm', 'External Professional Activity (EPA) Permission Letters', '2026-08-11 09:00:00', '{"query":"SELECT 1 FROM X"}');
rep(2, 'fi-epa-c', 'FI-EPA Proposals (current)', '2026-10-21 10:00:00');
rep(3, 'fi-epa', 'FI-EPA Proposals', '2026-10-20 15:00:00');
rep(4, 'fi-epa-c-spoofer', 'FI-EPA Proposals (spoofer)', '2026-10-20 12:00:00');
rep(5, 'cdprop', 'Proposals by College and Department', '2026-07-01 09:00:00');
rep(6, 'cdawd', 'Awards by College and Department', '2026-06-15 09:00:00');
rep(7, 'hitratio', 'Hit Ratio by Department', '2026-09-30 09:00:00');
rep(8, 'award_compare_monthdeptprimespon', 'Award Compare by Month, Department and Prime Sponsor', '2026-05-20 09:00:00');
for ($k = 0; $k < 54; $k++) {
    rep(9 + $k, sprintf('sd%02d', $k + 1), sprintf('Sponsored Data %02d', $k + 1), date('Y-m-d 08:00:00', strtotime('2026-08-12') + $k * 86400),
        $k < 46 ? '{"query":"SELECT DEPARTMENT, AWARD FROM X"}' : '{"view":{"hidePagination":true}}');
}
rep(63, 'zz-other', 'Unrelated report', '2026-10-21 11:00:00', '{"query":"SELECT 1 FROM X"}');
rep(64, '__HOME__', 'Home EPA', '2026-10-21 12:00:00');   // a system placeholder: the auth filter hides it
// One report per tier for the term "budget", dated the REVERSE of the tier order.
rep(100, 'budget', 'Overall Plan', '2026-01-01 09:00:00');                     // 0 the id is the term
rep(101, 'budget-2026', 'Plan 2026', '2026-01-02 09:00:00');                   // 1 the id starts with it
rep(111, 'fy_budget_x', 'Plan H', '2026-01-02 12:00:00');                      // 2 a word of the id (after _)
rep(102, 'fy-budget', 'Fiscal Plan', '2026-01-03 09:00:00');                   // 2 a word of the id (after -)
rep(103, 'plan-a', 'Annual Budget Review', '2026-01-04 09:00:00');             // 2 a word of the title
rep(112, 'plan-i', 'Plan (Budget) I', '2026-01-04 12:00:00');                 // 2 a word of the title (after a paren)
rep(104, 'subbudgets', 'Sub plans', '2026-01-05 09:00:00');                    // 3 inside the id
rep(105, 'plan-b', 'Overbudget Items', '2026-01-06 09:00:00');                 // 3 inside the title
rep(106, 'plan-c', 'Plan C', '2026-01-07 09:00:00', '{}', 'budgetguy');        // 4 the owner
rep(107, 'plan-d', 'Plan D', '2026-01-08 09:00:00', '{}', 'owner1', 'budgetteam,alice');   // 4 the access list
rep(108, 'plan-e', 'Plan E', '2026-01-09 09:00:00');                           // 4 a tag (BUDGETING)
rep(109, 'plan-f', 'Plan F', '2026-01-10 09:00:00', '{"query":"SELECT BUDGET FROM X"}');   // 5 the SQL
rep(110, 'plan-g', 'Plan G', '2026-01-11 09:00:00');                           // 5 a task recipient
// Owner by NAME (quicksearch only): "smith" is jqs123 in the directory stub.
rep(120, 'plan-j', 'Plan J', '2026-02-01 09:00:00', '{}', 'jqs123');           // 4 owner-by-name
rep(121, 'plan-k', 'Plan K', '2026-02-02 09:00:00', '{"note":"smith"}');       // 5
rep(122, 'smith-report', 'Smith Report', '2026-01-15 09:00:00');               // 1
// A term with regex metacharacters: literal, never a pattern.
rep(130, 'a.b', 'Dotted', '2026-03-01 09:00:00');                              // 0
rep(133, 'q-thing', 'Dotted a.b notes', '2026-03-02 09:00:00');                // 2 (after a space)
rep(131, 'axb-tool', 'Axb Tool', '2026-03-05 09:00:00', '{"note":"a.b"}');     // 5 - an unescaped "A.B" would call AXB a word start
// (a LIKE wildcard in the term - "fy_budget" - reuses 102 / 111: the WHERE's LIKE lets _ reach fy-budget, the rank is literal)
$ins = $db->prepare('INSERT INTO PENUMBRA_REPORTS VALUES (:ID, :SHORT_ID, :TITLE, :OWNER_ID, :AUTHORIZED, :STATE_DATA, :CREATED_AT, :UPDATED_AT)');
foreach ($REP as $r) { $ins->execute($r); }
$db->exec("INSERT INTO PENUMBRA_REPORT_TAGS VALUES (108, 'BUDGETING'), (104, 'BUDGETING')");
$db->exec("INSERT INTO PENUMBRA_SCHEDULED_TASKS VALUES (1, 'plan-g', 'budget-office@ncsu.edu', '{}')");
// viewer1 (a non-admin) has opened every "budget" report: the discovery gate's known set
foreach (array(100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112) as $i => $rid) {
    $db->exec("INSERT INTO PENUMBRA_AUDIT VALUES (" . ($i + 1) . ", $rid, 'viewer1', 'OPEN', '2026-02-01 09:00:00')");
}

// ---------------------------------------------------------------- running a mode block
$RUNS = array();
function run_mode($mode, $term, $limit, $admin = true, $user = 'admin1') {
    global $db, $pre, $blockS, $blockQ, $tagsJoinText, $RUNS;
    $oracleConn = new FakeConn($db);
    $isAdmin = $admin; $currentUserKey = $user; $searchTerm = $term; $offset = 0;
    $metricsSel = ''; $tagsSel = 't_agg.TAGS,'; $tagsJoin = $tagsJoinText;
    $reports = array(); $totalCount = -1; $err = null;
    try { eval($pre); eval($mode === 'search' ? $blockS : $blockQ); }
    catch (Throwable $e) { $err = $e->getMessage(); }
    $res = array('ids' => array_map(function ($r) { return trim((string)$r['SHORT_ID']); }, $reports ?: array()),
                 'total' => $totalCount, 'log' => $oracleConn->log, 'error' => $err, 'what' => "$mode '" . (strlen($term) > 30 ? substr($term, 0, 30) . '...' : $term) . "'" . ($admin ? '' : ' (non-admin)'));
    $RUNS[] = $res;
    return $res;
}
function list_stmt($res) { foreach ($res['log'] as $e) { if (strpos($e['sql'], 'ORDER BY') !== false) return $e; } return null; }
function sid_of($ids) { global $REP; $by = array(); foreach ($REP as $r) $by[$r['ID']] = $r['SHORT_ID']; return array_map(function ($i) use ($by) { return $by[$i]; }, $ids); }
function show($res) { return $res['error'] !== null ? 'ERROR ' . $res['error'] : implode(',', $res['ids']); }
function order_is($id, $res, $want, $note) { t($id, $res['error'] === null && $res['ids'] === $want, $res['what'] . ' -> ' . show($res) . ($res['ids'] === $want ? '' : ' | want ' . implode(',', $want)) . $note); }

// P-fixture: the fixture reproduces the bug - by date alone epa-perm is not in the top 8 of the 62 hits.
$epaHits = array();
foreach ($REP as $r) {
    if (strpos($r['SHORT_ID'], '__') === 0) continue;
    if (stripos($r['SHORT_ID'] . ' ' . $r['TITLE'] . ' ' . $r['STATE_DATA'], 'epa') !== false) $epaHits[$r['SHORT_ID']] = $r['UPDATED_AT'];
}
arsort($epaHits);
$dateRank = array_search('epa-perm', array_keys($epaHits)) + 1;
t('P-fixture', count($epaHits) === 62 && $dateRank > 8, count($epaHits) . ' reports hold EPA; by date alone epa-perm is #' . $dateRank);

$EPA8 = array('epa-perm', 'fi-epa-c', 'fi-epa', 'fi-epa-c-spoofer', 'hitratio', 'cdprop', 'cdawd', 'award_compare_monthdeptprimespon');
$BUDGET = sid_of(array(100, 101, 112, 103, 102, 111, 105, 104, 108, 107, 106, 110, 109));

// ---- the EPA case, both modes
$q = run_mode('quicksearch', 'EPA', 8);
order_is('Q-epa8', $q, $EPA8, ' (home / Quick actions: the 8 id/title hits, epa-perm first)');
$s = run_mode('search', 'EPA', 50);
t('S-epa50', $s['error'] === null && array_slice($s['ids'], 0, 8) === $EPA8 && count($s['ids']) === 50 && intval($s['total']) === 62,
  $s['what'] . ' -> first 8 ' . ($s['error'] !== null ? 'ERROR ' . $s['error'] : implode(',', array_slice($s['ids'], 0, 8))) . ', ' . count($s['ids']) . ' rows of total_count ' . $s['total']);
// ---- every tier, both modes (no owner-by-name for "budget")
order_is('S-tiers', run_mode('search', 'budget', 50), $BUDGET, ' (tiers 0..5, each newest first)');
order_is('Q-tiers', run_mode('quicksearch', 'budget', 50), $BUDGET, ' (the same order in quicksearch)');
// ---- owner by name: quicksearch ranks it with the owner (4); the search has no such surface
order_is('Q-ownername', run_mode('quicksearch', 'smith', 50), array('smith-report', 'plan-j', 'plan-k'), ' (id 1, owner-by-name 4, SQL 5)');
order_is('S-ownername', run_mode('search', 'smith', 50), array('smith-report', 'plan-k'), ' (no owner-by-name in MODE search)');
// ---- the term is literal
order_is('S-escape-dot', run_mode('search', 'a.b', 50), array('a.b', 'q-thing', 'axb-tool'), ' (a regex-escaped "a.b": AXB is no word start)');
$paren = run_mode('quicksearch', '(epa', 8);
t('Q-escape-paren', $paren['error'] === null && isset($paren['ids'][0]) && $paren['ids'][0] === 'epa-perm', $paren['what'] . ' -> ' . show($paren) . ' (an unbalanced paren is ORA-12725 unless escaped)');
order_is('S-literal', run_mode('search', 'fy_budget', 50), array('fy_budget_x', 'fy-budget'), ' (LIKE lets _ reach fy-budget; the rank is literal, so that wildcard hit sorts last)');
// ---- a non-admin under the discovery gate: id / title / tag only, and a rank with no owner or access list
order_is('S-nonadmin', run_mode('search', 'budget', 50, false, 'viewer1'), sid_of(array(100, 101, 112, 103, 102, 111, 105, 104, 108)), ' (viewer1: id/title tiers, then the tag hit)');
// ---- tag:NAME stays exact and newest-first, no rank
foreach (array('S-tag' => 'search', 'Q-tag' => 'quicksearch') as $aid => $m) {
    $r = run_mode($m, 'tag:budgeting', 50);
    $l = list_stmt($r);
    $noRank = $l && strpos($l['sql'], 'CASE WHEN') === false && !preg_grep('/rk\d|rn\d/', array_keys($l['binds']));
    t($aid, $r['error'] === null && $r['ids'] === array('plan-e', 'subbudgets') && $noRank, $r['what'] . ' -> ' . show($r) . ($noRank ? ', ORDER BY r.UPDATED_AT DESC alone' : ', the list is RANKED'));
}

// ---- the rank helper itself
if (!$rankFn) {
    foreach (array('R-helper', 'R-escape', 'R-fold', 'R-gate', 'R-long') as $aid) t($aid, false, 'penumbraReportSearchRankSql is not in the file');
} else {
    $h = penumbraReportSearchRankSql(true, 's', 'budget', true, array('jqs123'));
    preg_match_all('/THEN (\d+)/', $h['sql'], $th);
    t('R-helper', implode(',', $th[1]) === '0,1,2,3,4' && strpos($h['sql'], 'ELSE 5 END') !== false && strpos($h['sql'], 'CASE WHEN UPPER(TRIM(r.SHORT_ID)) = UPPER(:srk0) THEN 0') === 0,
      'tiers THEN ' . implode(',', $th[1]) . (strpos($h['sql'], 'ELSE 5 END') !== false ? ', ELSE 5' : ', no ELSE 5'));
    // every metacharacter escaped, nothing else (Oracle reads \d \w \s as classes, so letters must stay bare)
    $meta = '\\^$.|?*+()[]{}';
    $esc = function ($s) use ($meta) { $o = ''; for ($i = 0; $i < strlen($s); $i++) { $o .= (strpos($meta, $s[$i]) !== false ? '\\' : '') . $s[$i]; } return $o; };
    $cases = array('(epa', 'a.b*c+d?e|f^g$h[i]j{k}l\\m', 'Ab-1_%d w', 'x]y');
    $bad = array();
    foreach ($cases as $c) {
        $hb = penumbraReportSearchRankSql(true, 's', $c, false);
        $got = isset($hb['binds'][':srk2']) ? $hb['binds'][':srk2'] : null;
        if ($got !== $esc($c) || !isset($hb['binds'][':srk3']) || $hb['binds'][':srk3'] !== $esc($c)) $bad[] = $c . ' -> ' . var_export($got, true);
    }
    t('R-escape', !$bad, $bad ? 'wrong: ' . implode(' | ', $bad) : 'metacharacters escaped, letters / digits / - _ % space left alone (' . count($cases) . ' terms)');
    // Oracle folds: the binds hold the RAW term, every rank placeholder sits inside UPPER(...)
    $hf = penumbraReportSearchRankSql(true, 's', 'Budget', true, array('jqs123'));
    preg_match_all('/(.{6}):srk(\d)/', $hf['sql'], $pm);
    $raw = true; foreach (array('0', '1', '4', '5', '6', '7', '8') as $n) { if (!isset($hf['binds'][':srk' . $n]) || $hf['binds'][':srk' . $n] !== 'Budget') $raw = false; }
    $wrapped = count($pm[1]) >= 9 && count(array_unique($pm[1])) === 1 && $pm[1][0] === 'UPPER(';
    t('R-fold', $raw && $wrapped, ($raw ? 'binds hold the raw term' : 'a bind is pre-folded / missing') . ', ' . count($pm[1]) . ' placeholders ' . ($wrapped ? 'all inside UPPER(...)' : 'NOT all inside UPPER(...): ' . implode(' ', array_unique($pm[1]))));
    // the discovery gate: a non-admin's rank has no owner / access-list / owner-name surface
    $hn = penumbraReportSearchRankSql(false, 'q', 'budget', true, array('jqs123'));
    $ha = penumbraReportSearchRankSql(true, 'q', 'budget', true, array('jqs123'));
    $nonOk = strpos($hn['sql'], 'OWNER_ID') === false && strpos($hn['sql'], 'AUTHORIZED') === false && !preg_grep('/rk[67]|rn\d/', array_keys($hn['binds']));
    $admOk = strpos($ha['sql'], 'INSTR(UPPER(r.OWNER_ID)') !== false && strpos($ha['sql'], 'INSTR(UPPER(r.AUTHORIZED)') !== false && isset($ha['binds'][':qrn0']) && $ha['binds'][':qrn0'] === 'jqs123';
    t('R-gate', $nonOk && $admOk, 'non-admin ' . ($nonOk ? 'no owner / access list' : 'REACHES owner / access list') . '; admin ' . ($admOk ? 'owner, access list, owner-by-name' : 'MISSING a surface'));
    // a term whose escaped form passes 400 bytes binds no regex (Oracle: a pattern over 512 bytes is ORA-12733)
    $long = 'budget' . str_repeat('(', 250);
    $hl = penumbraReportSearchRankSql(true, 's', $long, true);
    $longRun = run_mode('search', $long, 50);
    $longOk = strpos($hl['sql'], 'WHEN 1=0 THEN 2') !== false && !isset($hl['binds'][':srk2']) && !isset($hl['binds'][':srk3']) && isset($h['binds'][':srk2']) && $longRun['error'] === null;
    t('R-long', $longOk, 'a ' . strlen($long) . '-char term: ' . (strpos($hl['sql'], 'WHEN 1=0 THEN 2') !== false ? 'no word tier' : 'a word tier') . ', regex binds ' . (isset($hl['binds'][':srk2']) ? 'BOUND' : 'none') . ', run ' . ($longRun['error'] === null ? 'clean' : 'ERROR ' . $longRun['error']));
}

// ---- OCI8's bind discipline over every statement the scenarios executed
$listBad = array(); $countBad = array(); $nList = 0; $nCount = 0;
foreach ($RUNS as $r) {
    foreach ($r['log'] as $e) {
        $hyg = ($e['error'] !== null && preg_match('/^ORA-010(36|08)/', $e['error'])) ? $e['error'] : null;
        if (strpos($e['sql'], 'SELECT COUNT(*)') === 0) {
            $nCount++;
            if ($hyg || preg_grep('/rk\d|rn\d/', array_keys($e['binds']))) $countBad[] = $r['what'] . ': ' . ($hyg ? $hyg : 'carries a rank bind');
        } else if (strpos($e['sql'], 'ORDER BY') !== false) {
            $nList++;
            if ($hyg) $listBad[] = $r['what'] . ': ' . $hyg;
        }
    }
}
t('B-list', $nList > 0 && !$listBad, $listBad ? implode(' | ', array_slice($listBad, 0, 3)) : "$nList list statements, every bind used, every placeholder bound");
t('B-count', $nCount > 0 && !$countBad, $countBad ? implode(' | ', array_slice($countBad, 0, 3)) : "$nCount search count statements, the WHERE's binds only (no rank bind = no ORA-01036)");
finish();
