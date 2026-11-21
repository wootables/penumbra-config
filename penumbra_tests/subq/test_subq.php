<?php
/**
 * penumbra_tests/subq - the cross-database [SUBQUERY] / [CTE_SUBQUERY] tags (subqsweep, 2026-11-19).
 *
 * WHAT IS UNDER TEST - the REAL functions, lifted by tokenizer from the app's db_connection.php and
 * shared_logic.php (default: the live webroot; --app=DIR for a staged copy), plus source anchors in
 * query.php, index.php and schedule_runner.php:
 *   1. penumbraFindSubqueryTags: one pass, tags in -- / block comments, '...' / q'[...]' literals and
 *      "..." identifiers skipped; [PROMPT]/[IMPORT]/[T-SQL ids] stepped over; prev_char for the IN wrap;
 *      transport= before db=; exact offsets. extractSubqueryTags (IMPORT) still works.
 *   2. penumbraOffsetInMssqlTag (dates inside pins/infoed tags), penumbraSqlStackedStatement (one SQL
 *      Server statement), penumbraSelectListNames, penumbraGateDropCteReads, penumbraSubqueryErrorMessage
 *      (dialect hint only on database errors), penumbraSubqueryTransportPref (JSON default).
 *   3. executeSubqueryLogic END TO END against fake Oracle / SQL Server connections that obey the row
 *      limits injected into the SQL: never-silent limits on both lanes, the author's own TOP / FETCH /
 *      OFFSET..FETCH, empty IN = empty subquery, CHAR padding trimmed, JSON NUMBER typing from the
 *      values, typed empty CTEs, Oracle DATEs with their time (session format switched and RESTORED),
 *      the allow-list without raw-text excuses, stacked statements refused.
 *   4. Structural anchors: query.php's one-pass loop, prev_char wrap, early in-flight slot, gate CTE
 *      reads at both sites, literal-safe prefix strip, extractor-based dialect detection; index.php no
 *      longer runs tags; ?json=1 and the scheduler format dates inside SQL Server tags.
 *
 *   php.exe -n test_subq.php [--app=DIR] [--control] [--mutant=NAME] [--mutants]
 *
 * The fixture cache/ddl_oracle.txt (ALC_SRAR.AMOUNT_TOTAL NUMBER) is read by the lifted
 * executeSubqueryLogic through __DIR__ (this folder) for the JSON typing checks.
 * --control adds one false assertion (must FAIL). --mutant=NAME re-introduces one old bug into the
 * lifted source; --mutants runs every mutant in a child process and requires each to turn red (and
 * its anchor to be found). EXPECTED TAIL: "PASS 80   FAIL 0" (and "MUTANTS 12/12 BITE" with
 * --mutants). A smaller pass count is a failure too.
 */
$APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$CONTROL = false; $MUTANT = null; $RUN_MUTANTS = false;
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--app=') === 0) $APP = rtrim(substr($a, 6), '\\/');
    elseif ($a === '--control') $CONTROL = true;
    elseif (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
    elseif ($a === '--mutants') $RUN_MUTANTS = true;
}
ini_set('log_errors', '1');
ini_set('error_log', sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'penumbra_subq_test.log');

$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}

// ------------------------------------------------------------------ mutants (one old bug each)
// name => array(file key, exact anchor in the CURRENT source, replacement). A missing anchor is STALE.
$MUTANTS = array(
  'silentcap'   => array('S', "            if (\$useJsonLane) {\n                throw new Exception(\n                    \"Subquery returned more than {\$capN} rows (the cross-database transport ceiling). \"",
                                "            break;\n            if (\$useJsonLane) {\n                throw new Exception(\n                    \"Subquery returned more than {\$capN} rows (the cross-database transport ceiling). \""),
  'literalcap'  => array('S', "    \$laneCap = \$useJsonLane ? \$hardCeiling : \$defaultCap;", "    \$laneCap = \$defaultCap;"),
  'aliasexcuse' => array('S', "    \$subqueryTables = penumbraExtractSqlTables(\$sqlQuery);\n",
                                "    \$subqueryTables = penumbraExtractSqlTables(\$sqlQuery);\n    preg_match_all('/\\b([a-zA-Z0-9_]+)\\s+AS\\s*\\(/i', \$sqlQuery, \$cteAliasesM); if (!empty(\$cteAliasesM[1])) { \$subqueryTables = array_diff(\$subqueryTables, array_map('strtoupper', \$cteAliasesM[1])); }\n"),
  'comments'    => array('S', "            if (\$nx === '-') {\n                \$e = strpos(\$sql, \"\\n\", \$i);", "            if (false) {\n                \$e = strpos(\$sql, \"\\n\", \$i);"),
  'prevchar'    => array('S', "            \$seg = rtrim(substr(\$sql, \$i, \$skip));", "            \$seg = substr(\$sql, \$i, \$skip);"),
  'emptyin'     => array('S', "            return (\$targetDb === 'mssql') ? \"SELECT NULL WHERE 1=0\" : \"SELECT NULL FROM dual WHERE 1=0\";", "            return \"NULL\";"),
  'nametyping'  => array('S', "                                    \$forceStringCol[\$col] = true;\n                                    \$ddlResolvedCols[\$col] = true;\n                                }",
                                "                                    \$forceStringCol[\$col] = true;\n                                }\n                                \$ddlResolvedCols[\$col] = true;"),
  'stacked'     => array('D', "        if (strpos(\$s, ';') !== false) return ';';", "        return null;"),
  'chartrim'    => array('S', "                if (\$sourceDbType === 'mssql' && substr(\$cv, -1) === ' ') {", "                if (false) {"),
  'daterestore' => array('S', "                \$conn->exec(\"ALTER SESSION SET NLS_DATE_FORMAT = '\" . \$pnbDateRestore . \"'\");", "                // restore removed"),
  'offsetfetch' => array('S', "        \$ownLimiter = \$tailOffsetFetch || (\$startsWithWith", "        \$ownLimiter = (\$startsWithWith"),
  'literaldefault' => array('S', "    return (\$g === 'literal') ? 'literal' : 'json';", "    return (\$g === 'json') ? 'json' : 'literal';"),
);

