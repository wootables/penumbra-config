<?php
// =============================================================================
// fix4srv/server.php DIR  - the server fixes of 2026-11-18 (batch 3, worker A), run against one build.
//   php -n -d extension_dir=... -d extension=mbstring server.php <app dir>
// DIR = the build (stage = with the fixes, base = before). Each check names its item (RANKED.md numbers). Prints a
// line a check and "TOTAL pass=N fail=M   failed: ...". On base the new behaviours are red; on stage all green.
// Modelled on fix3srv: functions and action blocks are lifted from the build by name (token-matched braces) and run
// against stubs - no database, no mail.
//   I1-*   manage_journal.php summary: off_since / since_off / never_on from the saved versions (journalOffSince)
//   I2-*   restore_server_report.php: restoring a journal-ON version over a journal-OFF report asks first
//   I6-*   journal_export.php: a note's text never read as @@HTML / @@JSON markup in server output
//   I8-*   schedule_runner.php apply_state_logic: grouping by a journal column the layout shows keeps the column
//   I12-*  manage_journal.php toggles: a failed field read says so (fields_failed)
//   I14-*  manage_journal.php set_fields_bulk: an unsigned Undo leaves rows changed since as they are
//   I15-*  a pick-list / date column a task names in its change columns is signed and compared
//   I16-*  a renamed journal column's old name in change columns reads as the column now
// =============================================================================
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', 'stderr');
$dir = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
if ($dir === '' || !is_file($dir . '/schedule_runner.php')) { fwrite(STDERR, "usage: server.php <app dir>\n"); exit(2); }
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
class FxExit extends Exception {}

// ---- lifting (fix3srv's) ---------------------------------------------------------------------------------------
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
$rs = file_get_contents($dir . '/restore_server_report.php');

// ---- stubs (before the build's pure files) -----------------------------------------------------------------------
$GLOBALS['Q'] = array();
$GLOBALS['NOTES'] = array();       // summary: the journal's notes (with CREATED_AT)
$GLOBALS['AUD'] = array();         // summary: the version rows, newest first
$GLOBALS['FIELDS_FAIL'] = false;   // toggles: the field values read throws
$GLOBALS['CUR'] = array();         // set_fields_bulk: the field's rows now
$GLOBALS['EXPORT_NOTES'] = array();
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = $sql;
    if (strpos($sql, 'FROM NC_REPORTING.PENUMBRA_AUDIT a') !== false) {
        return array_slice($GLOBALS['AUD'], (int)$binds[':lo'], (int)$binds[':hi'] - (int)$binds[':lo']);
    }
    if (strpos($sql, 'UNSEEN_FLAG') !== false && strpos($sql, 'COUNT(*)') === false) {
        $o = array();
        foreach ($GLOBALS['NOTES'] as $n) $o[] = $n + array('UNSEEN_FLAG' => 0);
        return $o;
    }
    if (strpos($sql, 'COUNT(*) AS N FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND CREATED_AT >=') !== false) {
        $c = 0; foreach ($GLOBALS['NOTES'] as $n) if (strcmp($n['CREATED_AT'], $binds[':os']) >= 0) $c++;
        return array(array('N' => $c));
    }
    if (strpos($sql, 'SELECT COUNT(*) AS TOTAL') !== false) return array(array('TOTAL' => count($GLOBALS['NOTES']), 'UNSEEN' => 0, 'LATEST_AT' => null));
    if (strpos($sql, 'FIELD_VALUE, UPDATED_BY') !== false) { if ($GLOBALS['FIELDS_FAIL']) throw new Exception('ORA-03113: end-of-file on communication channel'); return array(); }
    if (strpos($sql, 'FOR UPDATE WAIT 10') !== false) return $GLOBALS['CUR'];
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL') !== false && strpos($sql, "SCOPE = 'row'") !== false) return $GLOBALS['EXPORT_NOTES'];
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return array();
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    throw new Exception('unexpected SQL: ' . substr(preg_replace('/\s+/', ' ', $sql), 0, 160));
}
$GLOBALS['PRIVCOL'] = true;
function journalHasPrivateColumn() { return $GLOBALS['PRIVCOL']; }
function journalHasParentColumn() { return true; }
function journalHasAttachColumn() { return true; }
function journalIsMissingTableError($m) { return false; }
function utf8ize($x) { return $x; }
function readClobViaOci8($t, $c, $k, $id) { return '{"encrypted":true,"content":""}'; }   // the resolver's key filing: an encrypted saved state is not checked
function log_scheduler($m) { $GLOBALS['LOG'][] = $m; }
require $dir . '/journal_export.php';
if (!defined('JOURNAL_PARK_OPEN_SQL')) define('JOURNAL_PARK_OPEN_SQL', "UNISTR('\\2402')");
if (!defined('JOURNAL_FIELD_STATE')) define('JOURNAL_FIELD_STATE', 2);
if (!defined('JOURNAL_FIELD_VALUE_RE')) define('JOURNAL_FIELD_VALUE_RE', '/^o[1-9][0-9]{0,3}$/');
if (!defined('JOURNAL_FIELD_DATE_RE')) define('JOURNAL_FIELD_DATE_RE', '/^(19[0-9]{2}|20[0-9]{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/');
if (!defined('OCI_NO_AUTO_COMMIT')) define('OCI_NO_AUTO_COMMIT', 0);
if (!defined('JOURNAL_BULK_MAX_ROWS')) define('JOURNAL_BULK_MAX_ROWS', 5000);
if (!defined('JOURNAL_MAX_TOGGLE_ROWS')) define('JOURNAL_MAX_TOGGLE_ROWS', 250000);

