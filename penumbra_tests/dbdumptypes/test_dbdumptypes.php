<?php
/**
 * =============================================================================
 * DB_DUMP destination column typing - db_dump_resolve_column_types()
 * =============================================================================
 *
 *   php -n test_dbdumptypes.php <app-path>
 *
 * Extracts the three typing functions out of the LIVE schedule_runner.php and
 * exercises them in isolation, so the suite keeps testing real shipped code as
 * that file evolves. Nothing here touches a database or the network.
 *
 * TWO CONTRACTS ARE UNDER TEST:
 *
 *  1. ROWS-PRESENT (the live DB_DUMP call site, 4 args, $allow_meta_only off).
 *     The column SET and ORDER belong to the rows; metadata contributes TYPES
 *     only. This must not drift: $rows at the call site is ALREADY narrowed by
 *     the task's column mode, while $columns_meta still describes the full
 *     driver result - so letting metadata own the set would resurrect every
 *     column the user excluded, as an all-NULL column. The caller also detects
 *     schema drift with !== on the column-name array, which is order-sensitive,
 *     so a reorder here silently rebuilds every preserve-table destination.
 *
 *  2. METADATA-ONLY ($allow_meta_only = true, no rows). Added 2026-08-26 as the
 *     precondition for batched/streaming DB_DUMP, which must CREATE the
 *     destination table before it has read a single row. With no rows there is
 *     no data evidence, so max_len facts are synthesized from the declared
 *     width - a missing entry would read as 0 in db_dump_existing_column_fits()
 *     and wave through a column that is far too narrow.
 *
 * EXPECTED TAIL: "SUMMARY  pass=NN  fail=0".
 * =============================================================================
 */

$app = isset($argv[1]) ? rtrim($argv[1], "\\/") : '\\\\oitras\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$src = $app . DIRECTORY_SEPARATOR . 'schedule_runner.php';
if (!is_readable($src)) {
    fwrite(STDERR, "FATAL: cannot read $src\n");
    exit(2);
}

// --- Lift the functions under test into their own namespace -----------------
// Namespaced so the stubs below win name resolution over anything global, and
// so this file can never accidentally execute the rest of the runner.
function pnb_extract_fn($lines, $name) {
    $out = ''; $in = false;
    foreach ($lines as $l) {
        if (!$in && strpos($l, "function $name(") === 0) $in = true;
        if ($in) {
            $out .= $l;
            if (rtrim($l, "\r\n") === '}') return $out;
        }
    }
    fwrite(STDERR, "FATAL: could not extract $name() from schedule_runner.php\n");
    exit(2);
}

$lines = file($src);
$code  = "<?php namespace Pnb;\n"
       . "function log_scheduler(\$m) { \$GLOBALS['LOG'][] = \$m; }\n"
       . "function db_dump_ddl_says_character(\$c) { return in_array(strtoupper(\$c), \$GLOBALS['DDL_CHAR'], true); }\n"
       . pnb_extract_fn($lines, 'db_dump_resolve_column_types')
       . pnb_extract_fn($lines, 'infer_db_dump_column_types')
       . pnb_extract_fn($lines, 'db_dump_type_from_meta');

$tmp = tempnam(sys_get_temp_dir(), 'pnbddt') . '.php';
file_put_contents($tmp, $code);
require $tmp;
@unlink($tmp);

// --- Harness ----------------------------------------------------------------
$pass = 0; $fail = 0;

function meta($name, $native, $len = 0, $prec = 0, $scale = -1) {
    return array('name' => $name, 'native_type' => $native, 'len' => $len,
                 'precision' => $prec, 'scale' => $scale);
}

function resolve($rows, $cols_meta, $ddl_char = array(), $allow_meta_only = false) {
    $GLOBALS['LOG'] = array();
    $GLOBALS['DDL_CHAR'] = $ddl_char;
    $prov = null; $facts = null;
    $out = Pnb\db_dump_resolve_column_types($rows, $cols_meta, $prov, $facts, $allow_meta_only);
    return array('out' => $out, 'prov' => $prov, 'facts' => $facts, 'log' => $GLOBALS['LOG']);
}

