<?php
// =============================================================================
// PICK LISTS SUITE "picklist" - SERVER HALF (2026-11-11, PICKLIST_SPEC.md sections 4-5)
//
// Tracking fields, slice 1: a row's one value from a list the report's editors define, kept in
// PENUMBRA_JOURNAL_TOGGLE beside the toggle marks as STATE 2 with the option id in FIELD_VALUE.
//   F-*  journalReportStateFlags() / journalDecodeFields(): the saved fields (a toggle's key stays the toggle's)
//   V-*  journalFieldValueOf(): what a request may send as a value
//   W-*  journalFieldWriteRefusal(): journal on, not a toggle's key, a saved field and a live option unless an editor
//   S-*  set_field: the row read LOCKED, conflict / unchanged answered without writing, the MERGE's binds, the audit
//   B-*  set_fields_bulk: per-row previous values (Undo), already-so rows skipped, one audit row, all or nothing
//   T-*  toggles: the fields' values beside the marks, read only for a report with fields; the marks as before
//   H-*  field_history / toggle_history: the field's JOURNAL_FIELD rows; the toggle's history as before
//   I-*  install: FIELD_VALUE in the CREATE, the ALTER for an old table, the early return waits for it
//   K-*  rekey / P-* purge / X-* the isolation rule (no STATE <> 0 read anywhere)
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring server.php
//        [--app DIR]        the build under test (default: the live webroot)
//        [--control]        DIR is the build BEFORE the change: exactly CONTROL_GREEN pass (the toggle paths)
//        [--mutant NAME | --mutants]   single-point reverts: exactly the named asserts go red
// Each build runs in a CHILD process (the lifted functions are defined once per process). The oci_* functions
// are stubs (php -n loads no OCI8): the SQL and binds are recorded, never run.
// =============================================================================
error_reporting(E_ALL);
$APP = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$PHP = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/php.exe';
$args = $argv; array_shift($args);
$opt = function ($n, $d = null) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return $d; $v = $args[$i + 1]; array_splice($args, $i, 2); return $v; };
$flag = function ($n) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return false; array_splice($args, $i, 1); return true; };
$child = $opt('--child');
$app = $opt('--app', $APP);
$oneMutant = $opt('--mutant');
$allMutants = $flag('--mutants');
$control = $flag('--control');
if ($args) { fwrite(STDERR, 'unknown arguments: ' . implode(' ', $args) . "\n"); exit(2); }
$FILES = array('manage_journal.php', 'purge_report_data.php');

// --- mutants: name => [file, old, new, must-red] ------------------------------
$MUTANTS = array(
    // (2026-11-12, DATE_SPEC.md) date columns
    'd-decode'     => array('manage_journal.php', "(\$fd['type'] !== 'pick' && \$fd['type'] !== 'date')) continue;\n                        if (!isset(\$fd['key'])",
                            "\$fd['type'] !== 'pick') continue;\n                        if (!isset(\$fd['key'])",
                            array('D-fields', 'D-label-default', 'D-write-reader', 'D-write-shape', 'D-write-editor', 'D-set', 'D-set-wrongtype', 'D-conflict', 'D-bulk', 'D-read')),
    'd-value'      => array('manage_journal.php', "    if (preg_match(JOURNAL_FIELD_DATE_RE, \$v, \$dm) && checkdate((int)\$dm[2], (int)\$dm[3], (int)\$dm[1])) return \$v;\n", "",
                            array('D-values', 'D-set', 'D-conflict', 'D-bulk')),
    'd-checkdate'  => array('manage_journal.php', "preg_match(JOURNAL_FIELD_DATE_RE, \$v, \$dm) && checkdate((int)\$dm[2], (int)\$dm[3], (int)\$dm[1])",
                            "preg_match(JOURNAL_FIELD_DATE_RE, \$v, \$dm)", array('D-values', 'D-set-bad')),
    'd-shape'      => array('manage_journal.php', "            if (\$isDate && !preg_match(JOURNAL_FIELD_DATE_RE, (string)\$v)) return", "            if (false) return",
                            array('D-write-shape', 'D-write-editor', 'D-set-wrongtype')),
    'd-pickshape'  => array('manage_journal.php', "            if (!\$isDate && !preg_match(JOURNAL_FIELD_VALUE_RE, (string)\$v)) return", "            if (false) return",
                            array('D-write-editor')),
    'd-anyday'     => array('manage_journal.php', "    if (\$def['type'] === 'date') return null;   // any day (its shape is checked above)\n", "",
                            array('D-write-reader', 'D-set', 'D-conflict', 'D-bulk')),
    'noconflict'   => array('manage_journal.php', "if (\$now !== \$prev) return array_merge(array('status' => 'success', 'conflict' => true), \$held);",
                            "if (false) return array_merge(array('status' => 'success', 'conflict' => true), \$held);",
                            array('S-conflict', 'S-dup-conflict', 'D-conflict')),
    'nounchanged'  => array('manage_journal.php', "if (\$now === \$value) return array_merge(array('status' => 'success', 'unchanged' => true), \$held);",
                            "if (false) return array_merge(array('status' => 'success', 'unchanged' => true), \$held);",
                            array('S-unchanged')),
    'nolock'       => array('manage_journal.php', "(\$lock ? \" FOR UPDATE WAIT 10\" : '')", "''",
                            array('S-lock')),
    'state1'       => array('manage_journal.php', "define('JOURNAL_FIELD_STATE', 2);", "define('JOURNAL_FIELD_STATE', 1);",
                            array('S-ok', 'S-clear', 'S-conflict', 'S-unchanged', 'S-cap', 'S-dup-conflict', 'S-dup-retry', 'B-ok', 'B-undo', 'T-fields', 'X-state2', 'D-set', 'D-conflict', 'D-bulk')),
    'toggleguard'  => array('manage_journal.php', "if (\$cur !== null && \$cur['state'] === 1) return array('status' => 'error'",
                            "if (false) return array('status' => 'error'",
                            array('S-toggle-row')),
    'bulktoggle'   => array('manage_journal.php', "            if ((int)\$c['STATE'] === 1) {\n                oci_rollback(\$oci);",
                            "            if (false) {\n                oci_rollback(\$oci);",
                            array('B-toggle')),
    'bulkskip'     => array('manage_journal.php', "            if (\$now === \$vv) continue;   // already so: no write, no event\n", "",
                            array('B-ok', 'D-bulk')),
    'retired'      => array('manage_journal.php', "        if (\$def['options'][\$v]['retired']) return", "        if (false) return",
                            array('W-reader-retired', 'B-refused')),
    'decodetoggle' => array('manage_journal.php', " || in_array(\$fkey, \$keys, true)", "",
                            array('F-toggle-wins')),
    'editorbypass' => array('manage_journal.php', "    if (journalCallerCanEditReport(\$report, \$uid, \$isAdmin)) return null;\n    if (!is_array(\$f['fields'])) return null;",
                            "    if (!is_array(\$f['fields'])) return null;",
                            array('W-editor', 'D-write-editor')),
    'histaction'   => array('manage_journal.php', "\$histAction = \$histField ? 'JOURNAL_FIELD' : 'JOURNAL_TOGGLE';", "\$histAction = 'JOURNAL_TOGGLE';",
                            array('H-field-sql', 'H-field-single', 'H-field-bulk')),
    'histroute'    => array('manage_journal.php', "    if (\$fieldHistory) \$action = 'toggle_history';
", "",
                            array('H-route')),
    'histchanges'  => array('manage_journal.php', "                } elseif (\$histField && isset(\$aft['changes']) && is_array(\$aft['changes'])) {\n                    foreach (\$aft['changes'] as \$c) {\n                        if (is_array(\$c) && isset(\$c['row_key']) && (string)\$c['row_key'] === \$row_key) { \$hit = true; \$chg = \$c; break; }\n                    }\n                }",
                            "                }",
                            array('H-field-bulk', 'H-field-single')),
    'fieldsread'   => array('manage_journal.php', "if (\$sfT['enc'] || (is_array(\$sfT['fields']) && \$sfT['fields'])) {", "if (false) {",
                            array('T-fields', 'T-nocolumn', 'D-read')),
    'nocolready'   => array('manage_journal.php', "                if (journalIsMissingColumnError(\$e->getMessage())) \$fieldReady = false;\n                else error_log",
                            "                error_log",
                            array('T-nocolumn')),
    'cap'          => array('manage_journal.php', "if (\$value !== null && journalToggleRowCount(\$report_id) >= JOURNAL_MAX_TOGGLE_ROWS) {",
                            "if (false && journalToggleRowCount(\$report_id) >= JOURNAL_MAX_TOGGLE_ROWS) {",
                            array('S-cap')),
    'dupdecide'    => array('manage_journal.php', "                try { \$early = \$decide(); } catch (Exception \$e2) { \$refuseWith(\$e2->getMessage(), \$stmt); }\n",
                            "                \$early = null;\n",
                            array('S-dup-conflict', 'S-dup-retry')),
    'nocolmsg'     => array('manage_journal.php', "    if (journalIsMissingColumnError(\$msg)) return 'Pick lists need an update", "    if (false) return 'Pick lists need an update",
                            array('S-nocolumn')),
    'installalter' => array('manage_journal.php', "        \$runStmt('toggle_field_alter', \$stmts['toggle_field_alter']);\n", "",
                            array('I-run')),
    'earlyreturn'  => array('manage_journal.php', "in_array('PENUMBRA_JOURNAL_TOGGLE', \$inSchema, true) && \$hasField\n", "in_array('PENUMBRA_JOURNAL_TOGGLE', \$inSchema, true)\n",
                            array('I-early')),
    'purge'        => array('purge_report_data.php', "ACTION IN ('JOURNAL_TOGGLE', 'JOURNAL_FIELD')", "ACTION = 'JOURNAL_TOGGLE'",
                            array('P-purge')),
    'rekeyleft'    => array('manage_journal.php', "            'left_fields' => \$left['fields']));", "));",
                            array('K-left')),
);
// The build before the change has none of it: only the toggle paths it already had pass.
$CONTROL_GREEN = array('T-marks', 'H-toggle', 'X-no-ne0');