if ($RUN_MUTANTS) {
    $bite = 0; $n = 0;
    foreach (array_keys($MUTANTS) as $m) {
        $n++;
        $cmd = array(PHP_BINARY, '-n', __FILE__, '--app=' . $APP, '--mutant=' . $m);
        $p = proc_open($cmd, array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, null, null, array('bypass_shell' => true));
        $out = stream_get_contents($pipes[1]); stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
        if (preg_match('/MUTANT-STALE/', $out)) { echo "  STALE     $m (anchor not found)\n"; continue; }
        if (preg_match('/PASS (\d+)\s+FAIL (\d+)/', $out, $mm) && (int)$mm[2] > 0) { $bite++; echo "  BITES     $m (" . $mm[2] . " red)\n"; }
        else { echo "  SURVIVES  $m\n" . substr($out, -300) . "\n"; }
    }
    echo "\nMUTANTS $bite/$n BITE\n";
    exit($bite === $n ? 0 : 1);
}

// ------------------------------------------------------------------ lift
$SRC = array(
    'D' => @file_get_contents($APP . DIRECTORY_SEPARATOR . 'db_connection.php'),
    'S' => @file_get_contents($APP . DIRECTORY_SEPARATOR . 'shared_logic.php'),
    'Q' => @file_get_contents($APP . DIRECTORY_SEPARATOR . 'query.php'),
    'I' => @file_get_contents($APP . DIRECTORY_SEPARATOR . 'index.php'),
    'R' => @file_get_contents($APP . DIRECTORY_SEPARATOR . 'schedule_runner.php'),
);
foreach ($SRC as $k => $v) { if (!is_string($v) || $v === '') { echo "FATAL: cannot read $k under $APP\n"; exit(2); } }
if ($MUTANT !== null) {
    if (!isset($MUTANTS[$MUTANT])) { echo "unknown mutant; known: " . implode(', ', array_keys($MUTANTS)) . "\n"; exit(2); }
    list($fk, $anchor, $repl) = $MUTANTS[$MUTANT];
    if (substr_count($SRC[$fk], $anchor) !== 1) { echo "MUTANT-STALE $MUTANT\n"; exit(3); }
    $SRC[$fk] = str_replace($anchor, $repl, $SRC[$fk]);
}