$GLOBALS['FLAGS'] = array('on' => false, 'enc' => false, 'toggles' => array('done'), 'labels' => array(), 'keyCols' => array('ID'), 'shared' => false, 'fields' => null);
function journalReportStateFlags($r) { return $GLOBALS['FLAGS']; }
$GLOBALS['config'] = null;
function journalGetReport($c, $id) { return array('ID' => 7, 'SHORT_ID' => 'jjornl', 'OWNER_ID' => 'owner1', 'TITLE' => 'T'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanReadJournal($r, $u, $a) { return true; }
function journalEnsureFiledFor($r) { return 'ok'; }
function journalReadKeyStale($r) { return false; }
function journalFieldWriteRefusal($r, $k, $v, $u, $a) { return null; }
function journalWriteKeyRefusal($r, $d) { return null; }
function journalToggleRowCount($rid) { return 0; }
function journalFilingHold($r) { return null; }
function journalFieldAuditContext($r, $k, $ids) { return array(); }
function getOci8Connection() { return 'oci'; }
$GLOBALS['OCI'] = array();
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'runs' => array()); return $k; }
function oci_bind_by_name($st, $n, &$v, $l = -1, $t = 0) { $GLOBALS['BIND'][$st][$n] = &$v; return true; }
function oci_execute($st, $m = 0) { $GLOBALS['OCI'][$st]['runs'][] = array('rk' => $GLOBALS['BIND'][$st][':rk'], 'v' => $GLOBALS['BIND'][$st][':v']); return true; }
function oci_num_rows($st) { return 1; }
function oci_free_statement($st) { return true; }
function oci_commit($c) { return true; }
function oci_rollback($c) { return true; }
function oci_error($x = null) { return array('message' => 'stub'); }
function logPenumbraAudit($rid, $a, $b, $c, $m = null, $x = null) { $GLOBALS['AUDIT'][] = $a; }

if (!defined('JOURNAL_OFF_SINCE_SCAN')) define('JOURNAL_OFF_SINCE_SCAN', 200);   // (the build defines it beside the function)
foreach (array('journalSanitizeToggleKey', 'journalRowKeyIsFiledForm', 'journalFieldValueOf', 'journalFieldUndoKey', 'journalFieldUndoSig', 'journalFieldMergeSql', 'journalIsMissingColumnError', 'journalParkedSummary', 'journalOffSince') as $fn) fx_lift($mj, $fn);