if ($child === null) {
    // ===== PARENT =====
    $runBuild = function ($files) use ($PHP) {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_pl_' . getmypid() . '_' . mt_rand();
        mkdir($dir);
        foreach ($files as $f => $txt) file_put_contents($dir . '/' . $f, $txt);
        $cmd = escapeshellarg($PHP) . ' -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring '
             . escapeshellarg(__FILE__) . ' --child ' . escapeshellarg($dir);
        $out = shell_exec($cmd . ' 2>&1');
        foreach (glob($dir . '/*') as $f) unlink($f);
        rmdir($dir);
        $p = strrpos((string)$out, "\n@@RESULT ");
        if ($p === false) return array(array('FATAL', false, 'child said: ' . substr((string)$out, -1500)));
        return json_decode(substr($out, $p + 10), true);
    };
    $base = array();
    foreach ($FILES as $f) {
        if (!is_file($app . '/' . $f)) { fwrite(STDERR, "no $f in $app\n"); exit(2); }
        $base[$f] = file_get_contents($app . '/' . $f);
    }
    echo 'build: ' . $app . ($control ? '   (as the CONTROL: the build before the change)' : '') . "\n";
    if ($oneMutant || $allMutants) {
        $ok = 0; $bad = 0;
        foreach (($oneMutant ? explode(',', $oneMutant) : array_keys($MUTANTS)) as $m) {
            list($mf, $old, $new, $must) = $MUTANTS[$m];
            $files = $base;
            $c = substr_count($files[$mf], $old);
            if ($c !== 1) { echo "  FAIL  mutant $m: anchor found $c times\n"; $bad++; continue; }
            $files[$mf] = str_replace($old, $new, $files[$mf]);
            $res = $runBuild($files);
            $red = array(); foreach ($res as $r) if (!$r[1]) $red[] = $r[0];
            sort($red); $want = $must; sort($want);
            $good = ($red === $want);
            $ok += $good; $bad += !$good;
            printf("  %s  mutant %-13s turns %s red   [red: %s]\n", $good ? 'PASS' : 'FAIL', $m, implode(' ', $must), implode(' ', $red));
            if (!$good) foreach ($res as $r) if (!$r[1]) printf("        %-18s %s\n", $r[0], substr($r[2], 0, 300));
        }
        echo "SUMMARY mutants ok=$ok bad=$bad\n";
        echo ($bad === 0 && $ok > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
        exit(0);
    }
    $res = $runBuild($base);
    $p = 0; $f = 0; $passed = array(); $failed = array();
    foreach ($res as $r) {
        printf("  %s  %-18s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 400));
        if ($r[1]) { $p++; $passed[] = $r[0]; } else { $f++; $failed[] = $r[0]; }
    }
    echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
    if ($control) {
        $want = $CONTROL_GREEN; sort($want); sort($passed);
        echo 'CONTROL: ' . ($passed === $want ? 'as expected' : 'NOT as expected (want green only: ' . implode(' ', $want) . ')') . "\n";
        echo ($passed === $want) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    } else {
        echo ($f === 0 && $p > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    }
    exit(0);
}

// ===== CHILD: one build =====
ini_set('display_errors', 'stderr');
class PlExit extends Exception {}
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], array(E_ERROR, E_PARSE, E_COMPILE_ERROR), true)) A('FATAL', false, $e['message'] . ' @' . $e['line']);
    echo "\n@@RESULT " . json_encode($GLOBALS['R']);
});
$mj = file_get_contents($child . '/manage_journal.php');
$pr = file_get_contents($child . '/purge_report_data.php');

// Lift a block by brace-matching real tokens: an action's body ($anchor = its if line) or a function (whole).
// exit -> throw new PlExit (a lifted action's exit must not end the child).
function lift_tokens($src, $anchor, $whole) {
    $p = strpos($src, $anchor);
    if ($p === false) return '';
    $toks = token_get_all('<?php ' . substr($src, $p));
    $depth = 0; $out = ''; $started = false;
    foreach ($toks as $t) {
        $s = is_array($t) ? $t[1] : $t;
        if (is_array($t) && $t[0] === T_OPEN_TAG) continue;
        if (!$started) {
            if ($whole) $out .= $s;
            if ($s === '{') { $started = true; $depth = 1; }
            continue;
        }
        if ($s === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) $depth++;
        if ($s === '}') { $depth--; if ($depth === 0) { if ($whole) $out .= '}'; break; } }
        if (is_array($t) && $t[0] === T_EXIT) { $out .= 'throw new PlExit()'; continue; }
        $out .= $s;
    }
    return $out;
}
// The constants the lifted code needs, from the build's own define() lines (a mutant of one is seen).
foreach (array('JOURNAL_FIELD_STATE', 'JOURNAL_FIELD_VALUE_RE', 'JOURNAL_FIELD_DATE_RE', 'JOURNAL_MAX_TOGGLE_ROWS', 'JOURNAL_BULK_MAX_ROWS', 'JOURNAL_ROW_KEY_BYTES') as $cn) {
    if (preg_match('/^define\(\'' . $cn . '\',[^\n]*\);$/m', $mj, $m)) eval($m[0]);
}
if (!defined('JOURNAL_FIELD_STATE')) define('JOURNAL_FIELD_STATE', -1);          // the control: none of it
if (!defined('JOURNAL_FIELD_VALUE_RE')) define('JOURNAL_FIELD_VALUE_RE', '/^$/');
if (!defined('JOURNAL_FIELD_DATE_RE')) define('JOURNAL_FIELD_DATE_RE', '/^$/');   // (2026-11-12) a build before date columns
if (!defined('JOURNAL_MAX_TOGGLE_ROWS')) define('JOURNAL_MAX_TOGGLE_ROWS', 250000);
if (!defined('JOURNAL_BULK_MAX_ROWS')) define('JOURNAL_BULK_MAX_ROWS', 5000);
define('JOURNAL_PARK_OPEN_SQL', "UNISTR('\\2402')");
define('JOURNAL_PARK_CLOSE_SQL', "UNISTR('\\2403')");
define('JOURNAL_KEYFILE_TK', '__keyfile');
if (!defined('OCI_NO_AUTO_COMMIT')) define('OCI_NO_AUTO_COMMIT', 0);

