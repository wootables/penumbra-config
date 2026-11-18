<?php
// =============================================================================
// fix3srv/server.php DIR  - the server fixes of 2026-11-18 (fix3 / worker A), run against one build.
//   php -n -d extension_dir=... -d extension=mbstring check_fixes.php <app dir>
// DIR = the build (stage = with the fixes, base = before). Each check names its item. Prints a line a check and
// "TOTAL pass=N fail=M   failed: ...". On base the new behaviours are expected red; on stage everything green.
// The functions are lifted from the build by name (token-matched braces) and run against stubs - no database.
// =============================================================================
error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
$dir = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
if ($dir === '' || !is_file($dir . '/schedule_runner.php')) { fwrite(STDERR, "usage: check_fixes.php <app dir>\n"); exit(2); }
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
class FxExit extends Exception {}

// ---- lifting ----------------------------------------------------------------------------------------------
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
// call $f; on "Call to undefined function X()" lift X from $src and try again (a few times)
function fx_call($src, $f) {
    for ($i = 0; $i < 25; $i++) {
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
$ce = file_get_contents($dir . '/penumbra_cards_email.php');

// ---- stubs (before the build's pure files) -----------------------------------------------------------------
$GLOBALS['Q'] = array();
$GLOBALS['NOTES'] = array();
$GLOBALS['PRIVCOL'] = true;
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = $sql;
    if (strpos($sql, 'DBMS_LOB.GETLENGTH(NOTE_TEXT) AS TEXT_LEN') !== false) {
        $o = array();
        foreach ($GLOBALS['NOTES'] as $n) $o[] = array('ID' => $n['ID'], 'SCOPE' => 'row', 'CREATED_BY' => $n['CREATED_BY'], 'AUTHOR_NAME' => 'x', 'CREATED_AT' => '2026-11-01 09:00:00', 'TEXT_LEN' => '4', 'ATTACH_NAME' => null, 'IS_PRIVATE' => $n['IS_PRIVATE']);
        return $o;
    }
    if (preg_match('/CREATED_BY, MENTIONS, IS_PRIVATE FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid\s*$/', $sql)) return $GLOBALS['NOTES'];   // wipe_notes' visible count
    if (strpos($sql, 'AND SCOPE = :sc AND ROW_KEY = :rk') !== false) {
        $o = array();
        foreach ($GLOBALS['NOTES'] as $n) if ($n['SCOPE'] === $binds[':sc'] && $n['ROW_KEY'] === $binds[':rk']) $o[] = $n + array('NOTE_TEXT' => 't', 'AUTHOR_NAME' => 'x', 'CREATED_AT' => '2026-11-01 09:00:00');
        return $o;
    }
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    throw new Exception('unexpected SQL: ' . substr(preg_replace('/\s+/', ' ', $sql), 0, 160));
}
function journalHasPrivateColumn() { return $GLOBALS['PRIVCOL']; }
function journalHasParentColumn() { return true; }
function journalHasAttachColumn() { return true; }
function journalIsMissingTableError($m) { return false; }
function utf8ize($x) { return $x; }
function readClobViaOci8($t, $c, $k, $id) { return '{}'; }
require $dir . '/journal_export.php';
require $dir . '/penumbra_search.php';
require $dir . '/penumbra_cards_email.php';
if (!defined('JOURNAL_PARK_OPEN_SQL')) define('JOURNAL_PARK_OPEN_SQL', "UNISTR('\\2402')");

function nt($id, $rk, $by, $priv = 0, $mentions = null, $parent = null, $scope = 'row') {
    return array('ID' => (string)$id, 'SCOPE' => $scope, 'ROW_KEY' => $rk, 'CREATED_BY' => $by, 'MENTIONS' => $mentions, 'PARENT_ID' => $parent, 'IS_PRIVATE' => (string)$priv);
}
// the report flags the lifted code reads (journalReportStateFlags is a stub here: the real one reads the saved state)
$GLOBALS['FLAGS'] = array('on' => false, 'enc' => false, 'toggles' => array('done'), 'labels' => array(), 'keyCols' => array('DEPARTMENT', 'LOG_DATE'), 'shared' => false, 'fields' => null);
function journalReportStateFlags($r) { return $GLOBALS['FLAGS']; }
function penumbraIsReportOwner($owner, $uid) { return strcasecmp((string)$owner, (string)$uid) === 0; }
$GLOBALS['allowedUsers'] = array('admin1');
$GLOBALS['config'] = null;
function journalGetReport($c, $id) { return array('ID' => 7, 'SHORT_ID' => 'jjornl', 'OWNER_ID' => 'owner1', 'TITLE' => 'T'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanReadJournal($r, $u, $a) { return true; }
function journalEnsureFiledFor($r) { return 'ok'; }
function getOci8Connection() { return 'oci'; }
$GLOBALS['OCI'] = array();
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'runs' => 0); return $k; }
function oci_bind_by_name($st, $n, &$v, $l = -1, $t = 0) { return true; }
function oci_execute($st, $m = 0) { $GLOBALS['OCI'][$st]['runs']++; return true; }
function oci_num_rows($st) { return count($GLOBALS['NOTES']); }
function oci_free_statement($st) { return true; }
function oci_error($x = null) { return array('message' => 'stub'); }
function logPenumbraAudit($rid, $a, $b, $c, $m) { $GLOBALS['AUDIT'][] = $a; }

foreach (array('journalReportJournalEnabled', 'journalTargetCanOpenJournal', 'journalRowNotesWhere') as $fn) fx_lift($mj, $fn);
fx_lift($mj, 'journalReadKeyStale');   // a build before 2026-11-17 has none

$run = function ($action, $user, $admin, $get, $body) use ($mj) {
    $code = fx_block(str_replace("\r\n", "\n", $mj), "if (\$action === '$action') {", false);
    if ($code === '') return array('code' => 0, 'j' => null, 'err' => 'not lifted');
    $GLOBALS['OCI'] = array(); $GLOBALS['AUDIT'] = array(); $GLOBALS['Q'] = array();
    $_GET = $get;
    $fn = eval('return function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin, $action) { ' . $code . ' };');
    ob_start(); $err = '';
    @http_response_code(200);
    try { $fn($body, 'conn', $user, '', $admin, $action); } catch (FxExit $e) { } catch (Throwable $e) { $err = $e->getMessage(); }
    $out = ob_get_clean();
    return array('code' => @http_response_code(), 'j' => json_decode($out, true), 'err' => $err, 'raw' => substr($out, 0, 300));
};
$deleted = function () { foreach ($GLOBALS['OCI'] as $s) if (strpos($s['sql'], 'DELETE FROM PENUMBRA_JOURNAL WHERE REPORT_ID') !== false && $s['runs'] > 0) return true; return false; };

// ===== item 2: row_notes_one and a stale page key ===========================================================
$GLOBALS['NOTES'] = array(nt(1, 'K1', 'ann'), nt(2, 'PK', 'ann', 0, null, null, 'pivot'));
$get = array('report_id' => 'jjornl', 'kind' => 'row', 'row_key' => 'K1');
$r = $run('row_notes_one', 'ann', false, $get + array('key_cols' => json_encode(array('DEPARTMENT', 'LOG_DATE'))), null);
A('I2-fresh', isset($r['j']['notes']) && count($r['j']['notes']) === 1 && empty($r['j']['key_stale']), json_encode($r['j']) . $r['err']);
$r = $run('row_notes_one', 'ann', false, $get + array('key_cols' => json_encode(array('PROPOSAL_ID'))), null);
A('I2-stale', isset($r['j']['notes']) && $r['j']['notes'] === array() && !empty($r['j']['key_stale']) && $r['j']['status'] === 'success', json_encode($r['j']) . $r['err']);
$r = $run('row_notes_one', 'ann', false, $get, null);
A('I2-nokeycols', isset($r['j']['notes']) && count($r['j']['notes']) === 1 && empty($r['j']['key_stale']), 'an older page sends no key_cols: ' . json_encode($r['j']));
$r = $run('row_notes_one', 'ann', false, array('report_id' => 'jjornl', 'kind' => 'pivot', 'row_key' => 'PK', 'key_cols' => json_encode(array('PROPOSAL_ID'))), null);
A('I2-pivot-stays', isset($r['j']['notes']) && count($r['j']['notes']) === 1 && empty($r['j']['key_stale']), 'a pivot key is not the key columns\': ' . json_encode($r['j']));
$GLOBALS['FLAGS']['enc'] = true;
$r = $run('row_notes_one', 'ann', false, $get + array('key_cols' => json_encode(array('PROPOSAL_ID'))), null);
$GLOBALS['FLAGS']['enc'] = false;
A('I2-enc', isset($r['j']['notes']) && count($r['j']['notes']) === 1, 'an encrypted report\'s key cannot be read: ' . json_encode($r['j']));

// ===== item 5: an encrypted report's mention / reply targets ===============================================
$rep = array('ID' => 7, 'SHORT_ID' => 'jjornl', 'OWNER_ID' => 'owner1');
$t = function ($f) use ($rep) { $GLOBALS['FLAGS'] = array_merge($GLOBALS['FLAGS'], $f); $v = journalTargetCanOpenJournal($rep, 'viewer9'); return $v; };
$enc = $t(array('on' => false, 'enc' => true));
$off = $t(array('on' => false, 'enc' => false));
$on = $t(array('on' => true, 'enc' => false));
$own = journalTargetCanOpenJournal($rep, 'owner1');
$GLOBALS['FLAGS']['on'] = false;
A('I5-enc-target', $enc === true, 'a viewer named on an encrypted report: ' . var_export($enc, true));
A('I5-off-target', $off === false && $on === true && $own === true, 'off ' . var_export($off, true) . ', on ' . var_export($on, true) . ', owner on an off report ' . var_export($own, true));

// ===== item 13: wipe_notes and expect_total =================================================================
$GLOBALS['NOTES'] = array(nt(1, 'K1', 'ann', 1, 'bob'), nt(2, 'K1', 'bob', 1, null, '1'), nt(3, 'K1', 'eve'), nt(4, 'K2', 'adm'), nt(5, 'K3', 'cat', 1));
$wb = array('report_id' => 'jjornl');
$r = $run('wipe_notes', 'adm', true, array(), $wb + array('expect_total' => 2));
A('I13-mismatch', $r['code'] === 409 && isset($r['j']['code']) && $r['j']['code'] === 'wipe_count' && $r['j']['total'] === 5 && $r['j']['hidden'] === 3 && !$deleted() && !$GLOBALS['AUDIT'],
    'code ' . $r['code'] . ' ' . json_encode($r['j']) . ' deleted ' . var_export($deleted(), true) . $r['err']);
$r = $run('wipe_notes', 'adm', true, array(), $wb + array('expect_total' => '5'));
A('I13-match', $r['code'] === 200 && $deleted() && isset($r['j']['deleted']) && $r['j']['deleted'] === 5, 'code ' . $r['code'] . ' ' . json_encode($r['j']) . $r['err']);
$r = $run('wipe_notes', 'adm', true, array(), $wb);
A('I13-absent', $r['code'] === 200 && $deleted(), 'no expect_total, an older page: deleted ' . var_export($deleted(), true) . ' ' . json_encode($r['j']));
$r = $run('wipe_notes', 'adm', true, array(), $wb + array('expect_total' => 4));
A('I13-race', $r['code'] === 409 && $r['j']['total'] === 5 && !$deleted(), 'a count one short (a note written since the page counted): nothing deleted: ' . json_encode($r['j']));
$GLOBALS['PRIVCOL'] = false;
$r = $run('wipe_notes', 'adm', true, array(), $wb + array('expect_total' => 3));
$GLOBALS['PRIVCOL'] = true;
A('I13-noprivcol', $r['code'] === 409 && $r['j']['hidden'] === 0 && !$deleted(), 'no private column: every note visible, hidden 0: ' . json_encode($r['j']));

// ===== item 6: the cards' journal slots ===================================================================
$res = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')),
    'whoMeta' => array(array('name' => 'STATUS', 'key' => 'status3', 'kind' => 'field'), array('name' => 'DUE', 'key' => 'due', 'kind' => 'field'),
                       array('name' => 'DUE SET BY', 'key' => 'due', 'kind' => 'by', 'field' => true)),
    'whoNames' => array('STATUS', 'DUE', 'DUE SET BY'), 'notesName' => 'NOTES', 'keyUpper' => array('DEPARTMENT', 'LOG_DATE'), 'stateMap' => array(), 'whoMap' => array(), 'aliasMap' => array(),
    'fieldOpts' => array('STATUS' => array('key' => 'status3', 'order' => array('Not started', 'In progress', 'Done'),
        'cur' => array('NOT STARTED' => true, 'IN PROGRESS' => true, 'DONE' => true), 'old' => array('STARTED' => 'In progress', 'DONE' => 'Not started'))));