$run = function ($action, $user, $admin, $get, $body) use ($mj) {
    $code = fx_block(str_replace("\r\n", "\n", $mj), "if (\$action === '$action') {", false);
    if ($code === '') return array('code' => 0, 'j' => null, 'err' => 'not lifted');
    $GLOBALS['OCI'] = array(); $GLOBALS['BIND'] = array(); $GLOBALS['AUDIT'] = array(); $GLOBALS['Q'] = array();
    $_GET = $get;
    $fn = eval('return function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin, $action) { ' . $code . ' };');
    ob_start(); $err = '';
    @http_response_code(200);
    try { $fn($body, 'conn', $user, '', $admin, $action); } catch (FxExit $e) { } catch (Throwable $e) { $err = $e->getMessage(); }
    $out = ob_get_clean();
    return array('code' => @http_response_code(), 'j' => json_decode($out, true), 'err' => $err, 'raw' => substr($out, 0, 300));
};
$written = function () { $o = array(); foreach ($GLOBALS['OCI'] as $s) foreach ($s['runs'] as $r) $o[] = $r['rk']; sort($o); return implode(',', $o); };

// ===== item 1: summary's off_since / since_off ========================================================================
function aud($act, $at, $b, $a, $bh = '{"report":{"query":"x"', $ah = '{"report":{"query":"x"') {
    return array('ID' => '1', 'ACTION' => $act, 'AT' => $at, 'B_ON' => (string)$b, 'A_ON' => (string)$a, 'B_HEAD' => $b === -1 ? null : $bh, 'A_HEAD' => $ah);
}
function nn($id, $at, $by = 'ann') { return array('ID' => (string)$id, 'PARENT_ID' => null, 'CREATED_BY' => $by, 'MENTIONS' => null, 'IS_PRIVATE' => '0', 'CREATED_AT' => $at); }
$GLOBALS['NOTES'] = array(nn(1, '2026-06-01 10:00:00'), nn(2, '2026-09-01 10:00:00'), nn(3, '2026-11-10 09:00:00'), nn(4, '2026-11-12 15:00:00'), nn(5, '2026-11-14 08:00:00'));
$sum = function () use ($run) { $r = $run('summary', 'adm', true, array('report_id' => 'jjornl'), null); return $r['j'] !== null ? $r['j'] : array('err' => $r['err'], 'raw' => $r['raw']); };
$g = function ($j, $k) { return (is_array($j) && array_key_exists($k, $j)) ? $j[$k] : 'MISSING'; };
// on for months, off since 2026-11-10 09:00:00 (a save after it, both off)
$GLOBALS['AUD'] = array(aud('UPDATE', '2026-11-13 12:00:00', 0, 0), aud('UPDATE', '2026-11-10 09:00:00', 1, 0), aud('UPDATE', '2026-05-01 08:00:00', 1, 1), aud('CREATE', '2026-04-01 08:00:00', -1, 1));
$j = $sum();
A('I1-switch', $g($j, 'total') === 5 && $g($j, 'off_since') === '2026-11-10 09:00:00' && $g($j, 'since_off') === 3 && $g($j, 'never_on') === false,
    'off at 11-10 09:00, 3 of the 5 notes since: ' . json_encode($j));
