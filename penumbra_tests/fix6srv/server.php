<?php
// =============================================================================
// fix6srv/server.php DIR  - the server fixes of 2026-11-18 (batch 5, worker A), run against one build.
//   php -n -d extension_dir=... -d extension=mbstring server.php <app dir>
// DIR = the build (stage = with the fixes, base = before). Each check names its item (fix10/RANKED.md numbers). Prints a
// line a check and "TOTAL pass=N fail=M   failed: ...". On base the new behaviours are red; on stage all green. The
// "-same" checks are guards that pass on both. Modelled on fix5srv: functions and action blocks are lifted from the build
// by name (token-matched braces) and run against stubs - no database, no mail.
//   I1-*   save_server_state.php: the publish gate on the save (pubgate) + journal_export.php journalPublishCounts
//   I2-*   a condition on a journal column the run could not read matches no row (failclosed)
//   I3-*   toggles' 'parked' lists field values and notes; rekey counts moved_fields (parkall, rekeyall)
//   I4-*   rekey step 1 lists keys holding only private notes (hidden_only); left_hidden (rekeyall)
//   I5-*   a mixed thread: the reply's re-check by the thread rule, set_private on it (thrdrule)
//   I6-*   delete: other people's files, every notes mode (ownfiles)
//   I7-*   set_private keeps the caps (flipcap)
//   I8-*   more than JOURNAL_MAX_MENTIONS mentions: refused (mentioncap)
//   I9-*   a watched toggle the layout hides; a who / when name watched (chgtoggle)
//   I10-*  a scheduled pivot's value filter on a journal column (pvjrnfilter)
//   I11-*  a key changed while the report was encrypted (encfile)
//   I12-*  an encrypted report's mention targets follow journal_on (encoff)
//   I13-*  a File Drop template's journal tokens (tplnames)
//   I14-*  toggle history: the row key as a key (rowneedle)
//   I15-*  samemove only for its own key columns (samesig)
//   I17-*  get_audit_log.php: no journal rows for a plain viewer (jrnaudit)
//   I18-*  restore_server_report.php: the re-link chain (relinkchain)
//   I19-*  a row snapshot cut to valid JSON (snapfit)
// =============================================================================
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', 'stderr');
$dir = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
if ($dir === '' || !is_file($dir . '/manage_journal.php')) { fwrite(STDERR, "usage: server.php <app dir>\n"); exit(2); }
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
class FxExit extends Exception {}

// ---- lifting (fix5srv's) ---------------------------------------------------------------------------------------
function fx_block($src, $anchor, $whole) {
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
        if (is_array($t) && $t[0] === T_EXIT) { $out .= 'throw new FxExit()'; continue; }
        $out .= $s;
    }
    return $out;
}
function fx_lift($src, $fn) {
    if (function_exists($fn)) return true;
    $code = fx_block(str_replace("\r\n", "\n", $src), "\nfunction " . $fn . '(', true);
    if ($code === '') return false;
    try { eval($code); } catch (Throwable $e) { fwrite(STDERR, "lift $fn: " . $e->getMessage() . "\n"); return false; }
    return true;
}
function fx_call($src, $f) {
    for ($i = 0; $i < 80; $i++) {
        try { return $f(); }
        catch (Error $e) {
            if (preg_match('/Call to undefined function ([A-Za-z0-9_]+)\(\)/', $e->getMessage(), $m) && fx_lift($src, $m[1])) continue;
            throw $e;
        }
    }
    throw new Exception('too many lifts');
}

$mj = file_get_contents($dir . '/manage_journal.php');
$sr = file_get_contents($dir . '/schedule_runner.php');

// ---- the fixture -------------------------------------------------------------------------------------------------
function n6($id, $scope, $rk, $by, $text, $parent = null, $priv = 0, $file = null, $mentions = null) {
    return array('ID' => (string)$id, 'REPORT_ID' => '7', 'SCOPE' => $scope, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'ROW_SNAPSHOT' => null,
        'MENTIONS' => $mentions, 'CREATED_BY' => $by, 'AUTHOR_NAME' => ucfirst($by) . ' Doe', 'ATTACH_NAME' => $file, 'ATTACH_MIME' => $file ? 'application/pdf' : null,
        'PARENT_ID' => $parent === null ? null : (string)$parent, 'IS_PRIVATE' => (string)$priv, 'CREATED_AT' => sprintf('2026-11-%02d 09:00:00', 1 + ($id % 27)));
}
function fixture6() {
    return array(
        n6(40, 'row', 'K5', 'ann', 'public root of a mixed thread', null, 0),
        n6(41, 'row', 'K5', 'bob', 'flagged reply', 40, 1),
        n6(50, 'row', 'K6', 'eve', 'a discussion note', null, 0),
        n6(51, 'row', 'K6', 'ann', '', 50, 0, 'anns.pdf'),
        n6(52, 'row', 'K6', 'bob', 'a text reply', 50, 0),
        n6(60, 'row', 'K7', 'eve', 'mine', null, 0),
        n6(61, 'row', 'K7', 'eve', '', 60, 0, 'mine.pdf'),
        n6(62, 'row', 'K7', 'bob', 'text only', 60, 0),
        n6(70, 'report', null, 'ann', 'a private report note', null, 1),
        n6(71, 'report', null, 'ann', 'its reply', 70, 1),
        n6(80, 'report', null, 'ann', 'public, to be made private', null, 0),
        n6(81, 'report', null, 'ann', 'my reply', 80, 0),
    );
}
function by_id6($id) { foreach ($GLOBALS['N'] as $r) if ((int)$r['ID'] === (int)$id) return $r; return null; }
function thread6($root) { $o = array(); foreach ($GLOBALS['N'] as $r) if ((int)$r['ID'] === (int)$root || (string)$r['PARENT_ID'] === (string)$root) $o[] = $r; return $o; }