$state = array('viewOptions' => array('cards' => array('open' => 1, 'sent' => array('title' => 'DEPARTMENT', 'pill' => '__JOURNAL_FIELD__status3',
    'fields' => array('LOG_DATE', '__JOURNAL_FIELD__due', '__JOURNAL_FIELD__status3'), 'lists' => array('__JOURNAL_FIELD__status3' => 'dsemi')))));
$cfg = penumbra_cards_email_cfg($state);
$mapped = function_exists('penumbra_cards_email_journal_names') ? penumbra_cards_email_journal_names($cfg, $res) : $cfg;
A('I6-map', is_array($mapped) && $mapped['pill'] === 'STATUS' && $mapped['fields'] === array('LOG_DATE', 'DUE', 'STATUS') && isset($mapped['lists']['STATUS']) && $mapped['title'] === 'DEPARTMENT',
    json_encode($mapped));
$rows = array(array('DEPARTMENT' => 'Chem', 'LOG_DATE' => '2026-11-01', 'DONE' => '1', 'STATUS' => 'In progress', 'DUE' => '2026-12-01', 'DUE SET BY' => 'pat'));
$cellFn = function ($row, $idx, $cols) { $o = array('row' => array(), 'cells' => array()); foreach ($cols as $c) if (array_key_exists($c, $row)) $o['cells'][strtoupper($c)] = array('raw' => $row[$c], 'html' => htmlspecialchars((string)$row[$c]), 'css' => array()); return $o; };
$h = penumbra_cards_email_html($rows, false, $mapped, 'theme-default', $cellFn);
A('I6-email', strpos($h['html'], 'In progress') !== false && strpos($h['html'], '2026-12-01') !== false, 'the email card shows the pick list and the date: ' . (strpos($h['html'], 'In progress') !== false ? 'yes' : 'no'));
$GLOBALS['penumbra_cards_email'] = $mapped;
$pp = penumbra_cards_pdf_pages($rows, false, $mapped, 'T', function ($raw, $col) { return htmlspecialchars((string)$raw); });
A('I6-pdf', $pp && strpos(implode('', $pp['pages']), 'In progress') !== false, 'the PDF card\'s pill: ' . ($pp ? 'pages ' . count($pp['pages']) : 'none'));
A('I6-wired', strpos(str_replace("\r\n", "\n", $sr), "penumbra_cards_email_journal_names(\$GLOBALS['penumbra_cards_email'], \$_cjRes)") !== false, 'apply_state_logic maps the setup by the task\'s resolver');
A('I6-namemap', function_exists('journalExportInternalNameMap') && journalExportInternalNameMap($res) === array('__JOURNAL_TOGGLE__DONE' => 'DONE', '__JOURNAL_FIELD__STATUS3' => 'STATUS', '__JOURNAL_FIELD__DUE' => 'DUE', '__JOURNAL_BY__DUE' => 'DUE SET BY', '__JOURNAL_NOTES' => 'NOTES'),
    function_exists('journalExportInternalNameMap') ? json_encode(journalExportInternalNameMap($res)) : 'none');

