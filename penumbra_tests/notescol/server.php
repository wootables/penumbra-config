<?php
// =============================================================================
// NOTES COLUMN SUITE "notescol" - SERVER HALF (2026-10-14)
//
// Row notes as a real column: with viewOptions.journalNotesExport on (off by
// default), journal_export.php adds a NOTES column - each row's notes flattened,
// one line a note - to the ?json=1 API and scheduled output, riding the toggle
// resolver like the who / when columns (never a snapshot, a change signature or a
// DB dump). And manage_journal.php's new 'edit' action: the author rewrites their
// own NEWEST note on a row.
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring server.php
//        [--app DIR]        the build under test (default: the live webroot)
//        [--mutant NAME]    a single-point revert of that build: exactly its asserts must go red
//        [--mutants]        every mutant
//        [--flat-out FILE]  write journalNotesFlatten(PARITY fixture) to FILE (run.py's JS parity check)
//        [--control]        the build BEFORE the change (journal_export.php / manage_journal.php
//                           .bak-*-notescol): exactly CONTROL_RED fails
//
// S-* export resolver   X-* strip / decorate / columns   E-* edit action   P-* preconditions
// =============================================================================
error_reporting(E_ALL);
$APP = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$args = $argv; array_shift($args);
$opt = function ($n, $d = null) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return $d; $v = $args[$i + 1]; array_splice($args, $i, 2); return $v; };
$flag = function ($n) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return false; array_splice($args, $i, 1); return true; };
$app = $opt('--app', $APP);
$RUNNER_PATH = '';   // set below: the build's schedule_runner.php (round 4)
$SEARCH_PATH = file_exists($app . '/penumbra_search.php') ? $app . '/penumbra_search.php' : $APP . '/penumbra_search.php';   // (round 7)
$oneMutant = $opt('--mutant');
$flatOut = $opt('--flat-out');
$allMutants = $flag('--mutants');
$control = $flag('--control');
if ($args) { fwrite(STDERR, 'unknown arguments: ' . implode(' ', $args) . "\n"); exit(2); }

// --- mutants: [file, old, new, must-red] --------------------------------------
$MUTANTS = array(
    'gate'     => array('journal_export.php', "\$notesOut = !empty(\$vo['journalRowNotes']) && !empty(\$vo['journalNotesExport']);", "\$notesOut = !empty(\$vo['journalRowNotes']);",
                        array('S-off-toggles', 'S-off-notesonly')),
    'nostrip'  => array('journal_export.php', "if (!empty(\$res['notesName'])) \$drop[strtoupper((string)\$res['notesName'])] = true;", "",
                        array('X-strip', 'X-strip-grouped', 'X-strip-notesonly')),
    'withwho'  => array('journal_export.php', "if (\$withWho && !empty(\$resolver['notesName'])) {", "if (!empty(\$resolver['notesName'])) {",
                        array('X-decorate', 'X-rowvalues-nowho')),
    'keepcols' => array('journal_export.php', "if (!empty(\$resolver['notesName'])) \$out['whoNames'][] = \$resolver['notesName'];", "",
                        array('X-keepcols', 'S-on-names', 'S-with-toggles')),
    'parked'   => array('journal_export.php', "if (\$rk === '' || (defined('JOURNAL_PARK_OPEN') && strpos(\$rk, JOURNAL_PARK_OPEN) === 0)) continue;", "if (\$rk === '') continue;",
                        array('S-parked')),
    'latest'   => array('manage_journal.php', "if (!empty(\$later) && (int)\$later[0]['CNT'] > 0) {", "if (false) {",
                        array('E-notlatest', 'E-scope-latest')),
    'author'   => array('manage_journal.php', "if (strcasecmp((string)\$note['CREATED_BY'], (string)\$currentUserKey) !== 0) {", "if (false) {",
                        array('E-author', 'E-author-admin')),
    'newonly'  => array('manage_journal.php', "\$new_uids = array_values(array_diff(\$mention_uids, \$old_uids));", "\$new_uids = \$mention_uids;",
                        array('E-mail-newonly')),
    'notesread' => array('journal_export.php', "\$notesRead = !empty(\$vo['journalRowNotes']);", "\$notesRead = \$notesOut;",
                        array('Q-and', 'Q-clean', 'Q-col', 'Q-col-not', 'Q-col-regex', 'Q-count', 'Q-empty', 'Q-grouped', 'Q-word', 'Q-word-not', 'S-off-noquery', 'S-off-notesonly')),
    'flatrep'  => array('journal_export.php', "if (\$id !== '' && isset(\$replies[\$id])) { foreach (\$replies[\$id] as \$r) \$out[] = \"  \\xE2\\x86\\xB3 \" . \$line(\$r); }", "",
                        array('S-flatten', 'S-on-value', 'S-with-toggles', 'S-collide', 'X-rowvalues', 'Q-clean', 'Q-word', 'Q-word-not')),
);
// What the build before the change gets wrong (frozen from its first control run).
$CONTROL_RED = array('O-lifted', 'O-order', 'O-order-null', 'O-lead', 'O-wired', 'M-lifted', 'M-br', 'M-cleared', 'M-wired', 'P-flatten-fn', 'P-edit-lifted', 'S-flatten', 'S-flatten-orphan', 'S-flatten-empty', 'S-on-value', 'S-on-blank',
    'S-on-numkey', 'S-on-last', 'S-on-names', 'S-parked', 'S-with-toggles', 'S-collide', 'S-fallback', 'S-fail-notesonly', 'X-keepcols',
    'X-rowvalues', 'E-ok', 'E-mentions-csv', 'E-mail-newonly', 'E-audit', 'E-author', 'E-author-admin', 'E-notlatest', 'E-scope',
    'E-empty', 'E-empty-file', 'E-unchanged', 'E-long', 'E-journal-off', 'E-noview', 'E-gone', 'E-noid');
