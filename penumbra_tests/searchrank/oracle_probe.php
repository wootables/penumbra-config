<?php
// =============================================================================
// searchrank - the ORACLE half (2026-10-21). Builds ONE read-only statement that runs the
// rank CASE of penumbraReportSearchRankSql (lifted from --file) over fixture rows selected
// FROM DUAL, for a set of terms, and the tiers SQLite gives for the very same statement.
// Oracle and SQLite must agree row for row; Oracle is the one that can refuse a pattern
// (ORA-12725 / ORA-12733), and the one whose UPPER and [:alnum:] the app really uses.
//
// The binds become columns of a terms row: the CASE text is the endpoint's own with
// :Xrk0/1/4/5/6/7 -> t.TRM, :Xrk2/3 -> t.RX (the escaped term), :Xrn0 -> t.RN0 - a bind is a
// value, so the semantics are the same. No tags table (the console's allow-list has only
// DUAL here); a term too long for the word tier gets its own SELECT with that CASE.
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=pdo_sqlite
//       oracle_probe.php --file <get_server_reports.php>   -> {"sql": ..., "expected": [[T, SID, RK], ...]}
// Run the sql through query.php (an admin's console, no short_id) from a signed-in www3 tab
// and compare; README.md has the browser snippet.
// =============================================================================
$o = getopt('', array('file:'));
$src = str_replace("\r\n", "\n", (string)@file_get_contents(isset($o['file']) ? $o['file'] : ''));
function lift_fn($src, $name) {
    $tok = token_get_all($src); $n = count($tok);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tok[$i]) || $tok[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1; while ($j < $n && is_array($tok[$j]) && $tok[$j][0] === T_WHITESPACE) $j++;
        if (!($j < $n && is_array($tok[$j]) && $tok[$j][0] === T_STRING && $tok[$j][1] === $name)) continue;
        $buf = ''; $depth = 0; $started = false;
        for ($k = $i; $k < $n; $k++) {
            $buf .= is_array($tok[$k]) ? $tok[$k][1] : $tok[$k];
            if (!is_array($tok[$k]) && $tok[$k] === '{') { $depth++; $started = true; }
            else if (is_array($tok[$k]) && ($tok[$k][0] === T_CURLY_OPEN || $tok[$k][0] === T_DOLLAR_OPEN_CURLY_BRACES)) { $depth++; }
            else if (!is_array($tok[$k]) && $tok[$k] === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    return null;
}
$fn = lift_fn($src, 'penumbraReportSearchRankSql');
if (!$fn) { fwrite(STDERR, "no penumbraReportSearchRankSql in the file\n"); exit(2); }
function penumbraReportDiscoveryAllowed($isAdmin) { return (bool)$isAdmin; }
eval($fn);

function q($s) { return "'" . str_replace("'", "''", $s) . "'"; }
// fixture rows: ID, SHORT_ID, TITLE, OWNER_ID, AUTHORIZED
$rows = array(
    array(1, 'epa-perm', 'External Professional Activity (EPA) Permission Letters', 'owner1', 'public'),
    array(2, 'fi-epa-c', 'FI-EPA Proposals (current)', 'owner1', 'public'),
    array(5, 'cdprop', 'Proposals by College and Department', 'owner1', 'public'),
    array(9, 'sd01', 'Sponsored Data 01', 'owner1', 'public'),
    array(100, 'budget', 'Overall Plan', 'owner1', 'public'),
    array(101, 'budget-2026', 'Plan 2026', 'owner1', 'public'),
    array(111, 'fy_budget_x', 'Plan H', 'owner1', 'public'),
    array(102, 'fy-budget', 'Fiscal Plan', 'owner1', 'public'),
    array(103, 'plan-a', 'Annual Budget Review', 'owner1', 'public'),
    array(112, 'plan-i', 'Plan (Budget) I', 'owner1', 'public'),
    array(104, 'subbudgets', 'Sub plans', 'owner1', 'public'),
    array(105, 'plan-b', 'Overbudget Items', 'owner1', 'public'),
    array(106, 'plan-c', 'Plan C', 'budgetguy', 'public'),
    array(107, 'plan-d', 'Plan D', 'owner1', 'budgetteam,alice'),
    array(120, 'plan-j', 'Plan J', 'jqs123', 'public'),
    array(130, 'a.b', 'Dotted', 'owner1', 'public'),
    array(133, 'q-thing', 'Dotted a.b notes', 'owner1', 'public'),
    array(131, 'axb-tool', 'Axb Tool', 'owner1', 'public'),
    array(150, 'x]y', 'Bracket test', 'owner1', 'public'),
    array(151, 'q-x]y', 'Word q', 'owner1', 'public'),
    array(152, '{x}-report', 'Braces', 'owner1', 'public'),
    array(153, 'c++-guide', 'C++ Guide', 'owner1', 'public'),
    array(154, 'caf-x', 'Café Report', 'owner1', 'public'),
    array(155, 'x-cafe', 'Cafe plain', 'owner1', 'public'),
    array(156, 'a|b', 'Pipe a|b', 'owner1', 'public'),
);
$fix = array();
foreach ($rows as $i => $r) {
    $fix[] = $i === 0
        ? 'SELECT CAST(' . $r[0] . ' AS NUMBER) AS ID, CAST(' . q($r[1]) . ' AS VARCHAR2(100)) AS SHORT_ID, CAST(' . q($r[2]) . ' AS VARCHAR2(400)) AS TITLE, CAST(' . q($r[3]) . ' AS VARCHAR2(100)) AS OWNER_ID, CAST(' . q($r[4]) . ' AS VARCHAR2(400)) AS AUTHORIZED FROM DUAL'
        : 'SELECT ' . $r[0] . ', ' . q($r[1]) . ', ' . q($r[2]) . ', ' . q($r[3]) . ', ' . q($r[4]) . ' FROM DUAL';
}
$fixSql = '(' . implode(' UNION ALL ', $fix) . ') r';
$terms = array('EPA', 'budget', 'a.b', '(epa', 'x]y', '{x}', 'c++', 'café', 'fy_budget', 'a|b', 'smith');
$tr = array(); $tid = 0;
foreach ($terms as $i => $t) {
    $h = penumbraReportSearchRankSql(true, 's', $t, false, array('jqs123'));
    $rx = $h['binds'][':srk2'];
    $tr[] = $i === 0
        ? 'SELECT CAST(' . ($i + 1) . ' AS NUMBER) AS T, CAST(' . q($t) . ' AS VARCHAR2(400)) AS TRM, CAST(' . q($rx) . ' AS VARCHAR2(400)) AS RX, CAST(' . q('jqs123') . ' AS VARCHAR2(100)) AS RN0 FROM DUAL'
        : 'SELECT ' . ($i + 1) . ', ' . q($t) . ', ' . q($rx) . ', ' . q('jqs123') . ' FROM DUAL';
}
$termSql = '(' . implode(' UNION ALL ', $tr) . ') t';
// the endpoint's CASE with each bind replaced by the terms row's column
$case = penumbraReportSearchRankSql(true, 's', 'probe', false, array('jqs123'));
$caseSql = preg_replace_callback('/:srk(\d)|:srn0/', function ($m) {
    if ($m[0] === ':srn0') return 't.RN0';
    return in_array($m[1], array('2', '3'), true) ? 't.RX' : 't.TRM';
}, $case['sql']);
// a term too long for the word tier: its own CASE (tier 2 is 1=0 there), its own literal
$long = 'budget' . str_repeat('(', 250);
$hl = penumbraReportSearchRankSql(true, 's', $long, false, array('jqs123'));
$longCase = preg_replace_callback('/:srk(\d)|:srn0/', function ($m) use ($long) { return $m[0] === ':srn0' ? q('jqs123') : q($long); }, $hl['sql']);
$sql = 'SELECT t.T, r.SHORT_ID AS SID, ' . preg_replace('/\s+/', ' ', $caseSql) . ' AS RK FROM ' . $fixSql . ' CROSS JOIN ' . $termSql
     . ' UNION ALL SELECT ' . (count($terms) + 1) . ', r.SHORT_ID, ' . preg_replace('/\s+/', ' ', $longCase) . ' FROM ' . $fixSql
     . ' ORDER BY 1, 2';

// the same statement in SQLite (PCRE standing in for Oracle's regex)
$db = new PDO('sqlite::memory:'); $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE DUAL (DUMMY TEXT)'); $db->exec("INSERT INTO DUAL VALUES ('X')");
$db->sqliteCreateFunction('REGEXP_LIKE', function ($s, $p) { if ($s === null || $p === null) return null; $r = @preg_match('~' . str_replace('~', '\\~', (string)$p) . '~', (string)$s); if ($r === false) throw new Exception('pattern does not compile: ' . $p); return $r; }, 2);
$exp = array();
foreach ($db->query($sql)->fetchAll(PDO::FETCH_NUM) as $row) { $exp[] = array((int)$row[0], (string)$row[1], (int)$row[2]); }
$termsOut = $terms; $termsOut[] = 'budget + 250 x (';
echo json_encode(array('sql' => $sql, 'terms' => $termsOut, 'expected' => $exp, 'bytes' => strlen($sql)), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