// ===== item 7: an old option label in format / rewrite / snippet conditions =================================
fx_lift($sr, '_snippet_normalize_toggle_tree');
$tree = array(array('type' => 'condition', 'column' => 'Status', 'op' => '=', 'value' => 'Started'), array('type' => 'logical', 'op' => 'or'),
    array(array('type' => 'condition', 'column' => '{STATUS}', 'op' => '!=', 'value' => "'started'")), array('type' => 'logical', 'op' => 'or'),
    array('type' => 'condition', 'column' => 'STATUS', 'op' => 'contains', 'value' => 'Started'), array('type' => 'logical', 'op' => 'or'),
    array('type' => 'condition', 'column' => 'STATUS', 'op' => '=', 'value' => 'Done'), array('type' => 'logical', 'op' => 'or'),
    array('type' => 'condition', 'column' => 'DUE', 'op' => '=', 'value' => 'Started'), array('type' => 'logical', 'op' => 'or'),
    array('type' => 'condition', 'column' => 'DONE', 'op' => '=', 'value' => "\xE2\x98\x91"));
$nt = _snippet_normalize_toggle_tree($tree, $res, array());
$vals = array($nt[0]['value'], $nt[2][0]['value'], $nt[4]['value'], $nt[6]['value'], $nt[8]['value'], $nt[10]['value']);
A('I7-tree', $vals === array('In progress', 'In progress', 'Started', 'Done', 'Started', '1'), json_encode($vals) . ' (= and != mapped, nested too; contains kept; a current label wins; a date column kept; a toggle still 1/0)');
// end to end: a format() rule's condition on a row
$ok7 = fx_call($sr, function () use ($res) {
    $c = parse_format_condition('Status = Started', array('DEPARTMENT', 'STATUS', 'DONE'));
    $c = _snippet_normalize_toggle_tree($c, $res, array());
    return array(evaluate_format_condition(array('DEPARTMENT' => 'x', 'STATUS' => 'In progress'), $c), evaluate_format_condition(array('DEPARTMENT' => 'x', 'STATUS' => 'Not started'), $c));
});
A('I7-format', $ok7 === array(true, false), 'format(Status = Started) on "In progress" / "Not started": ' . json_encode($ok7));

