<?php
/**
 * penumbra_tests/importtrunc - the [IMPORT] silent-truncation fix (2026-09-10).
 *
 * WHAT WAS BROKEN. Both ./imports/ folder paths in query.php sliced an oversize
 * file down to the cap and then PERSISTED the short copy - the refresh path
 * UPDATEs the stored CLOB, the auto-create path INSERTs a new row. Nothing was
 * shown to the user, and because the folder is re-read on every run, a
 * 25,000-row CSV became a permanent 20,000-row report. Both sites also used a
 * bare literal 20000 instead of PENUMBRA_IMPORT_MAX_ROWS, so the constant that
 * exists to stop writers drifting was bypassed by the writers.
 *
 * WHAT IS UNDER TEST - all REAL code, lifted from the live query.php by source
 * anchor (so a rewrite that removes an anchor fails the suite loudly):
 *   1. Refresh path guard: oversize records + empties $parsedRows, and the
 *      CLOB-write branch is NOT entered. At/under the cap it still writes.
 *   2. Auto-create guard: oversize records + `continue`s, so no INSERT.
 *   3. The 400 gate: message text, singular/plural, and that it names every
 *      offending import. Run in a CHILD php process because it calls exit.
 *   4. Structural: no bare 20000 left, no array_slice($parsedRows) left, the
 *      gate precedes resolveImportDataTags(), and the resolver call is passed
 *      the constant.
 *   5. resolveImportDataTags() itself (shared_logic.php, lifted by tokenizer
 *      with its helpers): the row cap now THROWS where it used to array_slice,
 *      the boundary is > not >=, an empty import is still the placeholder
 *      no-op, and an omitted $maxRows resolves to PENUMBRA_IMPORT_MAX_ROWS
 *      rather than a hardcoded 20000.
 *   6. The JSON row transport (2026-09-10): lane selection by generated-
 *      statement size, the mssql / no-bind-pool gates, payload integrity
 *      (chunking, positional keys, leading zeros, apostrophes), the shared
 *      bind pool surviving, every added bind appearing in the statement, and
 *      above all LANE EQUIVALENCE - the literal and JSON lanes must give every
 *      column the same name and the same type across all five storage shapes,
 *      or a report changes what a join means on crossing the threshold.
 *
 *   php.exe -n test_importtrunc.php [--control]
 *
 * --control adds one deliberately false assertion, which MUST report FAIL.
 * THREE TARGETED MUTANTS always run. Two revert a fixed site to its old
 * array_slice() form (the resolver's row cap, the refresh guard) and prove the
 * oversize case then truncates silently - the resolver emitting a short row set
 * without throwing, the refresh guard WRITING a truncated row and recording
 * nothing. The third re-introduces the typing bug found while building the JSON
 * lane: deriving $forceStringCol from the numeric PREDICATE instead of from
 * what the literal emitter actually ships, which types a CSV id column NUMBER
 * on one lane and VARCHAR2 on the other. Without them those assertions could
 * pass vacuously.
 *
 * Two PENUMBRA_SUBQUERY_LIMIT lines on stderr during the resolver section are
 * EXPECTED - that is the live error_log() firing on the refusal path.
 *
 * EXPECTED TAIL: "PASS 172   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}

$APP_UNC = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP_LOC = 'C:/inetpub/wwwroot/sponsor_migration/penumbra';
$APP = is_file($APP_UNC . '\\query.php') ? $APP_UNC : $APP_LOC;

$SRC = @file_get_contents($APP . '/query.php');
if ($SRC === false) { fwrite(STDERR, "FATAL: cannot read query.php\n"); exit(2); }
$DBC = @file_get_contents($APP . '/db_connection.php');
if ($DBC === false) { fwrite(STDERR, "FATAL: cannot read db_connection.php\n"); exit(2); }
// Read up here, not at the resolver section: the constants lifted just below
// come out of this file and every later section depends on them.
$SHARED = @file_get_contents($APP . '/shared_logic.php');
if ($SHARED === false) { fwrite(STDERR, "FATAL: cannot read shared_logic.php\n"); exit(2); }
if ($DBC === false) { fwrite(STDERR, "FATAL: cannot read db_connection.php\n"); exit(2); }

// The cap comes from the LIVE define, never a literal here - otherwise raising
// the cap in db_connection.php would leave this suite asserting the old number.
if (!preg_match("/define\\(\\s*'PENUMBRA_IMPORT_MAX_ROWS'\\s*,\\s*(\\d+)\\s*\\)/", $DBC, $m)) {
    fwrite(STDERR, "FATAL: PENUMBRA_IMPORT_MAX_ROWS define not found in db_connection.php\n");
    exit(2);
}
define('PENUMBRA_IMPORT_MAX_ROWS', (int)$m[1]);
$CAP = PENUMBRA_IMPORT_MAX_ROWS;

// The other two live constants, lifted the same way. Defined UP HERE, not beside
// the sections that exercise them: the resolver is eval'd once and every section
// below calls it, so a constant defined late is an "Undefined constant" fatal in
// whichever section happens to run first.
if (!preg_match("/define\\(\\s*'PENUMBRA_IMPORT_JSON_MIN_BYTES'\\s*,\\s*(\\d+)\\s*\\)/", $SHARED, $tm)) {
    fwrite(STDERR, "FATAL: PENUMBRA_IMPORT_JSON_MIN_BYTES define not found\n");
    exit(2);
}
define('PENUMBRA_IMPORT_JSON_MIN_BYTES', (int)$tm[1]);
if (!preg_match("/define\\(\\s*'PENUMBRA_IMPORT_REQUEST_MAX_ROWS'\\s*,\\s*(\\d+)\\s*\\)/", $SHARED, $rm)) {
    fwrite(STDERR, "FATAL: PENUMBRA_IMPORT_REQUEST_MAX_ROWS define not found\n");
    exit(2);
}
define('PENUMBRA_IMPORT_REQUEST_MAX_ROWS', (int)$rm[1]);
$REQCAP = PENUMBRA_IMPORT_REQUEST_MAX_ROWS;

/**
 * Lift the source text from $startAnchor up to (and optionally including)
 * $endAnchor. Anchors are literal substrings of the live file; a miss is fatal,
 * which is the point - it means the code moved and the suite must be re-aimed.
 */