$bodies = array();
foreach (array('set_field', 'set_fields_bulk', 'field_status', 'toggles', 'install', 'rekey') as $ac) {
    $bodies[$ac] = lift_tokens($mj, "if (\$action === '$ac') {", false);
}
$bodies['history'] = lift_tokens($mj, "if (\$action === 'toggle_history') {", false);   // field_history runs through it
$histIsNew = strpos($mj, "\$fieldHistory = (\$action === 'field_history');") !== false;
$fns = array();
foreach (array('journalReportStateFlags', 'journalFieldValueOf', 'journalFieldWriteRefusal', 'journalFieldAuditContext',
               'journalFieldMergeSql', 'journalFieldCurrent', 'journalIsMissingColumnError', 'journalFieldWriteFailure', 'journalCallerCanEditReport',
               'journalToggleRowCount', 'journalSanitizeToggleKey', 'journalIsMissingTableError', 'journalInstallStatements') as $fn) {
    $fns[$fn] = lift_tokens($mj, "function $fn(", true);
}
A('P-lifted', $bodies['set_field'] !== '' && $bodies['set_fields_bulk'] !== '' && $bodies['field_status'] !== '' && $histIsNew
    && strpos($fns['journalReportStateFlags'], 'journalFields') !== false && $fns['journalFieldWriteRefusal'] !== '' && $fns['journalFieldMergeSql'] !== '',
    'lifted: ' . json_encode(array_map('strlen', $fns + $bodies)));

// --- stubs ------------------------------------------------------------------------------------------------
$GLOBALS['OCI'] = array();
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'binds' => array(), 'runs' => array()); return $k; }
function oci_bind_by_name($st, $name, &$var, $len = -1, $type = 0) { $GLOBALS['OCI'][$st]['binds'][$name] = &$var; return true; }
function oci_execute($st, $mode = 0) {
    $ok = !empty($GLOBALS['EXEC']) ? array_shift($GLOBALS['EXEC']) : true;
    $snap = array(); foreach ($GLOBALS['OCI'][$st]['binds'] as $k => $v) $snap[$k] = $v;
    $GLOBALS['OCI'][$st]['runs'][] = array('ok' => $ok, 'binds' => $snap);
    return $ok;
}
function oci_num_rows($st) { return !empty($GLOBALS['OCI_ROWS']) ? array_shift($GLOBALS['OCI_ROWS']) : 1; }
function oci_commit($c) { $GLOBALS['TX'][] = 'commit'; return true; }
function oci_rollback($c) { $GLOBALS['TX'][] = 'rollback'; return true; }
function oci_free_statement($st) { return true; }
function oci_error($x = null) { return array('message' => isset($GLOBALS['ERRMSG']) ? $GLOBALS['ERRMSG'] : 'stub'); }
function getOci8Connection() { return 'oci'; }
function readClobViaOci8($t, $c, $k, $id) { return $GLOBALS['STATE_RAW']; }
function utf8ize($x) { return $x; }
function logPenumbraAudit($rid, $action, $before, $after, $msg) { $GLOBALS['AUDIT'][] = array('action' => $action, 'after' => json_decode($after, true), 'msg' => $msg); }
function journalGetReport($conn, $id) { $GLOBALS['RID'] = isset($GLOBALS['RID']) ? $GLOBALS['RID'] + 1 : 100; return array('ID' => $GLOBALS['RID'], 'SHORT_ID' => 'rpt', 'OWNER_ID' => 'owner'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanReadJournal($r, $u, $a) { return true; }
function penumbraIsReportOwner($owner, $uid) { return !empty($GLOBALS['EDITOR']); }
function journalCallerHoldsGrant($r, $u) { return false; }
function journalRowKeyIsFiledForm($k) { return false; }
function journalEnsureFiledFor($r) { return 'ok'; }
function journalWriteKeyRefusal($r, $d) { return null; }
function journalFilingHold($r) { return null; }
function journalKeySig($cols) { return implode('|', (array)$cols); }
function journalParkedSummary($sql, $rid, $field) { $GLOBALS['PARKED_SQL'][] = array($sql, $field); return array(); }
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = array($sql, $binds);
    if (strpos($sql, 'ALL_TAB_COLUMNS') !== false) {
        if (!empty($GLOBALS['COLERR'])) throw new Exception('ORA-00942: table or view does not exist');
        return array(array('CNT' => $GLOBALS['COLCNT']));
    }
    if (strpos($sql, 'COUNT(*) AS C FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid') !== false && strpos($sql, 'STATE') === false) return array(array('C' => $GLOBALS['ROWCOUNT']));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false && strpos($sql, 'ROW_KEY = :rk') !== false && strpos($sql, 'TOGGLE_KEY = :tk') !== false) {
        if (strpos($sql, 'FOR UPDATE') === false && empty($GLOBALS['CUR_UNLOCKED_OK'])) $GLOBALS['UNLOCKED_READS'][] = $sql;
        $r = !empty($GLOBALS['CUR_Q']) ? array_shift($GLOBALS['CUR_Q']) : (isset($GLOBALS['CUR_AFTER']) ? $GLOBALS['CUR_AFTER'] : null);
        if (is_string($r)) throw new Exception($r);
        return $r === null ? array() : array($r);
    }
    if (strpos($sql, 'TOGGLE_KEY = :tk FOR UPDATE') !== false) {
        if (!empty($GLOBALS['BULK_ERR'])) throw new Exception($GLOBALS['BULK_ERR']);
        return $GLOBALS['CUR_ROWS'];
    }
    if (strpos($sql, 'STATE = ' . JOURNAL_FIELD_STATE . ' ') !== false && strpos($sql, 'FIELD_VALUE') !== false) {
        if (!empty($GLOBALS['NO_COLUMN'])) throw new Exception('ORA-00904: "FIELD_VALUE": invalid identifier');
        return $GLOBALS['FIELD_ROWS'];
    }
    if (strpos($sql, 'SELECT DISTINCT TOGGLE_KEY') !== false) return $GLOBALS['USED'];
    if (strpos($sql, 'STATE = 1') !== false && strpos($sql, 'TOGGLE_KEY, ROW_KEY') !== false) return $GLOBALS['TOGGLE_ROWS'];
    if (strpos($sql, "'JOURNAL_REKEY'") !== false) return array();
    throw new Exception('unexpected SQL: ' . substr($sql, 0, 200));
}
function queryViaOci8Each($sql, $binds, $cb) {
    $GLOBALS['Q'][] = array($sql, $binds);
    $act = preg_match("/ACTION = '([A-Z_]+)'/", $sql, $m) ? $m[1] : '?';
    foreach ($GLOBALS['AUDIT_ROWS'] as $row) { if ($row['ACTION'] === $act) $cb($row); }
}
foreach ($fns as $fn => $code) { if ($code !== '' && !function_exists($fn)) eval($code); }
// The control has none of the new helpers: what the lifted bodies call must exist.
if (!function_exists('journalSanitizeToggleKey')) { function journalSanitizeToggleKey($k) { return strtolower((string)$k); } }
if (!function_exists('journalIsMissingTableError')) { function journalIsMissingTableError($m) { return strpos($m, 'ORA-00942') !== false; } }
if (!function_exists('journalIsMissingColumnError')) { function journalIsMissingColumnError($m) { return false; } }
if (!function_exists('journalFieldValueOf')) { function journalFieldValueOf($v) { return false; } }
if (!function_exists('journalFieldWriteRefusal')) { function journalFieldWriteRefusal() { return false; } }
if (!function_exists('journalInstallStatements')) { function journalInstallStatements() { return array(); } }
if (!function_exists('journalReportStateFlags')) { function journalReportStateFlags($r) { return array('on' => true, 'enc' => false); } }

