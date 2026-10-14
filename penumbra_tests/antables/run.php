<?php
/**
 * METRICS TABLES TAB SUITE (2026-10-14): Platform Metrics' Tables tab.
 *
 *   A. penumbra_an_table_refs() - the metrics-side reading of a report's tables:
 *      connection placement in ROUTING order, prompt prose dropped (DATE/TODAY),
 *      SQL inside a literal scanned, TABLE.COLUMN / SCHEMA.TABLE, [IMPORT], DUAL,
 *      encrypted scope_tables, unknown names on '?'.
 *   B. penumbra_an_table_map() - re-reads only edited reports; a list change or
 *      a corrupt cache re-reads all; an unwritable cache path still answers.
 *   C. penumbra_an_tables_rollup() - multi-table reports count toward each table,
 *      Users DISTINCT across a table's reports, Opened / Errors / Last, idle
 *      reports listed, order.
 *   D. analytics_all.php wiring: tab button, TAB_NAMES, panel, the predicates
 *      match Most-Opened / Errors, and the shared JS data-csv / data-find hooks.
 *   E. the gate is untouched: penumbraExtractSqlTables / penumbraExtractReportTables
 *      byte-identical to --orig.
 *   F. (with --corpus=<PENUMBRA_REPORTS backup .jsonl.gz> --ddl=<app cache dir>)
 *      every live report: no DATE / TODAY / IMPORT / dotted names, and the
 *      prompt-literal report reads a table.
 *
 *   php -n run.php --app=<dir> --orig=<dir> [--corpus=..] [--ddl=..] [--control] [--mutant=1..4]
 *     --control   lift the helpers from --orig (they do not exist there) -> RED
 *     --mutant=1  prompt prose is not dropped        -> A red
 *     --mutant=2  literal SQL is not scanned         -> A red
 *     --mutant=3  the cache ignores UPDATED_AT       -> B red
 *     --mutant=4  Users summed, not distinct          -> C red
 *     --mutant=5  autofill TABLE.COLUMN kept dotted    -> A red
 */
error_reporting(E_ALL);
// Throws even under @ on purpose: the helpers must survive a handler that does.
set_error_handler(function ($no, $str, $file, $line) { throw new ErrorException($str, 0, $no, $file, $line); });
$opt = array('app' => '', 'orig' => '', 'corpus' => '', 'ddl' => '', 'control' => false, 'mutant' => 0);
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--app=') === 0) $opt['app'] = rtrim(substr($a, 6), '/\\');
    elseif (strpos($a, '--orig=') === 0) $opt['orig'] = rtrim(substr($a, 7), '/\\');
    elseif (strpos($a, '--corpus=') === 0) $opt['corpus'] = substr($a, 9);
    elseif (strpos($a, '--ddl=') === 0) $opt['ddl'] = rtrim(substr($a, 6), '/\\');
    elseif ($a === '--control') $opt['control'] = true;
    elseif (strpos($a, '--mutant=') === 0) $opt['mutant'] = (int)substr($a, 9);
}
if ($opt['app'] === '' || $opt['orig'] === '') { fwrite(STDERR, "--app=<dir> and --orig=<dir> are required\n"); exit(2); }
$APP = $opt['app'];
$PASS = 0; $FAIL = 0;
function ok($c, $l, $g = null) { global $PASS, $FAIL; if ($c) { $PASS++; echo "  ok   $l\n"; } else { $FAIL++; echo "  FAIL $l" . ($g !== null ? ' (got: ' . (is_string($g) ? $g : json_encode($g)) . ')' : '') . "\n"; } }
function section($s) { echo "\n== $s\n"; }
function lift($src, $names, $strict = true) {
    $t = token_get_all($src); $n = count($t); $out = ''; $found = array();
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && ((is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) || (!is_array($t[$j]) && $t[$j] === '&'))) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;
        $fname = $t[$j][1];
        if (!in_array($fname, $names, true) || in_array($fname, $found, true)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) { if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; $started = true; } $buf .= $tok[1]; }
            else { if ($tok === '{') { $depth++; $started = true; } elseif ($tok === '}') { $depth--; } $buf .= $tok; }
            if ($started && $depth === 0) break;
        }
        $out .= "if (!function_exists('$fname')) {\n$buf\n}\n"; $found[] = $fname;
    }
    $missing = array_diff($names, $found);
    if ($missing && $strict) { fwrite(STDERR, "MISSING from source: " . implode(', ', $missing) . "\n"); exit(2); }
    return array($out, $found);
}
function patch_once($hay, $from, $to, $label) { $c = substr_count($hay, $from); if ($c !== 1) { fwrite(STDERR, "patch '$label' anchor matched $c times\n"); exit(2); } return str_replace($from, $to, $hay); }