$GLOBALS['PRIVCOL'] = false;
$j = $sum();
$GLOBALS['PRIVCOL'] = true;
A('I1-nocol', $g($j, 'total') === 5 && $g($j, 'off_since') === '2026-11-10 09:00:00' && $g($j, 'since_off') === 3, 'a table without IS_PRIVATE counts by SQL: ' . json_encode($j));
$GLOBALS['AUD'] = array(aud('UPDATE', '2026-11-13 12:00:00', 0, 0), aud('CREATE', '2026-04-01 08:00:00', -1, 0));
$j = $sum();
A('I1-never', $g($j, 'never_on') === true && $g($j, 'since_off') === 5 && $g($j, 'off_since') === null, 'never on: every note counts: ' . json_encode($j));
$GLOBALS['AUD'] = array(aud('UPDATE', '2026-11-13 12:00:00', 0, 1), aud('UPDATE', '2026-11-10 09:00:00', 1, 0));
$j = $sum();
A('I1-gap', $g($j, 'off_since') === null && $g($j, 'since_off') === null && $g($j, 'total') === 5, 'the newest version is on, the report off: not known: ' . json_encode($j));
$GLOBALS['AUD'] = array(aud('UPDATE', '2026-11-13 12:00:00', 0, 0, '{"report":{"encrypted":true,"content":"x"', '{"report":{"q":1'), aud('CREATE', '2026-04-01 08:00:00', -1, 0));
$j = $sum();
A('I1-enc', $g($j, 'off_since') === null && $g($j, 'since_off') === null && $g($j, 'never_on') === false, 'an encrypted version: not known: ' . json_encode($j));
$GLOBALS['AUD'] = array(aud('UPDATE', '2026-11-13 12:00:00', 0, 0), aud('UPDATE', '2026-11-12 12:00:00', 0, 0));
$j = $sum();
A('I1-short', $g($j, 'off_since') === null && $g($j, 'since_off') === null && $g($j, 'never_on') === false, 'history without its CREATE (cleared): not known: ' . json_encode($j));
$long = array(); for ($i = 0; $i < 20; $i++) $long[] = aud('UPDATE', sprintf('2026-11-14 %02d:00:00', 23 - $i), 0, 0);
$long[] = aud('UPDATE', '2026-11-12 10:00:00', 1, 0);
$GLOBALS['AUD'] = $long;
$j = $sum();
A('I1-page2', $g($j, 'off_since') === '2026-11-12 10:00:00' && $g($j, 'since_off') === 2, 'the switch past the first 12 versions is found: ' . json_encode($j));
$GLOBALS['FLAGS']['on'] = true;
$GLOBALS['AUD'] = array(aud('UPDATE', '2026-11-10 09:00:00', 1, 0));
$j = $sum();
$GLOBALS['FLAGS']['on'] = false;
A('I1-on-now', $g($j, 'off_since') === null && $g($j, 'since_off') === null && $g($j, 'total') === 5, 'the journal on now: nothing said: ' . json_encode($j));

// ===== item 2: a restore that switches the journal on asks first ======================================================
class FxSt { public $sql; function __construct($s) { $this->sql = $s; } function bindValue() { return true; } function execute() { return true; }
    function fetchColumn() { if (strpos($this->sql, 'FROM PENUMBRA_JOURNAL WHERE REPORT_ID') !== false) { $GLOBALS['RQ'][] = $this->sql; return $GLOBALS['JN']; } return 0; }
    function fetch() { return false; } }
class FxConn { function prepare($s) { return new FxSt($s); } }
$rsBlock = fx_block(str_replace("\r\n", "\n", $rs), "            if (empty(\$input['confirmed'])) {", false);
$restore = function ($nowOn, $thenOn, $notes) use ($rsBlock) {
    $GLOBALS['JN'] = $notes; $GLOBALS['RQ'] = array();
    $vo = function ($on) { return array('journalEnabled' => $on, 'journalKeyColumns' => array('ID')); };
    $before_state_decoded = array('query' => 'SELECT ID FROM T', 'viewOptions' => $vo($nowOn));
    $state_data = json_encode(array('query' => 'SELECT ID FROM T', 'viewOptions' => $vo($thenOn)));
    $fn = eval('return function ($input, $state_data, $before_state_decoded, $oracleConn, $report_id_num_for_audit, $short_id) { ' . $rsBlock . ' };');
    ob_start();
    try { $fn(array(), $state_data, $before_state_decoded, new FxConn(), 7, 'jjornl'); } catch (FxExit $e) { } catch (Throwable $e) { echo 'ERR ' . $e->getMessage(); }
    return json_decode(ob_get_clean(), true);
};
$j = $restore(false, true, 3);
$w = (is_array($j) && isset($j['warnings'])) ? implode(' | ', $j['warnings']) : '';
A('I2-warn', is_array($j) && $j['status'] === 'confirm' && strpos($w, '3 journal notes') !== false && strpos($w, 'everyone who can view') !== false, json_encode($j));
A('I2-public-only', !empty($GLOBALS['RQ']) && strpos($GLOBALS['RQ'][0], 'NVL(IS_PRIVATE, 0) = 0') !== false, 'counts the notes that would be published (not private threads): ' . json_encode($GLOBALS['RQ']));
$j = $restore(true, true, 3);
A('I2-on-on', $j === null, 'on now and then: no question: ' . json_encode($j));
$j = $restore(false, false, 3);
A('I2-off-off', $j === null, 'off then too: no question: ' . json_encode($j));
$j = $restore(false, true, 0);
A('I2-no-notes', $j === null, 'no notes to publish: no question: ' . json_encode($j));

