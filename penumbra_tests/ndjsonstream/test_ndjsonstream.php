<?php
/**
 * =============================================================================
 * NDJSON stream consumer - penumbra_ndjson_feed/init/finish/usable
 * =============================================================================
 *
 *   php -n test_ndjsonstream.php <app-path>
 *
 * Lifts the four consumer functions out of the LIVE shared_logic.php and drives
 * them the way curl does: arbitrary byte chunks with no relationship to line
 * boundaries. No database, no network.
 *
 * WHY THIS SUITE EXISTS. A DB_DUMP streams its rows and then DROPs and rebuilds
 * a real Oracle table from them. HTTP returned 200 and the headers were gone
 * long before any fetch could fail, so "the connection closed cleanly" proves
 * nothing about completeness. If this consumer ever reports a truncated stream
 * as usable, the dump swaps a SHORT table into place and the loss is silent.
 * Every "not usable" case below is guarding exactly that.
 *
 * EXPECTED TAIL: "SUMMARY  pass=NN  fail=0".
 * =============================================================================
 */

$app = isset($argv[1]) ? rtrim($argv[1], "\\/") : '\\\\oitras\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$src = $app . DIRECTORY_SEPARATOR . 'shared_logic.php';
if (!is_readable($src)) { fwrite(STDERR, "FATAL: cannot read $src\n"); exit(2); }

$lines = file($src);
function lift($lines, $name) {
    $out = ''; $in = false;
    foreach ($lines as $l) {
        if (!$in && strpos($l, "function $name(") === 0) $in = true;
        if ($in) { $out .= $l; if (rtrim($l, "\r\n") === '}') return $out; }
    }
    fwrite(STDERR, "FATAL: could not lift $name() from shared_logic.php\n"); exit(2);
}
$code = "<?php\n";
foreach (array('penumbra_ndjson_feed', 'penumbra_ndjson_init',
               'penumbra_ndjson_finish', 'penumbra_ndjson_usable') as $fn) {
    $code .= lift($lines, $fn);
}
$tmp = tempnam(sys_get_temp_dir(), 'pnbnd') . '.php';
file_put_contents($tmp, $code);
require $tmp;
@unlink($tmp);

$pass = 0; $fail = 0;
function check($label, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  PASS  $label\n"; return; }
    $fail++; echo "  FAIL  $label\n        want " . json_encode($want) . "\n        got  " . json_encode($got) . "\n";
}

/** Drive the consumer with a fixed chunk size. */
function consume($stream, $chunkSize) {
    $state = penumbra_ndjson_init();
    $rows = array();
    $onRow = function ($r) use (&$rows) { $rows[] = $r; };
    if ($chunkSize <= 0) {
        penumbra_ndjson_feed($state, $stream, $onRow);
    } else {
        for ($i = 0; $i < strlen($stream); $i += $chunkSize) {
            penumbra_ndjson_feed($state, substr($stream, $i, $chunkSize), $onRow);
        }
    }
    penumbra_ndjson_finish($state);
    return array('state' => $state, 'rows' => $rows, 'usable' => penumbra_ndjson_usable($state));
}

$HEAD = json_encode(array('__pnb' => 'head', 'columns_meta' => array(
    array('name' => 'ID', 'native_type' => 'NUMBER'),
    array('name' => 'TXT', 'native_type' => 'VARCHAR2', 'len' => 40),
)));
$R1 = json_encode(array('ID' => '1', 'TXT' => 'first &amp; only'));
$R2 = json_encode(array('ID' => '2', 'TXT' => 'sec"ond, with {braces} and \\n'));
$R3 = json_encode(array('ID' => '3', 'TXT' => "caf\u{00e9} — unicode"));
$END = json_encode(array('__pnb' => 'end', 'rows' => 3));
$GOOD = "$HEAD\n$R1\n$R2\n$R3\n$END\n";

