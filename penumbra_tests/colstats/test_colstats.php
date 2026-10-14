<?php
/**
 * penumbra_tests/colstats - ALL_TAB_COLUMNS column statistics for scoped callers.
 *
 * Guards the 2026-10-14 fix: ALL_TAB_COLUMNS is on penumbraHiddenAllowList()
 * as metadata, so any scoped caller (a power user's sql grant, OR any viewer of
 * any report, who may POST SQL against that report's tables) could select its
 * LOW_VALUE / HIGH_VALUE - each column's min / max from the last stats run - for
 * ANY table, HR / FIN included. penumbraSqlReadsColumnStats() (db_connection.php)
 * names the shape; query.php's gate (non-admins) and shared_logic.php's subquery
 * gate ($GLOBALS['penumbraSqlScoped'], set by penumbraApplySqlScope) refuse it.
 *
 * Lifts the REAL function by tokenizer (db_connection.php cannot be require'd),
 * and checks that both gates call it (source anchors).
 *
 *   php.exe -n test_colstats.php [--app=<dir>] [--control]
 *
 * --control adds one deliberately false assertion, which MUST report FAIL.
 * A TARGETED MUTANT always runs: the star-projection pattern broken must MISS
 * "SELECT * FROM ALL_TAB_COLUMNS".
 *
 * EXPECTED TAIL: "PASS 36   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$APP = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = substr($a, 6); }
$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}
function src($app, $f) {
    $s = @file_get_contents(rtrim($app, '/\\') . '/' . $f);
    if ($s === false) { fwrite(STDERR, "FATAL: cannot read $f under $app\n"); exit(2); }
    return $s;
}

/** Lift one NAMED function's source (from `function` to its matching `}`). */
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
            if ($txt === '{' || (is_array($t) && $t[0] === T_CURLY_OPEN)) { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    return null;
}

$DB = src($APP, 'db_connection.php');
$buf = lift_function($DB, 'penumbraSqlReadsColumnStats');
if ($buf === null) { fwrite(STDERR, "FATAL: could not lift penumbraSqlReadsColumnStats()\n"); exit(2); }
eval($buf);
ok(function_exists('penumbraSqlReadsColumnStats'), 'function lifted and defined');

echo "BLOCKED (must return true)\n";
$blocked = array(
    array("SELECT COLUMN_NAME, LOW_VALUE, HIGH_VALUE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'PS_PERSONAL_DATA'", 'the headline payload'),
    array("select utl_raw.cast_to_varchar2(high_value) from all_tab_columns where table_name='X'", 'lower case, wrapped in a function'),
    array("SELECT RAWTOHEX(c.LOW_VALUE) FROM ALL_TAB_COLUMNS c", 'alias-qualified'),
    array("SELECT \"HIGH_VALUE\" FROM \"ALL_TAB_COLUMNS\"", 'quoted identifiers'),
    array("SELECT * FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'AWARD'", 'SELECT * returns them too'),
    array("SELECT DISTINCT * FROM ALL_TAB_COLUMNS", 'SELECT DISTINCT *'),
    array("SELECT c.* FROM ALL_TAB_COLUMNS c", 'alias.*'),
    array("SELECT c . * FROM ALL_TAB_COLUMNS c", 'alias . * with spaces'),
    array("SELECT x.COLUMN_NAME FROM (SELECT * FROM ALL_TAB_COLUMNS) x", 'star inside a derived table'),
    array("WITH s AS (SELECT * FROM ALL_TAB_COLUMNS) SELECT COLUMN_NAME FROM s", 'star inside a CTE'),
    array("SELECT 1 AS N FROM DUAL UNION ALL SELECT LOW_VALUE FROM ALL_TAB_COLUMNS", 'behind a UNION'),
    array("SELECT COUNT(*), LOW_VALUE FROM ALL_TAB_COLUMNS GROUP BY LOW_VALUE", 'COUNT(*) does not hide a named LOW_VALUE'),
    array("SELECT /* x */ LOW_VALUE -- y\n FROM ALL_TAB_COLUMNS", 'comments around the name'),
    array("SELECT 'a', * FROM ALL_TAB_COLUMNS", 'comma-star'),
    array("SELECT\n*\nFROM\nALL_TAB_COLUMNS", 'newlines'),
);
foreach ($blocked as $c) ok(penumbraSqlReadsColumnStats($c[0]) === true, 'BLOCKED ' . $c[1]);