function lift($src, $startAnchor, $endAnchor, $includeEnd, $what) {
    $a = strpos($src, $startAnchor);
    if ($a === false) { fwrite(STDERR, "FATAL: start anchor missing for $what\n"); exit(2); }
    $b = strpos($src, $endAnchor, $a);
    if ($b === false) { fwrite(STDERR, "FATAL: end anchor missing for $what\n"); exit(2); }
    return substr($src, $a, ($b - $a) + ($includeEnd ? strlen($endAnchor) : 0));
}

// ---------------------------------------------------------------- SITE 1 lift
// From the guard comment through the head of the CLOB-write branch. The write
// body is replaced with a flag, so "did it write?" is directly observable
// without an Oracle connection.
$site1 = lift($SRC,
    '// Oversize is a HARD STOP, never a silent slice.',
    'if (is_array($parsedRows) && count($parsedRows) > 0) {',
    true, 'site1 (refresh guard)');
$site1Code = $site1 . "\n \$WROTE = true; }";

// ---------------------------------------------------------------- SITE 2 lift
// From the guard comment up to the first line of the INSERT body.
$site2 = lift($SRC,
    '// Same hard stop as the refresh path above:',
    '$newJson     = json_encode($parsedRows);',
    false, 'site2 (auto-create guard)');
// `continue` needs an enclosing loop; the INSERT body becomes a flag.
$site2Code = "foreach (array(1) as \$_iter) {\n" . $site2 . "\n \$WROTE = true;\n}";

// ------------------------------------------------------------------ GATE lift
$gate = lift($SRC, 'if (!empty($importOversize)) {', "        exit;\n    }", true, 'gate');

function run_site1($code, $rowCount, $importName, $path) {
    $parsedRows     = ($rowCount === null) ? null : array_fill(0, $rowCount, 1);
    $importOversize = array();
    $fileMatch      = array('path' => $path, 'ext' => 'csv');
    $WROTE          = false;
    eval($code);
    return array('wrote' => $WROTE, 'over' => $importOversize, 'left' => is_array($parsedRows) ? count($parsedRows) : -1);
}

function run_site2($code, $rowCount, $impName, $path) {
    $parsedRows     = array_fill(0, $rowCount, 1);
    $importOversize = array();
    $fileMatch      = array('path' => $path, 'ext' => 'csv');
    $_impName       = $impName;
    $WROTE          = false;
    eval($code);
    return array('wrote' => $WROTE, 'over' => $importOversize);
}

echo "=== SITE 1: refresh path (UPDATEs the stored CLOB) ===\n";

$r = run_site1($site1Code, $CAP + 1, 'budget_2025', 'C:\\imports\\budget_2025.csv');
ok($r['wrote'] === false,                       'over cap: CLOB write branch NOT entered');
ok(count($r['over']) === 1,                     'over cap: exactly one import recorded');
ok(isset($r['over']['BUDGET_2025']),            'over cap: recorded under the UPPERCASED name');
ok(isset($r['over']['BUDGET_2025']['rows']) && $r['over']['BUDGET_2025']['rows'] === $CAP + 1,
                                                'over cap: records the TRUE row count, not the cap');
ok(isset($r['over']['BUDGET_2025']['file']) && $r['over']['BUDGET_2025']['file'] === 'budget_2025.csv',
                                                'over cap: records basename only (no server path leak)');
ok(strpos(json_encode($r['over']), 'C:\\\\imports') === false,
                                                'over cap: no directory component anywhere in the record');
ok($r['left'] === 0,                            'over cap: $parsedRows emptied so nothing downstream writes');

$r = run_site1($site1Code, $CAP, 'budget_2025', 'C:\\imports\\budget_2025.csv');
ok($r['wrote'] === true,                        'exactly at cap: still writes (boundary is > not >=)');
ok(empty($r['over']),                           'exactly at cap: nothing recorded');

$r = run_site1($site1Code, 1, 'x', 'C:\\imports\\x.csv');
ok($r['wrote'] === true,                        'one row: writes');
ok(empty($r['over']),                           'one row: nothing recorded');

$r = run_site1($site1Code, 0, 'x', 'C:\\imports\\x.csv');
ok($r['wrote'] === false,                       'zero rows: no write (pre-existing empty guard intact)');
ok(empty($r['over']),                           'zero rows: not treated as oversize');

$r = run_site1($site1Code, null, 'x', 'C:\\imports\\x.csv');
ok($r['wrote'] === false,                       'non-array parse result: no write');
ok(empty($r['over']),                           'non-array parse result: not recorded as oversize');

$r = run_site1($site1Code, $CAP + 5000, 'Mixed_Case Name', 'C:\\imports\\weird name.tsv');
ok(isset($r['over']['MIXED_CASE NAME']),        'name is uppercased exactly as the data map key is');
ok($r['over']['MIXED_CASE NAME']['file'] === 'weird name.tsv', 'basename survives spaces');

echo "=== SITE 2: auto-create path (INSERTs a new row) ===\n";

$r = run_site2($site2Code, $CAP + 1, 'NEWFILE', 'C:\\imports\\newfile.csv');
ok($r['wrote'] === false,                       'over cap: INSERT branch NOT entered');
ok(count($r['over']) === 1,                     'over cap: exactly one import recorded');
ok(isset($r['over']['NEWFILE']),                'over cap: recorded under the tag name');
ok($r['over']['NEWFILE']['rows'] === $CAP + 1,  'over cap: records the TRUE row count');
ok($r['over']['NEWFILE']['file'] === 'newfile.csv', 'over cap: basename only');

$r = run_site2($site2Code, $CAP, 'NEWFILE', 'C:\\imports\\newfile.csv');
ok($r['wrote'] === true,                        'exactly at cap: still inserts');
ok(empty($r['over']),                           'exactly at cap: nothing recorded');