// --- the saved state the report holds --------------------------------------------------------------------
$PICK = array('key' => 'status', 'type' => 'pick', 'label' => 'Status', 'options' => array(
    array('id' => 'o1', 'label' => 'Not started', 'color' => 'grey'),
    array('id' => 'o2', 'label' => 'Waiting on PI', 'color' => 'amber', 'oldLabels' => array('Waiting')),
    array('id' => 'o3', 'label' => 'Done', 'color' => 'green'),
    array('id' => 'o4', 'label' => 'Withdrawn', 'retired' => true)));
function state_raw($vo, $enc = false) {
    if ($enc) return '{"encrypted":true,"content":"abc"}';
    return json_encode(array('name' => 'rpt', 'viewOptions' => $vo));
}
function vo_with($extra = array()) {
    global $PICK;
    return array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID'),
        'journalToggles' => array(array('key' => 'done', 'label' => 'Done')), 'journalFields' => array($PICK)), $extra);
}
$flagsOf = function ($vo, $enc = false) {
    $GLOBALS['STATE_RAW'] = state_raw($vo, $enc);
    $GLOBALS['RID'] = isset($GLOBALS['RID']) ? $GLOBALS['RID'] + 1 : 100;   // a fresh id: the function caches per report
    return journalReportStateFlags(array('ID' => $GLOBALS['RID']));
};

// --- F: the saved fields -------------------------------------------------------------------------------------
$f = $flagsOf(vo_with());
$st = isset($f['fields']['status']) ? $f['fields']['status'] : null;
A('F-fields', is_array($st) && $st['type'] === 'pick' && $st['label'] === 'Status' && count($st['options']) === 4
    && $st['options']['o2']['label'] === 'Waiting on PI' && $st['options']['o4']['retired'] === true && $st['options']['o1']['retired'] === false,
    json_encode(isset($f['fields']) ? $f['fields'] : null));
$f = $flagsOf(vo_with(array('journalFields' => array(array('key' => 'done', 'type' => 'pick', 'label' => 'Clash', 'options' => array())))));
A('F-toggle-wins', isset($f['fields']) && is_array($f['fields']) && !isset($f['fields']['done']), 'a toggle\'s key stays the toggle\'s: ' . json_encode(isset($f['fields']) ? $f['fields'] : null));
$f = $flagsOf(vo_with(array('journalFields' => array(
    array('key' => 'kind', 'type' => 'lookup', 'label' => 'Later type'),   // (2026-11-12) 'date' is a type now: D-*
    array('key' => '__keyfile', 'type' => 'pick', 'label' => 'Reserved'),
    array('type' => 'pick', 'label' => 'No key'),
    array('key' => 'stage', 'type' => 'pick', 'options' => array(array('id' => 'x1', 'label' => 'Bad id'), array('id' => 7), array('id' => 'o5', 'label' => 'Fine')))))));
A('F-skips', isset($f['fields']) && array_keys($f['fields']) === array('stage') && array_keys($f['fields']['stage']['options']) === array('o5')
    && $f['fields']['stage']['label'] === 'Status', json_encode(isset($f['fields']) ? $f['fields'] : null));
$f = $flagsOf(vo_with(), true);
A('F-enc', array_key_exists('fields', $f) && $f['fields'] === null && !empty($f['enc']), json_encode($f));
$f = $flagsOf(array('journalEnabled' => true));
A('F-none', isset($f['fields']) && $f['fields'] === array(), json_encode(isset($f['fields']) ? $f['fields'] : 'missing'));

// --- V: values -----------------------------------------------------------------------------------------------
$vals = array(array(null, null), array('', null), array('o1', 'o1'), array('o2045', 'o2045'), array('o0', false), array('o01', false),
              array('x1', false), array(5, false), array('o12345', false), array(array('o1'), false), array('o1 ', false));
$bad = array();
foreach ($vals as $vv) { $got = journalFieldValueOf($vv[0]); if ($got !== $vv[1]) $bad[] = json_encode($vv[0]) . ' -> ' . json_encode($got); }
A('V-values', !$bad, $bad ? implode('; ', $bad) : 'all 11 as expected');

// --- W: write refusals ---------------------------------------------------------------------------------------
$refuse = function ($vo, $key, $values, $editor = false, $enc = false) use ($flagsOf) {
    $GLOBALS['STATE_RAW'] = state_raw($vo, $enc);
    $GLOBALS['RID'] = isset($GLOBALS['RID']) ? $GLOBALS['RID'] + 1 : 100;
    $GLOBALS['EDITOR'] = $editor;
    return journalFieldWriteRefusal(array('ID' => $GLOBALS['RID'], 'SHORT_ID' => 'rpt', 'OWNER_ID' => 'owner'), $key, $values, 'kim', false);
};
$w = $refuse(vo_with(array('journalEnabled' => false)), 'status', array('o1'));
A('W-off', is_string($w) && strpos($w, 'off') !== false, json_encode($w));
$w = $refuse(vo_with(), 'done', array('o1'), true);
A('W-toggle', is_string($w) && strpos($w, 'toggle') !== false, 'even an editor: ' . json_encode($w));
$w = $refuse(vo_with(), '__keyfile', array(null), true);
A('W-reserved', is_string($w), json_encode($w));
$w1 = $refuse(vo_with(), 'stage', array('o1'));
$w2 = $refuse(vo_with(), 'status', array('o9'));
$w3 = $refuse(vo_with(), 'status', array('o1', null, 'o3'));
A('W-reader', is_string($w1) && is_string($w2) && $w3 === null, json_encode(array($w1, $w2, $w3)));
$w = $refuse(vo_with(), 'status', array('o4'));
A('W-reader-retired', is_string($w) && strpos($w, 'retired') !== false, json_encode($w));
$w1 = $refuse(vo_with(), 'stage', array('o1'), true);
$w2 = $refuse(vo_with(), 'status', array('o9', 'o4'), true);
A('W-editor', $w1 === null && $w2 === null, 'a field or option added on screen: ' . json_encode(array($w1, $w2)));
$w = $refuse(vo_with(array('journalEnabled' => false)), 'anything', array('o9'), false, true);
A('W-enc', $w === null, json_encode($w));