$GATE = array('penumbraExtractSqlTables', 'penumbraExtractSqlTablesUncached', 'penumbraExtractReportTables');
list($gateSrc) = lift(file_get_contents($APP . '/db_connection.php'), $GATE);
eval("?><?php\n" . $gateSrc);

$HELPERS = array('penumbra_an_table_refs', 'penumbra_an_tables_cache_file', 'penumbra_an_table_map', 'penumbra_an_tables_rollup', 'penumbra_an_conn_label');
$shSrc = file_get_contents(($opt['control'] ? $opt['orig'] : $APP) . '/analytics_shared.php');
list($hSrc, $hFound) = lift($shSrc, $HELPERS, !$opt['control']);
if ($opt['mutant'] === 1) $hSrc = patch_once($hSrc, "\$t = preg_replace('/\\b(?:message|", "\$t = \$m[0]; preg_replace('/\\b(?:message|", 'mutant1');
if ($opt['mutant'] === 2) $hSrc = patch_once($hSrc, "if (preg_match('/^\\s*(?:SELECT|WITH)\\b/i', \$lit)", "if (false && preg_match('/^\\s*(?:SELECT|WITH)\\b/i', \$lit)", 'mutant2');
if ($opt['mutant'] === 3) $hSrc = patch_once($hSrc, "&& \$cache[\$k]['u'] === (string)\$c['updated']", '', 'mutant3');
if ($opt['mutant'] === 4) $hSrc = patch_once($hSrc, "'users' => count(\$s['users']),", "'users' => array_sum(array_map(function (\$r) { return \$r['users']; }, \$reports)),", 'mutant4');
if ($opt['mutant'] === 5) $hSrc = patch_once($hSrc, "return preg_replace('/\\b(autofill", "return \$t; preg_replace('/\\b(autofill", 'mutant5');
if (!defined('PENUMBRA_AN_TABLES_V')) define('PENUMBRA_AN_TABLES_V', 'test');
eval("?><?php\n" . $hSrc);
$have = function_exists('penumbra_an_table_refs') && function_exists('penumbra_an_table_map') && function_exists('penumbra_an_tables_rollup');

$L = array('pins' => array('PERSONNEL' => true, 'SHARED_T' => true), 'infoed' => array('PROJMAIN' => true, 'FACULTY' => true),
           'hr' => array(), 'fin' => array(), 'ieprd' => array('STATS_COMBINED_V2' => true, 'COLLEGES' => true, 'SHARED_T' => true, 'COI_CHECK_COMPLIANCE' => true));
$st = function ($q) { return json_encode(array('query' => $q)); };
$keys = function ($refs) { $o = array(); foreach ($refs as $r) $o[] = $r['conn'] . ':' . $r['table']; sort($o); return $o; };
$R = function ($json) use ($have, $L, $keys) { return $have ? $keys(penumbra_an_table_refs($json, $L)) : array('(missing)'); };