$r = run_site2($site2Code, 3, 'NEWFILE', 'C:\\imports\\newfile.csv');
ok($r['wrote'] === true,                        'small file: inserts');
ok(empty($r['over']),                           'small file: nothing recorded');

echo "=== GATE: the 400 (child process - the block calls exit) ===\n";

$php  = PHP_BINARY;
// The gate ends in exit, so it has to run in a child. Two Windows traps here,
// both of which produce an EMPTY stdout that reads as a harness pass rather
// than a failure: cmd.exe refuses a UNC current directory, and a UNC path as
// the script argument does not survive the quoting. So the child is GENERATED
// into local temp - the lifted gate plus its seed - and nothing in the command
// line touches the share. $CAP is inlined because the child skips the define
// lift; the parent already proved that number came from the live source.
function gate_child($php, $cap, $gateSrc, $payload) {
    $child = "<?php\n"
           . "define('PENUMBRA_IMPORT_MAX_ROWS', " . (int)$cap . ");\n"
           . '$importOversize = ' . var_export($payload, true) . ";\n"
           . $gateSrc . "\n"
           . "echo '{\"error\":\"GATE-DID-NOT-FIRE\"}';\n";
    $tmp = tempnam(sys_get_temp_dir(), 'pnbgate') . '.php';
    file_put_contents($tmp, $child);

    $desc = array(1 => array('pipe', 'w'), 2 => array('pipe', 'w'));
    $cmd  = escapeshellarg($php) . ' -n ' . escapeshellarg($tmp);
    $p = proc_open($cmd, $desc, $pipes, sys_get_temp_dir());
    if (!is_resource($p)) { @unlink($tmp); return ''; }
    $out = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]); fclose($pipes[2]);
    proc_close($p);
    @unlink($tmp);
    if (trim($err) !== '') { fwrite(STDERR, "    child stderr: " . trim($err) . "\n"); }
    return $out;
}

$one = gate_child($php, $CAP, $gate, array(
    'BUDGET_2025' => array('rows' => 25000, 'file' => 'budget_2025.csv')
));
$oneJson = json_decode($one, true);
ok(is_array($oneJson) && isset($oneJson['error']), 'single: gate emits a JSON error object');
$msg = isset($oneJson['error']) ? $oneJson['error'] : '';
// Non-empty AND not the sentinel: an empty $msg would satisfy a bare strpos
// check, which is exactly how a child that never launched reads as a pass.
ok($msg !== '' && strpos($msg, 'GATE-DID-NOT-FIRE') === false,
                                                  'single: gate actually fired and exited');
ok(strpos($msg, '"BUDGET_2025"') !== false,       'single: names the import');
ok(strpos($msg, '25,000 rows') !== false,         'single: reports the true row count, formatted');
ok(strpos($msg, 'budget_2025.csv') !== false,     'single: names the file');
ok(strpos($msg, number_format($CAP) . '-row import limit') !== false,
                                                  'single: quotes the live cap, formatted');
ok(strpos($msg, 'No import data was changed') !== false,
                                                  'single: states nothing was written');
ok(strpos($msg, 'Import "') === 0,                'single: singular "Import", no trailing s');
ok(strpos($msg, ' exceeds the ') !== false,       'single: singular verb');
ok(strpos($msg, 'imports folder') !== false,      'single: tells the user where to fix it');
ok(strpos($msg, "\xE2\x80\x94") === false,        'single: no em-dash in user-facing copy');
ok(strpos($msg, 'C:\\') === false,                'single: no server path in user-facing copy');

$two = gate_child($php, $CAP, $gate, array(
    'BUDGET_2025' => array('rows' => 25000, 'file' => 'budget_2025.csv'),
    'HEADCOUNT'   => array('rows' => 31500, 'file' => 'headcount.tsv')
));
$twoJson = json_decode($two, true);
$msg2 = isset($twoJson['error']) ? $twoJson['error'] : '';
ok(strpos($msg2, 'Imports "') === 0,              'plural: "Imports"');
ok(strpos($msg2, ' exceed the ') !== false,       'plural: plural verb');
ok(strpos($msg2, 'BUDGET_2025') !== false && strpos($msg2, 'HEADCOUNT') !== false,
                                                  'plural: names BOTH imports');
ok(strpos($msg2, '31,500 rows') !== false,        'plural: second row count formatted');
ok(substr_count($msg2, ' rows in ') === 2,        'plural: one file clause per import');

echo "=== STRUCTURAL: the live source ===\n";

// Everything between the [IMPORT] resolution head and the resolver call.
$impStart = strpos($SRC, "// Resolve [IMPORT] tags");
$impEnd   = strpos($SRC, 'resolveImportDataTags($query_template', $impStart);
$impBlock = substr($SRC, $impStart, $impEnd - $impStart);

ok($impStart !== false && $impEnd !== false,      'import resolution block located');
ok(strpos($impBlock, 'array_slice($parsedRows') === false,
                                                  'no array_slice($parsedRows) left anywhere');
ok(preg_match('/\b20000\b/', $impBlock) === 0,    'no bare 20000 left in the import block');
ok(substr_count($impBlock, 'PENUMBRA_IMPORT_MAX_ROWS >') === 0
   && substr_count($impBlock, '> PENUMBRA_IMPORT_MAX_ROWS') === 2,
                                                  'exactly two guards, both comparing against the constant');
ok(substr_count($impBlock, '$importOversize[') === 2,
                                                  'both guards record into $importOversize');
ok(strpos($impBlock, '$importOversize = array();') !== false,
                                                  '$importOversize is initialized');
ok(strpos($impBlock, '$importOversize = array();') < strpos($impBlock, '$importOversize['),
                                                  'initialized BEFORE either guard writes to it');
ok(strpos($impBlock, 'if (!empty($importOversize)) {') !== false,
                                                  'the gate exists inside the block');
ok(strpos($impBlock, 'if (!empty($importOversize)) {') > strpos($impBlock, '$importOversize['),
                                                  'gate sits AFTER both guards (so it sees both)');