// ...every "switch off = as before" assert (S-off-*, S-rownotes-off, S-journal-off, S-on-notoggleq, S-fail-toggles,
// X-strip*, X-decorate, X-rowvalues-nowho) PASSES on the old build: the fixture reads the same.

function lift_build($app, $mutant, $MUTANTS) {
    $files = array();
    foreach (array('journal_export.php', 'manage_journal.php') as $f) $files[$f] = file_get_contents($app . '/' . $f);
    if ($mutant !== null) {
        list($mf, $old, $new) = $MUTANTS[$mutant];
        $c = substr_count($files[$mf], $old);
        if ($c !== 1) { fwrite(STDERR, "mutant $mutant: anchor found $c times\n"); exit(2); }
        $files[$mf] = str_replace($old, $new, $files[$mf]);
    }
    return $files;
}

// The 'edit' action's body, lifted by brace-matching real tokens, as a function: exit -> return.
function lift_edit_action($src) {
    $anchor = "if (\$action === 'edit') {";
    $p = strpos($src, $anchor);
    if ($p === false) return null;
    $toks = token_get_all('<?php ' . substr($src, $p));
    $depth = 0; $out = ''; $started = false;
    foreach ($toks as $t) {
        $s = is_array($t) ? $t[1] : $t;
        if (is_array($t) && $t[0] === T_OPEN_TAG) continue;
        if (!$started) { if ($s === '{') { $started = true; $depth = 1; } continue; }
        if ($s === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) $depth++;
        if ($s === '}') { $depth--; if ($depth === 0) break; }
        if (is_array($t) && $t[0] === T_EXIT) { $out .= 'return'; continue; }
        $out .= $s;
    }
    return $out;
}

// --- stubs --------------------------------------------------------------------
$GLOBALS['DB'] = array();
function db_reset() {
    $GLOBALS['DB'] = array('toggles' => array(), 'notes' => array(), 'fail_parent' => false, 'fail_notes' => false, 'queries' => array());
}
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['DB']['queries'][] = $sql;
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 7));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return $GLOBALS['DB']['toggles'];
    if (strpos($sql, 'COUNT(*) AS CNT FROM PENUMBRA_JOURNAL o') !== false) return array(array('CNT' => $GLOBALS['DB']['later']));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ID = :nid') !== false) return $GLOBALS['DB']['note'] ? array($GLOBALS['DB']['note']) : array();
    if (strpos($sql, 'SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL') !== false) return array(array('ROW_SNAPSHOT' => '{"ID":"root"}'));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL') !== false && strpos($sql, "SCOPE = 'row'") !== false) {
        if ($GLOBALS['DB']['fail_notes']) throw new Exception('ORA-00942: table or view does not exist');
        if ($GLOBALS['DB']['fail_parent'] && strpos($sql, 'PARENT_ID') !== false) throw new Exception('ORA-00904: "PARENT_ID": invalid identifier');
        $rows = $GLOBALS['DB']['notes'];
        if (strpos($sql, 'PARENT_ID') === false) foreach ($rows as $i => $r) { unset($rows[$i]['PARENT_ID'], $rows[$i]['ATTACH_NAME']); }
        return $rows;
    }
    throw new Exception('unexpected SQL: ' . $sql);
}
function log_scheduler($m) { $GLOBALS['DB']['log'][] = $m; }
function journalKeySig($cols) { return implode('|', $cols); }   // skips the filing block (journalEnsureFiled absent = 'ok')

// manage_journal.php's helpers the edit action calls
function journalGetReport($conn, $id) { return $GLOBALS['EDIT']['report']; }
function journalCallerCanView($r, $u, $o, $a) { return $GLOBALS['EDIT']['canView']; }
function journalCallerCanReadJournal($r, $u, $a) { return $GLOBALS['EDIT']['canRead']; }
function journalHasAttachColumn() { return true; }
function journalHasParentColumn() { return true; }
function journalUpdateNoteText($id, $rid, $text, $m) { $GLOBALS['EDIT']['updates'][] = array($id, $rid, $text, $m); return 1; }
function utf8ize($x) { return $x; }
function journalRowRefLine($scope, $t) { return 'ROW: ' . $t; }
function journalRowRefText($scope, $k, $snap) { return $k . '|' . $snap; }
function journalAuthorName() { return 'Lee Roe'; }
function journalResolveMentionAccess($c, $r, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = array('authorized' => $u !== 'outsider', 'name' => $u); return $o; }
function journalTargetCanOpenJournal($r, $u) { return true; }
function journalSendMentionEmail($uid, $name, $from, $author, $report, $text, $auth, $row) { $GLOBALS['EDIT']['mails'][] = $uid; return true; }
function logPenumbraAudit($rid, $action, $before, $after, $msg) { $GLOBALS['EDIT']['audit'][] = array($action, $before, $after, $msg); }
if (!defined('JOURNAL_NOTE_MAX_CHARS')) define('JOURNAL_NOTE_MAX_CHARS', 8000);
if (!defined('JOURNAL_MAX_MENTIONS')) define('JOURNAL_MAX_MENTIONS', 20);