section('A. penumbra_an_table_refs');
ok($R($st("SELECT * FROM STATS_COMBINED_V2 s JOIN PROJMAIN p ON 1=1")) === array('ieprd:STATS_COMBINED_V2', 'infoed:PROJMAIN'), 'two connections placed', $R($st("SELECT * FROM STATS_COMBINED_V2 s JOIN PROJMAIN p ON 1=1")));
ok($R($st("SELECT * FROM SHARED_T")) === array('pins:SHARED_T'), 'a name on two lists lands on the ROUTING winner (pins before ieprd)', $R($st("SELECT * FROM SHARED_T")));
$q = "SELECT * FROM STATS_COMBINED_V2 WHERE LOG_DATE >= [PROMPT;type=date;name=from_date;message=From date;forcedefault=3 years ago from today]";
ok($R($st($q)) === array('ieprd:STATS_COMBINED_V2'), 'prompt prose (message= / forcedefault=) adds no DATE / TODAY', $R($st($q)));
$q = "[PROMPT;type=select;noquote;options=a:'select pi_name from STATS_COMBINED_V2 fetch first 10 rows only',b:'select x from PROJMAIN']";
ok($R($st($q)) === array('ieprd:STATS_COMBINED_V2', 'infoed:PROJMAIN'), 'SQL inside a noquote option literal is read', $R($st($q)));
$q = "SELECT 1 FROM DUAL WHERE x = [PROMPT;type=text;name=u;autofill=UNLISTED_T.EMAIL]";
ok($R($st($q)) === array('?:UNLISTED_T'), 'autofill TABLE.COLUMN = TABLE even when TABLE is on no list', $R($st($q)));
$q = "SELECT 1 FROM DUAL WHERE x = [PROMPT;type=text;name=u;autofill=COI_CHECK_COMPLIANCE.EMAIL]";
ok($R($st($q)) === array('ieprd:COI_CHECK_COMPLIANCE'), 'autofill TABLE.COLUMN = TABLE; DUAL dropped', $R($st($q)));
ok($R($st("SELECT * FROM NC_REPORTING_X.COLLEGES")) === array('ieprd:COLLEGES'), 'SCHEMA.TABLE = TABLE', $R($st("SELECT * FROM NC_REPORTING_X.COLLEGES")));
$q = "SELECT * FROM STATS_COMBINED_V2 s LEFT JOIN [IMPORT; name=Copy_Of_Clients] i ON s.OUC = i.OUC";
ok($R($st($q)) === array('ieprd:STATS_COMBINED_V2', 'imports:COPY_OF_CLIENTS'), '[IMPORT; name=X] = import X, no table IMPORT', $R($st($q)));
$q = "SELECT * FROM [IMPORT; name='Quoted_One'] q";
ok($R($st($q)) === array('imports:QUOTED_ONE'), 'a quoted import name loses its quotes', $R($st($q)));
ok($R($st("SELECT * FROM MYSTERY_VIEW")) === array('?:MYSTERY_VIEW'), 'a name on no list goes to ?', $R($st("SELECT * FROM MYSTERY_VIEW")));
ok($R(json_encode(array('content' => 'opaque', 'scope_tables' => array('projmain', 'colleges')))) === array('ieprd:COLLEGES', 'infoed:PROJMAIN'), 'encrypted report: its scope_tables', $R(json_encode(array('content' => 'opaque', 'scope_tables' => array('projmain', 'colleges')))));
ok($R('') === array() && $R('null') === array() && $R('{"query":""}') === array(), 'empty / null / no query = nothing');
$q = "SELECT * FROM STATS_COMBINED_V2 WHERE NAME = 'from FACULTY'";
ok($R($st($q)) === array('ieprd:STATS_COMBINED_V2'), 'a plain string literal (not SQL) adds nothing', $R($st($q)));