// ===== item 6: note text is never cell markup in server output ========================================================
function sn($id, $rk, $text, $by, $at, $parent = null) { return array('ID' => (string)$id, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'CREATED_BY' => $by, 'AUTHOR_NAME' => ucfirst($by), 'CREATED_AT' => $at, 'PARENT_ID' => $parent, 'ATTACH_NAME' => null, 'IS_PRIVATE' => '0'); }
$GLOBALS['EXPORT_NOTES'] = array(sn(1, 'P-1', '@@HTML<img src="https://evil.example/x.png"><a href="https://evil.example">click</a>', 'pat', '2026-10-01 09:00:00'),
                                 sn(2, 'P-2', 'see @@JSON[{"A":"1"}]', 'lee', '2026-10-02 09:00:00'));
$vo6 = array('journalEnabled' => true, 'journalKeyColumns' => array('PROPOSAL ID'), 'journalRowNotes' => true, 'journalNotesExport' => true);
$rows6 = array(array('PROPOSAL ID' => 'P-1', 'TITLE' => 'Alpha'), array('PROPOSAL ID' => 'P-2', 'TITLE' => 'Bravo'));
$GLOBALS['penumbra_jt_resolver_memo'] = array();
journalExportToggleColumns('rpt6', array('viewOptions' => $vo6 + array('journalNotesMode' => 'shared')), $rows6);
$cell = isset($rows6[0]['NOTES']) ? $rows6[0]['NOTES'] : null;
if (getenv('FX_DEBUG') && false) { fwrite(STDERR, json_encode(array($rows6, $GLOBALS['Q'], isset($GLOBALS['LOG']) ? $GLOBALS['LOG'] : null)) . "
"); }
$html = fx_call($sr, function () use ($cell) { return formatCellContent($cell); });
A('I6-shared-html', is_string($cell) && strpos($cell, '@@HTML') !== 0 && strpos($html, '<img') === false && strpos($html, '<a ') === false && strpos($html, 'click') !== false,
    'a Shared note "@@HTML<img..><a..>" in the email cell: ' . json_encode($html));
A('I6-visible', is_string($cell) && str_replace("\xE2\x81\xA0", '', $cell) === $GLOBALS['EXPORT_NOTES'][0]['NOTE_TEXT'], 'the text reads as typed (a zero-width joiner only): ' . json_encode($cell));
$rows6 = array(array('PROPOSAL ID' => 'P-1', 'TITLE' => 'Alpha'), array('PROPOSAL ID' => 'P-2', 'TITLE' => 'Bravo'));
$GLOBALS['penumbra_jt_resolver_memo'] = array();
journalExportToggleColumns('rpt6b', array('viewOptions' => $vo6), $rows6);
$cell2 = isset($rows6[1]['NOTES']) ? $rows6[1]['NOTES'] : '';
A('I6-discussion-json', $cell2 !== '' && strpos($cell2, '@@JSON') === false && strpos($cell2, 'see @') !== false, 'Discussion: @@JSON inside the line is not a nested table: ' . json_encode($cell2));
$plain = function_exists('journalNoteCellSafe') ? journalNoteCellSafe('a plain note, user@@example') : null;
A('I6-plain', $plain === 'a plain note, user@@example', 'other text untouched: ' . json_encode($plain));

// ===== item 8: grouping by a journal column the layout shows ==========================================================
$res8 = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'whoMeta' => array(), 'whoNames' => array(), 'keyUpper' => array('ID'),
    'stateMap' => array(), 'whoMap' => array(), 'aliasMap' => array(), 'notesName' => null);
$data8 = array(array('ID' => '1', 'T' => 'a', 'DONE' => '1'), array('ID' => '2', 'T' => 'b', 'DONE' => '0'), array('ID' => '3', 'T' => 'c', 'DONE' => '1'));
$asl = function ($vis, $order) use ($sr, $data8, $res8) {
    $state = array('visibleColumns' => $vis, 'columnOrder' => $order, 'groupBy' => 'DONE', 'journalToggleResolver' => $res8);
    return fx_call($sr, function () use ($data8, $state) { return apply_state_logic($data8, $state, array('DONE')); });
};
$cols = function ($out) { $c = array(); if (!is_array($out) || !isset($out['data'])) return 'none';
    foreach ($out['data'] as $g) { $rows = (is_array($g) && isset($g['rows'])) ? $g['rows'] : $g; foreach ((array)$rows as $r) { if (is_array($r)) return implode(',', array_keys($r)); } } return 'empty'; };
$o = $asl(array('0', '__JOURNAL_TOGGLE__done', '1'), array('0', '__JOURNAL_TOGGLE__done', '1'));
A('I8-shown', $o['viewMode'] === 'grouped' && $cols($o) === 'ID,DONE,T', 'grouped by Done, Done shown between ID and T: ' . $o['viewMode'] . ' ' . $cols($o));
$o = $asl(array('0', '1'), array('0', '__JOURNAL_TOGGLE__done', '1'));
A('I8-hidden', $o['viewMode'] === 'grouped' && count($o['data']) === 2 && $cols($o) === 'ID,T', 'grouped by Done, Done hidden: still two groups, column stripped: ' . $o['viewMode'] . ' ' . count((array)$o['data']) . ' ' . $cols($o));
$o = $asl(array('0', '1'), array('0', '1'));
A('I8-data', $o['viewMode'] === 'grouped' && count($o['data']) === 2 && $cols($o) === 'DONE,ID,T', 'a layout that never named it (saved before 2026-10-26): it leads, as it does ungrouped: ' . $cols($o));

// ===== item 12: a failed field read ===================================================================================
$GLOBALS['FIELDS_FAIL'] = true;
$r = $run('toggles', 'ann', false, array('report_id' => 'jjornl'), null);
$GLOBALS['FIELDS_FAIL'] = false;
A('I12-failed', is_array($r['j']) && $r['j']['status'] === 'success' && array_key_exists('field_ready', $r['j']) && $r['j']['field_ready'] === null && isset($r['j']['fields_failed']) && $r['j']['fields_failed'] === true,
    json_encode($r['j']) . $r['err']);
$r = $run('toggles', 'ann', false, array('report_id' => 'jjornl'), null);
A('I12-ok', is_array($r['j']) && $r['j']['field_ready'] === true && isset($r['j']['fields_failed']) && $r['j']['fields_failed'] === false, json_encode($r['j']) . $r['err']);

// ===== item 14: an unsigned Undo keeps rows changed since =============================================================
$GLOBALS['FLAGS']['on'] = true;
// a bulk set wrote o2 on A, B, C (from o1, none, o1); since then someone set B to o3
$GLOBALS['CUR'] = array(array('ROW_KEY' => 'A', 'STATE' => '2', 'FIELD_VALUE' => 'o2'), array('ROW_KEY' => 'B', 'STATE' => '2', 'FIELD_VALUE' => 'o3'), array('ROW_KEY' => 'C', 'STATE' => '2', 'FIELD_VALUE' => 'o2'));
$ub = array('report_id' => 'jjornl', 'toggle_key' => 'status3', 'values' => array('A' => 'o1', 'B' => null, 'C' => 'o1'));
$r = $run('set_fields_bulk', 'ann', false, array(), $ub + array('undo' => array('ts' => time() - 7 * 3600, 'sig' => 'stale', 'to' => array('A' => 'o2', 'B' => 'o2', 'C' => 'o2'))));
A('I14-old', $written() === 'A,C' && isset($r['j']['kept']) && $r['j']['kept'] === 1, 'an Undo older than 6 hours: wrote ' . $written() . ' ' . json_encode($r['j']) . $r['err']);
$r = $run('set_fields_bulk', 'ann', false, array(), $ub + array('undo' => array('ts' => 0, 'sig' => '', 'to' => array('A' => 'o2', 'C' => 'o2'))));
A('I14-unnamed', $written() === 'A,C' && $r['j']['kept'] === 1, 'a row its "to" does not name is kept: wrote ' . $written() . ' ' . json_encode($r['j']));
$r = $run('set_fields_bulk', 'ann', false, array(), $ub);
A('I14-plain', $written() === 'A,B,C' && $r['j']['kept'] === 0, 'a plain bulk set (no undo) writes every row, as before: ' . $written());
$GLOBALS['FLAGS']['on'] = false;

// ===== items 15 / 16: change columns ==================================================================================
foreach (array('penumbra_split_change_columns', 'generate_snapshot_signature', 'penumbra_signature_rows', 'penumbra_task_change_columns') as $fn) fx_lift($sr, $fn);
$res15 = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'keyUpper' => array('ID'),
    'whoMeta' => array(array('name' => 'STATUS', 'key' => 'status3', 'kind' => 'field'), array('name' => 'STATUS BY', 'key' => 'status3', 'kind' => 'by', 'field' => true),
                       array('name' => 'DUE', 'key' => 'due', 'kind' => 'field')),
    'whoNames' => array('STATUS', 'STATUS BY', 'DUE'), 'stateMap' => array('done' => array()), 'notesName' => null,
    'whoMap' => array('status3' => array('1' => array('field' => 'In progress', 'by' => 'pat', 'on' => '2026-11-01'), '2' => array('field' => 'Done', 'by' => 'lee', 'on' => '2026-11-02'))),
    'aliasMap' => array('COMPLETE' => 'DONE', 'STAGE' => 'STATUS', 'STAGE BY' => 'STATUS BY'));
