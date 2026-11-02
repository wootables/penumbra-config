<?php
// =============================================================================
// SHARED NOTE SUITE "sharednote" - SERVER HALF (2026-11-01)
//
// The Notes column's second type (viewOptions.journalNotesMode 'shared'): ONE note a table row,
// free text anyone who reads the journal edits, saved only from the text it holds now.
//   F-*  journalReportStateFlags(): 'shared' read from the saved state (needs row notes; never encrypted)
//   E-*  the 'edit' action: anyone edits a row's root note on a Shared report, base_text required and
//        checked (stale = HTTP 409 with what it holds), cleared = deleted, audited with whose it was
//   A-*  the 'add' action: a row that has its note refuses a second (409 with it)
//   U-*  journalUpdateNoteText / journalDeleteSharedNote: the base compared IN the statement (DBMS_LOB.COMPARE)
//   X-*  journal_export.php: the NOTES column carries the note's own text (journalSharedNoteText)
//   C-*  the Discussion type exactly as before (the control's green rows)
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring server.php
//        [--app DIR]        the build under test (default: the live webroot)
//        [--control]        the build BEFORE the change: exactly CONTROL_RED fails
//        [--mutant NAME | --mutants]   single-point reverts: exactly the named asserts go red
//        [--text-out FILE]  journalSharedNoteText(PARITY fixture) to FILE (run.py's JS parity check)
// Each build runs in a CHILD process (the lifted functions are defined once per process). The
// oci_* functions are stubs here (php -n loads no OCI8): the SQL and binds are recorded, never run.
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
$textOut = $opt('--text-out');
$allMutants = $flag('--mutants');
$control = $flag('--control');
if ($args) { fwrite(STDERR, 'unknown arguments: ' . implode(' ', $args) . "\n"); exit(2); }

// --- mutants: name => [file, old, new, must-red] ------------------------------
$MUTANTS = array(
    'anyone'     => array('manage_journal.php', "            if (!\$shared) {\n            echo json_encode(array('status' => 'error', 'message' => 'Only the note\\'s author can edit it.'));",
                          "            if (false) {\n            echo json_encode(array('status' => 'error', 'message' => 'Only the note\\'s author can edit it.'));",
                          array('C-author', 'E-reply-author', 'E-pivot-author')),
    'nobase'     => array('manage_journal.php', "            if (\$base_in === null) {\n                http_response_code(400);", "            if (false) {\n                http_response_code(400);",
                          array('E-nobase')),
    'stale'      => array('manage_journal.php', "if (\$base_in !== (string)\$note['NOTE_TEXT']) journalSharedConflict(", "if (false) journalSharedConflict(",
                          array('E-stale')),
    'nocompare'  => array('manage_journal.php', "    if (\$base !== null) \$sql .= \" AND DBMS_LOB.COMPARE(NOTE_TEXT, :b_base) = 0\";", "",
                          array('U-base-sql')),
    'noeditor'   => array('manage_journal.php', "\$shared ? array((string)\$currentUserKey, journalAuthorName()) : null) < 1) {", "null) < 1) {",
                          array('E-ok')),
    'race'       => array('manage_journal.php', "            if (\$shared) {\n                // 0 rows: it changed (or went) between the read above and the UPDATE.", "            if (false) {\n                // 0 rows: it changed (or went) between the read above and the UPDATE.",
                          array('E-race')),
    'noclear'    => array('manage_journal.php', "if (\$shared && \$note_text === '' && !\$hasFile) {", "if (false) {",
                          array('E-clear', 'E-clear-race')),
    'quiet'      => array('manage_journal.php', "if (\$reply_root !== null && !\$quietReply) {", "if (\$reply_root !== null) {",
                          array('A-quiet')),
    'clearfiles' => array('manage_journal.php', "        if (\$sharedFiles) \$hasFile = true;", "",
                          array('E-clear-files')),
    'addguard'   => array('manage_journal.php', "            if (\$sf['shared']) {\n                \$now = journalSharedNoteOf(", "            if (false) {\n                \$now = journalSharedNoteOf(",
                          array('A-exists', 'A-none')),
    'flagrows'   => array('manage_journal.php', "\$f['shared'] = !empty(\$vo['journalRowNotes']) && isset(", "\$f['shared'] = isset(",
                          array('F-needs-rownotes')),
    'exportmode' => array('journal_export.php', "if (isset(\$vo['journalNotesMode']) && \$vo['journalNotesMode'] === 'shared') { foreach", "if (false) { foreach",
                          array('X-resolver')),
    'rootonly'   => array('journal_export.php', "            if (\$pid === '' || \$pid === '0') \$best = \$n;", "            \$best = \$n;",
                          array('X-text', 'X-reply-last', 'X-empty')),
);
// The build before the change: every shared-only assert fails; the Discussion rows (C-*) and the "a reply / a pivot
// row's note stays its author's" rows pass (the old build refuses every non-author).
$CONTROL_RED = array('E-clear-files', 'A-quiet', 'P-lifted', 'F-shared', 'F-needs-rownotes', 'F-enc', 'F-default',
    'E-ok', 'E-nobase', 'E-stale', 'E-race', 'E-clear', 'E-clear-race', 'E-audit',
    'A-exists', 'A-none', 'U-base-sql', 'U-editor-sql', 'U-delete-sql', 'X-text', 'X-reply-last', 'X-empty', 'X-resolver');

