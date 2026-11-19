<?php
// =============================================================================
// fix5srv/server.php DIR  - the server fixes of 2026-11-18 (batch 4, worker A), run against one build.
//   php -n -d extension_dir=... -d extension=mbstring server.php <app dir>
// DIR = the build (stage = with the fixes, base = before). Each check names its item (fix8/RANKED.md numbers). Prints a
// line a check and "TOTAL pass=N fail=M   failed: ...". On base the new behaviours are red; on stage all green. The
// "-same" checks are guards that pass on both. Modelled on fix4srv: functions and action blocks are lifted from the
// build by name (token-matched braces) and run against stubs - no database, no mail.
//   I1-*   manage_journal.php delete: a row's Shared note with someone else's files is the editors' to delete (sharedown)
//   I2-*   set_private: made public, only with the replies the page showed (pubseen, 409 new_replies)
//   I4-*   add: a reply's expect_private (replyexpect, 409 privacy_changed), before and after the insert
//   I5-*   journal_export.php: a private thread is left out WHOLE from server output (thrdpriv)
//   I6-*   an attachment's name ends in its sniffed type's extension (attachext)
//   I11-*  edit: a mention taken out and put back is not mailed again (mentiononce)
//   I12-*  add: private notes off the report's cap, a private cap of their own (privcap)
//   I13-*  schedule_runner.php penumbra_sched_sort_rows: blanks with a list order, a date column's "(not a date)"
//   I14-*  index.php ?json=1: a pick list sorts / groups in its list's order (apiorder)
//   I16-*  journalCallerCanReadJournal under ?noadm / ?asgrant (noadmpeek)
//   I19-*  rekey: lists and counts only the notes the caller may see (rekeypriv)
// =============================================================================
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', 'stderr');
$dir = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
if ($dir === '' || !is_file($dir . '/manage_journal.php')) { fwrite(STDERR, "usage: server.php <app dir>\n"); exit(2); }
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
class FxExit extends Exception {}