$api = function ($res) { return array('journalToggleResolver' => $res, 'rawData' => array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b'))); };
$sig = function ($res, $shown, $cols) use ($api) {   // as the email's skip-if-no-changes signature (schedule_runner ~26938)
    if (function_exists('journalTaskChangeCols')) journalTaskChangeCols($cols);
    $a = $api($res);
    $cc = function_exists('penumbra_task_change_columns') ? penumbra_task_change_columns($cols, $a) : $cols;
    $rows = array();
    foreach ($a['rawData'] as $r) {
        $x = array('T' => $r['T'], 'DONE' => '0');
        if ($shown) { $v = journalExportToggleRowValues($res, $r); $x['STATUS'] = $v['STATUS']; $x['STATUS BY'] = $v['STATUS BY']; }
        $rows[] = $x;
    }
    $s = generate_snapshot_signature(penumbra_signature_rows(journalStripWhoCols($rows, $a), $a, $cc), $cc);
    if (function_exists('journalTaskChangeCols')) journalTaskChangeCols(null);
    return $s;
};
$res15b = $res15; $res15b['whoMap']['status3']['2']['field'] = 'Not started';   // row 2's pick list changed
A('I15-shown', $sig($res15, true, array('STATUS')) !== $sig($res15b, true, array('STATUS')), 'a task watching STATUS (shown): a changed value changes the signature');
A('I15-hidden', $sig($res15, false, array('STATUS')) !== $sig($res15b, false, array('STATUS')), 'a task watching STATUS (hidden on the layout): a changed value changes the signature');
$res15c = $res15; $res15c['whoMap']['status3']['2']['by'] = 'kim';
A('I15-by-stays-out', $sig($res15, true, array('STATUS', 'STATUS BY')) === $sig($res15c, true, array('STATUS', 'STATUS BY')), 'who set it ("STATUS BY") never signs');
A('I15-all-same', $sig($res15, true, null) === $sig($res15b, true, null), '"all columns" as before: a pick-list change does not sign');
A('I15-ignored', $sig($res15, true, array('T', '!STATUS')) === $sig($res15b, true, array('T', '!STATUS')), 'an ignored STATUS does not sign');
// the diff: both the stored baseline and the current side carry it (journalDecorateRowsWithToggles)
if (function_exists('journalTaskChangeCols')) journalTaskChangeCols(array('Status'));
$d = journalDecorateRowsWithToggles(array(array('ID' => '1', 'T' => 'a'), array('ID' => '3', 'T' => 'c')), array('journalToggleResolver' => $res15));
if (function_exists('journalTaskChangeCols')) journalTaskChangeCols(null);
$d0 = journalDecorateRowsWithToggles(array(array('ID' => '1', 'T' => 'a')), array('journalToggleResolver' => $res15));
A('I15-decorate', isset($d[0]['STATUS']) && $d[0]['STATUS'] === 'In progress' && $d[1]['STATUS'] === '' && !isset($d[0]['STATUS BY']) && !isset($d[0]['DUE']) && !isset($d0[0]['STATUS']),
    'a snapshot / diff row gets the named pick list only, and only while its task runs: ' . json_encode(array($d, $d0)));
$diff = fx_call($sr, function () use ($res15, $res15b) {
    if (!function_exists('journalTaskChangeCols')) return 'no journalTaskChangeCols';
    journalTaskChangeCols(array('ID', 'STATUS'));
    $base = journalDecorateRowsWithToggles(array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b')), array('journalToggleResolver' => $res15));
    $cur = journalDecorateRowsWithToggles(array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b')), array('journalToggleResolver' => $res15b));
    journalTaskChangeCols(null);
    return penumbra_compute_snapshot_diff($cur, $base, array('ID', 'STATUS'));
});
A('I15-diff', is_array($diff) && count($diff['new']) === 1 && count($diff['removed']) === 1, 'keys ID + STATUS: row 2 whose STATUS changed reads as changed: ' . json_encode(is_array($diff) ? array(count($diff['new']), count($diff['removed']), count($diff['modified'])) : $diff));
// item 16: an old name
$m = function_exists('penumbra_task_change_columns') ? penumbra_task_change_columns(array('COMPLETE', '!Stage', 'T', 'Stage By'), $api($res15)) : null;
A('I16-map', $m === array('DONE', '!STATUS', 'T', 'STATUS'),   // (2026-11-18, chgtoggle) a who / when name watches its column
    'old names read as the columns now, "!" kept: ' . json_encode($m));
$res16 = $res15; $res16b = $res15; $res16b['stateMap']['done'] = array('2' => true);
$sig16 = function ($res, $cols) use ($api) {
    $a = $api($res);
    $cc = function_exists('penumbra_task_change_columns') ? penumbra_task_change_columns($cols, $a) : $cols;
    $rows = array(); foreach ($a['rawData'] as $r) { $v = journalExportToggleRowValues($res, $r); $rows[] = array('T' => $r['T'], 'DONE' => $v['DONE']); }
    return generate_snapshot_signature(penumbra_signature_rows(journalStripWhoCols($rows, $a), $a, $cc), $cc);
};
A('I16-sig', $sig16($res16, array('COMPLETE')) !== $sig16($res16b, array('COMPLETE')), 'a task watching the toggle by its OLD name sees a flip');
$srn = str_replace("\r\n", "\n", $sr);
A('I16-wired', substr_count($srn, 'penumbra_task_change_columns(') >= 5 && strpos($srn, "journalTaskChangeCols(\$_tcMode === 'custom' ? \$_tcCols : null);") !== false,
    'the email / per-recipient / snapshot / drop reads map them; the task loop sets its change columns for every task');

// ---- report ------------------------------------------------------------------------------------------------------
$p = 0; $f = 0; $failed = array();
foreach ($R as $r) { printf("  %s  %-18s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 330)); if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; } }
echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