// --- the parity fixture: run.py hands the same notes to main.js journalNotesFlatten() in Shared mode ---
function sn_note($id, $rk, $text, $by, $at, $parent = null, $name = null) {
    return array('ID' => (string)$id, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'CREATED_BY' => $by, 'AUTHOR_NAME' => $name,
                 'CREATED_AT' => $at, 'PARENT_ID' => $parent === null ? null : (string)$parent, 'ATTACH_NAME' => null);
}
function parity_notes() {
    return array(
        sn_note(1, 'K', 'an old discussion note', 'pat', '2026-10-01 09:05:00', null, 'Pat Doe'),
        sn_note(2, 'K', "  address: 12 Elm St\r\nphone: 555-0100\r\n\r\n  ", 'lee', '2026-10-02 10:00:00', null, 'Lee Roe'),
        sn_note(3, 'K', 'a reply after it', 'kim', '2026-10-03 11:00:00', 2, 'Kim Lo'),
    );
}
define('PARITY_WANT', "address: 12 Elm St\nphone: 555-0100");

if ($child === null) {
    // ===== PARENT =====
    $runBuild = function ($files, $label) use ($PHP, $textOut) {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_sn_' . getmypid() . '_' . mt_rand();
        mkdir($dir);
        foreach ($files as $f => $txt) file_put_contents($dir . '/' . $f, $txt);
        $cmd = escapeshellarg($PHP) . ' -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring '
             . escapeshellarg(__FILE__) . ' --child ' . escapeshellarg($dir) . ($textOut ? ' --text-out ' . escapeshellarg($textOut) : '');
        $out = shell_exec($cmd . ' 2>&1');
        foreach (glob($dir . '/*') as $f) unlink($f);
        rmdir($dir);
        $p = strrpos((string)$out, "\n@@RESULT ");
        if ($p === false) return array(array('FATAL', false, 'child said: ' . substr((string)$out, -1500)));
        return json_decode(substr($out, $p + 10), true);
    };
    $read = function ($dir) {
        $o = array();
        foreach (array('manage_journal.php', 'journal_export.php') as $f) {
            if (!is_file($dir . '/' . $f)) { fwrite(STDERR, "no $f in $dir\n"); exit(2); }
            $o[$f] = file_get_contents($dir . '/' . $f);
        }
        return $o;
    };
    $base = $read($control ? $GLOBALS['APP'] : $app);
    if ($control) echo "build: the LIVE webroot as the control (the build before the change)\n"; else echo "build: $app\n";
    if ($oneMutant || $allMutants) {
        $ok = 0; $bad = 0;
        foreach (($oneMutant ? explode(',', $oneMutant) : array_keys($MUTANTS)) as $m) {
            list($mf, $old, $new, $must) = $MUTANTS[$m];
            $files = $base;
            $c = substr_count($files[$mf], $old);
            if ($c !== 1) { echo "  FAIL  mutant $m: anchor found $c times\n"; $bad++; continue; }
            $files[$mf] = str_replace($old, $new, $files[$mf]);
            $res = $runBuild($files, $m);
            $red = array(); foreach ($res as $r) if (!$r[1]) $red[] = $r[0];
            sort($red); $want = $must; sort($want);
            $good = ($red === $want);
            $ok += $good; $bad += !$good;
            printf("  %s  mutant %-11s turns %s red   [red: %s]\n", $good ? 'PASS' : 'FAIL', $m, implode(' ', $must), implode(' ', $red));
            if (!$good) foreach ($res as $r) if (!$r[1]) printf("        %-18s %s\n", $r[0], substr($r[2], 0, 300));
        }
        echo "SUMMARY mutants ok=$ok bad=$bad\n";
        echo ($bad === 0 && $ok > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
        exit(0);
    }
    $res = $runBuild($base, 'build');
    $p = 0; $f = 0; $failed = array();
    foreach ($res as $r) {
        printf("  %s  %-18s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 400));
        if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; }
    }
    echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
    if ($control) {
        $want = $CONTROL_RED; sort($want); sort($failed);
        echo 'CONTROL: ' . ($failed === $want ? 'as expected' : 'NOT as expected (want red: ' . implode(' ', $want) . ')') . "\n";
        echo ($failed === $want) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    } else {
        echo ($f === 0 && $p > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    }
    exit(0);
}

// ===== CHILD: one build =====
ini_set('display_errors', 'stderr');
class SnExit extends Exception {}
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], array(E_ERROR, E_PARSE, E_COMPILE_ERROR), true)) A('FATAL', false, $e['message'] . ' @' . $e['line']);
    echo "\n@@RESULT " . json_encode($GLOBALS['R']);
});
$mj = file_get_contents($child . '/manage_journal.php');