// ---- lifting (fix4srv's) ---------------------------------------------------------------------------------------
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
    for ($i = 0; $i < 60; $i++) {
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
$ix = file_get_contents($dir . '/index.php');

// ---- the fixture: report 7's notes -------------------------------------------------------------------------------
function n5($id, $scope, $rk, $by, $text, $parent = null, $priv = 0, $mentions = null, $file = null) {
    return array('ID' => (string)$id, 'REPORT_ID' => '7', 'SCOPE' => $scope, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'ROW_SNAPSHOT' => null,
        'MENTIONS' => $mentions, 'CREATED_BY' => $by, 'AUTHOR_NAME' => ucfirst($by) . ' Doe',
        'ATTACH_NAME' => $file, 'ATTACH_MIME' => $file ? 'application/pdf' : null,
        'PARENT_ID' => $parent === null ? null : (string)$parent, 'IS_PRIVATE' => (string)$priv,
        'CREATED_AT' => sprintf('2026-11-%02d 09:00:00', 1 + ($id % 27)));
}
function fixture5() {
    return array(
        n5(10, 'row', 'K1', 'ann', 'private root', null, 1),
        n5(11, 'row', 'K1', 'bob', 'bob replies', 10, 1),
        n5(12, 'row', 'K1', 'ann', 'ann replies', 10, 1),
        n5(20, 'row', 'K2', 'eve', 'shared note, last saved by eve', null, 0),
        n5(21, 'row', 'K2', 'ann', '', 20, 0, null, 'a.pdf'),
        n5(30, 'row', 'K3', 'eve', 'a lone note', null, 0),
        n5(31, 'row', 'K4', 'eve', 'eve note', null, 0),
        n5(32, 'row', 'K4', 'eve', '', 31, 0, null, 'mine.pdf'),
        n5(40, 'row', 'K5', 'ann', 'public root of a mixed thread', null, 0),
        n5(41, 'row', 'K5', 'bob', 'flagged reply', 40, 1),
        n5(50, 'report', null, 'ann', 'hello @cat', null, 0, 'cat'),
        n5(60, 'report', null, 'ann', 'secret @cat', null, 1, 'cat'),
    );
}
function by_id5($id) { foreach ($GLOBALS['N'] as $r) if ((int)$r['ID'] === (int)$id) return $r; return null; }
function thread5($root) { $o = array(); foreach ($GLOBALS['N'] as $r) if ((int)$r['ID'] === (int)$root || (string)$r['PARENT_ID'] === (string)$root) $o[] = $r; return $o; }

// ---- stubs (before the build's journal_export.php) ---------------------------------------------------------------
$GLOBALS['Q'] = array();
$GLOBALS['N'] = fixture5();
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = $sql;
    $N = $GLOBALS['N'];
    if (strpos($sql, 'ALL_TAB_COLUMNS') !== false) return array(array('CNT' => 1));
    if (strpos($sql, 'NC_REPORTING.PENUMBRA_AUDIT') !== false) {
        if (!empty($GLOBALS['AUDIT_FAIL'])) throw new Exception('ORA-03113: end-of-file on communication channel');
        $GLOBALS['AUDIT_Q'][] = array($sql, $binds);
        return isset($GLOBALS['AUDIT_ROWS']) ? $GLOBALS['AUDIT_ROWS'] : array();
    }
    if (strpos($sql, 'NVL(IS_PRIVATE, 0) AS P FROM PENUMBRA_JOURNAL WHERE ID = :root') !== false) {
        $r = by_id5($binds[':root']); if (!$r) return array();
        return array(array('P' => (isset($GLOBALS['ROOT_FLAG_NOW']) && $GLOBALS['ROOT_FLAG_NOW'] !== null) ? $GLOBALS['ROOT_FLAG_NOW'] : (int)$r['IS_PRIVATE']));
    }
    if (strpos($sql, 'SELECT ID, PARENT_ID, SCOPE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE ID = :pid') !== false) { $r = by_id5($binds[':pid']); return $r ? array($r) : array(); }
    if (strpos($sql, 'SELECT 1 AS OK FROM PENUMBRA_JOURNAL WHERE ID = :rid2') !== false) return by_id5($binds[':rid2']) ? array(array('OK' => 1)) : array();
    if (strpos($sql, 'SELECT COUNT(*) AS CNT FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid') !== false) {
        $GLOBALS['CAPSQL'][] = $sql;
        return array(array('CNT' => isset($GLOBALS['PUBCNT']) ? $GLOBALS['PUBCNT'] : count($N)));
    }
    if (strpos($sql, 'AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND NVL(IS_PRIVATE, 0) <> 0') !== false) return array(array('C' => isset($GLOBALS['PRIVCNT']) ? $GLOBALS['PRIVCNT'] : 0));
    if (strpos($sql, 'SELECT DISTINCT LOWER(CREATED_BY) AS CREATOR') !== false) {
        $o = array(); $s = array(); foreach (thread5($binds[':root']) as $r) { $u = strtolower($r['CREATED_BY']); if (!isset($s[$u])) { $s[$u] = 1; $o[] = array('CREATOR' => $u); } } return $o;
    }
    if (strpos($sql, 'SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL') !== false) return array();
    if (preg_match('/AND \(ID = :root( OR PARENT_ID = :root2)?\)/', $sql)) return thread5($binds[':root']);
    if (strpos($sql, 'WHERE PARENT_ID = :nid AND REPORT_ID = :rid ORDER BY ID') !== false) {
        $o = array(); foreach ($N as $r) if ((string)$r['PARENT_ID'] === (string)$binds[':nid']) $o[] = $r; return $o;
    }
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ID = :nid') !== false && strpos($sql, 'ATTACH_DATA') === false) { $r = by_id5($binds[':nid']); return $r ? array($r) : array(); }
    // rekey
    if (strpos($sql, 'SELECT DISTINCT SUBSTR(ROW_KEY, :a1) AS K') === 0) {
        $k = array();
        if (strpos($sql, 'UNION') !== false) foreach ($N as $r) if ($r['SCOPE'] === 'row' && is_string($r['ROW_KEY']) && strpos($r['ROW_KEY'], $binds[':tag2']) === 0) $k[substr($r['ROW_KEY'], strlen($binds[':tag2']))] = 1;
        $o = array(); foreach (array_keys($k) as $x) $o[] = array('K' => (string)$x); return $o;
    }
    if (strpos($sql, "IS_PRIVATE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, :ln) = :tag") !== false) {
        $o = array(); foreach ($N as $r) if ($r['SCOPE'] === 'row' && is_string($r['ROW_KEY']) && strpos($r['ROW_KEY'], $binds[':tag']) === 0) $o[] = $r; return $o;
    }
    if (strpos($sql, "SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, :ln) = :tag") === 0) {
        $c = 0; foreach ($N as $r) if ($r['SCOPE'] === 'row' && is_string($r['ROW_KEY']) && strpos($r['ROW_KEY'], $binds[':tag']) === 0) $c++; return array(array('C' => $c));
    }
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return strpos($sql, 'COUNT(*) AS C') !== false ? array(array('C' => 0)) : array();
    // the export resolver's notes read: every row note (the stub reads no WHERE clause of its own: the SQL is checked as text)
    if (strpos($sql, "SCOPE = 'row' AND ROW_KEY IS NOT NULL") !== false) {
        $GLOBALS['EXPORT_SQL'][] = $sql;
        $o = array(); foreach ($N as $r) if ($r['SCOPE'] === 'row') $o[] = $r; return $o;
    }
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    throw new Exception('unexpected SQL: ' . substr(preg_replace('/\s+/', ' ', $sql), 0, 200));
}
function journalHasPrivateColumn() { return true; }
function journalHasParentColumn() { return true; }
function journalHasAttachColumn() { return true; }
function journalIsMissingTableError($m) { return false; }
function utf8ize($x) { return $x; }
function readClobViaOci8($t, $c, $k, $id) { return '{"encrypted":true,"content":""}'; }
function log_scheduler($m) { $GLOBALS['LOG'][] = $m; }
require $dir . '/journal_export.php';
foreach (array('OCI_NO_AUTO_COMMIT' => 0, 'OCI_D_LOB' => 50, 'OCI_B_CLOB' => 112, 'OCI_TEMP_CLOB' => 2, 'SQLT_CHR' => 1, 'JOURNAL_NOTE_MAX_CHARS' => 8000,
               'JOURNAL_MAX_MENTIONS' => 20, 'JOURNAL_MAX_NOTES_PER_REPORT' => 1000, 'JOURNAL_ATTACH_MAX_BYTES' => 5242880, 'JOURNAL_BULK_MAX_ROWS' => 5000,
               'JOURNAL_FIELD_STATE' => 2) as $k => $v) { if (!defined($k)) define($k, $v); }