ok(preg_match('/resolveImportDataTags\(\$query_template,\s*\$importDataRaw,\s*\$target_db_type,\s*PENUMBRA_IMPORT_MAX_ROWS\b/', $SRC) === 1,
                                                  'resolver is passed the constant, not a literal');
ok(preg_match('/resolveImportDataTags\([^)]*,\s*\$penumbraSubqueryBinds\s*\)/', $SRC) === 1,
                                                  'resolver is handed the SHARED subquery bind pool (enables the JSON lane)');
ok(preg_match('/\b20000\b/', $SRC) === 0,         'query.php has no bare 20000 anywhere');

echo "=== RESOLVER: resolveImportDataTags() row cap (shared_logic.php) ===\n";

// The last line of defence, and it used to array_slice() directly above a byte
// check whose own comment says "fail loud, never silently drop rows". Lifted
// whole by tokenizer with its helpers - shared_logic.php cannot be require'd
// (it wants a live config), and the extractor does NOT follow require_once, so
// every helper the function reaches must be lifted explicitly or the first test
// that touches one dies before assertion number one.
// ($SHARED was read at the top - the live constants are lifted from it there.)

/**
 * Lift one NAMED class. The JSON lane's payload bind is a PenumbraClobBind
 * object, and the lane is wrapped in catch(Throwable) - so if this class were
 * missing, every JSON test would silently FALL BACK to the literal lane and the
 * "lane actually engaged" assertions are the only thing standing between that
 * and a vacuous pass. (They caught exactly this when the class was added.)
 */
function lift_class($src, $name) {
    $tokens = token_get_all($src);
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_CLASS) continue;
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
    fwrite(STDERR, "FATAL: could not lift class $name\n");
    exit(2);
}

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
    fwrite(STDERR, "FATAL: could not lift function $name\n");
    exit(2);
}

$fnResolver = lift_function($SHARED, 'resolveImportDataTags');
// penumbraBuildOracleJsonRowset and friends are NOT optional here: the JSON
// lane is gated on function_exists(), so leaving them unlifted would not fail -
// every JSON test would quietly take the literal path and pass vacuously. The
// lane-engaged assertions below are the backstop for exactly that.
eval(lift_class($SHARED, 'PenumbraClobBind'));
foreach (array('extractSubqueryTags', 'penumbraOracleLiteralBody', 'penumbraUtf8SafeCut', 'penumbraNormalizeUtf8',
               'penumbraSubqueryTransportPref', 'penumbraByteSafeChunks', 'penumbraBuildOracleJsonRowset') as $h) {
    eval(lift_function($SHARED, $h));
}
foreach (array('penumbraImportColumnIsNumeric', 'penumbraNumToSql') as $h) {
    eval(lift_function($DBC, $h));
}
eval($fnResolver);

function mk_rows($n, $col = 'AWARD_ID') {
    $r = array();
    for ($i = 0; $i < $n; $i++) { $r[] = array($col => 'A' . $i); }
    return $r;
}
/** Returns array(threw, message, sql). */
function resolve_try($rows, $maxRows) {
    $sql = 'SELECT * FROM [IMPORT; name=BUDGET] b';
    try {
        resolveImportDataTags($sql, array('BUDGET' => $rows), 'oracle', $maxRows);
        return array(false, '', $sql);
    } catch (Exception $e) {
        return array(true, $e->getMessage(), $sql);
    }
}

list($threw, $msg, $sql) = resolve_try(mk_rows(6), 5);
ok($threw === true,                               'over cap: THROWS instead of trimming');
ok(strpos($msg, "'BUDGET'") !== false,            'over cap: names the import');
ok(strpos($msg, '6 rows') !== false,              'over cap: reports the TRUE row count, not the cap');
ok(strpos($msg, '5-row import limit') !== false,  'over cap: quotes the cap it was given');
ok(stripos($msg, 'truncat') === false && stripos($msg, 'trimmed') === false,
                                                  'over cap: does not describe trimming (it refuses)');
ok(strpos($msg, "\xE2\x80\x94") === false,        'over cap: no em-dash in user-facing copy');

list($threw, $msg, $sql) = resolve_try(mk_rows(5), 5);
ok($threw === false,                              'exactly at cap: does NOT throw (boundary is > not >=)');
ok(substr_count($sql, 'FROM dual') === 5,         'exactly at cap: all 5 rows emitted');
ok(strpos($sql, '[IMPORT') === false,             'exactly at cap: the tag was replaced');

list($threw, $msg, $sql) = resolve_try(mk_rows(1), 5);
ok($threw === false,                              'under cap: does not throw');
ok(substr_count($sql, 'FROM dual') === 1,         'under cap: the single row is emitted');

// The default: omitted $maxRows must resolve to the live constant, which is the
// whole point of removing the hardcoded 20000 from the signature.
list($threw, $msg, $sql) = resolve_try(mk_rows($CAP + 1), null);
ok($threw === true,                               'omitted $maxRows: still enforced');
ok(strpos($msg, number_format($CAP) . '-row import limit') !== false,
                                                  'omitted $maxRows: uses PENUMBRA_IMPORT_MAX_ROWS');
unset($sql);

// A zero-row import is a documented no-op placeholder, not a limit failure.
list($threw, $msg, $sql) = resolve_try(array(), 5);
ok($threw === false,                              'empty import: no throw (placeholder path)');
ok(strpos($sql, 'WHERE 1=0') !== false,           'empty import: emits the empty result set');

ok(strpos($fnResolver, 'array_slice($rows') === false,
                                                  'no array_slice($rows) left in the resolver');
ok(preg_match('/function resolveImportDataTags\(&\$sql, \$importData, \$targetDb, \$maxRows = null, &\$transportBinds = null\)/', $fnResolver) === 1,
                                                  'signature: null cap default, bind pool BY REFERENCE');

echo "=== JSON TRANSPORT: lane selection ===\n";