// Lift a block by brace-matching real tokens: an action's body ($anchor = its if line) or a function
// (whole). exit -> throw new SnExit (a lifted helper's exit must not end the child).
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
        if (is_array($t) && $t[0] === T_EXIT) { $out .= 'throw new SnExit()'; continue; }
        $out .= $s;
    }
    return $out;
}
$editBody = lift_tokens($mj, "if (\$action === 'edit') {", false);
$addBody = lift_tokens($mj, "if (\$action === 'add') {", false);
$fns = array();
foreach (array('journalReportStateFlags', 'journalUpdateNoteText', 'journalDeleteSharedNote', 'journalSharedNoteOf', 'journalSharedConflict', 'journalSharedHasReplies') as $fn) {
    $fns[$fn] = lift_tokens($mj, "function $fn(", true);
}
A('P-lifted', $editBody !== '' && $addBody !== '' && $fns['journalReportStateFlags'] !== '' && $fns['journalUpdateNoteText'] !== ''
    && $fns['journalDeleteSharedNote'] !== '' && $fns['journalSharedNoteOf'] !== '' && $fns['journalSharedConflict'] !== '',
    'lifted: ' . json_encode(array_map(function ($x) { return strlen($x); }, $fns)));

// --- stubs: the DB, OCI8, the helpers the actions call --------------------------
$GLOBALS['OCI'] = array();
class SnLob { public $v = null; function writeTemporary($v, $t = 0) { $this->v = $v; return true; } function free() { return true; } }
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'binds' => array()); return $k; }   // a handle is never falsy
function oci_new_descriptor($c, $t) { return new SnLob(); }
function oci_bind_by_name($st, $name, &$var, $len = -1, $type = 0) { $GLOBALS['OCI'][$st]['binds'][$name] = &$var; return true; }
function oci_execute($st, $mode = 0) { $GLOBALS['OCI'][$st]['executed'] = true; return true; }
function oci_num_rows($st) { return !empty($GLOBALS['OCI_ROWS']) ? array_shift($GLOBALS['OCI_ROWS']) : 1; }
function oci_commit($c) { return true; }
function oci_free_statement($st) { return true; }
function oci_error($x = null) { return array('message' => 'stub'); }
function getOci8Connection() { return 'oci'; }
if (!defined('OCI_D_LOB')) define('OCI_D_LOB', 50);
if (!defined('OCI_B_CLOB')) define('OCI_B_CLOB', 112);
if (!defined('OCI_TEMP_CLOB')) define('OCI_TEMP_CLOB', 2);
if (!defined('OCI_NO_AUTO_COMMIT')) define('OCI_NO_AUTO_COMMIT', 0);
function readClobViaOci8($t, $c, $k, $id) { return $GLOBALS['STATE_RAW']; }
function journalSanitizeToggleKey($k) { $k = strtolower(preg_replace('/[^A-Za-z0-9_\-]/', '', (string)$k)); return $k === '' ? 'done' : substr($k, 0, 100); }