echo "=== 1. Chunk-boundary independence ===\n";
$ref = consume($GOOD, 0);
check('single chunk: usable', $ref['usable'], true);
check('single chunk: 3 rows', count($ref['rows']), 3);
$allSame = true; $badSize = null;
for ($cs = 1; $cs <= strlen($GOOD) + 3; $cs++) {
    $r = consume($GOOD, $cs);
    if ($r['usable'] !== true || $r['rows'] !== $ref['rows'] || $r['state']['rows'] !== 3) {
        $allSame = false; $badSize = $cs; break;
    }
}
check('every chunk size 1..len+3 gives an identical result' . ($badSize ? " (broke at $badSize)" : ''), $allSame, true);
check('1-byte chunks: rows intact', consume($GOOD, 1)['rows'], $ref['rows']);
check('unicode + escapes survive splitting', consume($GOOD, 1)['rows'][2]['TXT'], "café — unicode");
check('quotes/braces/backslash survive', consume($GOOD, 3)['rows'][1]['TXT'], 'sec"ond, with {braces} and \\n');

echo "\n=== 2. Completeness (the table-destroying cases) ===\n";
$trunc = "$HEAD\n$R1\n$R2\n";                       // connection died before the trailer
$r = consume($trunc, 0);
check('truncated: rows DID arrive', count($r['rows']), 2);
check('truncated: complete=false', $r['state']['complete'], false);
check('truncated: NOT usable', $r['usable'], false);

$mid = "$HEAD\n$R1\n{\"ID\":\"2\",\"TX";                // died mid-line
$r = consume($mid, 0);
check('mid-line truncation: NOT usable', $r['usable'], false);
check('mid-line truncation: flagged', strpos((string)$r['state']['error'], 'truncated') !== false, true);

$errline = "$HEAD\n$R1\n" . json_encode(array('__pnb' => 'error', 'error' => 'ORA-01555')) . "\n";
$r = consume($errline, 0);
check('error line: NOT usable', $r['usable'], false);
check('error line: message surfaced', $r['state']['error'], 'ORA-01555');

$miscount = "$HEAD\n$R1\n$R2\n" . json_encode(array('__pnb' => 'end', 'rows' => 3)) . "\n";
$r = consume($miscount, 0);
check('trailer says 3 but 2 parsed: NOT usable', $r['usable'], false);
check('...even though the trailer arrived', $r['state']['complete'], true);

$noHead = "$R1\n$END\n";
check('no head line: NOT usable', consume($noHead, 0)['usable'], false);

$malformed = "$HEAD\n$R1\nthis is not json\n$R2\n" . json_encode(array('__pnb' => 'end', 'rows' => 2)) . "\n";
$r = consume($malformed, 0);
check('malformed line: NOT usable', $r['usable'], false);
check('malformed line: flagged', strpos((string)$r['state']['error'], 'unparseable') !== false, true);

echo "\n=== 2b. usable() on a state that never existed ===\n";
// The live run on 2026-08-26 hit this: the fetch failed outright, the caller
// held null, and every field test below emitted "array offset on null".
$before = error_get_last();
check('null state -> not usable', penumbra_ndjson_usable(null), false);
check('...and silently (no new warning)', error_get_last() === $before, true);
check('non-array state -> not usable', penumbra_ndjson_usable('nonsense'), false);
check('truncated-but-shaped state -> not usable', penumbra_ndjson_usable(array('error' => null)), false);
check('empty array -> not usable', penumbra_ndjson_usable(array()), false);

echo "\n=== 3. Well-formed edge cases ===\n";
$empty = "$HEAD\n" . json_encode(array('__pnb' => 'end', 'rows' => 0)) . "\n";
$r = consume($empty, 0);
check('zero rows: usable', $r['usable'], true);
check('zero rows: none delivered', count($r['rows']), 0);
check('zero rows: head captured', $r['state']['head']['__pnb'], 'head');

$blank = "$HEAD\n\n$R1\n\n" . json_encode(array('__pnb' => 'end', 'rows' => 1)) . "\n";
$r = consume($blank, 0);
check('blank lines ignored', array(count($r['rows']), $r['usable']), array(1, true));

$unknown = "$HEAD\n" . json_encode(array('__pnb' => 'future_marker')) . "\n$R1\n"
         . json_encode(array('__pnb' => 'end', 'rows' => 1)) . "\n";
$r = consume($unknown, 0);
check('unknown control line is not inserted as data', array(count($r['rows']), $r['usable']), array(1, true));

$crlf = str_replace("\n", "\r\n", $empty);
$r = consume($crlf, 0);
check('CRLF-terminated stream still parses', $r['usable'], true);