/** Resolve one import; returns array(sql, binds). $binds seeded so the shared-pool trap shows. */
function resolve_import($rows, $target = 'oracle', $withBinds = true, $seed = array('sqSEEDED' => 'keep-me')) {
    $sql   = 'SELECT * FROM [IMPORT; name=X] x';
    $binds = $seed;
    if ($withBinds) {
        resolveImportDataTags($sql, array('X' => $rows), $target, PENUMBRA_IMPORT_MAX_ROWS, $binds);
    } else {
        resolveImportDataTags($sql, array('X' => $rows), $target, PENUMBRA_IMPORT_MAX_ROWS);
    }
    return array($sql, $binds);
}
function is_json_lane($sql) { return strpos($sql, 'JSON_TABLE') !== false; }
/** 8-column rows: wide enough that a few thousand cross the threshold. */
function wide_rows($n) {
    $r = array();
    for ($i = 0; $i < $n; $i++) {
        $r[] = array(
            'DEPT_CODE' => '0' . str_pad((string)($i % 900 + 100), 4, '0', STR_PAD_LEFT),
            'DEPT_NAME' => 'Department of Testing ' . $i,
            'PI_NAME'   => "O'Brien, Pat " . $i,
            'STATUS'    => ($i % 2) ? 'ACTIVE' : 'CLOSED',
            'NOTE'      => 'note ' . $i,
            'AWARD_ID'  => (string)(1000000 + $i),
            'FY'        => (string)(2020 + ($i % 6)),
            'AMOUNT'    => (string)($i * 13),
        );
    }
    return $r;
}

list($sqlSmall, $bSmall) = resolve_import(wide_rows(50));
ok(!is_json_lane($sqlSmall),                    'small import: stays on the literal lane');
ok(count($bSmall) === 1,                        'small import: adds no binds');
ok(strpos($sqlSmall, 'FROM dual') !== false,    'small import: still inlines UNION ALL');

list($sqlBig, $bBig) = resolve_import(wide_rows(3000));
ok(is_json_lane($sqlBig),                       'large import: takes the JSON lane');
ok(count($bBig) === 2,                          'large import: contributes exactly ONE bind (seed + payload)');
ok(isset($bBig['sqSEEDED']) && $bBig['sqSEEDED'] === 'keep-me',
                                                'large import: pre-existing pool entries SURVIVE (shared with subquery tags)');
ok(strpos($sqlBig, 'FROM dual UNION ALL') === false,
                                                'large import: no literal row branches left');
ok(strlen($sqlBig) < 20000,                     'large import: statement is small (rows ride in binds)');
$bigPayloadLen = 0;
foreach ($bBig as $bv) { $bigPayloadLen += ($bv instanceof PenumbraClobBind) ? strlen($bv->data) : strlen((string)$bv); }
ok(strlen($sqlBig) < $bigPayloadLen / 10,       'large import: the payload moved OUT of the statement');

// The replacement must be usable where the tag was: FROM (...) alias.
ok(preg_match('/FROM \(SELECT .*JSON_TABLE.*\) x/s', $sqlBig) === 1,
                                                'large import: replacement is parenthesised and keeps the tag alias');

list($sqlMs, $bMs) = resolve_import(wide_rows(3000), 'mssql');
ok(!is_json_lane($sqlMs),                       'mssql target: never takes the JSON lane');
ok(count($bMs) === 1,                           'mssql target: adds no binds');
ok(strpos($sqlMs, 'VALUES') !== false,          'mssql target: still emits the VALUES form');

list($sqlNo, $bNo) = resolve_import(wide_rows(3000), 'oracle', false);
ok(!is_json_lane($sqlNo),                       'no bind pool passed: never takes the JSON lane');

echo "=== JSON TRANSPORT: payload integrity ===\n";

$chunks = $bBig; unset($chunks['sqSEEDED']);
$payloadBind = reset($chunks);
ok($payloadBind instanceof PenumbraClobBind,    'the payload bind is a PenumbraClobBind, not a raw string');
ok(count($chunks) === 1,                        'ONE bind carries the whole payload (no || concatenation tree)');
$payload = ($payloadBind instanceof PenumbraClobBind) ? $payloadBind->data : '';
$decoded = json_decode($payload, true);
ok(is_array($decoded),                          'payload is valid JSON');
ok(is_array($decoded) && count($decoded) === 3000,
                                                'payload carries every row');
ok(is_array($decoded) && array_keys($decoded[0]) === array('c0','c1','c2','c3','c4','c5','c6','c7'),
                                                'keys are positional c0..cN (no name escaping needed)');
ok(is_array($decoded) && $decoded[0]['c0'] === '00100',
                                                'leading zeros survive the payload verbatim');
ok(is_array($decoded) && strpos($decoded[0]['c2'], "O'Brien") === 0,
                                                'embedded apostrophe survives (no SQL escaping on this lane)');
ok(strpos($sqlBig, '||') === false,             'no || concatenation left in the statement');
ok(strpos($sqlBig, 'TO_CLOB(') === false,        'no TO_CLOB leaders left (that was the chunked form)');
ok(preg_match('/JSON_TABLE\(:sq\d+doc, /', $sqlBig) === 1,
                                                'JSON_TABLE reads the bind directly');
ok(strlen($payload) > 100000,                   'the payload really is large (the bind is not silently truncated)');
$bindNames = array_keys($chunks);
ok(count($bindNames) === count(array_unique($bindNames)),
                                                'chunk bind names are unique');
$allInSql = true;
foreach ($bindNames as $bn) { if (strpos($sqlBig, $bn) === false) { $allInSql = false; break; } }
ok($allInSql,                                   'every bind it added appears in the statement (ORA-01036 trap)');

echo "=== JSON TRANSPORT: the two lanes must agree ===\n";