section('B. penumbra_an_table_map (cache)');
$tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'antables_test_' . getmypid() . '.json';
if (is_file($tmp)) unlink($tmp);
$states = array(1 => $st("SELECT * FROM PROJMAIN"), 2 => $st("SELECT * FROM COLLEGES"));
$reads = array();
$reader = function ($ids) use (&$reads, &$states) { $reads[] = $ids; $o = array(); foreach ($ids as $i) $o[$i] = $states[$i]; return $o; };
$cat = array(1 => array('updated' => '2026-10-01 10:00:00'), 2 => array('updated' => '2026-10-02 10:00:00'));
if ($have) {
    $m1 = penumbra_an_table_map($cat, $reader, $L, $tmp);
    ok(count($reads) === 1 && $reads[0] === array(1, 2), 'first build reads every report', $reads);
    ok($keys($m1[1]) === array('infoed:PROJMAIN') && $keys($m1[2]) === array('ieprd:COLLEGES'), 'first build maps both');
    $reads = array();
    $m2 = penumbra_an_table_map($cat, $reader, $L, $tmp);
    ok($reads === array() && $m2 == $m1, 'second build: no reads, same map', $reads);
    $states[2] = $st("SELECT * FROM FACULTY"); $cat[2]['updated'] = '2026-10-14 09:00:00';
    $reads = array();
    $m3 = penumbra_an_table_map($cat, $reader, $L, $tmp);
    ok($reads === array(array(2)) && $keys($m3[2]) === array('infoed:FACULTY'), 'an edited report (new UPDATED_AT) is re-read, alone', $reads);
    $L2 = $L; $L2['hr'] = array('NEW_T' => true);
    $reads = array();
    penumbra_an_table_map($cat, $reader, $L2, $tmp);
    ok(count($reads) === 1 && $reads[0] === array(1, 2), 'a changed allow list re-reads everything', $reads);
    file_put_contents($tmp, '{not json');
    $reads = array();
    penumbra_an_table_map($cat, $reader, $L, $tmp);
    ok(count($reads) === 1 && count($reads[0]) === 2, 'a corrupt cache re-reads everything');
    $sub = $cat; unset($sub[2]); $reads = array();
    penumbra_an_table_map($sub, $reader, $L, $tmp);
    ok($reads === array(), 'a filtered (subset) catalogue reads nothing', $reads);
    $sub[1]['updated'] = '2026-10-14 10:00:00'; $reads = array();
    penumbra_an_table_map($sub, $reader, $L, $tmp);
    $reads = array();
    penumbra_an_table_map($cat, $reader, $L, $tmp);
    ok($reads === array(array(1)), 'a write from a filtered load keeps the other reports cached', $reads);
    $reads = array();
    $m4 = penumbra_an_table_map(array(1 => array('updated' => 'x')), $reader, $L, sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'no_such_dir_antables' . DIRECTORY_SEPARATOR . 'c.json');
    ok(isset($m4[1]) && $keys($m4[1]) === array('infoed:PROJMAIN'), 'an unwritable cache path still answers');
    ok(strpos(penumbra_an_tables_cache_file(), str_replace('/', DIRECTORY_SEPARATOR, rtrim(sys_get_temp_dir(), '/\\'))) === 0, 'the cache lives in the temp folder, outside the webroot', penumbra_an_tables_cache_file());
} else { ok(false, 'B: helpers missing'); }
if (is_file($tmp)) unlink($tmp);