// --- the actions ---------------------------------------------------------------------------------------------
$run = function ($body, $data, $setup) {
    foreach (array('Q', 'AUDIT', 'TX', 'UNLOCKED_READS', 'PARKED_SQL', 'EXEC', 'OCI_ROWS', 'CUR_Q') as $g) $GLOBALS[$g] = array();
    $GLOBALS['OCI'] = array();
    $GLOBALS['ERRMSG'] = isset($setup['err']) ? $setup['err'] : 'stub';
    $GLOBALS['EXEC'] = isset($setup['exec']) ? $setup['exec'] : array();
    $GLOBALS['OCI_ROWS'] = isset($setup['rows']) ? $setup['rows'] : array();
    $GLOBALS['CUR_Q'] = isset($setup['cur']) ? $setup['cur'] : array();
    $GLOBALS['CUR_AFTER'] = isset($setup['after']) ? $setup['after'] : null;
    $GLOBALS['CUR_ROWS'] = isset($setup['curRows']) ? $setup['curRows'] : array();
    $GLOBALS['BULK_ERR'] = isset($setup['bulkErr']) ? $setup['bulkErr'] : null;
    $GLOBALS['ROWCOUNT'] = isset($setup['count']) ? $setup['count'] : 10;
    $GLOBALS['FIELD_ROWS'] = isset($setup['fieldRows']) ? $setup['fieldRows'] : array();
    $GLOBALS['TOGGLE_ROWS'] = isset($setup['toggleRows']) ? $setup['toggleRows'] : array();
    $GLOBALS['USED'] = isset($setup['used']) ? $setup['used'] : array();
    $GLOBALS['NO_COLUMN'] = !empty($setup['noColumn']);
    $GLOBALS['COLCNT'] = isset($setup['colcnt']) ? $setup['colcnt'] : 1;
    $GLOBALS['COLERR'] = !empty($setup['colerr']);
    $GLOBALS['AUDIT_ROWS'] = isset($setup['auditRows']) ? $setup['auditRows'] : array();
    $GLOBALS['EDITOR'] = !empty($setup['editor']);
    $GLOBALS['STATE_RAW'] = state_raw(isset($setup['vo']) ? $setup['vo'] : vo_with(), !empty($setup['enc']));
    $_GET = isset($setup['get']) ? $setup['get'] : array();
    if ($body === '') return array('j' => array(), 'thrown' => 'not lifted', 'oci' => array(), 'audit' => array(), 'tx' => array(), 'q' => array(), 'code' => 0);
    $fn = eval('return function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin, $action, $fieldHistory) { ' . $body . ' };');
    ob_start();
    $thrown = '';
    @http_response_code(200);
    try { $fn($data, null, 'kim', '', !empty($setup['admin']), isset($setup['action']) ? $setup['action'] : '', !empty($setup['fieldHistory'])); }
    catch (PlExit $e) { }
    catch (Throwable $e) { $thrown = $e->getMessage(); }
    $out = ob_get_clean();
    $j = json_decode($out, true);
    return array('j' => is_array($j) ? $j : array('raw' => $out), 'thrown' => $thrown, 'code' => @http_response_code(),
                 'oci' => $GLOBALS['OCI'], 'audit' => $GLOBALS['AUDIT'], 'tx' => $GLOBALS['TX'], 'q' => $GLOBALS['Q']);
};
$merges = function ($r) { $o = array(); foreach ($r['oci'] as $s) if (strpos($s['sql'], 'MERGE INTO PENUMBRA_JOURNAL_TOGGLE') !== false) foreach ($s['runs'] as $run) $o[] = $run; return $o; };
$mergeSql = function ($r) { foreach ($r['oci'] as $s) if (strpos($s['sql'], 'MERGE INTO PENUMBRA_JOURNAL_TOGGLE') !== false) return $s['sql']; return ''; };
$brief = function ($r) { return json_encode(array('j' => $r['j'], 'thrown' => $r['thrown'], 'tx' => $r['tx'], 'audit' => $r['audit'])); };
$cur = function ($state, $v, $by = 'lee', $at = '2026-11-11 09:00:00') { return array('STATE' => $state, 'FIELD_VALUE' => $v, 'UPDATED_BY' => $by, 'UPDATED_AT' => $at); };
$SF = $bodies['set_field'];
$one = array('report_id' => 'rpt', 'row_key' => 'P-1', 'toggle_key' => 'status', 'value' => 'o2', 'prev' => null, 'key_cols' => array('ID'));

// S-ok: an empty row set to o2
$r = $run($SF, $one, array('cur' => array(null), 'after' => $cur(2, 'o2', 'kim', '2026-11-11 10:00:00')));
$m = $merges($r);
$b = $m ? $m[0]['binds'] : array();
$au = $r['audit'] ? $r['audit'][0] : null;
A('S-ok', count($m) === 1 && $b[':st'] === 2 && $b[':st2'] === 2 && $b[':v'] === 'o2' && $b[':v4'] === 'o2' && $b[':tk'] === 'status' && $b[':rk'] === 'P-1'
    && $r['tx'] === array('commit') && $r['j']['status'] === 'success' && $r['j']['v'] === 'o2' && $r['j']['unchanged'] === false
    && $au && $au['action'] === 'JOURNAL_FIELD' && $au['after']['from'] === null && $au['after']['to'] === 'o2'
    && $au['after']['label'] === 'Status' && $au['after']['option_labels'] === array('o2' => 'Waiting on PI') && $au['after']['key_cols'] === array('ID'),
    json_encode($b) . ' ' . $brief($r));
$sql = $mergeSql($r);
A('S-merge-sql', strpos($sql, 'WHERE DECODE(t.FIELD_VALUE, :v2, 0, 1) = 1') !== false && strpos($sql, 'WHERE :v4 IS NOT NULL') !== false
    && strpos($sql, 't.FIELD_VALUE = :v') !== false && strpos($sql, 'STATE = :st,') !== false, $sql);
$lockSql = '';
foreach ($r['q'] as $q) if (strpos($q[0], 'ROW_KEY = :rk') !== false && strpos($q[0], 'FIELD_VALUE') !== false) { $lockSql = $q[0]; break; }
A('S-lock', strpos($lockSql, 'FOR UPDATE WAIT 10') !== false, 'the first read of the row: ' . $lockSql);

// S-clear: o2 -> nothing
$r = $run($SF, array_merge($one, array('value' => null, 'prev' => 'o2')), array('cur' => array($cur(2, 'o2')), 'after' => $cur(0, null, 'kim')));
$m = $merges($r);
$b = $m ? $m[0]['binds'] : array();
A('S-clear', count($m) === 1 && $b[':st'] === 0 && $b[':v'] === '' && $b[':v4'] === '' && $r['j']['v'] === null
    && $r['audit'] && $r['audit'][0]['after']['to'] === null && $r['audit'][0]['after']['from'] === 'o2' && strpos($r['audit'][0]['msg'], 'Cleared') === 0,
    json_encode($b) . ' ' . $brief($r));

// S-conflict: the row holds o3, the page showed nothing
$r = $run($SF, $one, array('cur' => array($cur(2, 'o3', 'lee', '2026-11-11 10:42:00'))));
A('S-conflict', !$merges($r) && $r['tx'] === array('rollback') && !empty($r['j']['conflict']) && $r['j']['v'] === 'o3' && $r['j']['by'] === 'lee'
    && $r['j']['at'] === '2026-11-11 10:42:00' && !$r['audit'], $brief($r));

// S-unchanged: it already holds o2 (the page knew)
$r = $run($SF, array_merge($one, array('prev' => 'o2')), array('cur' => array($cur(2, 'o2'))));
A('S-unchanged', !$merges($r) && $r['tx'] === array('rollback') && !empty($r['j']['unchanged']) && empty($r['j']['conflict']) && $r['j']['v'] === 'o2' && !$r['audit'], $brief($r));

// S-toggle-row: the key holds toggle marks
$r = $run($SF, $one, array('cur' => array($cur(1, null))));
A('S-toggle-row', !$merges($r) && $r['j']['status'] === 'error' && strpos($r['j']['message'], 'toggle marks') !== false, $brief($r));

// S-bad: a malformed value, no key
$r1 = $run($SF, array_merge($one, array('value' => 'zz')), array());
$r2 = $run($SF, array_merge($one, array('toggle_key' => '')), array());
$r3 = $run($SF, array_merge($one, array('prev' => 7)), array());
A('S-bad', $r1['code'] === 400 && $r2['code'] === 400 && $r3['code'] === 400 && !$r1['q'] && !$merges($r1),
    json_encode(array($r1['j'], $r2['j'], $r3['j'], $r1['code'], $r2['code'], $r3['code'])));

// S-cap: no new value at the ceiling; a clear still goes
$r1 = $run($SF, $one, array('count' => JOURNAL_MAX_TOGGLE_ROWS, 'cur' => array(null)));
$r2 = $run($SF, array_merge($one, array('value' => null, 'prev' => 'o2')), array('count' => JOURNAL_MAX_TOGGLE_ROWS, 'cur' => array($cur(2, 'o2'))));
A('S-cap', !$merges($r1) && $r1['j']['status'] === 'error' && strpos($r1['j']['message'], 'most') !== false && count($merges($r2)) === 1,
    $brief($r1) . ' / ' . $brief($r2));

// S-nocolumn: a table not updated for fields
$r = $run($SF, $one, array('cur' => array('ORA-00904: "FIELD_VALUE": invalid identifier')));
A('S-nocolumn', !$merges($r) && $r['j']['status'] === 'error' && strpos($r['j']['message'], 'update to the journal tables') !== false && $r['tx'] === array('rollback'), $brief($r));