// Same data, both lanes. Column NAMES and TYPES must match exactly, or a report
// changes meaning the moment it grows past the threshold.
function lane_types($rows) {
    $big = array();
    while (count($big) < 12000) { foreach ($rows as $r) { $big[] = $r; if (count($big) >= 12000) break; } }
    list($j, $jb) = resolve_import($big);
    $jt = array();
    if (preg_match_all('/"((?:[^"]|"")*)"\s+(VARCHAR2\(4000\)|NUMBER)\s+PATH/', $j, $jm)) {
        $jt = array_combine($jm[1], $jm[2]);
    }
    list($l, $lb) = resolve_import($rows, 'oracle', false);
    $lt = array();
    if (preg_match_all('/\(?SELECT (.*?) FROM dual/s', $l, $rowsM)) {
        foreach ($rowsM[1] as $branch) {
            if (preg_match_all('/(\'(?:[^\']|\'\')*\'|CAST\(NULL AS NUMBER\)|NULL|-?[0-9][0-9.]*) AS "((?:[^"]|"")*)"/', $branch, $lm)) {
                foreach ($lm[2] as $i => $col) {
                    $lit = $lm[1][$i];
                    if ($lit === 'NULL') continue;
                    $t = ($lit[0] === "'") ? 'VARCHAR2(4000)' : 'NUMBER';
                    if (isset($lt[$col]) && $lt[$col] !== $t) { $lt[$col] = 'MIXED'; }
                    elseif (!isset($lt[$col])) { $lt[$col] = $t; }
                }
            }
        }
    }
    return array($jt, $lt, is_json_lane($j));
}

$shapes = array(
    'csv numeric-looking strings' => array(array('ID'=>'1001','NAME'=>'a'), array('ID'=>'1002','NAME'=>'b')),
    'csv numeric-looking + blank' => array(array('ID'=>'1001','NAME'=>'a'), array('ID'=>'','NAME'=>'b'), array('ID'=>'1003','NAME'=>'c')),
    'snapshot real ints'          => array(array('ID'=>1001,'NAME'=>'a'), array('ID'=>1002,'NAME'=>'b')),
    'snapshot ints + null'        => array(array('ID'=>1001,'NAME'=>'a'), array('ID'=>null,'NAME'=>'b'), array('ID'=>1003,'NAME'=>'c')),
    'leading zeros'               => array(array('ID'=>'00123','NAME'=>'a'), array('ID'=>'00456','NAME'=>'b')),
);
foreach ($shapes as $label => $rows) {
    list($jt, $lt, $engaged) = lane_types($rows);
    ok($engaged,                                 "$label: JSON lane actually engaged (not a vacuous pass)");
    ok(array_keys($jt) === array_keys($lt),      "$label: identical column NAMES on both lanes");
    ok($jt === $lt,                              "$label: identical column TYPES on both lanes");
    ok(!in_array('MIXED', $lt, true),            "$label: literal lane types the column consistently (no ORA-01790)");
}

// The specific shape that used to emit CAST(NULL AS NUMBER) beside quoted
// strings in one UNION ALL column. Regression guard on the live emitter.
list($sqlBlank, $bBlank) = resolve_import(
    array(array('ID'=>'1001'), array('ID'=>''), array('ID'=>'1003')), 'oracle', false);
ok(!(strpos($sqlBlank, 'CAST(NULL AS NUMBER)') !== false && strpos($sqlBlank, "'1001'") !== false),
                                                'csv numeric column with a blank: no CAST(NULL AS NUMBER) beside quoted values');

// Snapshot-typed column keeps its typed NULL - the fix must not flatten that.
list($sqlTyped, $bTyped) = resolve_import(
    array(array('ID'=>1001), array('ID'=>null), array('ID'=>1003)), 'oracle', false);
ok(strpos($sqlTyped, 'CAST(NULL AS NUMBER)') !== false,
                                                'snapshot numeric column with a null: still a TYPED null');

echo "=== JSON TRANSPORT: the shared builder is unchanged for subqueries ===\n";

$sqBinds = array();
$sqSql = penumbraBuildOracleJsonRowset(
    array(array('AwardId' => 'x')), array('AwardId'), array('AwardId' => true), $sqBinds);
ok(strpos($sqSql, '"AWARDID"') !== false,        'default $upperAliases: identifier-safe alias still UPPERCASED');
$imBinds = array();
$imSql = penumbraBuildOracleJsonRowset(
    array(array('AwardId' => 'x')), array('AwardId'), array('AwardId' => true), $imBinds, false);
ok(strpos($imSql, '"AwardId"') !== false,        'import passes false: alias case PRESERVED to match its literal lane');

echo "=== CAP + PER-REQUEST CEILING ===\n";

// The client-side twin. js/main.js carries its own copy of the cap and rejects
// an upload BEFORE the server sees it, so a low copy silently refuses imports
// the server would accept. Nothing but this assertion links the two files.
$MAINJS = @file_get_contents($APP . '/js/main.js');
ok($MAINJS !== false,                            'js/main.js is readable');
$jsCap = null;
if ($MAINJS !== false && preg_match('/var PENUMBRA_IMPORT_MAX_ROWS = (\d+);/', $MAINJS, $jm)) {
    $jsCap = (int)$jm[1];
}
ok($jsCap !== null,                              'js/main.js declares PENUMBRA_IMPORT_MAX_ROWS');
ok($jsCap === $CAP,                              "client cap ($jsCap) EQUALS the server cap ($CAP)");

ok($REQCAP >= $CAP,                              'the per-request ceiling is at least one full import');

// Per-request ceiling: several tags in ONE statement.
function resolve_multi($counts, $reuseName = false) {
    $tags = array(); $data = array(); $i = 0;
    foreach ($counts as $n) {
        $nm = $reuseName ? 'A' : ('IMP' . (++$i));
        $tags[] = '[IMPORT; name=' . $nm . '] t' . count($tags);
        if (!isset($data[$nm])) {
            $rows = array();
            for ($k = 0; $k < $n; $k++) { $rows[] = array('ID' => (string)$k); }
            $data[$nm] = $rows;
        }
    }
    $sql = 'SELECT * FROM ' . implode(', ', $tags);
    try {
        resolveImportDataTags($sql, $data, 'oracle', PENUMBRA_IMPORT_MAX_ROWS);
        return array(false, '');
    } catch (Exception $e) {
        return array(true, $e->getMessage());
    }
}