// ===== item 9: an old toggle name inside parentheses in a task filter ======================================
$p = array(array('type' => 'group', 'parts' => array(array('type' => 'condition', 'column' => 'Complete', 'op' => '=', 'value' => '1'), array('type' => 'logical', 'op' => 'or'),
    array('type' => 'condition', 'column' => 'X', 'op' => '=', 'value' => '2'))), array('type' => 'logical', 'op' => 'and'), array('type' => 'condition', 'column' => '{Complete}', 'op' => '=', 'value' => '1'));
$pa = _journal_alias_toggle_conditions($p, array('COMPLETE' => 'DONE'));
A('I9-group', $pa[0]['parts'][0]['column'] === 'DONE' && $pa[0]['parts'][2]['column'] === 'X' && $pa[2]['column'] === 'DONE', json_encode(array($pa[0]['parts'][0]['column'], $pa[2]['column'])));
// end to end: php_apply_search_filter with the old name in parentheses
$tres = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'whoMeta' => array(), 'whoNames' => array(), 'keyUpper' => array('ID'),
    'stateMap' => array('done' => array('1' => true)), 'whoMap' => array(), 'aliasMap' => array('COMPLETE' => 'DONE'), 'notesName' => null, 'notesMap' => array(), 'notesSearch' => null, 'notesCount' => array());