echo "\n=== 4. Streaming eligibility (default deny) ===\n";
$runnerSrc = $app . DIRECTORY_SEPARATOR . 'schedule_runner.php';
if (!is_readable($runnerSrc)) { fwrite(STDERR, "FATAL: cannot read $runnerSrc\n"); exit(2); }
$tmp2 = tempnam(sys_get_temp_dir(), 'pnbel') . '.php';
file_put_contents($tmp2, "<?php\n" . lift(file($runnerSrc), 'db_dump_stream_eligible'));
require $tmp2;
@unlink($tmp2);

// A task that satisfies every condition, used as the baseline to break.
// $stream_requested is resolved by the CALLER (task option, else a config
// allowlist of task IDs) and passed in - see the note on the function.
$OK_OPTS = array(
    'destination_table'     => 'ALC_SRAR',
    'dbdump_columns_mode'   => 'custom',
    'dbdump_columns_custom' => array('ID', 'TXT'),
);
$why = '';
check('fully-qualified task is eligible', db_dump_stream_eligible(true, $OK_OPTS, array(), true, $why), true);

function denied($req, $opts, $state, $typesOn) { $w = ''; db_dump_stream_eligible($req, $opts, $state, $typesOn, $w); return $w !== ''; }
check('not requested -> denied',    denied(false, $OK_OPTS, array(), true), true);
check('driver types off -> denied', denied(true, $OK_OPTS, array(), false), true);
check('pivot view -> denied',       denied(true, $OK_OPTS, array('pivot' => array('rows' => array('A'))), true), true);
check('grouped view -> denied',     denied(true, $OK_OPTS, array('groupByColumn' => 'DEPT'), true), true);
check('search filter -> denied',    denied(true, $OK_OPTS + array('search_filter' => 'foo'), array(), true), true);
check('skip_no_change -> denied',   denied(true, $OK_OPTS + array('skip_no_change' => true), array(), true), true);
check('skip_empty -> denied',       denied(true, $OK_OPTS + array('skip_empty' => true), array(), true), true);
check('custom condition -> denied', denied(true, $OK_OPTS + array('custom_condition' => 'x > 1'), array(), true), true);
$vis = $OK_OPTS; $vis['dbdump_columns_mode'] = 'visible';
check('visible columns mode -> denied', denied(true, $vis, array(), true), true);
$noCols = $OK_OPTS; $noCols['dbdump_columns_custom'] = array();
check('custom mode with no columns -> denied', denied(true, $noCols, array(), true), true);
$long = $OK_OPTS; $long['destination_table'] = str_repeat('A', 29);
check('name too long for the _X build table -> denied', denied(true, $long, array(), true), true);
$empty = $OK_OPTS; $empty['destination_table'] = '';
check('empty destination -> denied', denied(true, $empty, array(), true), true);
check('an empty options array is denied', denied(true, array(), array(), true), true);
$why = '';
db_dump_stream_eligible(true, array(), array(), true, $why);
check('...with a reason given', $why !== '', true);

// The config-allowlist resolution the runner performs before calling in.
function resolve_requested($options, $cfg, $taskId) {
    if (isset($options['dbdump_stream'])) return (bool)$options['dbdump_stream'];
    if (isset($cfg['dbdump_stream_tasks']) && is_array($cfg['dbdump_stream_tasks'])) {
        return in_array((int)$taskId, array_map('intval', $cfg['dbdump_stream_tasks']), true);
    }
    return false;
}
check('allowlist enables the listed task',        resolve_requested(array(), array('dbdump_stream_tasks' => array(1064)), 1064), true);
check('allowlist leaves other tasks alone',       resolve_requested(array(), array('dbdump_stream_tasks' => array(1064)), 1043), false);
check('allowlist tolerates string ids',           resolve_requested(array(), array('dbdump_stream_tasks' => array('1064')), 1064), true);
check('task option overrides the allowlist (off)',resolve_requested(array('dbdump_stream' => false), array('dbdump_stream_tasks' => array(1064)), 1064), false);
check('no config at all -> off',                  resolve_requested(array(), array(), 1064), false);

echo "\n=== 4b. CTAS fast path ===\n";
$tmp3 = tempnam(sys_get_temp_dir(), 'pnbct') . '.php';
file_put_contents($tmp3, "<?php\n" . lift(file($runnerSrc), 'db_dump_ctas_eligible')
                              . lift(file($runnerSrc), 'db_dump_build_ctas_select'));
require $tmp3;
@unlink($tmp3);