section('C. penumbra_an_tables_rollup');
$cat = array(
    10 => array('short' => 'aa', 'title' => 'Alpha', 'owner' => 'o1', 'updated' => ''),
    11 => array('short' => 'bb', 'title' => 'Beta',  'owner' => 'o2', 'updated' => ''),
    12 => array('short' => 'cc', 'title' => 'Gamma', 'owner' => 'o3', 'updated' => ''),
);
$refs = array(
    10 => array(array('conn' => 'ieprd', 'table' => 'T1'), array('conn' => 'infoed', 'table' => 'P1')),
    11 => array(array('conn' => 'ieprd', 'table' => 'T1')),
    12 => array(array('conn' => 'ieprd', 'table' => 'T2'), array('conn' => '?', 'table' => 'ODD')),
);
$opens = array(
    array('RID' => 10, 'U' => 'amy', 'V' => 3, 'LAST_SEEN' => '2026-10-10 09:00'),
    array('RID' => 10, 'U' => 'bob', 'V' => 1, 'LAST_SEEN' => '2026-10-11 09:00'),
    array('RID' => 11, 'U' => 'AMY', 'V' => 2, 'LAST_SEEN' => '2026-10-12 09:00'),
    array('RID' => 99, 'U' => 'zed', 'V' => 9, 'LAST_SEEN' => '2026-10-13 09:00'),
);
$errs = array(10 => 2, 11 => 1);
if ($have) {
    $ru = penumbra_an_tables_rollup($cat, $refs, $opens, $errs);
    ok(array_keys($ru) === array('ieprd', 'infoed', '?'), 'connections in display order, ? last', array_keys($ru));
    $t1 = $ru['ieprd']['tables']['T1'];
    ok($t1['views'] === 6, 'T1 views = its two reports', $t1['views']);
    ok($t1['users'] === 2, 'T1 users DISTINCT across reports (amy twice, case-folded)', $t1['users']);
    ok($t1['opened'] === 2 && $t1['errors'] === 3 && $t1['last'] === '2026-10-12 09:00', 'T1 opened / errors / last', $t1);
    ok($ru['infoed']['tables']['P1']['views'] === 4, 'a two-table report counts toward EACH table');
    $t2 = $ru['ieprd']['tables']['T2'];
    ok($t2['views'] === 0 && $t2['opened'] === 0 && count($t2['reports']) === 1 && $t2['last'] === '', 'an idle report is still listed, at zero');
    ok(array_keys($ru['ieprd']['tables']) === array('T1', 'T2'), 'tables by views desc', array_keys($ru['ieprd']['tables']));
    ok($ru['ieprd']['reports'] === 3, 'card report count is distinct reports', $ru['ieprd']['reports']);
    ok($t1['reports'][0]['short'] === 'aa' && $t1['reports'][0]['users'] === 2, 'report list: busiest first, its own users');
    ok(!isset($ru['ieprd']['tables']['T1']['reports'][2]), 'a report off the catalogue (rid 99) never leaks in');
} else { ok(false, 'C: helpers missing'); }

section('D. analytics_all.php wiring');
$page = file_get_contents($APP . '/analytics_all.php');
ok(strpos($page, 'data-tab="tables"') !== false && strpos($page, 'aria-controls="panel-tables"') !== false, 'Tables tab button');
ok(strpos($page, "['overview','users','reports','tables','errors','activity','calendar']") !== false, 'TAB_NAMES carries tables (deep link #tables)');
ok(strpos($page, 'id="panel-tables"') !== false, 'Tables panel');
// Sweep 2026-10-14: the sort script overwrites every sortable th's title, so a
// column's meaning must live in the note; and calendar mode never builds the data.
preg_match('/<div class="panel" id="panel-tables".*?<\/thead>/s', $page, $tpm);
ok(isset($tpm[0]) && preg_match('/<th[^>]*data-sortable[^>]*title=/', $tpm[0]) === 0, 'no title on a sortable Tables header (the sorter would overwrite it)');
ok(isset($tpm[0]) && strpos($tpm[0], 'Opened = how many of those were opened in this date range') !== false, 'the note explains Reports / Opened / Users');
ok(strpos($page, "<?php if (!\$anReportScope && !\$anCalMode): /* Tables (2026-10-14)") !== false, 'calendar mode renders no Tables panel');
ok(preg_match('/a\.ACTION=\'OPEN\' \$sysSqlA \$timeFilterA \$whenFilterA \$exclSqlA \$userFilterA \$reportFilterA\s+GROUP BY a\.REPORT_ID, a\.USER_ID/', $page) === 1, 'opens: the Most-Opened predicates, per report and user');
ok(preg_match('/WHERE \$errorCondSqlA \$timeFilterA \$whenFilterA \$userFilterA \$reportFilterA\s+GROUP BY a\.REPORT_ID/', $page) === 1, 'errors: the Errors tab predicates, per report');
ok(strpos($page, 'NOT IN ($sysShortIdSql) $deadExistedSql $reportFilterA",' . "\n" . '            $reportBinds') !== false, 'catalogue: system rows out, past-window rule, report/tag filter with its own binds');
ok(strpos($page, 'penumbra_an_tables_cache_file()') !== false, 'map cached via the temp-folder path');
ok(strpos($page, "'pins' => \$tFlip(\$pinsTableNames), 'infoed' => \$tFlip(\$infoEdTableNames), 'hr' => \$tFlip(\$hrTableNames),") !== false, 'lists passed in routing order');
ok(strpos($shSrc, "r.getAttribute('data-find')") !== false, 'quick filter reads data-find (find a table by report name)');
ok(strpos($shSrc, "el.hasAttribute('data-csv')") !== false, 'CSV takes data-csv (a name cell, not its open report list)');
ok(strpos($page, '&mdash;') === false || substr_count($page, 'not in range') >= 1, 'no em-dash in the new copy');