function check($label, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  PASS  $label\n"; return true; }
    $fail++;
    echo "  FAIL  $label\n";
    echo "        want " . json_encode($want) . "\n";
    echo "        got  " . json_encode($got)  . "\n";
    return false;
}

echo "=== 1. Rows present: types resolved, set owned by the rows ===\n";

$r = resolve(array(array('EMPLID' => 'A123', 'AMT' => '10.5'),
                   array('EMPLID' => 'B9',   'AMT' => '7')), array());
check('no metadata -> everything inferred',
      array($r['out'], $r['prov']),
      array(array('EMPLID' => 'VARCHAR2(50)', 'AMT' => 'NUMBER'),
            array('EMPLID' => 'inferred', 'AMT' => 'inferred')));

$r = resolve(array(array('EMPLID' => 'A123', 'AMT' => '10.5')),
             array(meta('EMPLID', 'VARCHAR2', 20), meta('AMT', 'NUMBER', 0, 10, 2)));
check('full metadata wins over inference',
      array($r['out'], $r['prov']),
      array(array('EMPLID' => 'VARCHAR2(50)', 'AMT' => 'NUMBER(10,2)'),
            array('EMPLID' => 'meta', 'AMT' => 'meta')));

$r = resolve(array(array('EMPLID' => 'A123', 'AMT' => '10.5', 'NOTE' => 'x')),
             array(meta('EMPLID', 'VARCHAR2', 20)));
check('partial metadata -> per-column fallback',
      array($r['out'], $r['prov']),
      array(array('EMPLID' => 'VARCHAR2(50)', 'AMT' => 'NUMBER', 'NOTE' => 'VARCHAR2(50)'),
            array('EMPLID' => 'meta', 'AMT' => 'inferred', 'NOTE' => 'inferred')));

// THE REGRESSION THIS SUITE EXISTS FOR. $rows is post-column-pick; metadata is
// not. If metadata ever owns the set, SECRET1 reappears as an all-NULL column.
$r = resolve(array(array('EMPLID' => 'A1', 'AMT' => '3')),
             array(meta('EMPLID', 'VARCHAR2', 20), meta('AMT', 'NUMBER'),
                   meta('SECRET1', 'VARCHAR2', 99), meta('SECRET2', 'NUMBER')));
check('metadata superset does NOT widen the column set',
      $r['out'], array('EMPLID' => 'VARCHAR2(50)', 'AMT' => 'NUMBER'));

// Column ORDER is load-bearing: the caller compares name arrays with !==.
$r = resolve(array(array('C_COL' => '1', 'A_COL' => '2', 'B_COL' => '3')),
             array(meta('A_COL', 'NUMBER'), meta('B_COL', 'NUMBER'), meta('C_COL', 'NUMBER')));
check('row order survives metadata in a different order',
      array_keys($r['out']), array('C_COL', 'A_COL', 'B_COL'));

echo "\n=== 2. Typing rules ===\n";

$r = resolve(array(array('DEPT_ID' => '123456'), array('DEPT_ID' => '789012')),
             array(), array('DEPT_ID'));
check('all-digit column rescued to VARCHAR2 by the DDL-cache hint',
      array($r['out'], $r['prov']),
      array(array('DEPT_ID' => 'VARCHAR2(50)'), array('DEPT_ID' => 'ddl')));

$r = resolve(array(array('ZIP' => '02134'), array('ZIP' => '10001')), array());
check('leading zeros keep the column character, never NUMBER',
      $r['out'], array('ZIP' => 'VARCHAR2(50)'));

$r = resolve(array(array('MAYBE' => null), array('MAYBE' => '')), array());
check('all-empty column defaults to VARCHAR2(50)', $r['out'], array('MAYBE' => 'VARCHAR2(50)'));