// Imports that each fit under the PER-IMPORT cap but together do not fit under
// the per-request ceiling. Sized from the live constants: with a ceiling that is
// a multiple of the cap, two imports can never exceed it without first tripping
// the per-import cap, so the count is derived rather than assumed.
$nOver    = (int)floor($REQCAP / $CAP) + 1;
$overEach = (int)ceil(($REQCAP + 1) / $nOver);
$overTot  = $overEach * $nOver;
ok($overEach <= $CAP,                            'test fixture: each part is under the per-import cap');
ok($overTot > $REQCAP,                           'test fixture: the parts together exceed the ceiling');

$half = (int)floor($REQCAP / 2);
list($threw, $msg) = resolve_multi(array($half, $REQCAP - $half));
ok($threw === false,                             'imports summing to exactly the ceiling: allowed');

list($threw, $msg) = resolve_multi(array_fill(0, $nOver, $overEach));
ok($threw === true,                              "$nOver imports over the ceiling: refused");
ok(strpos($msg, number_format($REQCAP) . '-row limit for a single query') !== false,
                                                 'over ceiling: message quotes the per-QUERY limit');
ok(strpos($msg, number_format($overTot)) !== false || strpos($msg, number_format($REQCAP + 1)) !== false,
                                                 'over ceiling: message reports a running total, not the cap');
ok(strpos($msg, number_format($CAP)) !== false,  'over ceiling: message also states the per-import cap');
ok(stripos($msg, 'truncat') === false,           'over ceiling: refuses, never describes trimming');

// A single import under its own cap must not be blocked by the request ceiling.
list($threw, $msg) = resolve_multi(array($CAP));
ok($threw === false,                             'one import at the full per-import cap: allowed');

// Counted per TAG, not per NAME: the same import twice really is carried twice.
list($threw, $msg) = resolve_multi(array_fill(0, $nOver, $overEach), true);
ok($threw === true,                              'the SAME import reused across tags counts EACH time (per-tag, not per-name)');

echo "=== ALIAS CASE: outer references must match the emitted alias ===\n";

// The auto-quote tail rewrites unqualified outer references into quoted
// identifiers. It used to uppercase them unconditionally while both emitters
// alias VERBATIM, so any column not already uppercase resolved to nothing and
// Oracle answered ORA-00904.
/** Returns array(alias, outerRef, outputColumnName) for one column name. */
function alias_case($col, $outerText = null, $big = false) {
    $ref  = ($outerText === null) ? $col : $outerText;
    $sql  = "SELECT $ref FROM [IMPORT; name=X] x";
    $rows = array();
    $n    = $big ? 12000 : 2;
    for ($i = 0; $i < $n; $i++) { $rows[] = array($col => 'v' . $i); }
    $binds = array();
    if ($big) {
        resolveImportDataTags($sql, array('X' => $rows), 'oracle', PENUMBRA_IMPORT_MAX_ROWS, $binds);
    } else {
        resolveImportDataTags($sql, array('X' => $rows), 'oracle', PENUMBRA_IMPORT_MAX_ROWS);
    }
    // The alias: literal lane writes AS "col"; JSON lane writes "col" TYPE PATH.
    $alias = null;
    if (preg_match('/AS ("(?:[^"]|"")*")/', $sql, $m))                        { $alias = $m[1]; }
    elseif (preg_match('/("(?:[^"]|"")*")\s+(?:VARCHAR2\(4000\)|NUMBER) PATH/', $sql, $m)) { $alias = $m[1]; }
    // The outer reference: between SELECT and FROM.
    $outer = null;
    if (preg_match('/^SELECT\s+(.*?)\s+FROM /s', $sql, $m)) { $outer = trim($m[1]); }
    return array($alias, $outer, $sql);
}

foreach (array('AWARD_ID', 'award_id', 'AwardId', 'Award Id') as $col) {
    list($alias, $outer, $sql) = alias_case($col);
    ok($alias === '"' . $col . '"',  "literal lane, '$col': alias stays VERBATIM (output column not renamed)");
    ok($outer === $alias,            "literal lane, '$col': outer reference matches the alias");
    list($alias, $outer, $sql) = alias_case($col, null, true);
    ok($alias === '"' . $col . '"',  "JSON lane, '$col': alias stays VERBATIM");
    ok($outer === $alias,            "JSON lane, '$col': outer reference matches the alias");
}

// A reference the user already quoted, in the WRONG case, normalizes to the
// column's own case (that was the original intent - just aimed at uppercase).
list($alias, $outer, $sql) = alias_case('award_id', '"AWARD_ID"');
ok($outer === '"award_id"',          'quoted outer ref in the wrong case normalizes to the column case');
ok($alias === '"award_id"',          'quoted outer ref case: alias unchanged');

// The tail's original purpose still holds: a reserved word gets quoted.
list($alias, $outer, $sql) = alias_case('CLUSTER');
ok($outer === '"CLUSTER"',           'reserved-word column is still quoted (the reason this pass exists)');

// A qualified reference is still skipped (negative lookbehind for '.').
list($alias, $outer, $sql) = alias_case('award_id', 'x.award_id');
ok($outer === 'x.award_id',          'qualified reference x.award_id is left alone');

// A string literal that happens to contain the column name is untouched.
$strSql = "SELECT 'award_id is a column' AS NOTE, award_id FROM [IMPORT; name=X] x";
$strRows = array(array('award_id' => 'a'), array('award_id' => 'b'));
resolveImportDataTags($strSql, array('X' => $strRows), 'oracle', PENUMBRA_IMPORT_MAX_ROWS);
ok(strpos($strSql, "'award_id is a column'") !== false,
                                     'a column name inside a string literal is NOT rewritten');
ok(strpos($strSql, '"award_id"') !== false,
                                     'the real reference beside it still is');