function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = $sql;
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ID = :nid') !== false) {
        $n = isset($GLOBALS['REREAD']) ? $GLOBALS['REREAD'] : $GLOBALS['NOTE'];
        if (strpos($sql, 'SCOPE') === false && isset($GLOBALS['REREAD'])) return $n ? array($n) : array();
        return $GLOBALS['NOTE'] ? array($GLOBALS['NOTE']) : array();
    }
    if (strpos($sql, "SCOPE = 'row' AND ROW_KEY = :rk") !== false) return $GLOBALS['ROWNOTE'] ? array($GLOBALS['ROWNOTE']) : array();
    if (strpos($sql, 'SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL') !== false) return array();
    if (strpos($sql, 'COUNT(*) AS CNT FROM PENUMBRA_JOURNAL WHERE PARENT_ID = :nid') !== false) return array(array('CNT' => isset($GLOBALS['REPLIES']) ? $GLOBALS['REPLIES'] : 0));   // (sharedfiles)
    if (strpos($sql, 'SELECT ID, PARENT_ID, SCOPE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE ID = :pid') !== false) return array(array('ID' => '902', 'PARENT_ID' => null, 'SCOPE' => 'row', 'ROW_KEY' => 'P-1'));
    if (strpos($sql, 'SELECT DISTINCT LOWER(CREATED_BY) AS CREATOR') !== false) return array(array('CREATOR' => 'pat'), array('CREATOR' => 'lee'));
    if (strpos($sql, 'COUNT(*) AS CNT FROM PENUMBRA_JOURNAL WHERE REPORT_ID') !== false) { if (!empty($GLOBALS['COUNT_OK'])) return array(array('CNT' => 0)); throw new Exception('REACHED_COUNT'); }
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL') !== false && strpos($sql, "SCOPE = 'row'") !== false) return $GLOBALS['EXPORT_NOTES'];
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return array();
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    throw new Exception('unexpected SQL: ' . substr($sql, 0, 200));
}
function journalGetReport($conn, $id) { return array('ID' => 7, 'SHORT_ID' => 'rpt'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanReadJournal($r, $u, $a) { return true; }
function journalHasAttachColumn() { return true; }
function journalHasParentColumn() { return true; }
function utf8ize($x) { return $x; }
function journalRowRefLine($scope, $t) { return 'ROW: ' . $t; }
function journalRowRefText($scope, $k, $snap) { return $k; }
function journalAuthorName() { return 'Kim Lo'; }
function journalResolveMentionAccess($c, $r, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = array('authorized' => true, 'name' => $u); return $o; }
function journalTargetCanOpenJournal($r, $u) { return true; }
function journalSendMentionEmail() { $GLOBALS['MAILS'][] = func_get_arg(0); return true; }
function logPenumbraAudit($rid, $action, $before, $after, $msg) { $GLOBALS['AUDIT'][] = array($action, $before, $after, $msg); }
function journalRowKeyIsFiledForm($k) { return false; }
function journalEnsureFiledFor($r) { return 'ok'; }
function journalWriteKeyRefusal($r, $s) { return null; }
function journalIsMissingTableError($m) { return false; }
function journalAuthorCapRefusal() { return null; }   // (sharedfiles) the add path past its count: the insert and its mails
function journalFilingHold($r) { return null; }
function execClobInsert() { $GLOBALS['INSERTS'][] = func_get_arg(2); return 1; }
function journalSendReplyEmail() { $GLOBALS['REPLYMAILS'][] = func_get_arg(0); return true; }
function journalSplitParked($k) { return array($k, null); }
function log_scheduler($m) { $GLOBALS['LOG'][] = $m; }
function journalKeySig($cols) { return implode('|', $cols); }   // (as notescol's) the filing block skipped
if (!defined('JOURNAL_NOTE_MAX_CHARS')) define('JOURNAL_NOTE_MAX_CHARS', 8000);
if (!defined('JOURNAL_MAX_MENTIONS')) define('JOURNAL_MAX_MENTIONS', 20);
if (!defined('JOURNAL_ATTACH_MAX_BYTES')) define('JOURNAL_ATTACH_MAX_BYTES', 5242880);
if (!defined('JOURNAL_MAX_NOTES_PER_REPORT')) define('JOURNAL_MAX_NOTES_PER_REPORT', 1000);   // (sharedfiles) the add path's cap
foreach ($fns as $fn => $code) { if ($code !== '' && !function_exists($fn)) eval($code); }
// the control has none of the new helpers: the actions it lifts must still run
if (!function_exists('journalReportStateFlags')) { function journalReportStateFlags($r) { return array('on' => true, 'enc' => false, 'shared' => false); } }
if (!function_exists('journalSharedNoteOf')) { function journalSharedNoteOf($a, $b) { return null; } }

// state flags: the saved state the report holds
function state_raw($vo, $enc = false) {
    if ($enc) return '{"encrypted":true,"content":"abc"}';
    return json_encode(array('name' => 'rpt', 'viewOptions' => $vo));
}
$flags = function ($vo, $enc = false) use ($fns) {
    $GLOBALS['STATE_RAW'] = state_raw($vo, $enc);
    // journalReportStateFlags caches per report id: a fresh copy each call (renamed)
    static $n = 0; $n++;
    if ($fns['journalReportStateFlags'] === '') return array();
    $code = preg_replace('/function journalReportStateFlags\(/', 'function sn_flags_' . $n . '(', $fns['journalReportStateFlags'], 1);
    eval($code);
    return call_user_func('sn_flags_' . $n, array('ID' => 7));
};
$f = $flags(array('journalEnabled' => true, 'journalRowNotes' => true, 'journalNotesMode' => 'shared'));
A('F-shared', !empty($f['shared']), json_encode($f));
$f = $flags(array('journalEnabled' => true, 'journalNotesMode' => 'shared'));
A('F-needs-rownotes', isset($f['shared']) && $f['shared'] === false, 'row notes off: not shared ' . json_encode($f));
$f = $flags(array('journalEnabled' => true, 'journalRowNotes' => true, 'journalNotesMode' => 'shared'), true);
A('F-enc', isset($f['shared']) && $f['shared'] === false && !empty($f['enc']), 'an encrypted state: its mode cannot be read ' . json_encode($f));
$f = $flags(array('journalEnabled' => true, 'journalRowNotes' => true));
A('F-default', isset($f['shared']) && $f['shared'] === false, 'Discussion when not written ' . json_encode($f));

// --- the edit action ------------------------------------------------------------
$SHARED = array('on' => true, 'enc' => false, 'shared' => true, 'toggles' => array(), 'labels' => array(), 'keyCols' => array('ID'));
$DISC = array('on' => true, 'enc' => false, 'shared' => false, 'toggles' => array(), 'labels' => array(), 'keyCols' => array('ID'));
function root_note($extra = array()) {
    return array_merge(array('ID' => '902', 'REPORT_ID' => '7', 'SCOPE' => 'row', 'ROW_KEY' => 'P-1', 'NOTE_TEXT' => "address: 12 Elm St\nphone: 555-0100",
        'ROW_SNAPSHOT' => null, 'MENTIONS' => null, 'CREATED_BY' => 'lee', 'AUTHOR_NAME' => 'Lee Roe', 'ATTACH_NAME' => null,
        'PARENT_ID' => null, 'CREATED_AT' => '2026-10-30 09:00:00'), $extra);
}
// journalReportStateFlags is the real one when lifted: the edit action reads the flags through it, so the
// state it reads is set per call (and its per-request cache defeated: a fresh report array id each time)
$run = function ($body, $data, $setup) use ($SHARED) {
    $GLOBALS['NOTE'] = array_key_exists('note', $setup) ? $setup['note'] : root_note();
    unset($GLOBALS['REREAD']);
    if (array_key_exists('reread', $setup)) $GLOBALS['REREAD'] = $setup['reread'];
    $GLOBALS['ROWNOTE'] = isset($setup['rownote']) ? $setup['rownote'] : null;
    $GLOBALS['OCI'] = array(); $GLOBALS['OCI_ROWS'] = isset($setup['rows']) ? $setup['rows'] : array();
    $GLOBALS['AUDIT'] = array(); $GLOBALS['MAILS'] = array(); $GLOBALS['Q'] = array();
    $GLOBALS['REPLIES'] = isset($setup['replies']) ? $setup['replies'] : 0; $GLOBALS['COUNT_OK'] = !empty($setup['countOk']);
    $GLOBALS['INSERTS'] = array(); $GLOBALS['REPLYMAILS'] = array();
    $GLOBALS['FLAGS_NOW'] = isset($setup['flags']) ? $setup['flags'] : $SHARED;
    $GLOBALS['STATE_RAW'] = state_raw(array('journalEnabled' => true, 'journalRowNotes' => true, 'journalKeyColumns' => array('ID'))
        + (!empty($GLOBALS['FLAGS_NOW']['shared']) ? array('journalNotesMode' => 'shared') : array()));
    $code = 'return function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin) { ' . $body . ' };';
    $fn = eval($code);
    ob_start();
    $code = 200; $thrown = '';
    if (function_exists('http_response_code')) @http_response_code(200);
    try { $fn($data, null, isset($setup['me']) ? $setup['me'] : 'kim', '', false); }
    catch (SnExit $e) { }
    catch (Throwable $e) { $thrown = $e->getMessage(); }
    $out = ob_get_clean();
    $j = json_decode($out, true);
    return array('j' => is_array($j) ? $j : array('raw' => $out), 'thrown' => $thrown, 'code' => @http_response_code(),
                 'oci' => $GLOBALS['OCI'], 'audit' => $GLOBALS['AUDIT']);
};
// the flags the actions read: through the real function (cache keyed by report id 7 - reset by re-eval)
if ($fns['journalReportStateFlags'] !== '') {
    // the real function caches per id within a process: give each call a fresh process-wide cache by
    // routing through a wrapper reading STATE_RAW now (the lifted function's static cache would pin the first)
}
$updates = function ($r) { $o = array(); foreach ($r['oci'] as $s) if (strpos($s['sql'], 'UPDATE PENUMBRA_JOURNAL') === 0) $o[] = $s; return $o; };
$deletes = function ($r) { $o = array(); foreach ($r['oci'] as $s) if (strpos($s['sql'], 'DELETE FROM PENUMBRA_JOURNAL WHERE ID') === 0) $o[] = $s; return $o; };
$bind = function ($s, $k) { return isset($s['binds'][$k]) ? (is_object($s['binds'][$k]) ? $s['binds'][$k]->v : $s['binds'][$k]) : null; };

if ($editBody !== '') {
    // the real journalReportStateFlags caches report 7 forever in this process: the edit action is
    // rewritten to read the flags through a fresh call per run (one textual swap, both builds)
    $editRun = str_replace('journalReportStateFlags($report)', '$GLOBALS[\'FLAGS_NOW\']', $editBody);
    $addRun = str_replace('journalReportStateFlags($report)', '$GLOBALS[\'FLAGS_NOW\']', $addBody);
    $BASE = "address: 12 Elm St\nphone: 555-0100";

    // C: Discussion as before
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'x'), array('flags' => $DISC));
    A('C-author', ($r['j']['status'] ?? '') === 'error' && stripos($r['j']['message'] ?? '', 'author') !== false && !$updates($r), 'a Discussion note is its author\'s: ' . json_encode($r['j']));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'mine now'), array('flags' => $DISC, 'me' => 'lee'));
    $u = $updates($r);
    A('C-own', ($r['j']['status'] ?? '') === 'success' && count($u) === 1 && strpos($u[0]['sql'], 'COMPARE') === false && strpos($u[0]['sql'], 'CREATED_BY') === false,
        'the author edits as before (no base, no new owner): ' . json_encode($r['j']) . ' ' . ($u ? $u[0]['sql'] : ''));

    // E: Shared
    $r = $run($editRun, array('note_id' => 902, 'note_text' => "address: 14 Oak Ave\nphone: 555-0100", 'base_text' => $BASE), array());
    $u = $updates($r);
    A('E-ok', ($r['j']['status'] ?? '') === 'success' && count($u) === 1 && $bind($u[0], ':b_text') === "address: 14 Oak Ave\nphone: 555-0100"
        && $bind($u[0], ':b_base') === $BASE && $bind($u[0], ':b_by') === 'kim' && $bind($u[0], ':b_an') === 'Kim Lo',
        'kim (not the author) saves from the text it holds, and the note reads as kim\'s: ' . json_encode($r['j']) . ' binds ' . json_encode($u ? array_map(function ($v) { return is_object($v) ? $v->v : $v; }, $u[0]['binds']) : null));
    $au = $r['audit'];
    A('E-audit', count($au) === 1 && $au[0][0] === 'JOURNAL_EDIT' && strpos($au[0][1], '"created_by":"lee"') !== false && strpos($au[0][1], '12 Elm St') !== false
        && strpos($au[0][3], 'Edited shared note') === 0, 'the audit keeps the text replaced and whose it was: ' . json_encode($au));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'x'), array());
    A('E-nobase', ($r['j']['status'] ?? '') === 'error' && $r['code'] === 400 && !$updates($r), 'no base_text, no save: ' . json_encode($r['j']) . ' ' . $r['code']);
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'x', 'base_text' => 'what I saw an hour ago'), array());
    A('E-stale', $r['code'] === 409 && !empty($r['j']['conflict']) && ($r['j']['current']['NOTE_TEXT'] ?? '') === $BASE && ($r['j']['current']['AUTHOR_NAME'] ?? '') === 'Lee Roe' && !$updates($r),
        'a stale base: 409 with what it holds now, nothing written: ' . $r['code'] . ' ' . json_encode($r['j']));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'x', 'base_text' => $BASE),
        array('rows' => array(0), 'reread' => root_note(array('NOTE_TEXT' => 'pat got there first', 'CREATED_BY' => 'pat', 'AUTHOR_NAME' => 'Pat Doe'))));
    A('E-race', $r['code'] === 409 && ($r['j']['current']['NOTE_TEXT'] ?? '') === 'pat got there first' && !$r['audit'],
        'changed between the read and the UPDATE (0 rows): 409 with the new text, no audit: ' . $r['code'] . ' ' . json_encode($r['j']));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => '   ', 'base_text' => $BASE), array());
    $d = $deletes($r);
    A('E-clear', ($r['j']['status'] ?? '') === 'success' && !empty($r['j']['cleared']) && count($d) === 1 && $bind($d[0], ':b_base') === $BASE
        && count($r['audit']) === 1 && $r['audit'][0][0] === 'JOURNAL_DELETE' && !$updates($r), 'emptied = deleted, from the base, audited: ' . json_encode($r['j']) . ' ' . json_encode($r['audit']));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => '', 'base_text' => $BASE),
        array('rows' => array(0), 'reread' => root_note(array('NOTE_TEXT' => 'pat wrote more'))));
    A('E-clear-race', $r['code'] === 409 && ($r['j']['current']['NOTE_TEXT'] ?? '') === 'pat wrote more' && !$r['audit'], 'a clear from a stale base: 409, nothing gone: ' . $r['code'] . ' ' . json_encode($r['j']));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'x', 'base_text' => $BASE), array('note' => root_note(array('PARENT_ID' => '901'))));
    A('E-reply-author', ($r['j']['status'] ?? '') === 'error' && stripos($r['j']['message'] ?? '', 'author') !== false && !$updates($r), 'a reply is still its author\'s: ' . json_encode($r['j']));
    $r = $run($editRun, array('note_id' => 902, 'note_text' => 'x', 'base_text' => $BASE), array('note' => root_note(array('SCOPE' => 'pivot'))));
    A('E-pivot-author', ($r['j']['status'] ?? '') === 'error' && stripos($r['j']['message'] ?? '', 'author') !== false && !$updates($r), 'a pivot row\'s note is still its author\'s: ' . json_encode($r['j']));

    // (sharedfiles) a note with files (its replies) keeps its place when its text is cleared: the text empties
    $r = $run($editRun, array('note_id' => 902, 'note_text' => '', 'base_text' => $BASE), array('replies' => 2));
    $u = $updates($r);
    A('E-clear-files', ($r['j']['status'] ?? '') === 'success' && empty($r['j']['cleared']) && count($u) === 1 && $bind($u[0], ':b_text') === '' && $bind($u[0], ':b_base') === $BASE && !$deletes($r),
        'cleared text, files kept: the note stays with empty text: ' . json_encode($r['j']));
    // (sharedfiles) a file added to a Shared note is a reply: no one is mailed for it; a Discussion reply still mails
    $reply = array('report_id' => 'rpt', 'scope' => 'row', 'row_key' => 'P-1', 'note_text' => 'a file note', 'parent_id' => 902, 'key_cols' => array('ID'));
    $r = $run($addRun, $reply, array('countOk' => true));
    A('A-quiet', ($r['j']['status'] ?? '') === 'success' && count($GLOBALS['INSERTS']) === 1 && !$GLOBALS['REPLYMAILS'], 'a reply on a Shared row mails no one: ' . json_encode($r['j']) . ' mails ' . json_encode($GLOBALS['REPLYMAILS']) . ' ' . $r['thrown']);
    $r = $run($addRun, $reply, array('countOk' => true, 'flags' => $DISC));
    A('C-reply-mails', ($r['j']['status'] ?? '') === 'success' && count($GLOBALS['REPLYMAILS']) === 2, 'a Discussion reply mails the thread, as before: ' . json_encode($GLOBALS['REPLYMAILS']) . ' ' . $r['thrown']);

    // A: the add action's one-note rule
    $add = array('report_id' => 'rpt', 'scope' => 'row', 'row_key' => 'P-1', 'note_text' => 'a second note', 'key_cols' => array('ID'));
    $r = $run($addRun, $add, array('rownote' => root_note()));
    A('A-exists', $r['code'] === 409 && ($r['j']['current']['ID'] ?? 0) === 902 && $r['thrown'] === '', 'a row with its note: 409 with it, no insert: ' . $r['code'] . ' ' . json_encode($r['j']) . ' ' . $r['thrown']);
    $r = $run($addRun, $add, array('rownote' => null));
    A('A-none', $r['thrown'] === 'REACHED_COUNT' && in_array(true, array_map(function ($q) { return strpos($q, "SCOPE = 'row' AND ROW_KEY = :rk") !== false; }, $GLOBALS['Q']), true),
        'no note yet: the row is looked at, then on to the insert: ' . $r['thrown'] . ' ' . json_encode($r['j']));
    $r = $run($addRun, $add, array('rownote' => root_note(), 'flags' => $DISC));
    A('C-add', $r['thrown'] === 'REACHED_COUNT', 'Discussion: a row takes any number of notes: ' . $r['thrown'] . ' ' . json_encode($r['j']));
}