// --- fixtures -----------------------------------------------------------------
$SEP = "\xE2\x90\x9F";
function vo($extra = array()) {
    return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('PROPOSAL ID'),
        'journalRowNotes' => true, 'journalNotesExport' => true), $extra));
}
function data_rows() {
    return array(
        array('PROPOSAL ID' => 'P-1', 'TITLE' => 'Alpha', 'AMOUNT' => '10'),
        array('PROPOSAL ID' => 'P-2', 'TITLE' => 'Bravo', 'AMOUNT' => '20'),
        array('PROPOSAL ID' => '12345', 'TITLE' => 'Charlie', 'AMOUNT' => '30'),
    );
}
function note($id, $rk, $text, $by, $at, $parent = null, $file = null, $name = null) {
    return array('ID' => (string)$id, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'CREATED_BY' => $by, 'AUTHOR_NAME' => $name,
                 'CREATED_AT' => $at, 'PARENT_ID' => $parent === null ? null : (string)$parent, 'ATTACH_NAME' => $file);
}
function std_notes() {
    return array(
        note(11, 'P-1', "First look\r\ndone.", 'pat', '2026-10-01 09:05:00', null, null, 'Pat Doe'),
        note(12, 'P-1', 'Agreed', 'lee', '2026-10-01 10:00:00', 11, null, 'Lee Roe'),
        note(13, 'P-1', '  Follow up next week @lee  ', 'pat', '2026-10-02 08:00:00', null, 'budget.xlsx', 'Pat Doe'),
        note(14, '12345', '', 'kim', '2026-10-03 12:00:00', null, 'scan.pdf', ''),
        note(15, "\xE2\x90\x82OLD\xE2\x90\x83P-2", 'parked under an old key', 'pat', '2026-10-03 12:30:00'),
    );
}
// The parity fixture: run.py hands the same notes to main.js journalNotesFlatten().
function parity_notes() {
    return array(
        note(1, 'K', "Line one\nline two", 'pat', '2026-10-01 09:05:00', null, null, 'Pat Doe'),
        note(2, 'K', 'a reply', 'lee', '2026-10-01 09:06:00', 1, null, null),
        note(3, 'K', 'orphan reply (its note deleted)', 'kim', '2026-10-01 09:07:00', 99, null, 'Kim Lo'),
        note(4, 'K', "\t tabs and spaces \t", 'pat', '2026-10-02 10:00:00', null, 'scan.pdf', 'Pat Doe'),
        note(5, 'K', '', 'lee', '2026-10-02 11:00:00', 4, 'only-a-file.png', 'Lee Roe'),
        note(6, 'K', "R\xC3\xA9vis\xC3\xA9 \xE2\x9C\x93 @jdoe <b>html</b> & \"quotes\"", 'zed', '2026-10-03 12:00:00', '0', null, ''),
    );
}