$r = resolve(array(array('BIG' => str_repeat('x', 5000))), array());
check('over-4000 values cap at VARCHAR2(4000)', $r['out'], array('BIG' => 'VARCHAR2(4000)'));

$r = resolve(array(array('WHEN_D' => '01/02/2026')), array(meta('WHEN_D', 'DATE')));
check('DATE metadata lands as VARCHAR2(50), not a real DATE',
      $r['out'], array('WHEN_D' => 'VARCHAR2(50)'));

$r = resolve(array(array('BLOB_ISH' => 'abc')), array(meta('BLOB_ISH', 'RAW', 100)));
check('unusable native_type falls back to inference',
      array($r['out'], $r['prov']),
      array(array('BLOB_ISH' => 'VARCHAR2(50)'), array('BLOB_ISH' => 'inferred')));

$r = resolve(array(array('SUM(AMT)' => '5', 'OK_COL' => 'y')),
             array(meta('SUM(AMT)', 'NUMBER'), meta('OK_COL', 'VARCHAR2', 10)));
check('column Oracle cannot name unquoted is skipped', $r['out'], array('OK_COL' => 'VARCHAR2(50)'));
check('...and warned exactly once', count($r['log']), 1);

echo "\n=== 3. No rows: the historical skip contract ===\n";

check('no rows, no metadata -> empty', resolve(array(), array())['out'], array());
check('no rows + metadata, without opt-in -> still empty (caller preserves the table)',
      resolve(array(), array(meta('EMPLID', 'VARCHAR2', 20), meta('AMT', 'NUMBER')))['out'],
      array());

echo "\n=== 4. Metadata-only resolution (streaming precondition) ===\n";

$r = resolve(array(), array(meta('EMPLID', 'VARCHAR2', 20), meta('AMT', 'NUMBER')), array(), true);
check('resolves a full column set with no rows in hand',
      array($r['out'], $r['prov']),
      array(array('EMPLID' => 'VARCHAR2(50)', 'AMT' => 'NUMBER'),
            array('EMPLID' => 'meta', 'AMT' => 'meta')));

check('max_len synthesized from the declared width (0 would wave through a narrow column)',
      array($r['facts']['EMPLID']['max_len'], $r['facts']['AMT']['max_len']),
      array(50, 0));

$r = resolve(array(), array(meta('SUM(AMT)', 'NUMBER'), meta('GOOD_COL', 'VARCHAR2', 30)), array(), true);
check('bad identifier skipped on the metadata path too', $r['out'], array('GOOD_COL' => 'VARCHAR2(50)'));
check('...and warned, since no inference pass could have', count($r['log']), 1);

check('metadata column with no usable type is omitted, not guessed',
      resolve(array(), array(meta('BLOB_ISH', 'RAW', 100), meta('GOOD_COL', 'VARCHAR2', 30)), array(), true)['out'],
      array('GOOD_COL' => 'VARCHAR2(50)'));

check('opt-in with no metadata at all is still empty', resolve(array(), array(), array(), true)['out'], array());

// The opt-in must not change anything when rows ARE present, so a future caller
// cannot accidentally widen the set by passing true.
$rows = array(array('EMPLID' => 'A1', 'AMT' => '3'));
$cm   = array(meta('EMPLID', 'VARCHAR2', 20), meta('AMT', 'NUMBER'), meta('SECRET1', 'VARCHAR2', 99));
check('opt-in is inert while rows are present',
      resolve($rows, $cm, array(), true), resolve($rows, $cm, array(), false));

echo "\n=== 5. Negative control ===\n";
// A suite that cannot fail proves nothing. Two genuinely different inputs must
// compare unequal through the same code path used by every check above.
check('control: differing inputs are detected',
      resolve(array(array('A_COL' => '1')), array())['out'] !== resolve(array(array('A_COL' => 'x')), array())['out'],
      true);

echo "\nSUMMARY  pass=$pass  fail=$fail\n";
exit($fail === 0 ? 0 : 1);