// --- U: the statements ------------------------------------------------------------
if ($fns['journalUpdateNoteText'] !== '') {
    $GLOBALS['OCI'] = array(); $GLOBALS['OCI_ROWS'] = array();
    journalUpdateNoteText(902, 7, 'new', '', 'old text', array('kim', 'Kim Lo'));
    $s = $GLOBALS['OCI']['s1'];
    A('U-base-sql', strpos($s['sql'], 'AND DBMS_LOB.COMPARE(NOTE_TEXT, :b_base) = 0') !== false && $bind($s, ':b_base') === 'old text', $s['sql']);
    A('U-editor-sql', strpos($s['sql'], 'CREATED_BY = :b_by, AUTHOR_NAME = :b_an, CREATED_AT = SYSTIMESTAMP') !== false && $bind($s, ':b_by') === 'kim', $s['sql']);
    $GLOBALS['OCI'] = array();
    journalUpdateNoteText(902, 7, 'new', '');
    $s = $GLOBALS['OCI']['s1'];
    A('C-plain-sql', $s['sql'] === 'UPDATE PENUMBRA_JOURNAL SET NOTE_TEXT = :b_text, MENTIONS = :b_mentions WHERE ID = :b_id AND REPORT_ID = :b_rid', 'a Discussion edit, as before: ' . $s['sql']);
}
if ($fns['journalDeleteSharedNote'] !== '') {
    $GLOBALS['OCI'] = array(); $GLOBALS['OCI_ROWS'] = array(1);
    journalDeleteSharedNote(902, 7, 'old text');
    $s = $GLOBALS['OCI']['s1'];
    A('U-delete-sql', strpos($s['sql'], 'DELETE FROM PENUMBRA_JOURNAL WHERE ID = :b_id AND REPORT_ID = :b_rid AND DBMS_LOB.COMPARE(NOTE_TEXT, :b_base) = 0') === 0
        && $bind($s, ':b_base') === 'old text' && isset($GLOBALS['OCI']['s2']) && strpos($GLOBALS['OCI']['s2']['sql'], 'PARENT_ID = :b_id') !== false, $s['sql']);
} else { A('U-delete-sql', false, 'journalDeleteSharedNote not in the build'); }
if ($fns['journalUpdateNoteText'] === '') { A('U-base-sql', false, 'not lifted'); A('U-editor-sql', false, 'not lifted'); A('C-plain-sql', false, 'not lifted'); }