section('E. the gate is untouched');
list($origGate) = lift(file_get_contents($opt['orig'] . '/db_connection.php'), $GATE);
ok($origGate === $gateSrc, 'penumbraExtractSqlTables / Uncached / ReportTables byte-identical to --orig');

if ($opt['corpus'] !== '' && $opt['ddl'] !== '') {
    section('F. live catalogue (backup)');
    $lists = array('pins' => array(), 'infoed' => array(), 'hr' => array(), 'fin' => array(), 'ieprd' => array());
    $cur = 'ieprd';
    foreach (array($opt['ddl'] . '/ddl_oracle.txt', $opt['ddl'] . '/ddl_mssql.txt') as $f) {
        foreach (file($f) as $ln) {
            if (preg_match('/^# MS-SQL Database: PINS/', $ln)) $cur = 'pins';
            if (preg_match('/^# MS-SQL Database: InfoEd/', $ln)) $cur = 'infoed';
            if (preg_match('/^-- Table: (\S+)/', $ln, $mm)) $lists[$cur][strtoupper($mm[1])] = true;
        }
    }
    $fh = gzopen($opt['corpus'], 'r'); $cols = null; $n = 0; $bad = array(); $empty = array(); $unk = array(); $w8 = null;
    while (($line = gzgets($fh)) !== false) {
        $row = json_decode($line, true); if (!is_array($row)) continue;
        if (isset($row['columns'])) { $cols = array_column($row['columns'], 'name'); continue; }
        $r = array_combine(array_slice($cols, 0, count($row)), $row);
        $sid = trim((string)$r['SHORT_ID']);
        if (strpos($sid, '__') === 0) continue;
        $n++;
        if (!isset($r['STATE_DATA'])) continue;   // a row the backup split (no state in this part)
        $refs = $have ? penumbra_an_table_refs((string)$r['STATE_DATA'], $lists) : array();
        // Nothing found is right only for a DUAL-only demo (SELECT ... FROM DUAL).
        if (!$refs && array_diff(penumbraExtractReportTables((string)$r['STATE_DATA']), array('DUAL'))) $empty[] = $sid;
        foreach ($refs as $x) {
            if (in_array($x['table'], array('DATE', 'TODAY', 'IMPORT', 'DUAL'), true) || ($x['conn'] !== 'imports' && strpos($x['table'], '.') !== false)) $bad[] = "$sid:" . $x['table'];
            if ($x['conn'] === '?') $unk[$x['table']] = true;
        }
        if ($sid === 'w8dfj9ci') $w8 = $keys($refs);
    }
    echo "  ($n reports; " . count($unk) . " names on no DDL-cache list - the cache is partial, informational)\n";
    ok($n > 50, 'corpus read', $n);
    ok($bad === array(), 'no DATE / TODAY / IMPORT / DUAL / dotted names', implode(' ', $bad));
    ok($w8 !== null && in_array('ieprd:STATS_COMBINED_V2', $w8, true), 'w8dfj9ci (SQL in noquote options) reads STATS_COMBINED_V2', $w8);
    ok($empty === array(), 'only DUAL-only reports come back empty', implode(' ', $empty));
}

echo "\n" . ($FAIL ? "FAILED" : "PASSED") . ": $PASS passed, $FAIL failed\n";
exit($FAIL ? 1 : 0);