$CT_OPTS = array(
    'dbdump_strip_html'     => true,
    'destination_table'     => 'ALC_SRAR',
    'dbdump_columns_mode'   => 'custom',
    'dbdump_columns_custom' => array('ID', 'TXT'),
);
$CT_PRE = array(
    'resolvedQuery' => 'SELECT id, txt, secret FROM stats_combined_v2 WHERE x = 1',
    'rawData'       => array(array('ID' => '1', 'TXT' => 'a', 'SECRET' => 's')),
);
$w = '';
check('fully-qualified task is CTAS-eligible', db_dump_ctas_eligible($CT_OPTS, $CT_PRE, $w), true);

function ct_denied($opts, $pre) { $w = ''; db_dump_ctas_eligible($opts, $pre, $w); return $w !== ''; }
$noStrip = $CT_OPTS; unset($noStrip['dbdump_strip_html']);
check('strip_html off -> denied (content would differ)', ct_denied($noStrip, $CT_PRE), true);
check('pivot -> denied',            ct_denied($CT_OPTS, $CT_PRE + array('pivot' => array('rows' => array('A')))), true);
check('grouped -> denied',          ct_denied($CT_OPTS, $CT_PRE + array('groupByColumn' => 'DEPT')), true);
check('search filter -> denied',    ct_denied($CT_OPTS + array('search_filter' => 'x'), $CT_PRE), true);
check('custom condition -> denied', ct_denied($CT_OPTS + array('custom_condition' => 'a>1'), $CT_PRE), true);
check('skip_no_change -> denied',   ct_denied($CT_OPTS + array('skip_no_change' => true), $CT_PRE), true);
check('skip_empty -> denied',       ct_denied($CT_OPTS + array('skip_empty' => true), $CT_PRE), true);
$ctVis = $CT_OPTS; $ctVis['dbdump_columns_mode'] = 'visible';
check('visible mode -> denied',     ct_denied($ctVis, $CT_PRE), true);

// THE ONE THAT MATTERS: a display-computed column has no SQL behind it, so CTAS
// would omit it silently. Must refuse.
$ctComputed = $CT_OPTS; $ctComputed['dbdump_columns_custom'] = array('ID', 'DERIVED_PCT');
check('display-computed column -> denied', ct_denied($ctComputed, $CT_PRE), true);
$w = ''; db_dump_ctas_eligible($ctComputed, $CT_PRE, $w);
check('...and names the offending column', strpos($w, 'DERIVED_PCT') !== false, true);

$ctBad = $CT_PRE; $ctBad['resolvedQuery'] = 'UPDATE t SET x = 1';
check('non-SELECT query -> denied',  ct_denied($CT_OPTS, $ctBad), true);
$ctWith = $CT_PRE; $ctWith['resolvedQuery'] = 'WITH c AS (SELECT 1 id, 2 txt FROM dual) SELECT * FROM c';
check('WITH ... SELECT is accepted', db_dump_ctas_eligible($CT_OPTS, $ctWith, $w), true);
$ctNoRaw = $CT_PRE; unset($ctNoRaw['rawData']);
check('no raw row to validate against -> denied', ct_denied($CT_OPTS, $ctNoRaw), true);
$ctLong = $CT_OPTS; $ctLong['destination_table'] = str_repeat('A', 29);
check('destination too long -> denied', ct_denied($ctLong, $CT_PRE), true);

check('SELECT is built from the chosen columns, in order',
      db_dump_build_ctas_select('SELECT id, txt FROM t', array('TXT', 'ID')),
      'SELECT "TXT", "ID" FROM (SELECT id, txt FROM t)');
check('trailing semicolon stripped',
      db_dump_build_ctas_select("SELECT id FROM t;  \n", array('ID')),
      'SELECT "ID" FROM (SELECT id FROM t)');
// A bare ROWNUM predicate returns an ARBITRARY subset, so a capped task could
// dump different rows each run. query.php's own limiter adds ORDER BY 1 for
// exactly this reason; CTAS must match it.
check('row cap is DETERMINISTIC (ORDER BY 1, like query.php)',
      db_dump_build_ctas_select('SELECT id FROM t', array('ID'), 500),
      'SELECT "ID" FROM (SELECT id FROM t) ORDER BY 1 FETCH FIRST 500 ROWS ONLY');