// --- X: journal_export.php ---------------------------------------------------------
require $child . '/journal_export.php';
$has = function_exists('journalSharedNoteText');
$t = $has ? journalSharedNoteText(parity_notes()) : null;
A('X-text', $t === PARITY_WANT, 'the newest root, CRLF -> LF, ends trimmed: ' . json_encode($t));
$t2 = $has ? journalSharedNoteText(array(sn_note(1, 'K', 'root', 'a', '2026-10-01 09:00:00'), sn_note(2, 'K', 'reply', 'b', '2026-10-02 09:00:00', 1))) : null;
A('X-reply-last', $t2 === 'root', 'a reply after it is not the note: ' . json_encode($t2));
A('X-empty', $has && journalSharedNoteText(array()) === '' && journalSharedNoteText(array(sn_note(2, 'K', 'only a reply', 'b', '2026-10-02 09:00:00', 1))) === '', 'none = empty');
if ($textOut) file_put_contents($textOut, json_encode(array('notes' => parity_notes(), 'text' => $t)));
$GLOBALS['EXPORT_NOTES'] = array(sn_note(1, 'P-1', 'first', 'pat', '2026-10-01 09:00:00', null, 'Pat Doe'), sn_note(2, 'P-1', "line 1\r\nline 2", 'lee', '2026-10-02 09:00:00', null, 'Lee Roe'));
$vo = array('journalEnabled' => true, 'journalKeyColumns' => array('PROPOSAL ID'), 'journalRowNotes' => true, 'journalNotesExport' => true);
$rows = array(array('PROPOSAL ID' => 'P-1', 'TITLE' => 'Alpha'), array('PROPOSAL ID' => 'P-2', 'TITLE' => 'Bravo'));
$jt = journalExportToggleColumns('rpt', array('viewOptions' => $vo + array('journalNotesMode' => 'shared')), $rows);
A('X-resolver', isset($rows[0]['NOTES']) && $rows[0]['NOTES'] === "line 1\nline 2" && $rows[1]['NOTES'] === '', 'NOTES = the shared text: ' . json_encode($rows) . ' log ' . json_encode(isset($GLOBALS['LOG']) ? $GLOBALS['LOG'] : null));
$rows = array(array('PROPOSAL ID' => 'P-1', 'TITLE' => 'Alpha'));
$jt = journalExportToggleColumns('rpt', array('viewOptions' => $vo), $rows);
A('C-resolver', isset($rows[0]['NOTES']) && $rows[0]['NOTES'] === "2026-10-01 Pat Doe: first\n2026-10-02 Lee Roe: line 1 line 2", 'Discussion: the thread as before: ' . json_encode($rows));