// ---- stubs ---------------------------------------------------------------------------------------------------------
$GLOBALS['N'] = fixture6();
$GLOBALS['T'] = array();     // the toggle table: TOGGLE_KEY, ROW_KEY, STATE, FIELD_VALUE
$GLOBALS['HOOKS'] = array(); // regex => callable($sql, $binds): a test's own answers, first
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = array($sql, $binds);
    // (2026-11-18) like Oracle: a bind in GROUP BY never matches the select list's (ORA-00979); live rekey counts read 0
    if (preg_match('/GROUP BY [^"]*:[a-z]/i', $sql)) throw new Exception('ORA-00979: not a GROUP BY expression');
    foreach ($GLOBALS['HOOKS'] as $re => $fn) { if (preg_match($re, $sql)) return $fn($sql, $binds); }
    $N = $GLOBALS['N']; $T = $GLOBALS['T'];
    if (strpos($sql, 'ALL_TAB_COLUMNS') !== false) return array(array('CNT' => 1));
    if (strpos($sql, 'PENUMBRA_AUDIT') !== false) return isset($GLOBALS['AUDIT_ROWS']) ? $GLOBALS['AUDIT_ROWS'] : array();
    if (strpos($sql, 'NVL(IS_PRIVATE, 0) AS P FROM PENUMBRA_JOURNAL WHERE ID = :root') !== false) { $r = by_id6($binds[':root']); return $r ? array(array('P' => (int)$r['IS_PRIVATE'])) : array(); }
    if (strpos($sql, 'AS PRIV_N FROM PENUMBRA_JOURNAL WHERE PARENT_ID = :root') !== false) {
        $c = 0; foreach ($N as $r) if ((string)$r['PARENT_ID'] === (string)$binds[':root'] && (int)$r['ID'] !== (int)$binds[':nid'] && (int)$r['IS_PRIVATE'] !== 0) $c++;
        return array(array('PRIV_N' => $c));
    }
    if (strpos($sql, 'SELECT ID, PARENT_ID, SCOPE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE ID = :pid') !== false) { $r = by_id6($binds[':pid']); return $r ? array($r) : array(); }
    if (strpos($sql, 'SELECT 1 AS OK FROM PENUMBRA_JOURNAL WHERE ID = :rid2') !== false) return by_id6($binds[':rid2']) ? array(array('OK' => 1)) : array();
    if (strpos($sql, 'SELECT COUNT(*) AS CNT FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid') !== false) return array(array('CNT' => isset($GLOBALS['PUBCNT']) ? $GLOBALS['PUBCNT'] : 5));
    if (strpos($sql, 'AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND NVL(IS_PRIVATE, 0) <> 0') !== false) return array(array('C' => isset($GLOBALS['PRIVCNT']) ? $GLOBALS['PRIVCNT'] : 0));
    if (strpos($sql, 'SELECT DISTINCT LOWER(CREATED_BY) AS CREATOR') !== false) return array();
    if (strpos($sql, 'SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL') !== false) return array();
    if (preg_match('/AND \(ID = :root( OR PARENT_ID = :root2)?\)/', $sql)) return thread6($binds[':root']);
    if (strpos($sql, 'WHERE PARENT_ID = :nid AND REPORT_ID = :rid ORDER BY ID') !== false) { $o = array(); foreach ($N as $r) if ((string)$r['PARENT_ID'] === (string)$binds[':nid']) $o[] = $r; return $o; }
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ID = :nid') !== false) { $r = by_id6($binds[':nid']); return $r ? array($r) : array(); }
    // rekey: the toggle table under a tag, the notes under it
    if (strpos($sql, 'SELECT DISTINCT SUBSTR(ROW_KEY, :a1) AS K FROM PENUMBRA_JOURNAL_TOGGLE') === 0) {
        $k = array(); foreach ($T as $t) if ($t['TOGGLE_KEY'] !== '__keyfile' && strpos($t['ROW_KEY'], $binds[':tag']) === 0) $k[substr($t['ROW_KEY'], strlen($binds[':tag']))] = 1;
        $o = array(); foreach (array_keys($k) as $x) $o[] = array('K' => (string)$x); return $o;
    }
    if (strpos($sql, 'SELECT K, S, COUNT(*) AS N FROM (SELECT SUBSTR(ROW_KEY, :a1) AS K, STATE AS S FROM PENUMBRA_JOURNAL_TOGGLE') === 0) {
        $g = array();
        foreach ($T as $t) if ($t['TOGGLE_KEY'] !== '__keyfile' && strpos($t['ROW_KEY'], $binds[':tag']) === 0) {
            $kk = substr($t['ROW_KEY'], strlen($binds[':tag'])) . '|' . $t['STATE'];
            if (!isset($g[$kk])) $g[$kk] = array('K' => substr($t['ROW_KEY'], strlen($binds[':tag'])), 'S' => (string)$t['STATE'], 'N' => 0);
            $g[$kk]['N']++;
        }
        return array_values($g);
    }
    if (strpos($sql, "IS_PRIVATE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, :ln) = :tag") !== false) {
        $o = array(); foreach ($N as $r) if ($r['SCOPE'] === 'row' && is_string($r['ROW_KEY']) && strpos($r['ROW_KEY'], $binds[':tag']) === 0) $o[] = $r; return $o;
    }
    if (preg_match('/^SELECT COUNT\(\*\) AS C FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND STATE = (\d) AND SUBSTR\(ROW_KEY, 1, :ln\) = :tag$/', $sql, $m)) {
        $c = 0; foreach ($T as $t) if ((int)$t['STATE'] === (int)$m[1] && strpos($t['ROW_KEY'], $binds[':tag']) === 0) $c++; return array(array('C' => $c));
    }
    if (strpos($sql, "SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, :ln) = :tag") === 0) {
        $c = 0; foreach ($N as $r) if ($r['SCOPE'] === 'row' && strpos((string)$r['ROW_KEY'], $binds[':tag']) === 0) $c++; return array(array('C' => $c));
    }
    // the toggles' reads
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false && strpos($sql, 'AS SIG, COUNT(*) AS N') !== false) {
        $st = preg_match('/STATE = (\d)/', $sql, $m) ? (int)$m[1] : 1;
        $g = array();
        foreach ($T as $t) if ((int)$t['STATE'] === $st && strpos($t['ROW_KEY'], "\xE2\x90\x82") === 0) {
            $sp = journalSplitParked($t['ROW_KEY']); $g[$sp[1]] = (isset($g[$sp[1]]) ? $g[$sp[1]] : 0) + 1;
        }
        $o = array(); foreach ($g as $s => $n) $o[] = array('SIG' => $s, 'N' => $n); return $o;
    }
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false && strpos($sql, 'STATE = 1') !== false) return array();
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false && strpos($sql, 'STATE = 2') !== false) return array();
    if (strpos($sql, 'SELECT DISTINCT TOGGLE_KEY FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return array();
    if (strpos($sql, "IS_PRIVATE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, 1) =") !== false) {
        $o = array(); foreach ($N as $r) if ($r['SCOPE'] === 'row' && strpos((string)$r['ROW_KEY'], "\xE2\x90\x82") === 0) $o[] = $r; return $o;
    }
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return isset($GLOBALS['REPORT_ROWS']) ? $GLOBALS['REPORT_ROWS'] : array(array('ID' => 7));
    throw new Exception('unexpected SQL: ' . substr(preg_replace('/\s+/', ' ', $sql), 0, 200));
}
function queryViaOci8Each($sql, $binds, $cb) { $GLOBALS['EACH'][] = array($sql, $binds); foreach (queryViaOci8($sql, $binds) as $r) $cb($r); }
function journalHasPrivateColumn() { return true; }
function journalHasParentColumn() { return true; }
function journalHasAttachColumn() { return true; }
function journalIsMissingTableError($m) { return false; }
function utf8ize($x) { return $x; }
function readClobViaOci8($t, $c, $k, $id) { return '{"encrypted":true,"content":""}'; }
function log_scheduler($m) { $GLOBALS['LOG'][] = $m; }
require $dir . '/journal_export.php';
require $dir . '/penumbra_search.php';
require $dir . '/penumbra_template.php';
foreach (array('OCI_NO_AUTO_COMMIT' => 0, 'OCI_D_LOB' => 50, 'OCI_B_CLOB' => 112, 'OCI_TEMP_CLOB' => 2, 'SQLT_CHR' => 1, 'JOURNAL_NOTE_MAX_CHARS' => 8000,
               'JOURNAL_MAX_MENTIONS' => 20, 'JOURNAL_MAX_NOTES_PER_REPORT' => 1000, 'JOURNAL_ATTACH_MAX_BYTES' => 5242880, 'JOURNAL_BULK_MAX_ROWS' => 5000,
               'JOURNAL_FIELD_STATE' => 2, 'JOURNAL_MAX_NOTES_PER_AUTHOR' => 500) as $k => $v) { if (!defined($k)) define($k, $v); }

$GLOBALS['FLAGS'] = array('on' => true, 'enc' => false, 'toggles' => array('done'), 'labels' => array(), 'keyCols' => array('ID'), 'shared' => false, 'fields' => null);
function journalReportStateFlags($r) { return $GLOBALS['FLAGS']; }
function journalGetReport($c, $id) { return array('ID' => 7, 'SHORT_ID' => 'jjornl', 'OWNER_ID' => 'owner1', 'TITLE' => 'T', 'AUTHORIZED' => 'public'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanReadJournal($r, $u, $a) { return true; }
function journalCallerCanEditReport($r, $u, $a) { return $a || $u === 'edi' || $u === 'owner1'; }
function journalEnsureFiledFor($r, $x = null) { return 'ok'; }
function journalWriteKeyRefusal($r, $d) { return null; }
function journalAuthorCapRefusal($r, $u, $a, $n) { return null; }
function journalFilingHold($r) { return null; }
function journalRowKeyIsFiledForm($k) { return false; }
function journalValidPivotKey($k) { return true; }
function journalValidChartKey($k) { return true; }
function journalSharedConflict($now, $msg) { $GLOBALS['CONFLICT'] = $msg; throw new FxExit(); }
function journalUpdateNoteText($id, $rid, $text, $m, $base = null, $editor = null) { $GLOBALS['UPDATES'][] = array($id, $text, $m); return 1; }
function journalSharedHasReplies($id, $rid) { return false; }
function journalSharedNoteOf($rid, $rk) { return null; }
function journalResolveMentionAccess($c, $r, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = array('authorized' => true, 'name' => ucfirst($u)); return $o; }
function journalSendMentionEmail() { $a = func_get_args(); $GLOBALS['MAILS'][] = array('mention', $a[0]); return true; }
function journalSendReplyEmail() { $a = func_get_args(); $GLOBALS['MAILS'][] = array('reply', $a[0]); return true; }
function journalAuthorName() { return 'Kim Doe'; }
function journalRowRefLine($s, $t) { return ''; }
function journalRowRefText($s, $k, $snap) { return ''; }
function journalLookupNames($c, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = 'Named ' . $u; return $o; }
function journalNoteMentionHistory($rid, $nid) { return null; }
function execClobInsert($conn, $table, $cols, $clob, $raw = array()) { $GLOBALS['INSERTS'][] = $cols; return 1; }
function journalInsertNoteReturningId($cols, $clob, $blob) { $GLOBALS['INSERTS'][] = $cols; return 999; }
function logPenumbraAudit($rid, $a, $b, $c, $m = null, $x = null) { $GLOBALS['AUDIT'][] = array('action' => $a, 'before' => $b, 'after' => $c, 'msg' => $m); }
function penumbraIsReportOwner($owner, $uid) { $u = strtoupper(trim((string)$uid)); return $u !== '' && strtoupper(trim((string)$owner)) === $u; }
function penumbraReportGrantMatches($g, $sid) { return false; }
function penumbraNormalizeGrants($cfg, $uid) { return array(); }
function getOci8Connection() { return 'oci'; }
$GLOBALS['OCI'] = array();
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'runs' => array(), 'n' => null); $GLOBALS['BIND'][$k] = array(); return $k; }
function oci_bind_by_name($st, $n, &$v, $l = -1, $t = 0) { $GLOBALS['BIND'][$st][$n] = &$v; return true; }
function oci_execute($st, $m = 0) {
    $snap = array(); foreach ($GLOBALS['BIND'][$st] as $k => $v) $snap[$k] = is_object($v) ? 'LOB' : $v;
    $GLOBALS['OCI'][$st]['runs'][] = $snap;
    $sql = $GLOBALS['OCI'][$st]['sql'];
    $n = 0;
    if (strpos($sql, 'UPDATE PENUMBRA_JOURNAL_TOGGLE T SET ROW_KEY = :mnew') === 0) {
        foreach ($GLOBALS['T'] as $i => $t) if ($t['ROW_KEY'] === $snap[':mold'] && $t['TOGGLE_KEY'] !== '__keyfile') { $GLOBALS['T'][$i]['ROW_KEY'] = $snap[':mnew']; $n++; }
    } elseif (strpos($sql, 'UPDATE PENUMBRA_JOURNAL SET ROW_KEY = :qnew') === 0) {
        foreach ($GLOBALS['N'] as $i => $r) if ($r['ROW_KEY'] === $snap[':qold']) { $GLOBALS['N'][$i]['ROW_KEY'] = $snap[':qnew']; $n++; }
    } elseif (strpos($sql, 'UPDATE PENUMBRA_JOURNAL_TOGGLE SET ROW_KEY = ') === 0) {   // the key record
        foreach ($GLOBALS['T'] as $i => $t) {
            $old = isset($snap[':mold']) ? $snap[':mold'] : (isset($snap[':eold']) ? $snap[':eold'] : (isset($snap[':kold']) ? $snap[':kold'] : null));
            $new = isset($snap[':mnew']) ? $snap[':mnew'] : (isset($snap[':enew']) ? $snap[':enew'] : (isset($snap[':knew']) ? $snap[':knew'] : null));
            if ($t['TOGGLE_KEY'] === '__keyfile' && $t['ROW_KEY'] === $old) { $GLOBALS['T'][$i]['ROW_KEY'] = $new; $n++; }
        }
    } else $n = 1;
    $GLOBALS['OCI'][$st]['n'] = $n;
    return true;
}
function oci_num_rows($st) { return $GLOBALS['OCI'][$st]['n'] !== null ? $GLOBALS['OCI'][$st]['n'] : 1; }
function oci_free_statement($st) { return true; }
function oci_commit($c) { return true; }
function oci_rollback($c) { return true; }
function oci_error($x = null) { return array('message' => 'stub'); }
class Fx6Lob { function writeTemporary($v, $t = 0) { return true; } function free() { return true; } }
function oci_new_descriptor($c, $t = 0) { return new Fx6Lob(); }

foreach (array('journalNoteVisibleTo', 'journalTagNotesVisible', 'journalTargetCanOpenJournal', 'journalParkedSummary', 'journalParkedNotesVisible',
               'journalReadKeyStale', 'journalIsMissingColumnError', 'journalReportJournalEnabled', 'journalSanitizeToggleKey', 'journalFitSnapshot', 'journalChartSnapshot', 'journalOffSince') as $fn) fx_lift($mj, $fn);

$run = function ($action, $user, $admin, $body, $setup = array()) use ($mj) {
    $code = fx_block(str_replace("\r\n", "\n", $mj), "if (\$action === '$action') {", false);
    if ($code === '') return array('code' => 0, 'j' => null, 'err' => 'not lifted', 'raw' => '');
    foreach (array('OCI', 'BIND', 'AUDIT', 'Q', 'INSERTS', 'MAILS', 'UPDATES', 'EACH') as $g) $GLOBALS[$g] = array();
    $GLOBALS['N'] = isset($setup['notes']) ? $setup['notes'] : fixture6();
    $GLOBALS['FLAGS']['shared'] = !empty($setup['shared']);
    $GLOBALS['PUBCNT'] = isset($setup['pubcnt']) ? $setup['pubcnt'] : null;
    $GLOBALS['PRIVCNT'] = isset($setup['privcnt']) ? $setup['privcnt'] : 0;
    $GLOBALS['AUDIT_ROWS'] = isset($setup['audit']) ? $setup['audit'] : array();
    $GLOBALS['HOOKS'] = isset($setup['hooks']) ? $setup['hooks'] : array();
    $_GET = isset($setup['get']) ? $setup['get'] : array(); $_POST = array(); $_FILES = array();
    $GLOBALS['currentUserKey'] = $user;
    $GLOBALS['journalEncPageOn'] = false;
    $fn = eval('return function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin, $action) { ' . $code . ' };');
    ob_start(); $err = '';
    @http_response_code(200);
    try { $fn($body, 'conn', $user, '', $admin, $action); } catch (FxExit $e) { } catch (Throwable $e) { $err = $e->getMessage() . ' @' . $e->getLine(); }
    $out = ob_get_clean();
    return array('code' => @http_response_code(), 'j' => json_decode($out, true), 'err' => $err, 'raw' => substr($out, 0, 300));
};
$ran = function ($needle) { foreach ($GLOBALS['OCI'] as $s) if (strpos($s['sql'], $needle) !== false && $s['runs']) return $s; return null; };
$brief = function ($r) { return json_encode(array('code' => $r['code'], 'j' => $r['j'], 'err' => $r['err'])); };
$jv = function ($r, $k) { return (is_array($r['j']) && array_key_exists($k, $r['j'])) ? $r['j'][$k] : 'MISSING'; };
$norm = function ($s) { return str_replace("\r\n", "\n", (string)$s); };

// ===== item 1: the publish gate on the save ===============================================================================
$ss = $norm(file_get_contents($dir . '/save_server_state.php'));
$g0 = strpos($ss, '// --- PUBLISH GATE'); $g1 = strpos($ss, "// [FIX] Decode the CLOB string");
$gate = ($g0 !== false && $g1 !== false && $g1 > $g0) ? substr($ss, $g0, $g1 - $g0) : '';
$gate = str_replace(array('exit;', "require_once __DIR__ . '/journal_export.php';"), array('throw new FxExit();', ''), $gate);
$pub = function ($oldVo, $newVo, $data, $visible) use ($gate) {
    if ($gate === '') return array('code' => 200, 'j' => null, 'err' => '');   // a build without the gate: every save goes on
    $GLOBALS['HOOKS'] = array('/^SELECT ID, PARENT_ID, CREATED_BY, MENTIONS, IS_PRIVATE, TO_CHAR\(CREATED_AT/' => function () use ($visible) { return $visible; });
    $GLOBALS['AUDIT_ROWS'] = array(array('ID' => 1, 'ACTION' => 'CREATE', 'AT' => '2026-11-01 09:00:00', 'B_ON' => -1, 'A_ON' => 0, 'B_HEAD' => null, 'A_HEAD' => '{"report":{"viewOptions"'));
    $f = eval('return function ($decoded_input_state, $before_state_data, $data, $report_id_num, $currentUserKey) { ' . $gate . ' };');
    ob_start(); @http_response_code(200); $err = '';
    try { $f(array('viewOptions' => $newVo), json_encode(array('viewOptions' => $oldVo)), $data, 7, 'owner1'); } catch (FxExit $e) { } catch (Throwable $e) { $err = $e->getMessage(); }
    $out = ob_get_clean();
    $GLOBALS['HOOKS'] = array();
    return array('code' => @http_response_code(), 'j' => json_decode($out, true), 'err' => $err);
};
$vis3 = array(n6(1, 'report', null, 'owner1', 'a'), n6(2, 'report', null, 'owner1', 'b'), n6(3, 'row', 'K1', 'bob', 'c'), n6(4, 'report', null, 'cat', 'secret', null, 1));
$r = $pub(array('journalEnabled' => false), array('journalEnabled' => true), array(), $vis3);
A('I1-refused', $r['code'] === 409 && is_array($r['j']) && $r['j']['code'] === 'journal_publish' && $r['j']['total'] === 3 && $r['j']['never_on'] === true && $r['j']['since_off'] === 3,
    'switched on over 3 notes the saver sees (a private one of cat\'s not counted), no journal_publish_ok: ' . json_encode($r));
$r = $pub(array('journalEnabled' => false), array('journalEnabled' => true), array('journal_publish_ok' => 2), $vis3);
A('I1-stale-count', $r['code'] === 409 && is_array($r['j']) && $r['j']['total'] === 3, 'the gate showed 2, there are 3 now: refused: ' . json_encode($r));
$r = $pub(array('journalEnabled' => false), array('journalEnabled' => true), array('journal_publish_ok' => 3), $vis3);
A('I1-confirmed', $r['code'] === 200 && $r['j'] === null && $r['err'] === '', 'the count the gate showed: the save goes on: ' . json_encode($r));
$r = $pub(array('journalEnabled' => true), array('journalEnabled' => true), array(), $vis3);
A('I1-on-same', $r['code'] === 200 && $r['j'] === null, 'already on: untouched: ' . json_encode($r));
$r = $pub(array('journalEnabled' => false), array('journalEnabled' => true), array(), array());
A('I1-no-notes-same', $r['code'] === 200 && $r['j'] === null, 'no notes: nothing to ask: ' . json_encode($r));
$f = function () use ($gate) {
    if ($gate === '') return 200;
    $g = eval('return function ($decoded_input_state, $before_state_data, $data, $report_id_num, $currentUserKey) { ' . $gate . ' };');
    ob_start(); @http_response_code(200);
    try { $g(array('encrypted' => true, 'content' => 'x'), json_encode(array('viewOptions' => array('journalEnabled' => false))), array(), 7, 'owner1'); } catch (Throwable $e) { }
    ob_end_clean(); return @http_response_code();
};
A('I1-enc-same', $f() === 200, 'an encrypted state: as before');

// ===== item 2: fail closed =================================================================================================
$GLOBALS['penumbra_jt_unread'] = array();
$rows2 = array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b'));
$vo2 = array('journalEnabled' => true, 'journalKeyColumns' => array('ID'), 'journalToggles' => array(array('key' => 'done', 'label' => 'Done', 'oldLabels' => array('Complete'))),
             'journalToggleWho' => true, 'journalRowNotes' => true, 'journalFields' => array(array('type' => 'pick', 'key' => 'status3', 'label' => 'Status', 'options' => array(array('id' => 'o1', 'label' => 'Not started')))));
$GLOBALS['HOOKS'] = array('/FROM PENUMBRA_REPORTS WHERE TRIM\(SHORT_ID\)/' => function () { throw new Exception('ORA-03113: end-of-file on communication channel'); });
$res2 = journalExportToggleResolver('jjornl', array('viewOptions' => $vo2), array('ID', 'T'));
$GLOBALS['HOOKS'] = array();
$un = function_exists('journalUnreadCols') ? journalUnreadCols() : array();
A('I2-names', $res2 === null && isset($un['DONE'], $un['DONE BY'], $un['COMPLETE'], $un['STATUS'], $un['NOTES']) && !isset($un['T']),
    'the lookup failed: the journal\'s names are unread: ' . json_encode(array_keys($un)));
$kept = php_apply_search_filter($rows2, 'standard', "Done != \xE2\x98\x91", null, null);
A('I2-neq', is_array($kept) && count($kept) === 0, '"Done != (ticked)" with Done unread keeps no row (it kept every one): ' . count($kept));
$kept = php_apply_search_filter($rows2, 'standard', "Status = empty or T = b", null, null);
A('I2-or', is_array($kept) && count($kept) === 1 && $kept[0]['ID'] === '2', 'a condition on a data column keeps its rows: ' . json_encode($kept));
$kept = php_apply_search_filter($rows2, 'standard', "T = a", null, null);
A('I2-data-same', count($kept) === 1, 'a filter without journal names: as before');
$GLOBALS['penumbra_run_journal_warnings'] = array();
$cf = fx_call($sr, function () { return parse_format_condition("Done != \xE2\x98\x91", array('ID', 'T')); });
$cfOk = fx_call($sr, function () use ($cf) { return evaluate_format_condition(array('ID' => '1', 'T' => 'a'), $cf); });
A('I2-format', $cfOk === false && isset($GLOBALS['penumbra_run_journal_warnings']['DONE']), 'a format() / snippet / pivot condition too, and the run says so: '
    . json_encode(array($cf, $cfOk, isset($GLOBALS['penumbra_run_journal_warnings']) ? $GLOBALS['penumbra_run_journal_warnings'] : null)));
$GLOBALS['HOOKS'] = array('/STATE = 1/' => function () { return array(); }, '/STATE = 2/' => function () { return array(); },
    '/SCOPE = \'row\' AND ROW_KEY IS NOT NULL/' => function () { return array(); }, '/FROM PENUMBRA_REPORTS/' => function () { return array(array('ID' => 7)); });
$res2b = journalExportToggleResolver('jjornl', array('viewOptions' => $vo2), array('ID', 'T'));
$GLOBALS['HOOKS'] = array();
A('I2-cleared-same', is_array($res2b) && !(function_exists('journalUnreadCols') && journalUnreadCols()), 'a resolver that reads them all: nothing unread');
$GLOBALS['penumbra_jt_unread'] = array();

// ===== item 3: field values filed under an earlier key =====================================================================
$TAG = journalParkTag(journalKeySig(array('OLDKEY')));
$TAG2 = journalParkTag(journalKeySig(array('OTHER')));
$GLOBALS['T'] = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => $TAG . 'A', 'STATE' => 1), array('TOGGLE_KEY' => 'status3', 'ROW_KEY' => $TAG . 'B', 'STATE' => 2, 'FIELD_VALUE' => 'o1'),
                      array('TOGGLE_KEY' => 'status3', 'ROW_KEY' => $TAG2 . 'C', 'STATE' => 2, 'FIELD_VALUE' => 'o2'));