$GLOBALS['FLAGS'] = array('on' => true, 'enc' => false, 'toggles' => array('done'), 'labels' => array(), 'keyCols' => array('ID'), 'shared' => false, 'fields' => null);
function journalReportStateFlags($r) { return $GLOBALS['FLAGS']; }
function journalGetReport($c, $id) { return array('ID' => 7, 'SHORT_ID' => 'jjornl', 'OWNER_ID' => 'owner1', 'TITLE' => 'T', 'AUTHORIZED' => 'public'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanEditReport($r, $u, $a) { return $a || $u === 'edi'; }
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
function journalResolveMentionAccess($c, $r, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = array('authorized' => true, 'name' => ucfirst($u)); return $o; }
function journalSendMentionEmail() { $a = func_get_args(); $GLOBALS['MAILS'][] = array('mention', $a[0]); return true; }
function journalSendReplyEmail() { $a = func_get_args(); $GLOBALS['MAILS'][] = array('reply', $a[0]); return true; }
function journalAuthorName() { return 'Kim Doe'; }
function journalRowRefLine($s, $t) { return ''; }
function journalRowRefText($s, $k, $snap) { return ''; }
function journalLookupNames($c, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = 'Named ' . $u; return $o; }
function execClobInsert($conn, $table, $cols, $clob, $raw = array()) { $GLOBALS['INSERTS'][] = $cols; return 1; }
function journalInsertNoteReturningId($cols, $clob, $blob) { $GLOBALS['INSERTS'][] = $cols; return 999; }
function logPenumbraAudit($rid, $a, $b, $c, $m = null, $x = null) { $GLOBALS['AUDIT'][] = array('action' => $a, 'before' => $b, 'after' => $c, 'msg' => $m); }
function penumbraIsReportOwner($owner, $uid) { $u = strtoupper(trim((string)$uid)); return $u !== '' && strtoupper(trim((string)$owner)) === $u; }
function penumbraReportGrantMatches($g, $sid) { return is_array($g) && in_array($sid, $g, true); }
function penumbraNormalizeGrants($cfg, $uid) { return isset($GLOBALS['REAL_GRANTS'][$uid]) ? $GLOBALS['REAL_GRANTS'][$uid] : array(); }
function getOci8Connection() { return 'oci'; }
$GLOBALS['OCI'] = array();
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'runs' => array(), 'n' => null); $GLOBALS['BIND'][$k] = array(); return $k; }
function oci_bind_by_name($st, $n, &$v, $l = -1, $t = 0) { $GLOBALS['BIND'][$st][$n] = &$v; return true; }
function oci_execute($st, $m = 0) {
    $snap = array(); foreach ($GLOBALS['BIND'][$st] as $k => $v) $snap[$k] = is_object($v) ? 'LOB' : $v;
    $GLOBALS['OCI'][$st]['runs'][] = $snap;
    $sql = $GLOBALS['OCI'][$st]['sql'];
    if (strpos($sql, 'PENUMBRA_JOURNAL_TOGGLE') !== false) { $GLOBALS['OCI'][$st]['n'] = 0; return true; }
    if (strpos($sql, 'UPDATE PENUMBRA_JOURNAL SET ROW_KEY = :qnew') === 0) {   // rekey's move of the notes: done to the fixture
        $c = 0;
        foreach ($GLOBALS['N'] as $i => $r) if ($r['ROW_KEY'] === $snap[':qold']) { $GLOBALS['N'][$i]['ROW_KEY'] = $snap[':qnew']; $c++; }
        $GLOBALS['OCI'][$st]['n'] = $c;
    }
    return true;
}
function oci_num_rows($st) { return $GLOBALS['OCI'][$st]['n'] !== null ? $GLOBALS['OCI'][$st]['n'] : 1; }
function oci_free_statement($st) { return true; }
function oci_commit($c) { return true; }
function oci_rollback($c) { return true; }
function oci_error($x = null) { return array('message' => 'stub'); }
class Fx5Lob { function writeTemporary($v, $t = 0) { return true; } function free() { return true; } }
function oci_new_descriptor($c, $t = 0) { return new Fx5Lob(); }

foreach (array('journalNoteVisibleTo', 'journalTagNotesVisible', 'journalAllowedAttachMime', 'journalSafeFilename', 'journalAttachCanonicalName',
               'journalDeleteSharedNote', 'journalReportJournalEnabled', 'journalTargetCanOpenJournal', 'journalCallerCanReadJournal', 'journalSharedNoteOf') as $fn) fx_lift($mj, $fn);