echo "ALLOWED (must return false)\n";
$allowed = array(
    array("SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'AWARD'", 'named metadata columns'),
    array("SELECT COUNT(*) FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'AWARD'", 'COUNT(*)'),
    array("SELECT COUNT( * ) AS N FROM ALL_TAB_COLUMNS", 'COUNT( * ) spaced'),
    array("SELECT * FROM AWARD", 'star on a normal table'),
    array("SELECT LOW_VALUE FROM MY_RANGES", 'a LOW_VALUE column of another table'),
    array("SELECT 'LOW_VALUE' AS L, COLUMN_NAME FROM ALL_TAB_COLUMNS", 'the name inside a string literal'),
    array("SELECT COLUMN_NAME /* LOW_VALUE */ FROM ALL_TAB_COLUMNS -- HIGH_VALUE", 'the name inside comments'),
    array("SELECT DATA_LENGTH * 2 FROM ALL_TAB_COLUMNS", 'multiplication'),
    array("SELECT * FROM AWARD WHERE NOTE = 'ALL_TAB_COLUMNS'", 'the view name only in a literal'),
    array("SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS_X", 'near-miss view name'),
    array("SELECT MY_LOW_VALUE FROM ALL_TAB_COLUMNS", 'near-miss column name'),
);
foreach ($allowed as $c) ok(penumbraSqlReadsColumnStats($c[0]) === false, 'ALLOWED ' . $c[1]);
ok(penumbraSqlReadsColumnStats(null) === false, 'non-string input is clean');
ok(penumbraSqlReadsColumnStats('') === false, 'empty string is clean');

echo "WIRING (both gates call it)\n";
$Q  = src($APP, 'query.php');
$SL = src($APP, 'shared_logic.php');
ok(preg_match('/if \(!\$isAdmin && penumbraSqlReadsColumnStats\(\$query_template\)\)/', $Q) === 1, 'query.php gate: non-admins, on $query_template');
ok(strpos($Q, 'penumbraSqlReadsColumnStats') < strpos($Q, '$gateTables = penumbraExtractSqlTables($query_template);'), 'query.php: the check runs before the table gate');
ok(preg_match('/!empty\(\$GLOBALS\[\'penumbraSqlScoped\'\]\)[\s\S]{0,120}penumbraSqlReadsColumnStats\(\$sqlQuery\)/', $SL) === 1, 'shared_logic.php subquery gate: scoped callers');
$apply = lift_function($DB, 'penumbraApplySqlScope');
ok($apply !== null && strpos($apply, "\$GLOBALS['penumbraSqlScoped'] = true;") !== false, 'penumbraApplySqlScope sets the scoped flag');
ok(strpos(lift_function($DB, 'penumbraHiddenAllowList'), "'ALL_TAB_HISTOGRAMS'") === false, 'ALL_TAB_HISTOGRAMS is still NOT on the hidden allow-list');

echo "MUTANT (star pattern broken - must MISS SELECT *)\n";
$mut = str_replace('penumbraSqlReadsColumnStats', 'penumbraSqlReadsColumnStats_mut', $buf);
$mut = str_replace('|,\s*|\.\s*)\*/i', '|,\s*|\.\s*)\#/i', $mut);
ok(strpos($mut, ')\#/i') !== false, 'mutant: the star pattern was actually rewritten');
eval($mut);
ok(penumbraSqlReadsColumnStats_mut("SELECT * FROM ALL_TAB_COLUMNS") === false, 'mutant misses SELECT *, so the star BLOCKED rows can fail');

if ($CONTROL) {
    echo "Control (must FAIL)\n";
    ok(false, 'control: a deliberately false assertion');
}

echo "\nPASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