$r = $run('toggles', 'owner1', false, null, array('get' => array('report_id' => 'jjornl'), 'notes' => array(n6(90, 'row', $TAG . 'A', 'bob', 'parked'))));
$pk = $jv($r, 'parked');
$pkBy = array(); if (is_array($pk)) foreach ($pk as $p) $pkBy[implode('+', $p['cols'])] = $p;
A('I3-parked', isset($pkBy['OLDKEY'], $pkBy['OTHER']) && ($pkBy['OLDKEY']['marks'] ?? null) === 1 && ($pkBy['OLDKEY']['fields'] ?? null) === 1 && ($pkBy['OLDKEY']['notes'] ?? null) === 1
    && ($pkBy['OTHER']['fields'] ?? null) === 1 && ($pkBy['OTHER']['marks'] ?? null) === 0, 'each earlier key: marks, notes, field values (a key with values only too): ' . json_encode($pk) . $r['err']);
$GLOBALS['FLAGS']['keyCols'] = array('NEWKEY');
// (2026-11-18 hotfix) step 1's counts per old key (live read 0 marks / 0 values: the count SQL was ORA-00979)
$r = $run('rekey', 'owner1', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY')), array('notes' => array()));
$kc3 = array(); foreach ((array)$jv($r, 'key_counts') as $x) if (is_array($x)) $kc3[$x['key']] = $x;
A('I3-counts', ($kc3['A']['marks'] ?? null) === 1 && ($kc3['B']['fields'] ?? null) === 1 && ($kc3['B']['marks'] ?? null) === 0,
    'step 1 counts each old key: marks and field values: ' . $brief($r));
$r = $run('rekey', 'owner1', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY'), 'pairs' => array(array('A', 'A2'), array('B', 'B2'))), array('notes' => array()));
A('I3-moved-fields', $jv($r, 'moved_fields') === 1 && $jv($r, 'left_fields') === 0 && $jv($r, 'marks') === 2, 'the move takes the value with the mark, and says so: ' . $brief($r));

// ===== item 4: a key holding only private notes the caller cannot see =====================================================
$GLOBALS['T'] = array();
$rk4 = function () use ($TAG) { return array(n6(70, 'row', $TAG . 'A', 'ann', 'private, filed', null, 1), n6(71, 'row', $TAG . 'B', 'bob', 'public, filed', null, 0)); };
$r = $run('rekey', 'edi', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY')), array('notes' => $rk4()));
$kc = $jv($r, 'key_counts'); $kcA = null; if (is_array($kc)) foreach ($kc as $x) if ($x['key'] === 'A') $kcA = $x;
A('I4-listed', is_array($jv($r, 'keys')) && in_array('A', $jv($r, 'keys'), true) && $kcA !== null && $kcA['hidden_only'] === true && $kcA['notes'] === 0,
    'the key whose only note is ann\'s private one is listed, hidden_only, no counts: ' . $brief($r));
$r = $run('rekey', 'edi', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY'), 'pairs' => array(array('A', 'A2'), array('B', 'B2'))), array('notes' => $rk4()));
$nA = null; foreach ($GLOBALS['N'] as $x) if ((int)$x['ID'] === 70) $nA = $x['ROW_KEY'];
A('I4-moved', $nA === 'A2' && $jv($r, 'notes') === 1 && $jv($r, 'left_hidden') === 0, 'paired, the private note moves (counted only where seen): ' . $brief($r) . ' ' . json_encode($nA));
$r = $run('rekey', 'edi', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY'), 'pairs' => array(array('B', 'B2'))), array('notes' => $rk4()));
A('I4-left-hidden', $jv($r, 'left_hidden') === 1 && $jv($r, 'left_notes') === 0, 'not paired: one key left with only a hidden note: ' . $brief($r));
$GLOBALS['FLAGS']['keyCols'] = array('ID');

// ===== item 5: a mixed thread (public root 40, private reply 41) ==========================================================
$r = $run('add', 'bob', false, array('report_id' => 'jjornl', 'note_text' => 'my reply', 'parent_id' => 40, 'expect_private' => 1));
A('I5-expect', $jv($r, 'status') === 'success' && $jv($r, 'private') === 1 && !$ran('DELETE FROM PENUMBRA_JOURNAL WHERE ID = :nid'),
    'composed for a private thread (the thread rule): posted, not taken back: ' . $brief($r));
$r = $run('add', 'bob', false, array('report_id' => 'jjornl', 'note_text' => 'an old page', 'parent_id' => 40));
$up = $ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
A('I5-no-publish', $jv($r, 'status') === 'success' && $jv($r, 'private') === 1 && ($up === null || strpos($up['sql'], 'ID = :nid') !== false),
    'an old page\'s reply: the private reply is never made public: ' . $brief($r) . ' ' . json_encode($up));
$flipped = fixture6(); foreach ($flipped as $i => $x) if ((int)$x['ID'] === 41) $flipped[$i]['IS_PRIVATE'] = '0';
$r = $run('add', 'bob', false, array('report_id' => 'jjornl', 'note_text' => 'race', 'parent_id' => 40),
    array('hooks' => array('/AND \(ID = :root OR PARENT_ID = :root2\)/' => function ($s, $b) { $t = thread6($b[':root']); return $t; }), 'notes' => fixture6()));
$r2 = $run('set_private', 'ann', false, array('note_id' => 40, 'private' => 1));
$up = $ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
A('I5-make-private', $jv($r2, 'status') === 'success' && $up !== null && strpos($up['sql'], 'OR PARENT_ID = :root2') !== false && $up['runs'][0][':p'] === 1,
    'set_private on the mixed thread: every note made private (it said No change): ' . $brief($r2));
$r2 = $run('set_private', 'ann', false, array('note_id' => 40, 'private' => 0, 'reply_ids' => array(41)));
$up = $ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
A('I5-make-public-same', $jv($r2, 'status') === 'success' && $up !== null && $up['runs'][0][':p'] === 0, 'made public: as before: ' . $brief($r2));

// ===== item 6: a Discussion thread with someone else's file ================================================================
$r = $run('delete', 'eve', false, array('note_id' => 50));
A('I6-refused', $r['code'] === 403 && $jv($r, 'code') === 'shared_owned' && !$ran('DELETE FROM PENUMBRA_JOURNAL'), 'ann\'s file on eve\'s Discussion thread: ' . $brief($r));
$r = $run('delete', 'eve', false, array('note_id' => 60));
A('I6-own-files-same', $jv($r, 'status') === 'success' && $ran('DELETE FROM PENUMBRA_JOURNAL') !== null, 'only her own file and bob\'s text reply: deleted as before: ' . $brief($r));
$r = $run('delete', 'edi', false, array('note_id' => 50));
A('I6-editor-same', $jv($r, 'status') === 'success', 'an editor: as before: ' . $brief($r));

// ===== item 7: set_private and the caps ====================================================================================
$r = $run('set_private', 'ann', false, array('note_id' => 80, 'private' => 1), array('privcnt' => 99));
A('I7-private-cap', $r['code'] === 400 && $jv($r, 'code') === 'private_cap' && !$ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE'), '99 private + her 2 notes here > 100: ' . $brief($r));
$r = $run('set_private', 'ann', false, array('note_id' => 80, 'private' => 1), array('privcnt' => 98));
A('I7-private-under-same', $jv($r, 'status') === 'success', '98 + 2 = 100: ' . $brief($r));
$r = $run('set_private', 'ann', false, array('note_id' => 70, 'private' => 0, 'reply_ids' => array(71)), array('pubcnt' => 999));
A('I7-report-cap', $r['code'] === 400 && $jv($r, 'code') === 'report_cap' && !$ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE'), '999 public + 2 > 1000: ' . $brief($r));
$r = $run('set_private', 'ann', false, array('note_id' => 70, 'private' => 0, 'reply_ids' => array(71)), array('pubcnt' => 998));
A('I7-report-under-same', $jv($r, 'status') === 'success', '998 + 2 = 1000: ' . $brief($r));

// ===== item 8: mentions past the cap =======================================================================================
$names = array(); $ms = array(); for ($i = 1; $i <= 21; $i++) { $names[] = '@user' . $i; $ms[] = array('user' => 'user' . $i, 'name' => 'U' . $i); }
$r = $run('add', 'ann', false, array('report_id' => 'jjornl', 'note_text' => 'hi ' . implode(' ', $names), 'mentions' => $ms));
A('I8-add', $r['code'] === 400 && $jv($r, 'code') === 'too_many_mentions' && $jv($r, 'max') === 20 && !$GLOBALS['INSERTS'] && !$GLOBALS['MAILS'], $brief($r));
$r = $run('add', 'ann', false, array('report_id' => 'jjornl', 'note_text' => 'hi ' . implode(' ', array_slice($names, 0, 20)), 'mentions' => array_slice($ms, 0, 20)));
A('I8-twenty-same', $jv($r, 'status') === 'success' && count($GLOBALS['MAILS']) === 20, '20: as before: ' . $brief($r));
$r = $run('edit', 'eve', false, array('note_id' => 60, 'note_text' => 'mine ' . implode(' ', $names), 'mentions' => $ms));
A('I8-edit', $r['code'] === 400 && $jv($r, 'code') === 'too_many_mentions' && !$GLOBALS['UPDATES'], $brief($r));

// ===== item 9: a hidden watched toggle; a who / when name watched ==========================================================
$res9 = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'keyUpper' => array('ID'),
    'stateMap' => array('done' => array('2' => true)), 'whoMeta' => array(array('name' => 'DONE BY', 'key' => 'done', 'kind' => 'by'), array('name' => 'DONE ON', 'key' => 'done', 'kind' => 'on')),
    'whoNames' => array('DONE BY', 'DONE ON'), 'whoMap' => array(), 'aliasMap' => array());
journalTaskChangeCols(array('DONE'));
$a9 = journalAddNamedFields(array(array('ID' => '1'), array('ID' => '2')), $res9);
A('I9-named-toggle', isset($a9[1]['DONE']) && $a9[1]['DONE'] === '1' && $a9[0]['DONE'] === '0', 'a watched toggle rides on the unprocessed rows the signature reads: ' . json_encode($a9));
$sig = fx_call($sr, function () use ($res9) {
    $api = array('rawData' => array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b')), 'journalToggleResolver' => $res9);
    $a = generate_snapshot_signature(penumbra_signature_rows(array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b')), $api, array('DONE')), array('DONE'));
    $api['journalToggleResolver']['stateMap'] = array('done' => array());
    $b = generate_snapshot_signature(penumbra_signature_rows(array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b')), $api, array('DONE')), array('DONE'));
    return array($a, $b);
});
A('I9-signature', $sig[0] !== $sig[1], 'a tick the layout hides changes the signature: ' . json_encode($sig));
journalTaskChangeCols(null);
$cc = fx_call($sr, function () use ($res9) { return penumbra_task_change_columns(array('DONE BY', 'T', '!DONE ON'), $res9); });
A('I9-who', $cc === array('DONE', 'T', '!DONE'), 'an old task watching DONE BY watches DONE: ' . json_encode($cc));
$srn = $norm($sr);
A('I9-recipient', strpos($srn, 'generate_snapshot_signature($sigApi !== null ? penumbra_signature_rows($sigRows, $sigApi, $keys) : $sigRows, $keys)') !== false,
    'the per-recipient signature reads the same rows');

// ===== item 10: a pivot's value filter on a journal column ================================================================
$res10 = $res9 + array('notesSearch' => 'NOTES', 'notesMap' => array('1' => 'budget talk'), 'notesCount' => array('1' => 2));
$res10['whoMeta'] = array(); $res10['whoNames'] = array();
// the run's engine C helpers, all there as in the runner (the pivot asks function_exists of them)
foreach (array('_snippet_journal_toggles', '_snippet_merge_journal_cols', '_snippet_normalize_toggle_tree', '_snippet_notes_tree', '_snippet_tree_reads_journal',
               '_snippet_tree_reads_names', '_snippet_toggle_eval_row', '_snippet_notes_available', '_snippet_rownum_row') as $fn) fx_lift($sr, $fn);
$pv = fx_call($sr, function () use ($res10) {
    _snippet_journal_toggles($res10);
    $rows = array(array('ID' => '1', 'G' => 'x', 'AMT' => '10'), array('ID' => '2', 'G' => 'x', 'AMT' => '5'), array('ID' => '3', 'G' => 'x', 'AMT' => '1'));
    $out = pivot_process_data($rows, array('G'), array(), 'AMT', null, array("Done = \xE2\x98\x91", 'Notes > 0'), array('sum', 'sum'));
    _snippet_journal_toggles(false);
    return $out;
});
$cell = null; if (is_array($pv) && isset($pv['data']['x'])) { $cell = reset($pv['data']['x']); }
$fb = ($cell && isset($cell['_filteredBuckets'])) ? $cell['_filteredBuckets'] : null;
A('I10-filters', $fb && $fb[0]['count'] === 1 && $fb[0]['main']['sum'] == 5 && $fb[1]['count'] === 1 && $fb[1]['main']['sum'] == 10,
    '"Done = (ticked)" sums row 2, "Notes > 0" row 1: ' . json_encode($fb));

// ===== item 11: a key changed while the report was encrypted ===============================================================
$GLOBALS['T'] = array(array('TOGGLE_KEY' => '__keyfile', 'ROW_KEY' => 'OLDKEY', 'STATE' => 9, 'UPDATED_AT' => '2026-11-01'));
$GLOBALS['HOOKS'] = array('/TOGGLE_KEY = :kf AND STATE = 9 ORDER BY UPDATED_AT DESC/' => function () { $o = array(); foreach ($GLOBALS['T'] as $t) if ($t['TOGGLE_KEY'] === '__keyfile') $o[] = array('ROW_KEY' => $t['ROW_KEY']); return $o; });
if (function_exists('journalKeyfileEncWrite')) journalKeyfileEncWrite(7, array('NEWKEY'));
$marked = $GLOBALS['T'][0]['ROW_KEY'];
$GLOBALS['OCI'] = array();
$st = function_exists('journalEnsureFiled') ? journalEnsureFiled(7, array('NEWKEY'), null, true) : null;
$refiled = $ran('SET ROW_KEY = :ptag || T.ROW_KEY');
A('I11-held', defined('JOURNAL_KEYFILE_ENC') && $marked === 'OLDKEY' . JOURNAL_KEYFILE_ENC && $st === 'held' && $refiled === null && $GLOBALS['T'][0]['ROW_KEY'] === 'NEWKEY',
    'an encrypted page wrote under NEWKEY: no refile, the record is the saved key: ' . json_encode(array($marked, $st, $GLOBALS['T'][0]['ROW_KEY'])));
$GLOBALS['T'] = array(array('TOGGLE_KEY' => '__keyfile', 'ROW_KEY' => 'OLDKEY', 'STATE' => 9, 'UPDATED_AT' => '2026-11-01'));
$GLOBALS['OCI'] = array();
$st = journalEnsureFiled(7, array('NEWKEY'), null, true);
A('I11-refile-same', $st === 'refiled' && $ran('SET ROW_KEY = :ptag || T.ROW_KEY') !== null, 'no encrypted write: refiled as before: ' . json_encode($st));
$GLOBALS['HOOKS'] = array(); $GLOBALS['T'] = array();

// ===== item 12: an encrypted report's mention targets ======================================================================
$rep = journalGetReport('c', 7);
$GLOBALS['FLAGS'] = array_merge($GLOBALS['FLAGS'], array('on' => false, 'enc' => true));
$GLOBALS['allowedUsers'] = array('adm'); $GLOBALS['config'] = array();
$GLOBALS['journalEncPageOn'] = false;
$off = array(journalTargetCanOpenJournal($rep, 'viewer9'), journalTargetCanOpenJournal($rep, 'owner1'), journalTargetCanOpenJournal($rep, 'adm'));
$GLOBALS['journalEncPageOn'] = true;
$onv = journalTargetCanOpenJournal($rep, 'viewer9');
$GLOBALS['journalEncPageOn'] = false;
$GLOBALS['FLAGS'] = array_merge($GLOBALS['FLAGS'], array('on' => true, 'enc' => false));
A('I12-off', $off === array(false, true, true), 'the page says off (or nothing): a viewer is not mailed, the owner and an admin are: ' . json_encode($off));
A('I12-on-same', $onv === true, 'the page says on: as before');
A('I12-wired', strpos($norm($mj), "\$GLOBALS['journalEncPageOn'] = isset(\$src['journal_on'])") !== false, 'add reads journal_on');

// ===== item 13: a File Drop template's journal tokens ======================================================================
$res13 = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'keyUpper' => array('ID'), 'stateMap' => array(),
    'whoMeta' => array(), 'whoNames' => array(), 'whoMap' => array(), 'aliasMap' => array(), 'notesName' => null, 'notesSearch' => 'NOTES', 'notesMap' => array());
$tpl = generate_custom_template_string(array('data' => array(array('ID' => '1', 'DONE' => '1'), array('ID' => '2', 'DONE' => '0')), 'viewMode' => 'standard', 'journalToggleResolver' => $res13),
    array('drop_custom_template' => '{ID}:{__JOURNAL_TOGGLE__done}:{Notes}.', 'drop_custom_ext' => 'json'));
A('I13-tokens', $tpl === "1:1:.\n2:0:.", 'the legacy token reads the toggle; {Notes} with notes out of downloads is empty: ' . json_encode($tpl));

// ===== item 14 + 15: toggle history ========================================================================================
$aud = function ($a, $by, $ts) { return array('USER_ID' => $by, 'TS' => $ts, 'AFT' => json_encode($a)); };
$hist = array($aud(array('row_key' => '7', 'toggle_key' => 'done', 'state' => '1'), 'kim', '2026-11-10 09:00:00'));
$r = $run('toggle_history', 'owner1', false, null, array('get' => array('report_id' => 'jjornl', 'row_key' => '1', 'toggle_key' => 'done'), 'audit' => $hist));
$hb = null; foreach ($GLOBALS['EACH'] as $e) $hb = $e[1];
A('I14-needle', is_array($hb) && ($hb[':needle'] ?? null) === '"row_key":"1"' && ($hb[':na0'] ?? null) === '["1",' && count($jv($r, 'events')) === 0,
    'row "1": the key searched as the row key, not any "1" (every "state":"1"): ' . json_encode($hb));
$rk15 = array(array('AFT' => json_encode(array('from_cols' => array('OLDKEY'), 'to_cols' => array('ID'), 'moved' => array('P-1' => 'P-1')))));
$hist15 = array($aud(array('row_key' => 'P-1', 'toggle_key' => 'done', 'state' => '1', 'key_cols' => array('OLDKEY')), 'lee', '2026-11-09 09:00:00'),
                $aud(array('row_key' => 'P-1', 'toggle_key' => 'done', 'state' => '1', 'key_cols' => array('THIRD')), 'kim', '2026-11-08 09:00:00'));
$hk = array('/JOURNAL_REKEY/' => function () use ($rk15) { return $rk15; });
$r = $run('toggle_history', 'owner1', false, null, array('get' => array('report_id' => 'jjornl', 'row_key' => 'P-1', 'toggle_key' => 'done'), 'audit' => $hist15, 'hooks' => $hk));
$by15 = array(); foreach ((array)$jv($r, 'events') as $e) $by15[] = $e['by'];
A('I15-samesig', $by15 === array('lee'), 'a same-values move from OLDKEY: its change under OLDKEY is the row\'s, one under THIRD is not: ' . json_encode($by15) . ' ' . $r['err']);

// ===== item 17: the audit list for a plain viewer ==========================================================================
$al = $norm(file_get_contents($dir . '/get_audit_log.php'));
A('I17-jrnaudit', strpos($al, "\$jrnSql = \$can_see_people ? '' : \" AND ACTION NOT LIKE 'JOURNAL%'\";") !== false
    && substr_count($al, 'REPORT_ID = :report_id{$jrnSql}') === 4, 'the rows, the counts, the KPIs and the action mix leave JOURNAL_* out for a plain viewer');

// ===== item 18: restore - the re-link chain ================================================================================
$rs = $norm(file_get_contents($dir . '/restore_server_report.php'));
A('I18-chain', strpos($rs, "\$rl->bindValue(':old', \$relinkFrom, PDO::PARAM_INT);") !== false && strpos($rs, "JSON_VALUE(SOURCE_DATA, '\$.prior_report_id') = :p1") !== false
    && strpos($rs, 'if ((int)$nlSt->fetchColumn() > 0) break;') !== false, 'the re-link reads from the end of the restore chain, never a live report\'s id');

// ===== item 19: a long row snapshot ========================================================================================
$snap = json_encode(array('ID' => 'P-1', 'TITLE' => str_repeat("\xC3\xA9", 1500), 'NOTES' => str_repeat('x', 3000)), JSON_UNESCAPED_UNICODE);
$fit = function_exists('journalFitSnapshot') ? journalFitSnapshot($snap, 4000) : substr($snap, 0, 4000);
$dec = json_decode((string)$fit, true);
A('I19-fit', is_string($fit) && strlen($fit) <= 4000 && is_array($dec) && $dec['ID'] === 'P-1', 'cut to whole JSON, the key column kept: ' . strlen((string)$fit) . ' ' . json_encode(is_array($dec) ? array_keys($dec) : $dec));
$one = function_exists('journalFitSnapshot') ? journalFitSnapshot(json_encode(array('K' => str_repeat('y', 9000))), 4000) : null;
A('I19-one', is_string($one) && strlen($one) <= 4000 && is_array(json_decode($one, true)), 'one long value is shortened: ' . strlen((string)$one));
A('I19-bad', function_exists('journalFitSnapshot') && journalFitSnapshot('{"a":', 4000) === null && journalFitSnapshot('{"a":1}', 4000) === '{"a":1}', 'invalid JSON stores none; a short one as sent');
A('I19-wired', strpos($norm($mj), "\$rs = function_exists('journalFitSnapshot') ? journalFitSnapshot(\$rs, 4000)") !== false, 'add stores it');

// ---- report ------------------------------------------------------------------------------------------------------
$p = 0; $f = 0; $failed = array();
foreach ($R as $r) { printf("  %s  %-20s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 360)); if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; } }
echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