$run = function ($action, $user, $admin, $body, $setup = array()) use ($mj) {
    $code = fx_block(str_replace("\r\n", "\n", $mj), "if (\$action === '$action') {", false);
    if ($code === '') return array('code' => 0, 'j' => null, 'err' => 'not lifted', 'raw' => '');
    foreach (array('OCI', 'BIND', 'AUDIT', 'Q', 'INSERTS', 'MAILS', 'UPDATES', 'CAPSQL', 'AUDIT_Q') as $g) $GLOBALS[$g] = array();
    $GLOBALS['N'] = isset($setup['notes']) ? $setup['notes'] : fixture5();
    $GLOBALS['ROOT_FLAG_NOW'] = isset($setup['rootflag']) ? $setup['rootflag'] : null;
    $GLOBALS['FLAGS']['shared'] = !empty($setup['shared']);
    $GLOBALS['PUBCNT'] = isset($setup['pubcnt']) ? $setup['pubcnt'] : null;
    $GLOBALS['PRIVCNT'] = isset($setup['privcnt']) ? $setup['privcnt'] : 0;
    $GLOBALS['AUDIT_ROWS'] = isset($setup['audit']) ? $setup['audit'] : array();
    $GLOBALS['AUDIT_FAIL'] = !empty($setup['audit_fail']);
    $_GET = isset($setup['get']) ? $setup['get'] : array(); $_POST = array(); $_FILES = array();
    $GLOBALS['currentUserKey'] = $user;
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

// ===== item 1: a row's Shared note with someone else's files ==========================================================
$r = $run('delete', 'eve', false, array('note_id' => 20), array('shared' => true));
A('I1-refused', $r['code'] === 403 && $jv($r, 'code') === 'shared_owned' && !$ran('DELETE FROM PENUMBRA_JOURNAL'),
    'eve saved K2\'s Shared note last; ann added a file: ' . $brief($r));
$r = $run('delete', 'eve', false, array('note_id' => 31), array('shared' => true));
A('I1-own-files-same', $jv($r, 'status') === 'success' && $ran('DELETE FROM PENUMBRA_JOURNAL') !== null, 'only her own file on it: deleted as before: ' . $brief($r));
$r = $run('delete', 'edi', false, array('note_id' => 20), array('shared' => true));
A('I1-editor-same', $jv($r, 'status') === 'success' && $ran('DELETE FROM PENUMBRA_JOURNAL') !== null, 'the report\'s editor deletes it: ' . $brief($r));
$r = $run('delete', 'adm', true, array('note_id' => 20), array('shared' => true));
A('I1-admin-same', $jv($r, 'status') === 'success', 'an admin deletes it: ' . $brief($r));
$r = $run('delete', 'eve', false, array('note_id' => 20), array('shared' => false));
A('I1-discussion-same', $r['code'] === 403 && $jv($r, 'code') === 'shared_owned' && !$ran('DELETE FROM PENUMBRA_JOURNAL'), 'a Discussion thread with ann\'s file: refused too (2026-11-18, ownfiles): ' . $brief($r));
$GLOBALS['OCI'] = array(); $GLOBALS['BIND'] = array();
$dn = function_exists('journalDeleteSharedNote') ? journalDeleteSharedNote(20, 7, 'x') : null;
$ds = $ran('DELETE FROM PENUMBRA_JOURNAL WHERE ID = :b_id');
A('I1-clear-guard', $ds !== null && strpos($ds['sql'], 'NOT EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL c WHERE c.PARENT_ID = :b_id2') !== false && isset($ds['runs'][0][':b_id2']) && $ds['runs'][0][':b_id2'] === 20,
    'a cleared Shared note goes only while it has no files: ' . json_encode($ds));

// ===== item 2: made public, only with the replies the page showed =====================================================
$r = $run('set_private', 'ann', false, array('note_id' => 10, 'private' => 0, 'reply_ids' => array(11)));
A('I2-unseen', $r['code'] === 409 && $jv($r, 'code') === 'new_replies' && $jv($r, 'count') === 1 && !$ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE'), $brief($r));
$r = $run('set_private', 'ann', false, array('note_id' => 10, 'private' => 0));
A('I2-old-page', $r['code'] === 409 && $jv($r, 'code') === 'new_replies' && $jv($r, 'count') === 1 && !$ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE'),
    'no reply_ids and a reply by bob: refused: ' . $brief($r));
$r = $run('set_private', 'ann', false, array('note_id' => 10, 'private' => 0, 'reply_ids' => array(11, '12')));
$up = $ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
A('I2-seen', $jv($r, 'status') === 'success' && $up !== null && strpos($up['sql'], 'ID IN (:v0, :v1)') !== false && $up['runs'][0][':v0'] === 11 && $up['runs'][0][':v1'] === 12
    && $up['runs'][0][':root'] === 10 && $up['runs'][0][':p'] === 0, 'every reply shown: published by ID: ' . $brief($r) . ' ' . json_encode($up));
$own = fixture5(); $own[1]['CREATED_BY'] = 'ann';
$r = $run('set_private', 'ann', false, array('note_id' => 10, 'private' => 0), array('notes' => $own));
A('I2-own-replies-same', $jv($r, 'status') === 'success' && $ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE') !== null, 'an old page, her own replies only: as before: ' . $brief($r));
$r = $run('set_private', 'eve', false, array('note_id' => 30, 'private' => 1));
$up = $ran('UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
A('I2-private-same', $jv($r, 'status') === 'success' && $up !== null && strpos($up['sql'], 'OR PARENT_ID = :root2)') !== false, 'making private: no check, the whole thread: ' . $brief($r));

// ===== item 4: a reply's expected privacy =============================================================================
$rb = function ($extra) { return array('report_id' => 'jjornl', 'note_text' => 'my reply', 'parent_id' => 10) + $extra; };
$r = $run('add', 'bob', false, $rb(array('expect_private' => 0)));
A('I4-pre', $r['code'] === 409 && $jv($r, 'code') === 'privacy_changed' && $jv($r, 'private') === 1 && !$GLOBALS['INSERTS'] && !$GLOBALS['MAILS'],
    'written for a public thread, the thread is private: nothing posted: ' . $brief($r));
$r = $run('add', 'bob', false, $rb(array('expect_private' => 1)));
A('I4-match-same', $jv($r, 'status') === 'success' && count($GLOBALS['INSERTS']) === 1 && !empty($GLOBALS['INSERTS'][0]['IS_PRIVATE']) && $jv($r, 'private') === 1, $brief($r));
$r = $run('add', 'bob', false, $rb(array('expect_private' => true)), array('rootflag' => 0));
$del = $ran('DELETE FROM PENUMBRA_JOURNAL WHERE ID = :nid');
A('I4-post', $r['code'] === 409 && $jv($r, 'code') === 'privacy_changed' && $jv($r, 'private') === 0 && $del !== null && $del['runs'][0][':nid'] === 999 && !$GLOBALS['MAILS'] && !$GLOBALS['AUDIT'],
    'the thread made public while it was written: taken back, nobody mailed: ' . $brief($r) . ' ' . json_encode($del));
$r = $run('add', 'bob', false, $rb(array()), array('rootflag' => 0));
A('I4-old-page-same', $jv($r, 'status') === 'success' && $jv($r, 'private') === 0, 'no expect_private: the thread\'s flag as it is now, as before: ' . $brief($r));

// ===== item 12: private notes and the caps ============================================================================
$pb = array('report_id' => 'jjornl', 'note_text' => 'note to self', 'private' => 1);
$r = $run('add', 'ann', false, $pb, array('privcnt' => 100));
A('I12-private-cap', $r['code'] === 400 && $jv($r, 'code') === 'private_cap' && !$GLOBALS['INSERTS'], $brief($r));
$r = $run('add', 'ann', false, $pb, array('privcnt' => 99));
A('I12-private-under-same', $jv($r, 'status') === 'success', $brief($r));
$r = $run('add', 'ann', false, $pb, array('pubcnt' => 1000));
A('I12-report-cap-off', $jv($r, 'status') === 'success' && $GLOBALS['CAPSQL'] && strpos($GLOBALS['CAPSQL'][0], 'NVL(IS_PRIVATE, 0) = 0') !== false,
    'a private note past 1,000 public ones; the cap counts public notes: ' . $brief($r) . ' ' . json_encode($GLOBALS['CAPSQL']));
$r = $run('add', 'ann', false, array('report_id' => 'jjornl', 'note_text' => 'public'), array('pubcnt' => 1000));
A('I12-report-cap-same', $r['code'] === 400 && strpos((string)$jv($r, 'message'), 'maximum of 1000') !== false, $brief($r));

// ===== item 11: mentions mailed once a note ===========================================================================
$eb = array('note_id' => 50, 'note_text' => 'hello @cat @bob', 'mentions' => array(array('user' => 'cat', 'name' => 'Cat'), array('user' => 'bob', 'name' => 'Bob')));
$hist = array(array('B' => json_encode(array('id' => 50, 'note_text' => 'hello @bob', 'mentions' => 'bob')), 'A' => json_encode(array('id' => 50, 'scope' => 'report', 'mentions' => array()))));
$mailed = function () { $o = array(); foreach ((array)$GLOBALS['MAILS'] as $m) $o[] = $m[1]; sort($o); return implode(',', $o); };
$r = $run('edit', 'ann', false, $eb, array('audit' => $hist));
A('I11-again', $jv($r, 'status') === 'success' && $mailed() === '', 'bob was named before (taken out since): not mailed again: mailed [' . $mailed() . '] ' . $brief($r));
$r = $run('edit', 'ann', false, array('note_id' => 50, 'note_text' => 'hello @cat @dan', 'mentions' => array(array('user' => 'dan', 'name' => 'Dan'))), array('audit' => $hist));
A('I11-new-same', $mailed() === 'dan', 'dan never named: mailed: [' . $mailed() . ']');
$r = $run('edit', 'ann', false, $eb, array('audit' => $hist, 'audit_fail' => true));
A('I11-fallback-same', $mailed() === 'bob', 'the history unreadable: as before: [' . $mailed() . '] ' . $brief($r));
$GLOBALS['config'] = array('scheduler_secret_key' => 'fx5-key');
$tagBob = substr(hash_hmac('sha256', 'pnb-jmention|60|bob', 'fx5-key'), 0, 24);
$ph = array(array('B' => json_encode(array('id' => 60, 'private' => 1, 'text_len' => 9, 'mentions' => 1, 'mt' => array($tagBob))), 'A' => json_encode(array('id' => 60, 'scope' => 'report', 'private' => 1))));
$r = $run('edit', 'ann', false, array('note_id' => 60, 'note_text' => 'secret @cat @bob', 'mentions' => array(array('user' => 'bob', 'name' => 'Bob'))), array('audit' => $ph));
A('I11-private', $jv($r, 'status') === 'success' && $mailed() === '', 'a private note: bob\'s keyed tag in its history: not mailed again: [' . $mailed() . '] ' . $brief($r));
$au = $GLOBALS['AUDIT'] ? $GLOBALS['AUDIT'][0] : array();
$tagCat = substr(hash_hmac('sha256', 'pnb-jmention|60|cat', 'fx5-key'), 0, 24);
A('I11-private-audit', strpos((string)($au['before'] ?? ''), $tagCat) !== false && strpos((string)($au['before'] ?? ''), 'cat') === false && strpos((string)($au['after'] ?? ''), 'bob') === false,
    'its audit keeps the tags, never the uids: ' . json_encode($au));
$GLOBALS['config'] = null;

// ===== item 5: a private thread is left out whole =====================================================================
$GLOBALS['N'] = fixture5(); $GLOBALS['EXPORT_SQL'] = array();
if (isset($GLOBALS['penumbra_jt_resolver_memo'])) $GLOBALS['penumbra_jt_resolver_memo'] = array();
$vo5 = array('journalEnabled' => true, 'journalKeyColumns' => array('KEY'), 'journalRowNotes' => true, 'journalNotesExport' => true);
$rows5 = array(array('KEY' => 'K1'), array('KEY' => 'K2'), array('KEY' => 'K5'));
$xerr = '';
try { journalExportToggleColumns('rpt5', array('viewOptions' => $vo5), $rows5); } catch (Throwable $e) { $xerr = $e->getMessage(); }
$cell = function ($i) use ($rows5) { return isset($rows5[$i]['NOTES']) ? $rows5[$i]['NOTES'] : '(none)'; };
A('I5-mixed', strpos($cell(2), 'public root of a mixed thread') === false && strpos($cell(2), 'flagged') === false,
    'K5: a public root with a flagged reply is a private thread: ' . json_encode($cell(2)) . $xerr);
A('I5-public-same', strpos($cell(1), 'shared note, last saved by eve') !== false && strpos($cell(0), 'private root') === false, json_encode(array($cell(0), $cell(1))) . $xerr);
$xs = $GLOBALS['EXPORT_SQL'] ? $GLOBALS['EXPORT_SQL'][0] : '';
A('I5-sql', strpos($xs, 'NVL(IS_PRIVATE, 0) = 0') !== false && strpos($xs, 'NOT EXISTS (SELECT 1 FROM PENUMBRA_JOURNAL p') !== false && strpos($xs, 'p.PARENT_ID = NVL(NULLIF(j.PARENT_ID, 0), j.ID)') !== false,
    'the read asks for threads with no flagged note: ' . preg_replace('/\s+/', ' ', $xs));

// ===== item 6: attachment names =======================================================================================
$cn = function ($n, $m) { return function_exists('journalAttachCanonicalName') ? journalAttachCanonicalName($n, $m) : '(none)'; };
$cases = array(array('go.js', 'text/plain', 'go.txt'), array('x.bat', 'image/gif', 'x.gif'), array('a.hta', 'text/plain', 'a.txt'), array('page.html', 'text/plain', 'page.txt'),
               array('README', 'text/plain', 'README.txt'), array('data.csv', 'text/plain', 'data.csv'), array('Photo.JPEG', 'image/jpeg', 'Photo.JPEG'),
               array('report.PDF', 'application/pdf', 'report.PDF'), array('budget.xlsx.exe', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'budget.xlsx.xlsx'),
               array('v1.2 notes', 'text/plain', 'v1.2 notes.txt'), array('.bashrc', 'text/plain', '.bashrc.txt'));
$bad = array(); foreach ($cases as $c) { $got = $cn($c[0], $c[1]); if ($got !== $c[2]) $bad[] = $c[0] . ' (' . $c[1] . ') -> ' . $got . ' (want ' . $c[2] . ')'; }
A('I6-names', !$bad, $bad ? implode(' | ', $bad) : 'every name ends in its type\'s extension');
$mjn = str_replace("\r\n", "\n", $mj);
A('I6-wired', strpos($mjn, "'name' => journalAttachCanonicalName(journalSafeFilename(\$f['name']), \$mime)") !== false
    && strpos($mjn, "\$fname = journalAttachCanonicalName(journalSafeFilename(\$m['ATTACH_NAME']), \$m['ATTACH_MIME']);") !== false,
    'the upload stores it, the download sends it (a file stored before too)');

// ===== item 13: the scheduled sort ====================================================================================
$srt = function ($rows, $state) use ($sr) { return fx_call($sr, function () use ($rows, $state) { return penumbra_sched_sort_rows($rows, $state); }); };
$col = function ($rows, $c) { $o = array(); foreach ($rows as $r) $o[] = $r[$c]; return implode('|', $o); };
$pk = array(array('ID' => '1', 'STATUS' => 'Done'), array('ID' => '2', 'STATUS' => ''), array('ID' => '3', 'STATUS' => 'Not started'), array('ID' => '4', 'STATUS' => 'In progress'), array('ID' => '5', 'STATUS' => ''));
$cso = array('STATUS' => array('values' => array('Not started', 'In progress', 'Done')));
$o = $srt($pk, array('sortCriteria' => array(array('colIdentifier' => 'STATUS', 'colIndex' => 'STATUS', 'direction' => 'asc')), 'customSortOrders' => $cso));
A('I13-list-asc', $col($o, 'STATUS') === 'Not started|In progress|Done||', 'a pick list ascending: its options, then the unset rows (the page): ' . $col($o, 'STATUS'));
$o = $srt($pk, array('sortCriteria' => array(array('colIdentifier' => 'STATUS', 'colIndex' => 'STATUS', 'direction' => 'desc')), 'customSortOrders' => $cso));
A('I13-list-desc', $col($o, 'STATUS') === '||Done|In progress|Not started', 'descending: the unset rows first: ' . $col($o, 'STATUS'));
$o = $srt(array(array('T' => 'b'), array('T' => ''), array('T' => 'a')), array('sortCriteria' => array(array('colIdentifier' => 'T', 'colIndex' => 'T', 'direction' => 'asc'))));
A('I13-plain-same', $col($o, 'T') === '|a|b', 'a column with no order of its own: blanks first, as before: ' . $col($o, 'T'));
$dr = array(array('DUE' => '2026-01-02'), array('DUE' => '(not a date)'), array('DUE' => ''), array('DUE' => '2025-12-31'));
$o = $srt($dr, array('sortCriteria' => array(array('colIdentifier' => 'DUE', 'colIndex' => 'DUE', 'direction' => 'asc')),
                     'journalToggleResolver' => array('fieldDates' => array('DUE' => true), 'whoMeta' => array(array('name' => 'DUE', 'key' => 'due', 'kind' => 'field')))));
A('I13-days', $col($o, 'DUE') === '|2025-12-31|2026-01-02|(not a date)', 'a date column: a blank, the days, "(not a date)" (the page): ' . $col($o, 'DUE'));

// ===== item 14: ?json=1, a pick list's order ===========================================================================
$res14 = array('fieldOpts' => array('STATUS' => array('key' => 'status3', 'order' => array('Not started', 'In progress', 'Done'), 'cur' => array(), 'old' => array())),
               'whoMeta' => array(array('name' => 'STATUS', 'key' => 'status3', 'kind' => 'field')), 'colMeta' => array(), 'colNames' => array(), 'whoNames' => array('STATUS'));
$A14 = "            \$journal_toggle_resolver = isset(\$jt['resolver']) ? \$jt['resolver'] : null;\n        }\n";
$B14 = "        // columns (2026-09-30): the column names of this rowset BEFORE the search\n";
$ixn = str_replace("\r\n", "\n", $ix);
$i0 = strpos($ixn, $A14); $i1 = ($i0 === false) ? false : strpos($ixn, $B14, $i0);
$blk = ($i0 === false || $i1 === false) ? '' : substr($ixn, $i0 + strlen($A14), $i1 - $i0 - strlen($A14));
$blk = str_replace("__DIR__ . '/penumbra_layout.php'", var_export($dir . '/no_such_layout.php', true), $blk);
$blk = str_replace("__DIR__ . '/penumbra_search.php'", var_export($dir . '/penumbra_search.php', true), $blk);
$api = function ($rows, $dirn) use ($blk, $res14) {
    if ($blk === '') return 'not lifted';
    $f = function ($response, $state, $journal_toggle_resolver, $journal_toggle_cols, $_ssCalcAdded) use ($blk) { eval($blk); return $response; };
    try {
        $out = $f(array('data' => $rows), array('sortCriteria' => array(array('colIndex' => 'STATUS', 'colIdentifier' => 'STATUS', 'direction' => $dirn))), $res14, array('STATUS'), array());
    } catch (Throwable $e) { return 'THROWS ' . $e->getMessage(); }
    $o = array(); foreach ($out['data'] as $r) $o[] = $r['STATUS']; return implode('|', $o);
};
$ar = array(array('ID' => '1', 'STATUS' => 'Done'), array('ID' => '2', 'STATUS' => 'Not started'), array('ID' => '3', 'STATUS' => ''), array('ID' => '4', 'STATUS' => 'In progress'));
$got = $api($ar, 'asc');
A('I14-sort', $got === 'Not started|In progress|Done|', 'the API sorts a pick list in its list\'s order, unset last: ' . $got);
$got = $api($ar, 'desc');
A('I14-sort-desc', $got === '|Done|In progress|Not started', $got);
$gc = function_exists('journalExportFieldOrderCmp') ? journalExportFieldOrderCmp(array(), $res14, 'Status') : null;
$groups = array('Done' => 1, '[Blank]' => 1, 'In progress' => 1, 'Not started' => 1);
if ($gc) uksort($groups, $gc);
A('I14-group', $gc !== null && implode('|', array_keys($groups)) === 'Not started|In progress|Done|[Blank]' && strpos($ixn, "if (\$_pkGroupCmp) uksort(\$response['data'], \$_pkGroupCmp);") !== false,
    'its groups too: ' . implode('|', array_keys($groups)));
$gn = function_exists('journalExportFieldOrderCmp') ? journalExportFieldOrderCmp(array(), $res14, 'TITLE') : 'none';
A('I14-other-same', $gn === null || $gn === 'none', 'a column that is not a pick list: no comparator');

// ===== item 16: the journal-off peek under ?noadm / ?asgrant ==========================================================
$GLOBALS['FLAGS']['on'] = false;
$GLOBALS['allowedUsers'] = array('adm');
$GLOBALS['config'] = array();
$GLOBALS['REAL_GRANTS'] = array('gina' => array('jjornl'), 'adm' => array());
$peek = function ($uid, $admin, $noadm, $asgrant, $grants) {
    $GLOBALS['noadm'] = $noadm; $GLOBALS['penumbraAsGrant'] = $asgrant; $GLOBALS['userGrants'] = $grants;
    $r = function_exists('journalCallerCanReadJournal') ? journalCallerCanReadJournal(journalGetReport('c', 7), $uid, $admin) : 'none';
    $GLOBALS['noadm'] = 0; $GLOBALS['penumbraAsGrant'] = false; $GLOBALS['userGrants'] = array();
    return $r;
};
$p = array('admin-noadm' => $peek('adm', false, 1, false, array()), 'owner-noadm' => $peek('owner1', false, 1, false, array()),
           'asgrant-other' => $peek('adm', false, 1, true, array('other')), 'grant-noadm' => $peek('gina', false, 1, false, array('jjornl')));
A('I16-noadm', $p['admin-noadm'] === false && $p['owner-noadm'] === false && $p['asgrant-other'] === false && $p['grant-noadm'] === false,
    'a journal-off report under ?noadm / ?asgrant: a viewer\'s answer: ' . json_encode($p));
$q = array('admin' => $peek('adm', true, 0, false, array()), 'owner' => $peek('owner1', false, 0, false, array()), 'grant' => $peek('gina', false, 0, false, array('jjornl')),
           'asgrant-this' => $peek('adm', false, 1, true, array('jjornl')), 'viewer' => $peek('viewer9', false, 0, false, array()));
A('I16-same', $q['admin'] === true && $q['owner'] === true && $q['grant'] === true && $q['asgrant-this'] === true && $q['viewer'] === false,
    'without the switches, and ?asgrant naming this report: as before: ' . json_encode($q));
$GLOBALS['FLAGS']['on'] = true;
A('I16-on-same', $peek('viewer9', false, 1, false, array()) === true, 'the journal on: every viewer');

// ===== item 19: rekey, only the notes the caller may see =============================================================
$GLOBALS['FLAGS']['keyCols'] = array('NEWKEY');
$tag = journalParkTag(journalKeySig(array('OLDKEY')));
$rkN = function () use ($tag) { return array(n5(70, 'row', $tag . 'A', 'ann', 'private, filed', null, 1), n5(71, 'row', $tag . 'B', 'bob', 'public, filed', null, 0), n5(72, 'row', $tag . 'B', 'ann', 'its reply', 71, 0)); };
$r = $run('rekey', 'edi', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY')), array('notes' => $rkN()));
$keys = (is_array($r['j']) && isset($r['j']['keys'])) ? $r['j']['keys'] : null;
A('I19-keys', $keys === array('B', 'A') && $r['j']['key_counts'][1]['hidden_only'] === true && $r['j']['key_counts'][1]['notes'] === 0,
    'step 1 lists every old key; one holding only a note the caller cannot see is hidden_only (2026-11-18, rekeyall): ' . $brief($r));
$r = $run('rekey', 'edi', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY'), 'pairs' => array(array('A', 'A2'), array('B', 'B2'))), array('notes' => $rkN()));
A('I19-moved', $jv($r, 'notes') === 2 && count($GLOBALS['AUDIT']) === 1 && strpos((string)$GLOBALS['AUDIT'][0]['after'], '"notes":3') !== false,
    'moved: the 2 the caller may see (the audit keeps all 3): ' . $brief($r) . ' ' . json_encode($GLOBALS['AUDIT']));
$r = $run('rekey', 'edi', false, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY'), 'pairs' => array(array('B', 'B2'))), array('notes' => $rkN()));
A('I19-left', $jv($r, 'left_notes') === 0 && $jv($r, 'notes') === 2, 'left under the old key: only a private thread, not counted: ' . $brief($r));
$r = $run('rekey', 'ann', true, array('report_id' => 'jjornl', 'from_cols' => array('OLDKEY'), 'pairs' => array(array('B', 'B2'))), array('notes' => $rkN()));
A('I19-audience-same', $jv($r, 'left_notes') === 1, 'its own writer (an admin here, past the editors-only gate) is told of it: ' . $brief($r));
$GLOBALS['FLAGS']['keyCols'] = array('ID');

// ---- report ------------------------------------------------------------------------------------------------------
$p = 0; $f = 0; $failed = array();
foreach ($R as $r) { printf("  %s  %-20s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 360)); if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; } }
echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