$mode = getenv('PNB_NOTESCOL_CHILD');
if ($mode) {
    ini_set('display_errors', 'stderr');
    // ===== CHILD: one build =====
    $dir = $mode;
    require $dir . '/journal_export.php';
    $editBody = file_exists($dir . '/edit.txt') ? file_get_contents($dir . '/edit.txt') : '';
    $R = array();
    $A = function ($id, $ok, $detail = '') use (&$R) { $R[] = array($id, (bool)$ok, (string)$detail); };
    $SEP = "\xE2\x90\x9F";

    // P: preconditions
    $A('P-flatten-fn', function_exists('journalNotesFlatten'), 'journalNotesFlatten defined');
    $A('P-edit-lifted', $editBody !== '', 'the edit action lifted from manage_journal.php');

    // S-flatten: the format, threads, orphans, files, line breaks
    $flat = function_exists('journalNotesFlatten') ? journalNotesFlatten(parity_notes()) : '';
    $want = "2026-10-01 Pat Doe: Line one line two\n"
          . "  \xE2\x86\xB3 2026-10-01 lee: a reply\n"
          . "2026-10-01 Kim Lo: orphan reply (its note deleted)\n"
          . "2026-10-02 Pat Doe: tabs and spaces [file: scan.pdf]\n"
          . "  \xE2\x86\xB3 2026-10-02 Lee Roe: [file: only-a-file.png]\n"
          . "2026-10-03 zed: R\xC3\xA9vis\xC3\xA9 \xE2\x9C\x93 @jdoe <b>html</b> & \"quotes\"";
    $A('S-flatten', $flat === $want, json_encode($flat));
    $A('S-flatten-orphan', strpos($flat, "\n2026-10-01 Kim Lo:") !== false && strpos($flat, "\xE2\x86\xB3 2026-10-01 Kim Lo") === false, 'an orphan reply stands on its own');
    $A('S-flatten-empty', function_exists('journalNotesFlatten') && journalNotesFlatten(array()) === '' && journalNotesFlatten(null) === '', 'no notes = empty');
    if (getenv('PNB_FLAT_OUT')) file_put_contents(getenv('PNB_FLAT_OUT'), json_encode(array('notes' => parity_notes(), 'flat' => $flat)));

    // S-off-*: the switch is off by default - nothing changes
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $GLOBALS['DB']['toggles'] = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'P-1'));
    $st = vo(array('journalNotesExport' => false, 'journalToggles' => array(array('key' => 'done', 'label' => 'Done'))));
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', $st, $rows);
    $A('S-off-toggles', !isset($rows[0]['NOTES']) && $rows[0]['DONE'] === '1' && !in_array('NOTES', $jt['whoNames'], true), json_encode($rows[0]) . ' who=' . json_encode($jt['whoNames']));
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(array('journalNotesExport' => false)), $rows);
    $A('S-off-notesonly', $jt['resolver'] !== null && $jt['resolver']['notesName'] === null && $jt['resolver']['notesSearch'] === 'NOTES'
        && !isset($rows[0]['NOTES']) && $jt['whoNames'] === array(), 'switch off: no column, read for a search: ' . json_encode($rows[0]));
    $A('S-off-noquery', preg_grep('/SCOPE = \'row\'/', $GLOBALS['DB']['queries']) && isset($jt['resolver']['notesCount']['P-1']) && $jt['resolver']['notesCount']['P-1'] === 3,
        'read once for a search (round 7): count P-1 = ' . json_encode(isset($jt['resolver']['notesCount']['P-1']) ? $jt['resolver']['notesCount']['P-1'] : null));
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(array('journalRowNotes' => false)), $rows);
    $A('S-rownotes-off', $jt['resolver'] === null && !isset($rows[0]['NOTES']), 'row notes off: no column even with the switch on');
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(array('journalEnabled' => false)), $rows);
    $A('S-journal-off', $jt['resolver'] === null && !isset($rows[0]['NOTES']), 'journal off: none');

    // S-on: notes only (no toggle column)
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(), $rows);
    $p1 = "2026-10-01 Pat Doe: First look done.\n  \xE2\x86\xB3 2026-10-01 Lee Roe: Agreed\n2026-10-02 Pat Doe: Follow up next week @lee [file: budget.xlsx]";
    $A('S-on-value', isset($rows[0]['NOTES']) && $rows[0]['NOTES'] === $p1, json_encode(isset($rows[0]['NOTES']) ? $rows[0]['NOTES'] : null));
    $A('S-on-blank', isset($rows[1]['NOTES']) && $rows[1]['NOTES'] === '', 'a row with no notes reads blank');
    $A('S-on-numkey', isset($rows[2]['NOTES']) && $rows[2]['NOTES'] === '2026-10-03 kim: [file: scan.pdf]', 'a number-like key: ' . json_encode(isset($rows[2]['NOTES']) ? $rows[2]['NOTES'] : null));
    $A('S-on-last', array_keys($rows[0]) === array('PROPOSAL ID', 'TITLE', 'AMOUNT', 'NOTES'), 'appended at the end: ' . implode(',', array_keys($rows[0])));
    $A('S-on-names', $jt['colNames'] === array() && $jt['whoNames'] === array('NOTES') && $jt['resolver']['notesName'] === 'NOTES'
        && $jt['resolver']['whoNames'] === array(), 'colNames ' . json_encode($jt['colNames']) . ' who ' . json_encode($jt['whoNames']));
    $A('S-on-notoggleq', !preg_grep('/PENUMBRA_JOURNAL_TOGGLE/', $GLOBALS['DB']['queries']), 'no toggle read without a toggle');
    $A('S-parked', strpos(json_encode($rows), 'parked under an old key') === false && $jt['resolver'] && count($jt['resolver']['notesMap']) === 2, 'a note filed under an earlier key stays out');

    // S-with toggles + who: NOTES rides whoNames for the callers, never the resolver's
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $GLOBALS['DB']['toggles'] = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'P-2', 'UPDATED_BY' => 'pat', 'UPDATED_ON' => '2026-10-04'));
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(array('journalToggles' => array(array('key' => 'done', 'label' => 'Done')), 'journalToggleWho' => true)), $rows);
    $A('S-with-toggles', $jt['colNames'] === array('DONE') && $jt['whoNames'] === array('DONE BY', 'DONE ON', 'NOTES')
        && $jt['resolver']['whoNames'] === array('DONE BY', 'DONE ON') && $rows[1]['DONE'] === '1' && $rows[0]['NOTES'] === $p1,
        json_encode($jt['whoNames']) . ' ' . json_encode($rows[1]));

    // S-collide: a data column already called Notes
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $rows = data_rows(); foreach ($rows as $i => $r) $rows[$i]['Notes'] = 'data';
    $jt = journalExportToggleColumns('rpt', vo(), $rows);
    $A('S-collide', $jt['resolver']['notesName'] === 'NOTES_2' && $rows[0]['Notes'] === 'data' && $rows[0]['NOTES_2'] === $p1, json_encode($rows[0]));

    // S-fallback: a table without PARENT_ID / ATTACH_NAME reads flat
    db_reset(); $GLOBALS['DB']['notes'] = std_notes(); $GLOBALS['DB']['fail_parent'] = true;
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(), $rows);
    $A('S-fallback', isset($rows[0]['NOTES']) && $rows[0]['NOTES'] === "2026-10-01 Pat Doe: First look done.\n2026-10-01 Lee Roe: Agreed\n2026-10-02 Pat Doe: Follow up next week @lee",
        json_encode(isset($rows[0]['NOTES']) ? $rows[0]['NOTES'] : null));
    // S-fail: the read fails - no column, and a breadcrumb; the toggles still come
    db_reset(); $GLOBALS['DB']['notes'] = std_notes(); $GLOBALS['DB']['fail_notes'] = true;
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(), $rows);
    $A('S-fail-notesonly', $jt['resolver'] === null && !isset($rows[0]['NOTES']) && !empty($GLOBALS['DB']['log']), json_encode(isset($GLOBALS['DB']['log']) ? $GLOBALS['DB']['log'] : null));
    db_reset(); $GLOBALS['DB']['notes'] = std_notes(); $GLOBALS['DB']['fail_notes'] = true;
    $GLOBALS['DB']['toggles'] = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'P-1'));
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(array('journalToggles' => array(array('key' => 'done', 'label' => 'Done')))), $rows);
    $A('S-fail-toggles', $rows[0]['DONE'] === '1' && !isset($rows[0]['NOTES']), json_encode($rows[0]));

    // X: a snapshot / change signature / dump never carries it
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $GLOBALS['DB']['toggles'] = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'P-1', 'UPDATED_BY' => 'pat', 'UPDATED_ON' => '2026-10-04'));
    $st = vo(array('journalToggles' => array(array('key' => 'done', 'label' => 'Done')), 'journalToggleWho' => true));
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', $st, $rows);
    $stripped = journalStripWhoCols($rows, $jt['resolver']);
    $A('X-strip', !isset($stripped[0]['NOTES']) && !isset($stripped[0]['DONE BY']) && $stripped[0]['DONE'] === '1', json_encode($stripped[0]));
    $grp = journalStripWhoCols(array(array('rows' => array($rows[0]))), array('journalToggleResolver' => $jt['resolver']));
    $A('X-strip-grouped', !isset($grp[0]['rows'][0]['NOTES']), 'grouped rows too');
    $deco = journalDecorateRowsWithToggles(data_rows(), array('journalToggleResolver' => $jt['resolver']));
    $A('X-decorate', !isset($deco[0]['NOTES']) && $deco[0]['DONE'] === '1', 'a snapshot takes the toggle, not the notes: ' . json_encode($deco[0]));
    $A('X-keepcols', in_array('NOTES', $jt['whoNames'], true), 'kept / dump-stripped with the who columns');
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $rows = data_rows(); $jt = journalExportToggleColumns('rpt', vo(), $rows);
    $stripped = journalStripWhoCols($rows, $jt['resolver']);
    $A('X-strip-notesonly', !isset($stripped[0]['NOTES']) && $stripped[0]['TITLE'] === 'Alpha', json_encode($stripped[0]));
    $A('X-rowvalues', ($v = journalExportToggleRowValues($jt['resolver'], array('PROPOSAL ID' => 'P-1'))) && $v === array('NOTES' => $p1), json_encode($v));
    $A('X-rowvalues-nowho', journalExportToggleRowValues($jt['resolver'], array('PROPOSAL ID' => 'P-1'), false) === array(), 'withWho false = none');

    // E: the edit action
    $edit = function ($data, $setup = array()) use ($editBody) {
        $GLOBALS['EDIT'] = array_merge(array(
            'report' => array('ID' => 7, 'SHORT_ID' => 'rpt'), 'canView' => true, 'canRead' => true,
            'updates' => array(), 'mails' => array(), 'audit' => array()), $setup);
        $GLOBALS['DB']['later'] = isset($setup['later']) ? $setup['later'] : 0;
        $GLOBALS['DB']['note'] = array_key_exists('note', $setup) ? $setup['note'] : array('ID' => '902', 'REPORT_ID' => '7', 'SCOPE' => 'row', 'ROW_KEY' => 'P-1',
            'NOTE_TEXT' => 'Follow up @pat', 'ROW_SNAPSHOT' => null, 'MENTIONS' => 'pat', 'CREATED_BY' => 'LEE', 'AUTHOR_NAME' => 'Lee Roe',
            'ATTACH_NAME' => null, 'PARENT_ID' => '901', 'CREATED_AT' => '2026-10-01 11:00:00');
        $f = function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin) use ($editBody) { eval($editBody); };
        ob_start();
        $f($data, null, isset($setup['me']) ? $setup['me'] : 'lee', '', !empty($setup['admin']));
        $o = json_decode(ob_get_clean(), true);
        return is_array($o) ? $o : array('raw' => 'not json');
    };
    if ($editBody !== '') {
        $r = $edit(array('note_id' => 902, 'note_text' => 'Follow up Monday @pat @kim', 'mentions' => array(array('user' => 'pat'), array('user' => 'kim'), array('user' => 'ghost'))));
        $u = $GLOBALS['EDIT']['updates'];
        $A('E-ok', $r['status'] === 'success' && count($u) === 1 && $u[0][0] === 902 && $u[0][2] === 'Follow up Monday @pat @kim', json_encode($r) . ' ' . json_encode($u));
        $A('E-mentions-csv', isset($u[0]) && $u[0][3] === 'pat,kim', 'MENTIONS = the ones the text names: ' . json_encode(isset($u[0]) ? $u[0][3] : null));
        $A('E-mail-newonly', $GLOBALS['EDIT']['mails'] === array('kim'), 'only the NEW mention is mailed: ' . json_encode($GLOBALS['EDIT']['mails']));
        $au = $GLOBALS['EDIT']['audit'];
        $A('E-audit', count($au) === 1 && $au[0][0] === 'JOURNAL_EDIT' && strpos($au[0][1], 'Follow up @pat') !== false, 'the old text kept in the audit row: ' . json_encode($au));
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('me' => 'pat'));
        $A('E-author', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'] && stripos($r['message'], 'author') !== false, json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('me' => 'pat', 'admin' => true));
        $A('E-author-admin', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], 'an admin may delete, never reword: ' . json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('later' => 1));
        $A('E-notlatest', $r['status'] === 'error' && isset($r['code']) && $r['code'] === 'not_latest' && !$GLOBALS['EDIT']['updates'], json_encode($r));
        $n = $GLOBALS['DB']['note']; $n['SCOPE'] = 'report'; $n['ROW_KEY'] = null;
        $r = $edit(array('note_id' => 902, 'note_text' => 'x @kim', 'mentions' => array(array('user' => 'kim'))), array('note' => $n));
        $A('E-scope', $r['status'] === 'success' && count($GLOBALS['EDIT']['updates']) === 1 && $GLOBALS['EDIT']['mails'] === array('kim'),
            'a report-level note (the journal panel, round 7): ' . json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('note' => $n, 'later' => 1));
        $A('E-scope-latest', $r['status'] === 'error' && isset($r['code']) && $r['code'] === 'not_latest' && !$GLOBALS['EDIT']['updates'], 'only the newest report-level note: ' . json_encode($r));
        $n['SCOPE'] = 'weird';
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('note' => $n));
        $A('E-scope-bad', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], 'an unknown scope is refused: ' . json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => '   '));
        $A('E-empty', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], json_encode($r));
        $n = $GLOBALS['DB']['note']; $n['ATTACH_NAME'] = 'scan.pdf';
        $r = $edit(array('note_id' => 902, 'note_text' => ''), array('note' => $n));
        $A('E-empty-file', $r['status'] === 'success' && count($GLOBALS['EDIT']['updates']) === 1, 'a note with a file may lose its text: ' . json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => 'Follow up @pat', 'mentions' => array(array('user' => 'pat'))));
        $A('E-unchanged', $r['status'] === 'success' && !empty($r['unchanged']) && !$GLOBALS['EDIT']['updates'] && !$GLOBALS['EDIT']['mails'], json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => str_repeat('a', 8001)));
        $A('E-long', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], 'over 8,000 characters');
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('canRead' => false));
        $A('E-journal-off', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('canView' => false));
        $A('E-noview', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], json_encode($r));
        $r = $edit(array('note_id' => 902, 'note_text' => 'x'), array('note' => null));
        $A('E-gone', $r['status'] === 'error' && !$GLOBALS['EDIT']['updates'], json_encode($r));
        $r = $edit(array('note_text' => 'x'));
        $A('E-noid', $r['status'] === 'error', json_encode($r));
    }
    // Q: a task's search filter reads the notes (round 7) - the real php_apply_search_filter, the switch OFF
    $runner = getenv('PNB_RUNNER') ? file_get_contents(getenv('PNB_RUNNER')) : '';
    $psPath = getenv('PNB_SEARCH');
    if ($psPath && is_file($psPath) && !function_exists('php_apply_search_filter')) {
        require $psPath;
    }
    $okQ = function_exists('php_apply_search_filter') && function_exists('_search_notes_register');
    $A('Q-loaded', $okQ, 'penumbra_search.php of the build: ' . $psPath);
    if ($okQ) {
        db_reset(); $GLOBALS['DB']['notes'] = std_notes();
        $rows = data_rows();
        $jt = journalExportToggleColumns('rpt', vo(array('journalNotesExport' => false)), $rows);
        $res = $jt['resolver'];
        $ids = function ($q) use ($res) {
            $out = php_apply_search_filter(data_rows(), 'standard', $q, null, $res);
            return implode(',', array_map(function ($r) { return $r['PROPOSAL ID']; }, is_array($out) ? $out : array()));
        };
        $A('Q-word', $ids('agreed') === 'P-1', 'a bare word in a reply: ' . $ids('agreed'));
        $A('Q-word-not', $ids('!= agreed') === 'P-2,12345', '"!= agreed": ' . $ids('!= agreed'));
        $A('Q-col', $ids('Notes = follow') === 'P-1' && $ids('Notes = FOLLOW') === 'P-1', '"Notes = follow" (contains, any case): ' . $ids('Notes = follow'));
        $A('Q-col-not', $ids('Notes != follow') === 'P-2,12345', '"Notes != follow": ' . $ids('Notes != follow'));
        $A('Q-col-regex', $ids('Notes = /scan\.pdf/') === '12345', 'a regex finds the file-only note: ' . $ids('Notes = /scan\.pdf/'));
        $A('Q-count', $ids('Notes > 1') === 'P-1' && $ids('Notes = 1') === '12345' && $ids('Notes > 0') === 'P-1,12345',
            '"Notes > 1" ' . $ids('Notes > 1') . ' / "= 1" ' . $ids('Notes = 1') . ' / "> 0" ' . $ids('Notes > 0'));
        $A('Q-empty', $ids('Notes = empty') === 'P-2' && $ids('Notes != empty') === 'P-1,12345', '"Notes = empty": ' . $ids('Notes = empty'));
        $A('Q-and', $ids('Notes = follow and AMOUNT = 10') === 'P-1' && $ids('Notes = follow and AMOUNT = 20') === '', 'with another condition');
        $out = php_apply_search_filter(data_rows(), 'standard', 'agreed', null, $res);
        $A('Q-clean', isset($out[0]) && !isset($out[0]['NOTES']) && !isset($out[0]['__PNB_NOTES_N__']) && _search_notes_col() === null,
            'the rows come back as they were; the registry cleared');
        $A('Q-grouped', ($g = php_apply_search_filter(array('A' => array('rows' => data_rows())), 'grouped', 'Notes = follow', null, $res))
            && isset($g['A']['rows']) && count($g['A']['rows']) === 1, 'a grouped filter too');
        db_reset(); $GLOBALS['DB']['notes'] = std_notes();
        $rows = data_rows(); foreach ($rows as $i => $r) $rows[$i]['Notes'] = 'data' . $i;
        $jt2 = journalExportToggleColumns('rpt', vo(), $rows);
        $out = php_apply_search_filter($rows, 'standard', 'Notes = data1', null, $jt2['resolver']);
        $A('Q-shadow', count($out) === 1 && $out[0]['PROPOSAL ID'] === 'P-2', 'a data column called Notes wins, as on the page');
        db_reset(); $GLOBALS['DB']['notes'] = std_notes();
        $jt3 = journalExportToggleColumns('rpt', vo(array('journalRowNotes' => false)), $rows);
        $A('Q-off', php_apply_search_filter(data_rows(), 'standard', 'agreed', null, $jt3['resolver']) === array(), 'row notes off: the notes are not searched');
    }
    $A('Q-wired', substr_count($runner, '_search_notes_register($jtRes, $columns, $jNames)') === 1
        && substr_count($runner, 'journalExportNotesSearchValues($jtRes, $row)') === 1 && substr_count($runner, '_search_notes_col(false);') === 1,
        "the runner's group-summary filter branch reads them too: " . substr_count($runner, '_search_notes_register($jtRes, $columns, $jNames)') . '/' . substr_count($runner, 'journalExportNotesSearchValues($jtRes, $row)') . '/' . substr_count($runner, '_search_notes_col(false);'));

    // M: the email / PDF tables keep the Notes column's line breaks (round 4, schedule_runner.php)
    $runner = getenv('PNB_RUNNER') ? file_get_contents(getenv('PNB_RUNNER')) : '';
    $lift = function ($src, $name) {
        $p = strpos($src, "function $name(");
        if ($p === false) return null;
        $toks = token_get_all('<?php ' . substr($src, $p)); $out = ''; $depth = 0; $open = false;
        foreach ($toks as $t) {
            $s = is_array($t) ? $t[1] : $t;
            if (is_array($t) && $t[0] === T_OPEN_TAG) continue;
            $out .= $s;
            if ($s === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $open = true; }
            if ($s === '}') { $depth--; if ($open && $depth === 0) break; }
        }
        return $out;
    };
    $f1 = $lift($runner, 'penumbra_sched_notes_col'); $f2 = $lift($runner, 'penumbra_notes_cell_html');
    if ($f1 && $f2) { eval($f1); eval($f2); }
    $ok = function_exists('penumbra_notes_cell_html');
    $A('M-lifted', $ok, 'the two helpers lifted from the runner');
    if ($ok) {
        penumbra_sched_notes_col('Notes');
        $A('M-br', penumbra_notes_cell_html("a &amp; b\nc", 'NOTES') === "a &amp; b<br>\nc" && penumbra_notes_cell_html("x\ny", 'TITLE') === "x\ny",
           'the Notes column keeps a note a line, another column as it was');
        penumbra_sched_notes_col('');
        $A('M-cleared', penumbra_notes_cell_html("x\ny", 'NOTES') === "x\ny", 'a task with no Notes column changes nothing');
    }
    $A('M-wired', substr_count($runner, 'penumbra_notes_cell_html(formatCellContent(') === 2 && substr_count($runner, 'penumbra_notes_cell_html(formatCellContentPdf(') === 4
        && substr_count($runner, "penumbra_sched_notes_col((\$journal_toggle_resolver") === 1,
        'email x2 + PDF x4 + set per task: ' . substr_count($runner, 'penumbra_notes_cell_html(formatCellContent(') . ' / ' . substr_count($runner, 'penumbra_notes_cell_html(formatCellContentPdf('));
    // O: the scheduled output's journal columns LEAD each row in the page's order (round 5)
    $f3 = $lift($runner, 'penumbra_sched_journal_screen_order'); $f4 = $lift($runner, 'apply_state_logic');
    if ($f3) eval($f3);
    $A('O-lifted', function_exists('penumbra_sched_journal_screen_order') && $f4 !== null, 'the helper + apply_state_logic lifted');
    if (function_exists('penumbra_sched_journal_screen_order')) {
        $res = array('colMeta' => array(array('name' => 'DONE', 'key' => 'done'), array('name' => 'TAKEN', 'key' => 't2')),
                     'whoMeta' => array(array('name' => 'DONE ON', 'key' => 'done', 'kind' => 'on'), array('name' => 'DONE BY', 'key' => 'done', 'kind' => 'by'),
                                        array('name' => 'TAKEN BY', 'key' => 't2', 'kind' => 'by'), array('name' => 'TAKEN ON', 'key' => 't2', 'kind' => 'on')),
                     'notesName' => 'NOTES');
        $o = penumbra_sched_journal_screen_order($res, array('DONE', 'TAKEN', 'DONE BY', 'DONE ON', 'TAKEN BY', 'TAKEN ON', 'NOTES'));
        $A('O-order', $o === array('DONE', 'DONE BY', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', 'NOTES'), implode(',', $o));
        $A('O-order-null', penumbra_sched_journal_screen_order(null, array('A', 'B')) === array('A', 'B')
            && penumbra_sched_journal_screen_order($res, array('NOTES', 'EXTRA')) === array('NOTES', 'EXTRA'), 'no resolver: as given; unknown names kept');
    }
    if ($f4 && !function_exists('apply_state_logic')) {
        if (!function_exists('penumbra_group_levels')) { function penumbra_group_levels($g) { return array(); } }
        eval($f4);
    }
    // apply_state_logic() calls helpers unconditionally (group-limit normalizing, ...): any one
    // missing here becomes a pass-through (no grouping or sorting in these states, so none of
    // them can touch the column order), retried until the call completes.
    $runAsl = function ($rows, $st, $pc) {
        for ($i = 0; $i < 25; $i++) {
            try { return apply_state_logic($rows, $st, $pc); }
            catch (Error $e) {
                if (!preg_match('/Call to undefined function ([A-Za-z_0-9]+)\(\)/', $e->getMessage(), $mm)) return array('error' => $e->getMessage());
                eval('function ' . $mm[1] . '(...$a) { return isset($a[0]) ? $a[0] : null; }');
            }
        }
        return array('error' => 'too many missing helpers');
    };
    if (function_exists('apply_state_logic')) {
        $rows = array(array('ID' => '1', 'TITLE' => 'a', 'AMT' => '5', 'DONE' => '1', 'NOTES' => 'n1'),
                      array('ID' => '2', 'TITLE' => 'b', 'AMT' => '6', 'DONE' => '0', 'NOTES' => ''));
        $out = $runAsl($rows, array('visibleColumns' => array('#', 0, 2, 1), 'columnOrder' => array(2, 0, 1)), array('DONE', 'NOTES'));
        $keys = (is_array($out) && isset($out['data'][0])) ? array_keys($out['data'][0]) : array();
        $A('O-lead', $keys === array('DONE', 'NOTES', 'AMT', 'ID', 'TITLE'), implode(',', $keys) . (isset($out['error']) ? ' ' . $out['error'] : ''));
        $out = $runAsl($rows, array('visibleColumns' => array('#', 0, 1)), array());
        $keys = (is_array($out) && isset($out['data'][0])) ? array_keys($out['data'][0]) : array();
        $A('O-none', $keys === array('ID', 'TITLE'), 'no journal columns: as before (' . implode(',', $keys) . ')');
    } else { $A('O-lead', false, 'apply_state_logic not loaded'); $A('O-none', false, 'apply_state_logic not loaded'); }
    $A('O-wired', substr_count($runner, '$processed = apply_state_logic($flat_rows, $state, $journal_screen_cols);') === 1
        && substr_count($runner, "'journalToggleCols' => \$journal_screen_cols,") === 1, 'execute_scheduled_report hands them over in screen order');
    echo json_encode($R);
    exit(0);
}

// ===== PARENT =====
$EXPECT = array('P-flatten-fn', 'P-edit-lifted', 'S-flatten', 'S-flatten-orphan', 'S-flatten-empty', 'S-off-toggles', 'S-off-notesonly',
    'S-off-noquery', 'S-rownotes-off', 'S-journal-off', 'S-on-value', 'S-on-blank', 'S-on-numkey', 'S-on-last', 'S-on-names',
    'S-on-notoggleq', 'S-parked', 'S-with-toggles', 'S-collide', 'S-fallback', 'S-fail-notesonly', 'S-fail-toggles',
    'X-strip', 'X-strip-grouped', 'X-decorate', 'X-keepcols', 'X-strip-notesonly', 'X-rowvalues', 'X-rowvalues-nowho',
    'E-ok', 'E-mentions-csv', 'E-mail-newonly', 'E-audit', 'E-author', 'E-author-admin', 'E-notlatest', 'E-scope', 'E-empty',
    'E-empty-file', 'E-unchanged', 'E-long', 'E-journal-off', 'E-noview', 'E-gone', 'E-noid',
    'Q-loaded', 'Q-word', 'Q-word-not', 'Q-col', 'Q-col-not', 'Q-col-regex', 'Q-count', 'Q-empty', 'Q-and', 'Q-clean', 'Q-grouped', 'Q-shadow', 'Q-off', 'Q-wired',
    'E-scope-latest', 'E-scope-bad',
    'M-lifted', 'M-br', 'M-cleared', 'M-wired', 'O-lifted', 'O-order', 'O-order-null', 'O-lead', 'O-none', 'O-wired');

function run_build_child($files, $flatOut = null) {
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_notescol_' . getmypid() . '_' . mt_rand(1000, 9999);
    if (!preg_match('/pnb_notescol_\d+_\d{4}$/', $dir)) { fwrite(STDERR, "bad temp dir\n"); exit(2); }
    mkdir($dir);
    file_put_contents($dir . '/journal_export.php', $files['journal_export.php']);
    $eb = lift_edit_action($files['manage_journal.php']);
    if ($eb !== null) file_put_contents($dir . '/edit.txt', $eb);
    $php = PHP_BINARY;
    $cmd = '"' . $php . '" -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring "' . __FILE__ . '"';
    $env = array('PNB_SEARCH' => $GLOBALS['SEARCH_PATH'], 'PNB_RUNNER' => $GLOBALS['RUNNER_PATH'], 'PNB_NOTESCOL_CHILD' => $dir, 'PNB_FLAT_OUT' => (string)$flatOut, 'SystemRoot' => getenv('SystemRoot'), 'TEMP' => getenv('TEMP'), 'TMP' => getenv('TMP'));
    $p = proc_open($cmd, array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, null, $env);
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    foreach (array('journal_export.php', 'edit.txt') as $f) if (file_exists($dir . '/' . $f)) unlink($dir . '/' . $f);
    rmdir($dir);
    $res = json_decode($out, true);
    if (!is_array($res)) return array(array('FATAL', false, substr($out . ' ' . $err, 0, 1500)));
    return $res;
}
function evaluate_res($res, $EXPECT) {
    $got = array(); $out = array();
    foreach ($res as $r) $got[$r[0]] = $r;
    foreach ($EXPECT as $id) $out[] = isset($got[$id]) ? $got[$id] : array($id, false, 'NOT RECORDED');
    foreach ($got as $id => $r) if (!in_array($id, $EXPECT, true)) $out[] = array($id, false, 'UNEXPECTED ' . $r[2]);
    return $out;
}

if ($RUNNER_PATH === '') $RUNNER_PATH = file_exists($app . '/schedule_runner.php') ? $app . '/schedule_runner.php' : $APP . '/schedule_runner.php';
if ($allMutants || $oneMutant) {
    $ok = 0; $bad = 0;
    foreach (($oneMutant ? explode(',', $oneMutant) : array_keys($MUTANTS)) as $m) {
        $res = evaluate_res(run_build_child(lift_build($app, $m, $MUTANTS)), $EXPECT);
        $red = array(); foreach ($res as $r) if (!$r[1]) $red[] = $r[0];
        $must = $MUTANTS[$m][3]; sort($red); sort($must);
        $good = ($red === $must);
        $good ? $ok++ : $bad++;
        printf("  %s  mutant %-9s turns %s red   [red: %s]\n", $good ? 'PASS' : 'FAIL', $m, implode(' ', $MUTANTS[$m][3]), implode(' ', $red));
        if (!$good) foreach ($res as $r) if (!$r[1]) printf("        %-20s %s\n", $r[0], substr($r[2], 0, 300));
    }
    printf("SUMMARY mutants ok=%d bad=%d\n%s\n", $ok, $bad, ($bad === 0 && $ok > 0) ? 'RESULT: GREEN' : 'RESULT: RED');
    exit($bad ? 1 : 0);
}
$RUNNER_PATH = file_exists($app . '/schedule_runner.php') ? $app . '/schedule_runner.php' : $APP . '/schedule_runner.php';
$files = lift_build($app, null, $MUTANTS);
if ($control && $app === $APP) {
    require_once '\\\\oitras.oit.ncsu.edu\\d$\\Utilities\\PHP_8.2-p\\penumbra_tests\\_oldver\\oldver.php';   // .bak copies come from git since 2026-10-14
    foreach (array('journal_export.php', 'manage_journal.php') as $f) {
        $baks = oldver_glob($APP . '/' . $f . '.bak-*-notescol'); sort($baks);
        if (!$baks) { fwrite(STDERR, "no $f.bak-*-notescol: pass --app <the pre-change build>
"); exit(2); }
        $files[$f] = file_get_contents(end($baks));
    }
}
$res = evaluate_res(run_build_child($files, $flatOut), $EXPECT);
$p = 0; $f = 0; $failed = array();
foreach ($res as $r) { printf("  %s  %-20s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 400)); if ($r[1]) $p++; else { $f++; $failed[] = $r[0]; } }
printf("TOTAL pass=%d fail=%d   failed: %s\n", $p, $f, implode(' ', $failed));
if ($control) {
    if ($CONTROL_RED === null) { echo "CONTROL: not frozen yet - red set: " . implode(' ', $failed) . "\nRESULT: RED\n"; exit(1); }
    sort($failed); $w = $CONTROL_RED; sort($w);
    echo ($failed === $w ? "CONTROL: as expected\nRESULT: GREEN\n" : "CONTROL: NOT as expected\nRESULT: RED\n");
    exit($failed === $w ? 0 : 1);
}
echo ($f === 0 && $p > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
exit($f ? 1 : 0);