// (a lone parenthesised condition parses flat: the group needs a second term to stay a group)
$frows = array(array('ID' => '1', 'T' => 'a'), array('ID' => '2', 'T' => 'b'), array('ID' => '4', 'T' => 'zzz'));
$ids = function ($rs) { $o = array(); foreach ($rs as $r) $o[] = $r['ID']; return implode(',', $o); };
$f1 = $ids(php_apply_search_filter($frows, 'standard', "(Complete = \xE2\x98\x91 OR T = zzz)", null, $tres));
$f2 = $ids(php_apply_search_filter($frows, 'standard', "Complete = \xE2\x98\x91 OR T = zzz", null, $tres));
A('I9-filter', $f1 === '1,4' && $f2 === '1,4', '"(Complete = ☑ OR T = zzz)" keeps ' . $f1 . ', without parentheses ' . $f2 . ' (want 1,4)');

// ===== item 11: one duplicate-key rule, the scheduled pivot's too =========================================
$dres = array('keyUpper' => array('DEPARTMENT', 'LOG_DATE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'whoMeta' => array(), 'stateMap' => array('done' => array("Chem\xE2\x90\x9F2026-11-01" => true)));
$drows = array(array('DEPARTMENT' => 'Chem', 'LOG_DATE' => '2026-11-01'), array('DEPARTMENT' => 'Chem', 'LOG_DATE' => '2026-11-01'), array('DEPARTMENT' => 'Bio', 'LOG_DATE' => '2026-11-02'),
    array('DEPARTMENT' => '', 'LOG_DATE' => ''), array('DEPARTMENT' => null, 'LOG_DATE' => null));
$dk = function_exists('journalExportDupKeys') ? journalExportDupKeys($dres, $drows) : null;
A('I11-rule', $dk === array("Chem\xE2\x90\x9F2026-11-01" => true), 'shared key counted, blank keys not: ' . json_encode($dk === null ? null : array_map('strval', array_keys($dk))));
$dres2 = $dres; $dres2['dupKeys'] = $dk ? $dk : array();
$v = array(journalExportToggleRowValues($dres2, $drows[0])['DONE'], journalExportToggleRowValues($dres2, $drows[2])['DONE'], journalExportToggleRowValues($dres2, $drows[3])['DONE']);
A('I11-values', $v === array('', '0', '0'), 'a shared key reads blank, others 1/0, a blank key 0: ' . json_encode($v));
$srn = str_replace("\r\n", "\n", $sr);
$pv = strpos($srn, "        if (\$sched_is_pivot) {\n");
$pvBlock = $pv === false ? '' : substr($srn, $pv, 900);
A('I11-pivot-wired', strpos($pvBlock, "journalExportDupKeys(\$journal_toggle_resolver, \$flat_rows)") !== false, 'the scheduled pivot\'s resolver gets dupKeys from its rows');
$je = str_replace("\r\n", "\n", file_get_contents($dir . '/journal_export.php'));
A('I11-shared', strpos($je, "\$resolver['dupKeys'] = journalExportDupKeys(\$resolver, \$rows);") !== false, 'journalExportToggleColumns counts them by the same helper');

// ===== item 18: a rule on a HIDDEN journal column =============================================================
foreach (array('penumbra_sched_jrn_hidden_reset', 'penumbra_sched_jrn_fp', 'penumbra_sched_jrn_hidden_add', 'penumbra_sched_jrn_hidden_names', 'penumbra_sched_jrn_hidden_row',
               '_snippet_journal_toggles', '_snippet_toggle_eval_row', 'evaluate_row_formatting', 'prepare_format_rules', 'prepare_rewrite_rules', 'apply_rewrite_to_row') as $fn) fx_lift($sr, $fn);
$have18 = function_exists('penumbra_sched_jrn_hidden_add');
$jres = array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')), 'whoMeta' => array(), 'whoNames' => array(), 'keyUpper' => array('ID'),
    'stateMap' => array('done' => array('1' => true)), 'whoMap' => array(), 'aliasMap' => array(), 'notesName' => null);
_snippet_journal_toggles($jres);
if ($have18) penumbra_sched_jrn_hidden_reset();
// full rows (before the layout): ID is hidden too, the toggle DONE hidden; T shown
$full = array(array('ID' => '1', 'T' => 'alpha', 'DONE' => '1'), array('ID' => '2', 'T' => 'beta', 'DONE' => '0'), array('ID' => '3', 'T' => 'same', 'DONE' => '1'), array('ID' => '4', 'T' => 'same', 'DONE' => '0'));
if ($have18) penumbra_sched_jrn_hidden_add($full, array('T'), array('DONE'));
$shown = array(array('T' => 'alpha'), array('T' => 'beta'), array('T' => 'same'));
$fr = fx_call($sr, function () use ($shown) {
    $rules = array(array('type' => 'row', 'targetColumn' => null, 'condition' => "Done = \xE2\x98\x91", 'style' => 'color: red'),
                   array('type' => 'cell', 'targetColumn' => 'DONE', 'condition' => null, 'style' => 'color: blue'));
    $prep = prepare_format_rules($rules, array('T'), $shown);
    $o = array();
    foreach ($shown as $i => $row) { $f = evaluate_row_formatting($row, $i, $prep['row'], $prep['cell']); $o[] = array(!empty($f['row']), array_keys($f['cells'])); }
    return $o;
});
A('I18-format', $fr[0][0] === true && $fr[1][0] === false && $fr[2][0] === false, 'row rule "Done = ☑" on alpha (1) / beta (0) / two rows alike on screen (unknown): ' . json_encode($fr));
A('I18-noshow', $fr[0][1] === array() && $fr[1][1] === array(), 'the hidden column gets no cell: ' . json_encode(array($fr[0][1], $fr[1][1])));
$rw = fx_call($sr, function () use ($shown) {
    $prep = prepare_rewrite_rules(array(array('targetColumn' => 'T', 'condition' => "Done = \xE2\x98\x91", 'template' => 'DONE:{val}')), array('T'), $shown);
    return array(apply_rewrite_to_row($shown[0], 0, $prep), apply_rewrite_to_row($shown[1], 1, $prep));
});
A('I18-rewrite', !empty($rw[0]['T']) && empty($rw[1]), 'rewrite(T, Done = ☑): ' . json_encode($rw));
$ev = _snippet_toggle_eval_row(array('T' => 'alpha'), $jres);
$ev2 = _snippet_toggle_eval_row(array('ID' => '2', 'T' => 'alpha'), $jres);
A('I18-snippet', isset($ev['DONE']) && $ev['DONE'] === '1' && $ev2['DONE'] === '0', 'a count condition on a rendered row without its key: ' . json_encode($ev) . '; a row with its key still re-derives: ' . json_encode($ev2));
if ($have18) penumbra_sched_jrn_hidden_reset();
$ev3 = _snippet_toggle_eval_row(array('T' => 'alpha'), $jres);
A('I18-reset', $ev3['DONE'] === '0', 'after the task\'s reset nothing is kept: ' . json_encode($ev3));
A('I18-wired', strpos($srn, "if (\$_jHid) penumbra_sched_jrn_hidden_add(") !== false && strpos($srn, "if (function_exists('penumbra_sched_jrn_hidden_reset')) penumbra_sched_jrn_hidden_reset();") !== false,
    'apply_state_logic keeps them, the task resets them');
_snippet_journal_toggles(false);

// ---- report ------------------------------------------------------------------------------------------------
$p = 0; $f = 0; $failed = array();
foreach ($R as $r) { printf("  %s  %-18s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 330)); if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; } }
echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