function lift_function($src, $name) {
    $toks = token_get_all($src); $n = count($toks);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($toks[$i]) || $toks[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($toks[$j]) && $toks[$j][0] === T_WHITESPACE) $j++;
        if (!is_array($toks[$j]) || $toks[$j][0] !== T_STRING || $toks[$j][1] !== $name) continue;
        $buf = ''; $depth = 0; $started = false;
        for ($k = $i; $k < $n; $k++) {
            $t = $toks[$k]; $txt = is_array($t) ? $t[1] : $t; $buf .= $txt;
            if ($txt === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    echo "FATAL: could not lift function $name\n"; exit(2);
}
function lift_class($src, $name) {
    if (!preg_match('/\nclass\s+' . preg_quote($name, '/') . '\b[^{]*\{/', $src, $m, PREG_OFFSET_CAPTURE)) { echo "FATAL: class $name\n"; exit(2); }
    $start = $m[0][1] + 1; $depth = 0;
    for ($i = $start; $i < strlen($src); $i++) {
        if ($src[$i] === '{') $depth++;
        elseif ($src[$i] === '}') { $depth--; if ($depth === 0) return substr($src, $start, $i - $start + 1); }
    }
    echo "FATAL: class $name unclosed\n"; exit(2);
}
foreach (array('penumbraHiddenAllowList', 'penumbraSqlReadsColumnStats', 'penumbraSqlScrub', 'penumbraSqlForbiddenFunction',
               'penumbraExtractSqlTablesUncached', 'penumbraSqlStackedStatement') as $f) {
    eval(lift_function($SRC['D'], $f));
}
function penumbraExtractSqlTables($s) { return penumbraExtractSqlTablesUncached($s); }
eval(lift_class($SRC['S'], 'PenumbraClobBind'));
// (2026-11-20, promptfix4 Z1) resolveParamDateExpression writes Oracle literals through penumbraOracleDateLiteral /
// penumbraOracleRRYear and reads an MS-SQL DD-MON-YY through penumbraDateRangeParseEnd (RR): lifted when present.
foreach (array('penumbraOracleDateLiteral', 'penumbraOracleRRYear', 'penumbraDateRangeParseEnd') as $f) {
    if (preg_match('/\nfunction ' . $f . '\(/', $SRC['S'])) eval(lift_function($SRC['S'], $f));
}
foreach (array('extractSubqueryTags', 'penumbraTagCloseAt', 'penumbraSubqueryTagFields', 'penumbraFindSubqueryTags',
               'penumbraOffsetInMssqlTag', 'penumbraSelectListNames', 'penumbraGateDropCteReads', 'penumbraSubqueryErrorMessage',
               'penumbraSubqueryTransportPref', 'penumbraOciSessionDateFormat', 'penumbraPrepareSubqueryStmt', 'penumbraNormalizeUtf8',
               'penumbraOracleLiteralBody', 'penumbraUtf8SafeCut', 'penumbraBuildOracleJsonRowset', 'resolveParamDateExpression',
               'executeSubqueryLogic') as $f) {
    eval(lift_function($SRC['S'], $f));
}

// ------------------------------------------------------------------ fake connections
class PenumbraOciConnection {}   // the shim's class name, for executeSubqueryLogic's instanceof
class FakeStmt {
    public $sql; public $rows; public $meta; private $i = 0;
    function __construct($sql, $rows, $meta) { $this->sql = $sql; $this->rows = $rows; $this->meta = $meta; }
    function bindValue($k, $v) { return true; }
    function execute() { return true; }
    function fetch($mode = null) { return ($this->i < count($this->rows)) ? $this->rows[$this->i++] : false; }
    function fetchColumn($c = 0) { $r = $this->fetch(); return $r === false ? false : reset($r); }
    function columnCount() { return count($this->meta); }
    function getColumnMeta($i) { return isset($this->meta[$i]) ? $this->meta[$i] : false; }
}
/** Emulates the database's own row limit: the smallest TOP n / FETCH FIRST n / FETCH NEXT n / ROWNUM <= n in the SQL. */
function fake_limit($sql) {
    $lim = PHP_INT_MAX;
    if (preg_match_all('/\b(?:TOP\s*\(?\s*|FETCH\s+(?:FIRST|NEXT)\s+|ROWNUM\s*<=\s*)(\d+)/i', $sql, $m)) {
        foreach ($m[1] as $v) { $lim = min($lim, (int)$v); }
    }
    return $lim;
}
trait FakeConnBody {
    public $label; public $log = array();
    function __construct($label) { $this->label = $label; }
    function pnbLabel() { return $this->label; }
    function prepare($sql) {
        $this->log[] = 'PREPARE ' . $sql;
        $rows = $GLOBALS['SCEN_ROWS'];
        $lim = fake_limit($sql);
        if ($lim < count($rows)) $rows = array_slice($rows, 0, $lim);
        if (isset($GLOBALS['SCEN_DATEFMT_LIVE']) && $GLOBALS['SCEN_DATEFMT_LIVE'] !== 'YYYY-MM-DD HH24:MI:SS') {
            // the session is NOT in ISO format: DATE columns come back DD-MON-RR, as the real driver does
            foreach ($rows as &$r) { foreach ($GLOBALS['SCEN_DATECOLS'] as $dc) { if (isset($r[$dc])) $r[$dc] = strtoupper(date('d-M-y', strtotime($r[$dc]))); } }
            unset($r);
        }
        return new FakeStmt($sql, $rows, $GLOBALS['SCEN_META']);
    }
    function exec($sql) {
        $this->log[] = 'EXEC ' . $sql;
        if (preg_match("/NLS_DATE_FORMAT = '([^']*)'/", $sql, $m)) $GLOBALS['SCEN_DATEFMT_LIVE'] = $m[1];
        return 0;
    }
    function query($sql) { $this->log[] = 'QUERY ' . $sql; return new FakeStmt($sql, array(array('VALUE' => 'DD-MON-RR')), array()); }
}
class FakeOci extends PenumbraOciConnection { use FakeConnBody; }
class FakeMs { use FakeConnBody; }
$CONN = array('ieprd' => new FakeOci('ieprd'), 'fin' => new FakeOci('fin'), 'hr' => new FakeOci('hr'), 'pins' => new FakeMs('pins'), 'infoed' => new FakeMs('infoed'));
function connectOracle() { return $GLOBALS['CONN']['ieprd']; }
function connectFin()    { return $GLOBALS['CONN']['fin']; }
function connectHr()     { return $GLOBALS['CONN']['hr']; }
function connectPins()   { return $GLOBALS['CONN']['pins']; }
function connectInfoEd() { return $GLOBALS['CONN']['infoed']; }

$oracleTableNames = array('T1', 'ALC_SRAR', 'REPORTER_REQUIREMENT_STATUS');
$finTableNames = array('PS_NC_PROJECT_GR');
$hrTableNames = array();
$pinsTableNames = array('COLLEGES', 'PERSONNEL');
$infoEdTableNames = array('PROPOSAL');
$penumbra_subquery_default_cap = 3;      // small limits so the suite runs fast; the lane logic is identical
$penumbra_subquery_hard_ceiling = 5;
$GLOBALS['SCEN_DATECOLS'] = array();

/** Runs executeSubqueryLogic on a scenario; returns array(result|null, exception message|null, connection log, binds). */
function sq($db, $sql, $format, $target, $rows, $meta = array(), $json = true, $pref = null) {
    $GLOBALS['SCEN_ROWS'] = $rows; $GLOBALS['SCEN_META'] = $meta;
    $GLOBALS['SCEN_DATEFMT_LIVE'] = 'DD-MON-RR';
    $GLOBALS['penumbra_sq_tagseq'] = 0;
    $key = strtolower($db) === 'oracle' ? 'ieprd' : strtolower($db);
    if (isset($GLOBALS['CONN'][$key])) $GLOBALS['CONN'][$key]->log = array();
    $binds = $json ? array() : null;
    $res = null; $err = null;
    try {
        if ($json) { $res = executeSubqueryLogic($db, $sql, $format, $target, null, $binds, $pref); }
        else { $nb = null; $res = executeSubqueryLogic($db, $sql, $format, $target, null, $nb, $pref); }
    } catch (Exception $e) { $err = $e->getMessage(); }
    $log = isset($GLOBALS['CONN'][$key]) ? $GLOBALS['CONN'][$key]->log : array();
    return array($res, $err, $log, $binds);
}
function rowsN($n, $col = 'X') { $r = array(); for ($i = 1; $i <= $n; $i++) $r[] = array($col => (string)$i); return $r; }
function preparedSql($log) { foreach ($log as $l) if (strpos($l, 'PREPARE ') === 0) return substr($l, 8); return ''; }

// ================================================================== 1. tag finder
echo "=== TAG FINDER ===\n";
$sql = "WITH a AS ([CTE_SUBQUERY;db=pins;query=SELECT [prop no] AS P FROM T WHERE x = 'it''s ]' -- c ]\n])\n"
     . "-- [SUBQUERY;db=ieprd;query=SELECT 1 FROM DUAL]\n"
     . "/* [SUBQUERY;db=ieprd;query=SELECT 2 FROM DUAL] */\n"
     . "SELECT * FROM a WHERE p IN (\n  -- note\n  [SUBQUERY;db=ieprd;query=SELECT X FROM T2]\n) AND q = 'see [SUBQUERY;db=hr;query=SELECT Y FROM T3]'\n"
     . " AND r NOT IN [SUBQUERY;db=fin;transport=json;query=SELECT Z FROM T4] AND s = q'[it's [SUBQUERY;db=hr;query=SELECT 9 FROM DUAL]]'"
     . " AND \"[SUBQUERY;db=hr;query=x]\" = 1 AND [PROMPT;label=PI's;x=1] = 1"
     . " AND t IN ( [ SUBQUERY ; transport=json; db=hr ; query=SELECT W FROM T5 ] )";
$t = penumbraFindSubqueryTags($sql);
ok(count($t) === 4, 'four live tags, five dead ones skipped (got ' . count($t) . ')');
ok(isset($t[0]) && $t[0]['type'] === 'CTE_SUBQUERY' && $t[0]['db'] === 'pins' && strpos($t[0]['query'], "it''s ]'") !== false, 'CTE tag with ] in a string and a comment');
ok(isset($t[0]) && $t[0]['prev_char'] === '(', 'CTE prev_char (');
ok(isset($t[1]) && $t[1]['query'] === 'SELECT X FROM T2' && $t[1]['prev_char'] === '(', 'IN ( -- note + newline before the tag: prev_char (');
ok(isset($t[2]) && $t[2]['db'] === 'fin' && $t[2]['transport'] === 'json' && $t[2]['prev_char'] === 'N', 'NOT IN bare tag: prev_char N');
ok(isset($t[3]) && $t[3]['db'] === 'hr' && $t[3]['transport'] === 'json' && $t[3]['query'] === 'SELECT W FROM T5', 'transport= before db=, spaced opener');
$allExact = true; foreach ($t as $x) { if (substr($sql, $x['offset'], strlen($x['full_tag'])) !== $x['full_tag']) $allExact = false; }
ok($allExact, 'offsets exact');
ok(penumbraFindSubqueryTags('SELECT 1 FROM DUAL') === array(), 'no tags');
ok(count(penumbraFindSubqueryTags("SELECT [PI's Name] FROM T WHERE k IN [SUBQUERY;db=pins;query=SELECT k FROM U]")) === 1, 'T-SQL [identifier] with an apostrophe does not open a string');
$imp = extractSubqueryTags("SELECT * FROM [IMPORT;name=abc;cols=a,b] x", 'IMPORT');
ok(count($imp) === 1 && $imp[0]['params']['name'] === 'abc', 'extractSubqueryTags still reads IMPORT tags');
$s2 = "SELECT * FROM X WHERE d = '19-NOV-26' AND k IN [SUBQUERY;db=infoed;query=SELECT k FROM T WHERE d > '19-NOV-26']";
ok(penumbraOffsetInMssqlTag($s2, strpos($s2, "'19-NOV-26'")) === false, 'outer date: not in a SQL Server tag');
ok(penumbraOffsetInMssqlTag($s2, strrpos($s2, "'19-NOV-26'")) === true, 'date inside an infoed tag');
ok(resolveParamDateExpression('19-NOV-26', 'mssql') === '2026-11-19', 'SQL Server date form');

echo "=== HELPERS ===\n";
ok(penumbraSqlStackedStatement("SELECT 1 AS X; UPDATE T SET a = 1") === ';', 'stacked: semicolon');
ok(penumbraSqlStackedStatement("SELECT 1 AS X EXEC dbo.p") === 'EXEC', 'stacked: EXEC without semicolon');
ok(penumbraSqlStackedStatement("SELECT 1 AS X DECLARE @a INT") === 'DECLARE', 'stacked: DECLARE');
ok(penumbraSqlStackedStatement("SELECT a INTO #t FROM T") === 'INTO', 'stacked: SELECT INTO');
ok(penumbraSqlStackedStatement("SELECT a FROM T;") === null, 'trailing ; allowed');
ok(penumbraSqlStackedStatement(";WITH c AS (SELECT 1 AS x) SELECT * FROM c") === null, 'leading ;WITH allowed');
ok(penumbraSqlStackedStatement("SELECT [Update], 'delete; it' AS n FROM T -- drop table x;\n INNER MERGE JOIN U ON 1=1 OPTION (USE HINT('X'))") === null, 'keywords in names, strings, comments and hints allowed');
ok(penumbraSqlStackedStatement("SELECT a FROM T ORDER BY a OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY") === null, 'OFFSET .. FETCH allowed');
ok(penumbraSelectListNames("SELECT TOP 5 a.COLLEGE_OUC, b.[College Name], c.x AS Y, 'q' Z FROM T") === array('COLLEGE_OUC', 'College Name', 'Y', 'Z'), 'select-list names');
ok(penumbraSelectListNames("WITH q AS (SELECT a FROM T) SELECT DISTINCT q.a AS AA, CAST(b AS INT) BB FROM q") === array('AA', 'BB'), 'select-list names: main SELECT of a WITH');
ok(penumbraSelectListNames("SELECT * FROM T") === array() && penumbraSelectListNames("SELECT COUNT(*) FROM T") === array(), 'unnamed items fall back');
$jsonSql = "WITH a AS (SELECT jt.* FROM JSON_TABLE(:sq1doc, '\$[*]' COLUMNS (\"X\" NUMBER PATH '\$.c0')) jt), b AS (SELECT jt.* FROM JSON_TABLE(:sq2doc, '\$[*]' COLUMNS (\"Y\" VARCHAR2(4000) PATH '\$.c0')) jt) SELECT a.X FROM a JOIN b ON 1=1";
$kw = preg_replace('/\b(?:FROM|JOIN|APPLY)\s*\(/i', ' (', preg_replace('/\b(?:FROM|JOIN|APPLY)\s+JSON_TABLE\s*\(/i', ' (', penumbraSqlScrub($jsonSql)));
ok(preg_match('/\b(?:FROM|JOIN|APPLY)\b/i', penumbraGateDropCteReads($kw)) === 0, 'gate: reads of the statement\'s own JSON CTEs pass');
ok(preg_match('/\bJOIN\s+SECRET_T/i', penumbraGateDropCteReads(penumbraSqlScrub("WITH a AS (SELECT 1 AS X FROM DUAL) SELECT * FROM a JOIN secret_t ON 1=1 -- secret_t AS ("))) === 1, 'gate: a real name survives, a comment defines nothing');
ok(strpos(penumbraSubqueryErrorMessage('SUBQUERY', 'pins', 'Subquery returned more than 50,000 rows (x).'), 'Hint:') === false, 'no dialect hint on a row limit');
ok(strpos(penumbraSubqueryErrorMessage('SUBQUERY', 'pins', "Security Violation: Access to table 'X'"), 'Hint:') === false, 'no dialect hint on a security refusal');
ok(strpos(penumbraSubqueryErrorMessage('SUBQUERY', 'fin', 'ORA-00942: table or view does not exist'), 'Hint:') !== false, 'dialect hint on ORA-');
ok(strpos(penumbraSubqueryErrorMessage('SUBQUERY', 'pins', "SQLSTATE[42000]: [SQL Server]Incorrect syntax near 'x'"), 'Hint:') !== false, 'dialect hint on a T-SQL error');
ok(penumbraSubqueryTransportPref('') === 'json' && penumbraSubqueryTransportPref('literal') === 'literal' && penumbraSubqueryTransportPref('json') === 'json', 'JSON is the default transport');

// ================================================================== 3. executeSubqueryLogic end to end
echo "=== LIMITS (cap 3 literal / ceiling 5 JSON in this suite) ===\n";
list($r, $e, $log) = sq('ieprd', 'SELECT X FROM T1', 'cte', 'oracle', rowsN(5), array(), true);
ok($e === null && strpos($r, 'JSON_TABLE') !== false, 'JSON lane carries up to the ceiling (5 rows)');
ok(preg_match('/FETCH FIRST 6 ROWS ONLY\s*$/', preparedSql($log)) === 1, 'JSON lane asks the database for ceiling + 1 rows');
list($r, $e) = sq('ieprd', 'SELECT X FROM T1', 'cte', 'oracle', rowsN(6), array(), true);
ok($e !== null && strpos($e, 'more than 5 rows') !== false && strpos($e, 'transport ceiling') !== false, 'JSON lane past the ceiling: loud');
list($r, $e, $log) = sq('ieprd', 'SELECT X FROM T1', 'cte', 'oracle', rowsN(3), array(), false);
ok($e === null && strpos($r, 'UNION ALL') !== false, 'literal lane (no bind pool) carries the cap (3 rows)');
ok(preg_match('/FETCH FIRST 4 ROWS ONLY\s*$/', preparedSql($log)) === 1, 'literal lane asks for cap + 1');
list($r, $e) = sq('ieprd', 'SELECT X FROM T1', 'cte', 'oracle', rowsN(4), array(), false);
ok($e !== null && strpos($e, 'most the literal transport carries') !== false, 'literal lane past the cap: loud, names transport=literal');
list($r, $e) = sq('ieprd', 'SELECT X FROM T1', 'cte', 'oracle', rowsN(4), array(), true, 'literal');
ok($e !== null && strpos($e, 'most the literal transport carries') !== false, 'transport=literal past the cap: loud');
list($r, $e) = sq('ieprd', 'SELECT X FROM T1', 'cte', 'mssql', rowsN(4), array(), true);
ok($e !== null && strpos($e, 'SQL Server report') !== false, 'SQL Server outer query past the cap: loud, its own message');
list($r, $e, $log) = sq('pins', 'SELECT X FROM COLLEGES', 'cte', 'oracle', rowsN(4, 'X'), array(), true);
ok($e === null && strpos(preparedSql($log), 'TOP 6 ') !== false, 'SQL Server source: TOP ceiling + 1 injected');
list($r, $e, $log) = sq('ieprd', 'WITH w AS (SELECT X FROM T1) SELECT X FROM w', 'cte', 'oracle', rowsN(5), array(), true);
ok($e === null && strpos(preparedSql($log), "\n) WHERE ROWNUM <= 6") !== false, 'Oracle WITH: ROWNUM wrap on its own line');
echo "=== AUTHOR'S OWN LIMIT ===\n";
list($r, $e, $log) = sq('ieprd', "SELECT X FROM T1 FETCH FIRST 2 ROWS ONLY -- two\n", 'cte', 'oracle', rowsN(5), array(), true);
ok($e === null && substr_count(preparedSql($log), 'FETCH FIRST') === 1, 'FETCH FIRST with a trailing comment is the author\'s limit (no second FETCH)');
list($r, $e, $log) = sq('ieprd', "SELECT X FROM T1 FETCH FIRST :p1 ROWS ONLY", 'cte', 'oracle', rowsN(2), array(), true);
ok($e === null && substr_count(preparedSql($log), 'FETCH FIRST') === 1, 'FETCH FIRST :p1 is the author\'s limit');
list($r, $e, $log) = sq('pins', "SELECT X FROM COLLEGES ORDER BY 1 OFFSET 0 ROWS FETCH NEXT 2 ROWS ONLY", 'cte', 'oracle', rowsN(5), array(), true);
ok($e === null && stripos(preparedSql($log), 'TOP ') === false, 'T-SQL OFFSET .. FETCH: no TOP injected beside it');
list($r, $e) = sq('ieprd', "SELECT X FROM T1 FETCH FIRST 100 ROWS ONLY", 'cte', 'oracle', rowsN(6), array(), true);
ok($e !== null && strpos($e, 'transport ceiling') !== false, 'author limit above the ceiling: still loud past it');

echo "=== IN TAGS ===\n";
list($r, $e) = sq('ieprd', 'SELECT X FROM T1 WHERE 1 = 0', 'in', 'oracle', array(), array(), true);
ok($r === 'SELECT NULL FROM dual WHERE 1=0', 'empty IN tag: an empty subquery (NOT IN keeps every row)');
list($r, $e) = sq('pins', 'SELECT X FROM COLLEGES WHERE 1 = 0', 'in', 'mssql', array(), array(), true);
ok($r === 'SELECT NULL WHERE 1=0', 'empty IN tag on SQL Server');
list($r, $e) = sq('ieprd', 'SELECT X FROM T1', 'in', 'oracle', array(array('X' => null)), array(), true);
ok($r === 'SELECT NULL FROM dual WHERE 1=0', 'all-NULL IN tag: empty too');
list($r, $e) = sq('ieprd', 'SELECT X FROM T1', 'in', 'oracle', rowsN(2), array(), true);
ok($r === "'1','2'", 'IN values');

echo "=== VALUES ===\n";
list($r, $e) = sq('pins', 'SELECT PER_HR_ID AS H FROM PERSONNEL', 'cte', 'oracle', array(array('H' => '000005259 ')), array(), false);
ok($e === null && strpos($r, "'000005259'") !== false && strpos($r, "'000005259 '") === false, 'SQL Server CHAR padding trimmed (literal)');
list($r, $e) = sq('pins', 'SELECT PER_HR_ID AS H FROM PERSONNEL', 'in', 'oracle', array(array('H' => '000005259 ')), array(), true);
ok($r === "'000005259'", 'SQL Server CHAR padding trimmed (IN)');
list($r, $e, $log, $b) = sq('ieprd', "SELECT NVL(TO_CHAR(AMOUNT_TOTAL),'N/A') || ' USD' AS AMOUNT_TOTAL FROM ALC_SRAR", 'cte', 'oracle', array(array('AMOUNT_TOTAL' => '24996 USD')), array(), true);
ok($e === null && strpos($r, '"AMOUNT_TOTAL" VARCHAR2(4000)') !== false, 'JSON lane: a text alias named like a NUMBER column stays text');
list($r, $e, $log, $b) = sq('ieprd', "SELECT AMOUNT_TOTAL FROM ALC_SRAR", 'cte', 'oracle', array(array('AMOUNT_TOTAL' => '24996'), array('AMOUNT_TOTAL' => '.5')), array(), true);
ok($e === null && strpos($r, "\"AMOUNT_TOTAL\" NUMBER PATH '\$.c0' ERROR ON ERROR") !== false, 'JSON lane: numbers are NUMBER, ERROR ON ERROR');
$doc = null; if (is_array($b)) foreach ($b as $bv) { if ($bv instanceof PenumbraClobBind) $doc = $bv->data; }
ok($doc === '[{"c0":"24996"},{"c0":".5"}]', 'JSON payload');

echo "=== EMPTY CTE ===\n";
$metaOra = array(array('name' => 'N', 'native_type' => 'NUMBER'), array('name' => 'S', 'native_type' => 'VARCHAR2'), array('name' => 'D', 'native_type' => 'DATE'));
list($r, $e) = sq('fin', 'SELECT N, S, D FROM PS_NC_PROJECT_GR WHERE 1 = 0', 'cte', 'oracle', array(), $metaOra, true);
ok($r === 'SELECT CAST(NULL AS NUMBER) AS "N", CAST(NULL AS VARCHAR2(4000)) AS "S", CAST(NULL AS DATE) AS "D" FROM dual WHERE 1=0', 'empty Oracle CTE: typed NULL columns');
list($r, $e) = sq('pins', 'SELECT COLLEGE_OUC, COLLEGE_NAME FROM COLLEGES WHERE 1 = 0', 'cte', 'oracle', array(), array(), true);
ok($r === 'SELECT NULL AS "COLLEGE_OUC", NULL AS "COLLEGE_NAME" FROM dual WHERE 1=0', 'empty PINS CTE (no metadata): names from the SELECT list');

echo "=== DATES (Oracle source, Oracle outer query) ===\n";
$GLOBALS['SCEN_DATECOLS'] = array('D');
$metaD = array(array('name' => 'D', 'native_type' => 'DATE'), array('name' => 'X', 'native_type' => 'VARCHAR2'));
list($r, $e, $log) = sq('ieprd', 'SELECT D, X FROM T1', 'cte', 'oracle', array(array('D' => '2026-11-19 13:45:00', 'X' => 'a')), $metaD, false);
ok($e === null && strpos($r, "TO_DATE('2026-11-19 13:45:00', 'YYYY-MM-DD HH24:MI:SS') AS \"D\"") !== false, 'literal lane: DATE with its time');
$alter = array_values(array_filter($log, function ($l) { return strpos($l, 'EXEC ALTER SESSION') === 0; }));
ok(count($alter) === 2 && strpos($alter[0], "'YYYY-MM-DD HH24:MI:SS'") !== false && strpos($alter[1], "'DD-MON-RR'") !== false, 'session date format switched for the fetch and RESTORED');
ok($GLOBALS['SCEN_DATEFMT_LIVE'] === 'DD-MON-RR', 'session left in its own format');
list($r, $e, $log) = sq('ieprd', 'SELECT D, X FROM T1', 'cte', 'oracle', array(array('D' => '2026-11-19 13:45:00', 'X' => 'a')), $metaD, true);
ok($e === null && strpos($r, "TO_DATE(jt.\"D\", 'YYYY-MM-DD HH24:MI:SS') AS \"D\"") !== false, 'JSON lane: DATE with its time');
list($r, $e) = sq('ieprd', 'SELECT D, X FROM T1', 'cte', 'oracle', rowsN(6, 'D'), $metaD, true);
ok($e !== null && $GLOBALS['SCEN_DATEFMT_LIVE'] === 'DD-MON-RR', 'format restored even when the run fails loud');
list($r, $e, $log) = sq('ieprd', 'SELECT D, X FROM T1', 'cte', 'mssql', array(array('D' => '2026-11-19 13:45:00', 'X' => 'a')), $metaD, true);
ok(count(array_filter($log, function ($l) { return strpos($l, 'EXEC ALTER') === 0; })) === 0 && strpos($r, 'TO_DATE') === false && strpos($r, 'CONVERT(') === false, 'SQL Server outer query: dates keep the old text');
list($r, $e, $log) = sq('ieprd', 'SELECT D FROM T1', 'in', 'oracle', array(array('D' => '2026-11-19 13:45:00')), $metaD, true);
ok(count(array_filter($log, function ($l) { return strpos($l, 'EXEC ALTER') === 0; })) === 0, 'IN tags: session format untouched');
$GLOBALS['SCEN_DATECOLS'] = array();

echo "=== GATE ===\n";
list($r, $e) = sq('ieprd', "SELECT X FROM SECRET_T -- SECRET_T AS (\n", 'cte', 'oracle', rowsN(1), array(), true);
ok($e !== null && strpos($e, "Access to table 'SECRET_T'") !== false, 'a comment "NAME AS (" excuses nothing');
list($r, $e) = sq('ieprd', "WITH SECRET_T AS (SELECT X FROM T1) SELECT X FROM SECRET_T", 'cte', 'oracle', rowsN(1), array(), true);
ok($e === null, 'a real CTE name is not a table');
list($r, $e) = sq('pins', "SELECT 1 AS X; SELEC 2", 'cte', 'oracle', rowsN(1), array(), true);
ok($e !== null && strpos($e, "';' is not permitted") !== false, 'SQL Server source: a second statement refused');
list($r, $e) = sq('pins', "SELECT 1 AS X EXEC sp_who", 'cte', 'oracle', rowsN(1), array(), true);
ok($e !== null && strpos($e, "'EXEC' is not permitted") !== false, 'SQL Server source: EXEC refused');
list($r, $e) = sq('fin', "SELECT LISTAGG(X, ',' ON OVERFLOW TRUNCATE) WITHIN GROUP (ORDER BY X) AS L FROM PS_NC_PROJECT_GR", 'cte', 'oracle', array(array('L' => 'a')), array(), true);
ok($e === null, 'Oracle LISTAGG ON OVERFLOW TRUNCATE allowed');

// ================================================================== 4. structural anchors
echo "=== STRUCTURE ===\n";
$Q = $SRC['Q']; $I = $SRC['I']; $R = $SRC['R'];
ok(strpos($Q, '$pnbSqTags = penumbraFindSubqueryTags($query_template);') !== false, 'query.php: one pass over the author\'s SQL');
ok(strpos($Q, "extractSubqueryTags(\$query_template, 'SUBQUERY')") === false && strpos($Q, "extractSubqueryTags(\$query_template, 'CTE_SUBQUERY')") === false, 'query.php: no second extraction after CTE data is spliced in');
ok(strpos($Q, "\$tag['prev_char'] === '('") !== false, 'query.php: IN wrap reads prev_char');
ok(strpos($Q, '$penumbraInflightEarly = penumbraInflightAcquire(') !== false && strpos($Q, 'isset($penumbraInflightEarly) ? $penumbraInflightEarly') !== false, 'query.php: in-flight slot claimed before the tags and taken over');
ok(substr_count($Q, '= penumbraGateDropCteReads(') === 2, 'query.php: CTE reads dropped at both fail-closed fallbacks');
ok(strpos($Q, '$detected_tables = penumbraExtractSqlTables($query_for_detection);') !== false, 'query.php: dialect detection by the extractor');
ok(strpos($Q, "preg_replace('/\\b(dbo\\.|nc_reporting\\.|fs\\.)/i', '', \$query_template)") === false, 'query.php: no literal-blind prefix strip');
ok(strpos($Q, '$pnbPrefixStripped = preg_replace_callback(') !== false, 'query.php: literal-safe prefix strip');
ok(strpos($Q, 'penumbraSqlStackedStatement($query_template)') !== false, 'query.php: one statement on a SQL Server outer query');
ok(strpos($I, 'executeSubqueryLogic(') === false, 'index.php: ?json=1 runs no tag itself');
ok(strpos($I, 'penumbraOffsetInMssqlTag($sql, $offset)') !== false, 'index.php: dates inside SQL Server tags');
ok(strpos($R, 'penumbraOffsetInMssqlTag($sql, $tagOffset)') !== false, 'schedule_runner.php: dates inside SQL Server tags');

if ($CONTROL) { ok(false, 'CONTROL: this assertion must fail'); }
echo "\nPASS $pass   FAIL $fail\n";
exit($fail ? 1 : 0);