// Two imports disagreeing on case: ambiguous, so leave those references alone
// rather than silently binding to one of them.
$ambSql  = 'SELECT ID FROM [IMPORT; name=A] a, [IMPORT; name=B] b';
$ambData = array(
    'A' => array(array('id' => '1'), array('id' => '2')),
    'B' => array(array('ID' => '3'), array('ID' => '4')),
);
resolveImportDataTags($ambSql, $ambData, 'oracle', PENUMBRA_IMPORT_MAX_ROWS);
ok(preg_match('/^SELECT\s+ID\s+FROM /', $ambSql) === 1,
                                     'a name present in two cases across imports is left unrewritten');
ok(strpos($ambSql, 'AS "id"') !== false && strpos($ambSql, 'AS "ID"') !== false,
                                     'both imports still emit their own alias case');

echo "=== TARGETED MUTANT: restore the unconditional uppercase rewrite ===\n";

$mutAlias = str_replace(
    '? \'"\' . str_replace(\'"\', \'""\', $colCanonical[$ck]) . \'"\'',
    '? \'"\' . strtoupper($m[1]) . \'"\'',
    $fnResolver, $mutAliasCount
);
ok($mutAliasCount === 1,       'MUTANT: the bare-reference rewrite was located and replaced');
eval(str_replace('function resolveImportDataTags(', 'function resolveImportDataTags_ALIASMUT(', $mutAlias));
$amSql = 'SELECT award_id FROM [IMPORT; name=X] x';
resolveImportDataTags_ALIASMUT($amSql, array('X' => array(array('award_id' => 'a'))), 'oracle', PENUMBRA_IMPORT_MAX_ROWS);
ok(strpos($amSql, '"AWARD_ID"') !== false && strpos($amSql, 'AS "award_id"') !== false,
                               'MUTANT reproduces the ORA-00904 split (ref "AWARD_ID" vs alias "award_id")');

echo "=== TARGETED MUTANT: type the JSON lane from \$numericCols ===\n";

// The bug caught during development: deriving $forceStringCol from the numeric
// PREDICATE rather than from what the literal emitter actually ships types a
// CSV's id column NUMBER on one lane and VARCHAR2 on the other - so a join
// against it changes meaning at the threshold. Must be detectable.
$mutJson = preg_replace(
    '/if \(empty\(\$emitAsNumber\[\$col\]\)\) \{\s*\$forceStringCol\[\$col\] = true;\s*\}/s',
    'if (empty($numericCols[$col])) { $forceStringCol[$col] = true; }',
    $fnResolver, 1, $mutJsonCount
);
ok($mutJsonCount === 1,         'MUTANT: the forceStringCol derivation was located and replaced');
eval(str_replace('function resolveImportDataTags(', 'function resolveImportDataTags_TYPEMUT(', $mutJson));
$mutRows = array();
while (count($mutRows) < 12000) { $mutRows[] = array('ID' => (string)(1000 + count($mutRows)), 'NAME' => 'a'); }
$mutSql2 = 'SELECT * FROM [IMPORT; name=X] x';
$mutBinds2 = array();
resolveImportDataTags_TYPEMUT($mutSql2, array('X' => $mutRows), 'oracle', PENUMBRA_IMPORT_MAX_ROWS, $mutBinds2);
ok(strpos($mutSql2, '"ID" NUMBER PATH') !== false,
                                'MUTANT types a CSV id column NUMBER on the JSON lane (the divergence reproduces)');
list($ctlSql, $ctlB) = resolve_import($mutRows);
ok(strpos($ctlSql, '"ID" VARCHAR2(4000) PATH') !== false,
                                'live code types that same column VARCHAR2, matching its literal lane');

echo "=== TARGETED MUTANT: restore the resolver's silent slice ===\n";

// Rebuild the pre-fix resolver: same function, row cap trimming instead of
// throwing. The oversize case must then emit a SHORT result set and not throw.
$mutRes = preg_replace(
    '/\$rowTotal = count\(\$rows\);.*?^        \}/ms',
    // $rowTotal must survive: the size estimator downstream reads it, and an
    // undefined there would make the mutant fail for the WRONG reason.
    '$rows = array_slice($rows, 0, $maxRows); $rowTotal = count($rows);',
    $fnResolver, 1, $mutCount
);
ok($mutCount === 1,            'MUTANT: the row-cap guard was located and replaced');
eval(str_replace('function resolveImportDataTags(', 'function resolveImportDataTags_MUT(', $mutRes));

$mutSql = 'SELECT * FROM [IMPORT; name=BUDGET] b';
$mutThrew = false;
try { resolveImportDataTags_MUT($mutSql, array('BUDGET' => mk_rows(6)), 'oracle', 5); }
catch (Exception $e) { $mutThrew = true; }
ok($mutThrew === false,                      'MUTANT does not throw on an oversize import (the silence reproduces)');
ok(substr_count($mutSql, 'FROM dual') === 5, 'MUTANT emits only 5 of 6 rows (the truncation reproduces)');

echo "=== TARGETED MUTANT: revert site 1 to the old silent slice ===\n";

// Rebuild site 1 exactly as it was before the fix. The suite must show the old
// behaviour: an oversize file is truncated AND written, with nothing recorded.
$mutantGuard = 'if (count($parsedRows) > PENUMBRA_IMPORT_MAX_ROWS) {'
             . ' $parsedRows = array_slice($parsedRows, 0, PENUMBRA_IMPORT_MAX_ROWS); }';
$mutantCode  = $mutantGuard
             . "\n if (is_array(\$parsedRows) && count(\$parsedRows) > 0) {\n \$WROTE = true; }";

$mu = run_site1($mutantCode, $CAP + 5000, 'budget_2025', 'C:\\imports\\budget_2025.csv');
ok($mu['wrote'] === true,      'MUTANT writes a truncated import (the bug reproduces)');
ok(empty($mu['over']),         'MUTANT records nothing (the silence reproduces)');
ok($mu['left'] === $CAP,       'MUTANT leaves exactly cap rows (the truncation reproduces)');

if ($CONTROL) {
    ok(false, 'CONTROL - deliberately false assertion');
}

echo "\nPASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