// S-refused: journal off -> nothing read or written
$r = $run($SF, $one, array('vo' => vo_with(array('journalEnabled' => false))));
A('S-refused', $r['j']['status'] === 'error' && !$merges($r) && !$r['tx'], $brief($r));

// S-dup-conflict: the insert loses a race (ORA-00001); the row now holds o3 -> conflict, no second write
$r = $run($SF, $one, array('cur' => array(null, $cur(2, 'o3', 'pat')), 'exec' => array(false), 'err' => 'ORA-00001: unique constraint violated'));
$m = $merges($r);
A('S-dup-conflict', count($m) === 1 && !empty($r['j']['conflict']) && $r['j']['v'] === 'o3' && end($r['tx']) === 'rollback' && !$r['audit'], $brief($r) . ' merges=' . count($m));

// S-dup-retry: the race's row was cleared again before the re-read (it holds what the page showed: nothing) ->
// written as the update
$r = $run($SF, $one, array('cur' => array(null, $cur(0, null, 'pat')), 'exec' => array(false, true), 'err' => 'ORA-00001: unique constraint violated', 'after' => $cur(2, 'o2', 'kim')));
$m = $merges($r);
A('S-dup-retry', count($m) === 2 && $m[1]['ok'] === true && $r['tx'] === array('commit') && $r['j']['v'] === 'o2' && count($r['audit']) === 1, $brief($r) . ' merges=' . count($m));

// --- B: bulk ---------------------------------------------------------------------------------------------------
$SB = $bodies['set_fields_bulk'];
$bulk = array('report_id' => 'rpt', 'toggle_key' => 'status', 'values' => array('A' => 'o3', 'B' => 'o3', 'C' => 'o3', '123' => 'o3'), 'key_cols' => array('ID'));
$r = $run($SB, $bulk, array('curRows' => array(array('ROW_KEY' => 'A', 'STATE' => 2, 'FIELD_VALUE' => 'o3'), array('ROW_KEY' => 'B', 'STATE' => 2, 'FIELD_VALUE' => 'o1'),
    array('ROW_KEY' => '123', 'STATE' => 0, 'FIELD_VALUE' => null))));
$m = $merges($r);
$keys = array(); foreach ($m as $x) $keys[] = $x['binds'][':rk'];
$au = $r['audit'] ? $r['audit'][0]['after'] : array();
A('B-ok', $keys === array('B', 'C', '123') && $m[0]['binds'][':st'] === 2 && $m[0]['binds'][':v'] === 'o3' && $r['tx'] === array('commit')
    && $r['j']['count'] === 3 && $r['j']['skipped'] === 1
    && $r['j']['changed'] === array(array('row_key' => 'B', 'prev' => 'o1'), array('row_key' => 'C', 'prev' => null), array('row_key' => '123', 'prev' => null))
    && count($r['audit']) === 1 && !empty($au['bulk']) && $au['row_count'] === 3 && $au['changes'][0] === array('row_key' => 'B', 'from' => 'o1', 'to' => 'o3')
    && $au['changes'][2]['row_key'] === '123' && $au['option_labels'] === array('o1' => 'Not started', 'o3' => 'Done'),
    'merged ' . json_encode($keys) . ' ' . $brief($r));
$lockSql = '';
foreach ($r['q'] as $q) if (strpos($q[0], 'TOGGLE_KEY = :tk FOR UPDATE') !== false) $lockSql = $q[0];
A('B-lock', $lockSql !== '' && strpos($lockSql, 'WAIT 10') !== false, $lockSql);

// B-undo: each row its own previous value
$r = $run($SB, array('report_id' => 'rpt', 'toggle_key' => 'status', 'values' => array('B' => 'o1', 'C' => null)),
    array('curRows' => array(array('ROW_KEY' => 'B', 'STATE' => 2, 'FIELD_VALUE' => 'o3'), array('ROW_KEY' => 'C', 'STATE' => 2, 'FIELD_VALUE' => 'o3'))));
$m = $merges($r);
A('B-undo', count($m) === 2 && $m[0]['binds'][':v'] === 'o1' && $m[0]['binds'][':st'] === 2 && $m[1]['binds'][':v'] === '' && $m[1]['binds'][':st'] === 0
    && $r['j']['changed'] === array(array('row_key' => 'B', 'prev' => 'o3'), array('row_key' => 'C', 'prev' => 'o3')), $brief($r));

// B-toggle: the key holds toggle marks -> nothing written
$r = $run($SB, $bulk, array('curRows' => array(array('ROW_KEY' => 'A', 'STATE' => 1, 'FIELD_VALUE' => null))));
A('B-toggle', !$merges($r) && $r['j']['status'] === 'error' && $r['tx'] === array('rollback'), $brief($r));

// B-bad: one malformed value, one too many rows -> 400 before anything is read
$r1 = $run($SB, array('report_id' => 'rpt', 'toggle_key' => 'status', 'values' => array('A' => 'o3', 'B' => 'bad')), array());
$many = array(); for ($i = 0; $i <= JOURNAL_BULK_MAX_ROWS; $i++) $many['K' . $i] = 'o1';
$r2 = $run($SB, array('report_id' => 'rpt', 'toggle_key' => 'status', 'values' => $many), array());
A('B-bad', $r1['code'] === 400 && $r2['code'] === 400 && !$r1['q'] && !$r2['q'], json_encode(array($r1['j'], $r2['j'])));

// B-cap / B-refused
$r1 = $run($SB, $bulk, array('count' => JOURNAL_MAX_TOGGLE_ROWS - 2));
$r2 = $run($SB, array_merge($bulk, array('values' => array('A' => 'o4'))), array());
A('B-refused', $r1['j']['status'] === 'error' && !$merges($r1) && $r2['j']['status'] === 'error' && strpos($r2['j']['message'], 'retired') !== false && !$merges($r2),
    $brief($r1) . ' / ' . $brief($r2));

// B-fail: a write fails mid-batch -> rolled back, the generic message thrown, no audit
$r = $run($SB, $bulk, array('exec' => array(true, false), 'err' => 'ORA-12345: boom'));
A('B-fail', end($r['tx']) === 'rollback' && !in_array('commit', $r['tx'], true) && $r['thrown'] === 'Failed to update the row values. No rows were changed.' && !$r['audit'], $brief($r));

// --- field_status --------------------------------------------------------------------------------------------
$r1 = $run($bodies['field_status'], null, array('colcnt' => 1, 'admin' => true));
$r2 = $run($bodies['field_status'], null, array('colcnt' => 0));
$r3 = $run($bodies['field_status'], null, array('colerr' => true));
$colSql = ''; foreach ($r1['q'] as $q) if (strpos($q[0], 'ALL_TAB_COLUMNS') !== false) $colSql = $q[0];
A('S-status', $r1['j'] === array('status' => 'success', 'ready' => true, 'known' => true, 'can_install' => true)
    && $r2['j']['ready'] === false && $r2['j']['can_install'] === false && $r3['j']['known'] === false && $r3['j']['ready'] === false
    && strpos($colSql, "OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')") !== false && strpos($colSql, "COLUMN_NAME = 'FIELD_VALUE'") !== false,
    json_encode(array($r1['j'], $r2['j'], $r3['j'], $colSql)));