check('no bare ROWNUM predicate anywhere',
      strpos(db_dump_build_ctas_select('SELECT id FROM t', array('ID'), 500), 'ROWNUM'), false);

// Preserve-table mode keeps the table OBJECT so grants, indexes, triggers and
// dependent views survive. CTAS is DROP + CREATE + RENAME and would destroy all
// of them without asking.
$ctPreserve = $CT_OPTS; $ctPreserve['dbdump_reload_mode'] = 'truncate';
check('preserve-table (truncate) reload -> denied', ct_denied($ctPreserve, $CT_PRE), true);
$w = ''; db_dump_ctas_eligible($ctPreserve, $CT_PRE, $w);
check('...and says why (indexes/triggers/views)', strpos($w, 'indexes') !== false, true);
$ctRecreate = $CT_OPTS; $ctRecreate['dbdump_reload_mode'] = 'recreate';
check('explicit recreate mode is still eligible', db_dump_ctas_eligible($ctRecreate, $CT_PRE, $w), true);
check('zero cap means no cap',
      db_dump_build_ctas_select('SELECT id FROM t', array('ID'), 0),
      'SELECT "ID" FROM (SELECT id FROM t)');
check('lower-case picks are upper-cased to match Oracle',
      db_dump_build_ctas_select('SELECT id FROM t', array('id')),
      'SELECT "ID" FROM (SELECT id FROM t)');

echo "\n=== 4c. Destination conflict, including the _X shadow ===\n";
// A dump builds into "<dest>_X" and DROPs that name before every run, so a task
// targeting FOO silently destroyed the DESTINATION of a task targeting FOO_X.
// Both the save-time check and the runner's re-check used a bare ===, so the
// pair saved cleanly and coexisted until one ate the other.
$dbcSrc = $app . DIRECTORY_SEPARATOR . 'db_connection.php';
if (!is_readable($dbcSrc)) { fwrite(STDERR, "FATAL: cannot read $dbcSrc\n"); exit(2); }
$tmp4 = tempnam(sys_get_temp_dir(), 'pnbcf') . '.php';
file_put_contents($tmp4, "<?php\n" . lift(file($dbcSrc), 'penumbra_dbdump_destinations_conflict'));
require $tmp4;
@unlink($tmp4);

check('identical names conflict',        penumbra_dbdump_destinations_conflict('ALC_SRAR', 'ALC_SRAR'), true);
check('unrelated names do not',          penumbra_dbdump_destinations_conflict('ALC_SRAR', 'OTHER_TBL'), false);
check('FOO vs FOO_X conflicts',          penumbra_dbdump_destinations_conflict('ALC_SRAR', 'ALC_SRAR_X'), true);
check('FOO_X vs FOO conflicts (either order)', penumbra_dbdump_destinations_conflict('ALC_SRAR_X', 'ALC_SRAR'), true);
check('shadow of a shadow conflicts',    penumbra_dbdump_destinations_conflict('ALC_SRAR_X', 'ALC_SRAR_X_X'), true);
check('case and padding are ignored',    penumbra_dbdump_destinations_conflict('  alc_srar  ', 'ALC_SRAR_X'), true);
check('FOOX is NOT the shadow of FOO',   penumbra_dbdump_destinations_conflict('ALC_SRAR', 'ALC_SRARX'), false);
check('FOO_XY is NOT the shadow of FOO', penumbra_dbdump_destinations_conflict('ALC_SRAR', 'ALC_SRAR_XY'), false);
check('a _X suffix two removes apart does not conflict',
      penumbra_dbdump_destinations_conflict('ALC_SRAR', 'ALC_SRAR_X_X'), false);
check('empty never conflicts',           penumbra_dbdump_destinations_conflict('', 'ALC_SRAR'), false);
check('both empty never conflicts',      penumbra_dbdump_destinations_conflict('', ''), false);

echo "\n=== 5. Negative control ===\n";
check('control: a good stream and a truncated one differ',
      consume($GOOD, 0)['usable'] !== consume($trunc, 0)['usable'], true);
check('control: usable() actually returns false for something',
      consume($trunc, 0)['usable'], false);
check('control: eligibility can return true, so the denials mean something',
      db_dump_stream_eligible(true, $OK_OPTS, array(), true, $why), true);

echo "\nSUMMARY  pass=$pass  fail=$fail\n";
exit($fail === 0 ? 0 : 1);