// --- T: the toggles read -------------------------------------------------------------------------------------
$TG = $bodies['toggles'];
$togRows = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'A', 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-11-10 08:00:00'));
$fRows = array(array('TOGGLE_KEY' => 'status', 'ROW_KEY' => 'A', 'FIELD_VALUE' => 'o2', 'UPDATED_BY' => 'lee', 'UPDATED_AT' => '2026-11-11 09:00:00'),
               array('TOGGLE_KEY' => 'status', 'ROW_KEY' => 'B', 'FIELD_VALUE' => 'o3', 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-11-11 09:30:00'));
$r = $run($TG, null, array('get' => array('report_id' => 'rpt'), 'toggleRows' => $togRows, 'fieldRows' => $fRows, 'used' => array(array('TOGGLE_KEY' => 'done'), array('TOGGLE_KEY' => 'status'))));
A('T-marks', isset($r['j']['toggles']['done']['A']) && $r['j']['toggles']['done']['A'] === array('by' => 'pat', 'at' => '2026-11-10 08:00:00')
    && count($r['j']['toggles']) === 1 && $r['j']['used_keys'] === array('done', 'status'), 'the marks as before: ' . json_encode($r['j']));
$fsql = ''; foreach ($r['q'] as $q) if (strpos($q[0], 'FIELD_VALUE') !== false) $fsql = $q[0];
A('T-fields', isset($r['j']['fields']['status']['B']) && $r['j']['fields']['status']['B'] === array('v' => 'o3', 'by' => 'kim', 'at' => '2026-11-11 09:30:00')
    && count($r['j']['fields']['status']) === 2 && $r['j']['field_ready'] === true && strpos($fsql, 'STATE = 2 ') !== false
    && strpos($fsql, "SUBSTR(ROW_KEY, 1, 1) <> UNISTR('\\2402')") !== false, json_encode(array($r['j'], $fsql)));
$r = $run($TG, null, array('get' => array('report_id' => 'rpt'), 'vo' => vo_with(array('journalFields' => array())), 'toggleRows' => $togRows, 'fieldRows' => $fRows));
$fsql = ''; foreach ($r['q'] as $q) if (strpos($q[0], 'FIELD_VALUE') !== false) $fsql = $q[0];
A('T-nofields', $fsql === '' && isset($r['j']['field_ready']) === false && array_key_exists('field_ready', $r['j']) && $r['j']['fields'] === array() && isset($r['j']['toggles']['done']),
    'no field read for a report without fields: ' . json_encode($r['j']));
$r = $run($TG, null, array('get' => array('report_id' => 'rpt'), 'toggleRows' => $togRows, 'noColumn' => true));
A('T-nocolumn', $r['j']['status'] === 'success' && $r['j']['field_ready'] === false && $r['j']['fields'] === array() && isset($r['j']['toggles']['done']['A']), json_encode($r['j']));

// --- H: history ----------------------------------------------------------------------------------------------
$HB = $bodies['history'];
$aud = function ($action, $after, $by, $ts) { return array('ACTION' => $action, 'AFT' => json_encode($after), 'USER_ID' => $by, 'TS' => $ts); };
$rows = array(
    $aud('JOURNAL_FIELD', array('bulk' => true, 'toggle_key' => 'status', 'row_count' => 2, 'changes' => array(array('row_key' => 'Z', 'from' => null, 'to' => 'o1'), array('row_key' => 'P-1', 'from' => 'o2', 'to' => 'o3')),
        'option_labels' => array('o1' => 'Not started', 'o2' => 'Waiting', 'o3' => 'Done')), 'pat', '2026-11-11 12:00:00'),
    $aud('JOURNAL_FIELD', array('row_key' => 'P-1', 'toggle_key' => 'status', 'from' => null, 'to' => 'o2', 'option_labels' => array('o2' => 'Waiting')), 'lee', '2026-11-11 09:00:00'),
    $aud('JOURNAL_FIELD', array('row_key' => 'P-1', 'toggle_key' => 'other', 'from' => null, 'to' => 'o1'), 'lee', '2026-11-11 08:00:00'),
    $aud('JOURNAL_FIELD', array('row_key' => 'P-2', 'toggle_key' => 'status', 'from' => null, 'to' => 'o1'), 'lee', '2026-11-11 08:00:00'),
    $aud('JOURNAL_TOGGLE', array('row_key' => 'P-1', 'toggle_key' => 'status', 'state' => 1), 'kim', '2026-11-11 07:00:00'),
    $aud('JOURNAL_TOGGLE', array('row_key' => 'P-1', 'toggle_key' => 'done', 'state' => 1), 'kim', '2026-11-10 07:00:00'),
    $aud('JOURNAL_TOGGLE', array('bulk' => true, 'toggle_key' => 'done', 'state' => 0, 'row_keys' => array('X', 'P-1')), 'pat', '2026-11-10 09:00:00'));
$r = $run($HB, null, array('action' => 'toggle_history', 'fieldHistory' => true, 'get' => array('report_id' => 'rpt', 'row_key' => 'P-1', 'toggle_key' => 'status'), 'auditRows' => $rows));
$hsql = ''; foreach ($r['q'] as $q) if (strpos($q[0], 'PENUMBRA_AUDIT') !== false && strpos($q[0], 'JOURNAL_REKEY') === false) $hsql = $q[0];
$ev = isset($r['j']['events']) ? $r['j']['events'] : array();
A('H-field-sql', strpos($hsql, "ACTION = 'JOURNAL_FIELD'") !== false, $hsql);
A('H-field-single', count($ev) === 2 && $ev[1] === array('by' => 'lee', 'at' => '2026-11-11 09:00:00', 'from' => null, 'to' => 'o2', 'from_label' => null, 'to_label' => 'Waiting', 'bulk' => false),
    json_encode($ev));
A('H-field-bulk', isset($ev[0]) && $ev[0] === array('by' => 'pat', 'at' => '2026-11-11 12:00:00', 'from' => 'o2', 'to' => 'o3', 'from_label' => 'Waiting', 'to_label' => 'Done', 'bulk' => true),
    json_encode($ev));
$r = $run($HB, null, array('action' => 'toggle_history', 'get' => array('report_id' => 'rpt', 'row_key' => 'P-1', 'toggle_key' => 'done'), 'auditRows' => $rows));
$ev = isset($r['j']['events']) ? $r['j']['events'] : array();
A('H-toggle', $ev === array(array('by' => 'kim', 'at' => '2026-11-10 07:00:00', 'state' => 1, 'bulk' => false), array('by' => 'pat', 'at' => '2026-11-10 09:00:00', 'state' => 0, 'bulk' => true)),
    'the toggle\'s history as before: ' . json_encode($ev));

A('H-route', strpos($mj, "    \$fieldHistory = (\$action === 'field_history');
    if (\$fieldHistory) \$action = 'toggle_history';
    if (\$action === 'toggle_history') {
") !== false,
    'field_history runs through toggle_history, whose if line stays as it was');

// --- I: install ------------------------------------------------------------------------------------------------
$stm = journalInstallStatements(true, false);
$stq = journalInstallStatements(true, true);
A('I-create', isset($stm['toggle_table']) && strpos($stm['toggle_table'], "    STATE NUMBER(1) DEFAULT 0 NOT NULL,\n    FIELD_VALUE VARCHAR2(1000 BYTE),\n") !== false,
    isset($stm['toggle_table']) ? $stm['toggle_table'] : 'none');
A('I-alter', isset($stm['toggle_field_alter'], $stq['toggle_field_alter']) && $stm['toggle_field_alter'] === 'ALTER TABLE PENUMBRA_JOURNAL_TOGGLE ADD (FIELD_VALUE VARCHAR2(1000 BYTE))'
    && $stq['toggle_field_alter'] === 'ALTER TABLE NC_REPORTING.PENUMBRA_JOURNAL_TOGGLE ADD (FIELD_VALUE VARCHAR2(1000 BYTE))', json_encode(isset($stm['toggle_field_alter']) ? $stm['toggle_field_alter'] : null));
$ib = $bodies['install'];
A('I-run', strpos($ib, "\$runStmt('toggle_field_alter', \$stmts['toggle_field_alter']);") !== false
    && strpos($ib, "COLUMN_NAME = 'FIELD_VALUE'") !== false, 'the install runs the ALTER and checks the column');
A('I-early', strpos($ib, "&& in_array('PENUMBRA_JOURNAL_TOGGLE', \$inSchema, true) && \$hasField\n                && \$hasAttach && \$hasParent\n") !== false, 'the early return waits for the column');

// --- K / P / X ---------------------------------------------------------------------------------------------------
$kb = $bodies['rekey'];
A('K-left', strpos($kb, "STATE = \" . JOURNAL_FIELD_STATE . \" AND SUBSTR(ROW_KEY, 1, :ln) = :tag\"") !== false && strpos($kb, "'left_fields' => \$left['fields']") !== false,
    'rekey counts the values left under the old key');
A('P-purge', strpos($pr, "DELETE FROM PENUMBRA_AUDIT WHERE REPORT_ID = :id AND ACTION IN ('JOURNAL_TOGGLE', 'JOURNAL_FIELD')") !== false, 'clearing toggles clears the fields\' history');
A('X-no-ne0', !preg_match('/STATE\s*(<>|!=|>)\s*0/', $mj), 'no read takes STATE <> 0 (the filing marker is STATE 9)');
A('X-state2', JOURNAL_FIELD_STATE === 2 && strpos($mj, "define('JOURNAL_FIELD_STATE', 2);") !== false, 'a field row is STATE 2');

// --- D: date columns (2026-11-12, DATE_SPEC.md) -----------------------------------------------------------------
// A date column is a field of type 'date': a label, no options, a value that is one calendar day (ISO). Its saved
// type holds for everyone (an editor too); a pick list keeps its option ids.
$DATE = array('key' => 'due', 'type' => 'date', 'label' => 'Due', 'oldLabels' => array('Deadline'));
$vod = function ($extra = array()) use ($DATE) { $vo = vo_with($extra); $vo['journalFields'][] = $DATE; return $vo; };
$f = $flagsOf($vod());
A('D-fields', isset($f['fields']['due'], $f['fields']['status']) && $f['fields']['due'] === array('type' => 'date', 'label' => 'Due', 'options' => array())
    && $f['fields']['status']['type'] === 'pick', json_encode(isset($f['fields']) ? $f['fields'] : null));
$f = $flagsOf(vo_with(array('journalFields' => array(array('key' => 'due', 'type' => 'date')))));
A('D-label-default', isset($f['fields']['due']['label']) && $f['fields']['due']['label'] === 'Due', json_encode(isset($f['fields']) ? $f['fields'] : null));
$dv = array(array('2026-11-21', '2026-11-21'), array('2024-02-29', '2024-02-29'), array('1900-01-01', '1900-01-01'), array('2100-12-31', '2100-12-31'),
            array('2026-02-29', false), array('2026-02-30', false), array('2026-04-31', false), array('2026-13-01', false), array('2026-00-10', false),
            array('1899-12-31', false), array('2101-01-01', false), array('2026-1-5', false), array('26-11-21', false), array('2026-11-21 ', false),
            array('21-NOV-26', false), array('2026-11-21T00:00', false), array('o3', 'o3'));
$bad = array();
foreach ($dv as $vv) { $got = journalFieldValueOf($vv[0]); if ($got !== $vv[1]) $bad[] = json_encode($vv[0]) . ' -> ' . json_encode($got); }
A('D-values', !$bad, $bad ? implode('; ', $bad) : 'all ' . count($dv) . ' as expected');
$w1 = $refuse($vod(), 'due', array('2026-11-21'));
$w7 = $refuse($vod(), 'due', array(null, '2026-11-28'));
A('D-write-reader', $w1 === null && $w7 === null, 'a reader sets and clears a saved date column: ' . json_encode(array($w1, $w7)));
$w2 = $refuse($vod(), 'due', array('o1'));
$w3 = $refuse($vod(), 'status', array('2026-11-21'));
A('D-write-shape', is_string($w2) && strpos($w2, 'not a date') !== false && is_string($w3) && strpos($w3, 'options') !== false,
    'an option id on a date column, a day on a pick list: ' . json_encode(array($w2, $w3)));
$w4 = $refuse($vod(), 'status', array('2026-11-21'), true);
$w5 = $refuse($vod(), 'due', array('o1'), true);
$w6 = $refuse($vod(), 'next', array('2026-11-21'), true);
A('D-write-editor', is_string($w4) && is_string($w5) && $w6 === null,
    'an editor too is held to a SAVED field\'s type; a column added on screen is open: ' . json_encode(array($w4, $w5, $w6)));
$w = $refuse($vod(array('journalEnabled' => false)), 'due', array('o1'), false, true);
A('D-write-enc', $w === null, 'an encrypted state: the shape alone, checked before: ' . json_encode($w));

$oneD = array_merge($one, array('toggle_key' => 'due', 'value' => '2026-11-21'));
$r = $run($SF, $oneD, array('vo' => $vod(), 'cur' => array(null), 'after' => $cur(2, '2026-11-21', 'kim', '2026-11-12 10:00:00')));
$m = $merges($r);
$b = $m ? $m[0]['binds'] : array();
$au = $r['audit'] ? $r['audit'][0] : null;
A('D-set', count($m) === 1 && $b[':v'] === '2026-11-21' && $b[':v4'] === '2026-11-21' && $b[':st'] === 2 && $b[':tk'] === 'due'
    && $r['tx'] === array('commit') && $r['j']['status'] === 'success' && $r['j']['v'] === '2026-11-21'
    && $au && $au['action'] === 'JOURNAL_FIELD' && $au['after']['to'] === '2026-11-21' && $au['after']['from'] === null
    && $au['after']['label'] === 'Due' && !isset($au['after']['option_labels']), json_encode($b) . ' ' . $brief($r));
$r = $run($SF, array_merge($oneD, array('value' => '2026-02-30')), array('vo' => $vod(), 'cur' => array(null)));
A('D-set-bad', !$merges($r) && isset($r['j']['status']) && $r['j']['status'] === 'error' && strpos((string)$r['j']['message'], 'not valid') !== false, $brief($r));
$r = $run($SF, array_merge($oneD, array('value' => 'o2')), array('vo' => $vod(), 'cur' => array(null)));
A('D-set-wrongtype', !$merges($r) && isset($r['j']['status']) && $r['j']['status'] === 'error' && strpos((string)$r['j']['message'], 'not a date') !== false, $brief($r));
$r = $run($SF, array_merge($oneD, array('value' => '2026-11-28', 'prev' => '2026-11-21')), array('vo' => $vod(), 'cur' => array($cur(2, '2026-11-14', 'lee', '2026-11-12 09:00:00'))));
A('D-conflict', !$merges($r) && !empty($r['j']['conflict']) && $r['j']['v'] === '2026-11-14' && $r['j']['by'] === 'lee', $brief($r));
$bulkD = array('report_id' => 'rpt', 'toggle_key' => 'due', 'values' => array('A' => '2026-11-21', 'B' => '2026-11-21', 'C' => null), 'key_cols' => array('ID'));
$r = $run($SB, $bulkD, array('vo' => $vod(), 'curRows' => array(array('ROW_KEY' => 'A', 'STATE' => 2, 'FIELD_VALUE' => '2026-11-21'),
    array('ROW_KEY' => 'B', 'STATE' => 2, 'FIELD_VALUE' => '2026-11-14'), array('ROW_KEY' => 'C', 'STATE' => 2, 'FIELD_VALUE' => '2026-12-01'))));
$m = $merges($r);
$keys = array(); foreach ($m as $x) $keys[] = $x['binds'][':rk'] . '=' . $x['binds'][':v'];
A('D-bulk', $keys === array('B=2026-11-21', 'C=') && $r['tx'] === array('commit') && $r['j']['count'] === 2 && $r['j']['skipped'] === 1
    && $r['j']['changed'] === array(array('row_key' => 'B', 'prev' => '2026-11-14'), array('row_key' => 'C', 'prev' => '2026-12-01')), json_encode($keys) . ' ' . $brief($r));
$TGd = $bodies['toggles'];
$r = $run($TGd, null, array('get' => array('report_id' => 'rpt'), 'vo' => vo_with(array('journalFields' => array($DATE))),
    'fieldRows' => array(array('TOGGLE_KEY' => 'due', 'ROW_KEY' => 'A', 'FIELD_VALUE' => '2026-11-21', 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-11-12 09:30:00'))));
A('D-read', isset($r['j']['fields']['due']['A']) && $r['j']['fields']['due']['A']['v'] === '2026-11-21',
    'a report whose only field is a date column reads its values: ' . json_encode(isset($r['j']['fields']) ? $r['j']['fields'] : $r['j']));
