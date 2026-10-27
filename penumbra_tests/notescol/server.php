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
// J-* (round 8, 2026-10-26 jrnplace) the scheduled output's journal columns where the report's saved layout
//     has them, as the page now opens them: schedule_runner.php penumbra_sched_journal_places through
//     apply_state_logic. A mutant on schedule_runner.php runs the child on a mutated copy of the build's runner.
// =============================================================================
error_reporting(E_ALL);
$APP = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra';
$args = $argv; array_shift($args);
$opt = function ($n, $d = null) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return $d; $v = $args[$i + 1]; array_splice($args, $i, 2); return $v; };
$flag = function ($n) use (&$args) { $i = array_search($n, $args, true); if ($i === false) return false; array_splice($args, $i, 1); return true; };
$app = $opt('--app', $APP);
$RUNNER_PATH = '';   // set below: the build's schedule_runner.php (round 4)
$SEARCH_PATH = file_exists($app . '/penumbra_search.php') ? $app . '/penumbra_search.php' : $APP . '/penumbra_search.php';   // (round 7)
$LAYOUT_PATH = file_exists($app . '/penumbra_layout.php') ? $app . '/penumbra_layout.php' : $APP . '/penumbra_layout.php';   // (round 8)
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
                        array('X-keepcols', 'S-on-names', 'S-with-toggles', 'J-fixture')),
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
    // (round 8, jrnplace) schedule_runner.php: the journal's columns where the saved layout has them
    'jp-wire'     => array('schedule_runner.php', 'if ($_lead && is_array($_jRes)) $finalOrderNames = penumbra_sched_journal_places(', 'if (false) $finalOrderNames = penumbra_sched_journal_places(',
                        array('J-end', 'J-state', 'J-mid', 'J-hidden', 'J-who-first', 'J-hidden-anchor', 'J-hidden-prev', 'J-old-hash', 'J-names', 'J-tag', 'J-page', 'J-model')),
    'jp-stateres' => array('schedule_runner.php', '$_jRes = (isset($state[\'journalToggleResolver\']) && is_array($state[\'journalToggleResolver\'])) ? $state[\'journalToggleResolver\']', '$_jRes = false ? null',
                        array('J-state')),
    'jp-hiddendata' => array('schedule_runner.php', 'if ($i === false) { $i = $after + 1; array_splice($row, $i, 0, array($n)); $gone[] = $n; }', 'if ($i === false) continue;',
                        array('J-hidden-anchor', 'J-vc-empty', 'J-model')),
    'jp-hash'     => array('schedule_runner.php', 'if ($x === \'#\') break;   // an old save\'s: right after it, first', '',
                        array('J-old-hash', 'J-model')),
    'jp-hide'     => array('schedule_runner.php', 'if ($vc !== null && !in_array($pn, $vc, true)) $gone[] = $j;', '',
                        array('J-hidden', 'J-hidden-prev', 'J-page', 'J-model')),
    'jp-prev'     => array('schedule_runner.php', 'if ($prev !== null) $at = array_search($prev, $row, true) + 1;', '',
                        array('J-who-first', 'J-hidden-anchor', 'J-hidden-prev', 'J-old-hash', 'J-lead', 'J-vc-empty', 'J-names', 'J-tag', 'J-model')),
    'jp-janchor'  => array('schedule_runner.php', 'if ($n === null && is_string($x) && isset($byPage[$x])) $n = $byPage[$x];', '',
                        array('J-end', 'J-state', 'J-mid', 'J-hidden', 'J-who-first', 'J-page', 'J-model')),
    'jp-first'    => array('schedule_runner.php', 'while (--$k >= 0) {', 'if ($prev !== null) $at = array_search($prev, $row, true) + 1; while (--$k >= 0) {',
                        array('J-who-first', 'J-old-hash', 'J-page', 'J-model')),
    'jp-tagguard' => array('schedule_runner.php', 'return (isset($page[$n]) || in_array($n, $journal, true)) ? null : $n;', 'return isset($page[$n]) ? null : $n;',
                        array('J-tag')),
    'jp-vcempty'  => array('schedule_runner.php', 'is_array($state[\'visibleColumns\']) && $state[\'visibleColumns\']) ?', 'is_array($state[\'visibleColumns\'])) ?',
                        array('J-vc-empty')),
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
        if ($mf === 'schedule_runner.php') $files[$mf] = file_get_contents($GLOBALS['RUNNER_PATH']);   // (round 8) the child reads this copy
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

    // J: ...or where the report's saved layout has them (round 8, 2026-10-26 jrnplace), as the page now opens them
    // for a viewer without a layout of their own (main.js savedAnchorFor / reportLayoutFor / savedHidden): one the
    // saved columnOrder names goes right after the nearest column before it there that the page's header holds (a
    // data column, hidden ones too, or a journal column painted before it), else first; one it does not name follows
    // the one painted before it, or leads; one it names that the saved visibleColumns leaves out is left out.
    // Through apply_state_logic, with the task's resolver as a run sets it (_snippet_journal_toggles) or as a
    // reprocessing hands it on ($state['journalToggleResolver']).
    $f5 = $lift($runner, 'penumbra_sched_journal_places'); $f6 = $lift($runner, '_snippet_journal_toggles');
    if ($f5 && !function_exists('penumbra_sched_journal_places')) eval($f5);
    if ($f6 && !function_exists('_snippet_journal_toggles')) eval($f6);
    $A('J-lifted', function_exists('penumbra_sched_journal_places') && function_exists('_snippet_journal_toggles'), 'the helper + the task resolver lifted from the runner');
    if (!function_exists('pnb_layout_state_here') && getenv('PNB_LAYOUT') && is_file(getenv('PNB_LAYOUT'))) require_once getenv('PNB_LAYOUT');
    $setRes = function ($r) { if (function_exists('_snippet_journal_toggles')) _snippet_journal_toggles($r); };
    // the run's own resolver and rows: two toggles with their who / when columns, and the Notes column
    db_reset(); $GLOBALS['DB']['notes'] = std_notes();
    $GLOBALS['DB']['toggles'] = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'P-1', 'UPDATED_BY' => 'pat', 'UPDATED_ON' => '2026-10-01'));
    $jRows = data_rows();
    $jJt = journalExportToggleColumns('rpt', vo(array('journalToggleWho' => true,
        'journalToggles' => array(array('key' => 'done', 'label' => 'Done'), array('key' => 't2', 'label' => 'Taken')))), $jRows);
    $jRes = $jJt['resolver'];
    $jScreen = (function_exists('penumbra_sched_journal_screen_order') && is_array($jRes))
        ? penumbra_sched_journal_screen_order($jRes, array_merge($jJt['colNames'], $jJt['whoNames'])) : array();
    $JS = array('DONE', 'DONE BY', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', 'NOTES');
    $A('J-fixture', $jScreen === $JS && count(array_intersect($JS, array_keys($jRows[0]))) === 7,
       'the run hands over ' . json_encode($jScreen) . ' | its rows ' . json_encode(array_keys($jRows[0])));
    $P = 'PROPOSAL ID'; $T = 'TITLE'; $M = 'AMOUNT'; $jN = '__JOURNAL_NOTES';
    $jT = function ($k) { return '__JOURNAL_TOGGLE__' . $k; }; $jB = function ($k) { return '__JOURNAL_BY__' . $k; };
    $jO = function ($k) { return '__JOURNAL_ON__' . $k; };
    $allJ = array($jT('done'), $jB('done'), $jO('done'), $jT('t2'), $jB('t2'), $jO('t2'), $jN);
    // $how: 'run' (the static a run sets), 'state' (a reprocessing's $state), 'none' (no resolver). The columns handed
    // over: the run's list as J-fixture has it ($JS), so a journal_export.php mutant reddens J-fixture alone.
    $jCase = function ($id, $st, $want, $how = 'run', $rows = null, $keep = null) use ($A, $runAsl, $setRes, $jRows, $JS, $jRes) {
        $setRes($how === 'run' ? $jRes : false);
        if ($how === 'state') $st['journalToggleResolver'] = $jRes;
        $out = function_exists('apply_state_logic') ? $runAsl($rows === null ? $jRows : $rows, $st, $keep === null ? $JS : $keep) : array('error' => 'apply_state_logic not loaded');
        $setRes(false);
        $got = (is_array($out) && isset($out['data'][0]) && is_array($out['data'][0])) ? array_map('strval', array_keys($out['data'][0])) : array('ERROR ' . (isset($out['error']) ? $out['error'] : json_encode($out)));
        $A($id, $got === $want, implode(', ', $got) . ($got === $want ? '' : '   | want ' . implode(', ', $want)));
    };
    $lead = array('DONE', 'DONE BY', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', 'NOTES');
    // the user's report (2026-10-26): Notes moved to the end and saved; the toggles where they were
    $stEnd = array('columnOrder' => array_merge(array_slice($allJ, 0, 6), array(0, 1, 2, $jN)), 'visibleColumns' => array_merge(array('#'), $allJ, array(0, 1, 2)));
    $wEnd = array('DONE', 'DONE BY', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', $P, $T, $M, 'NOTES');
    $jCase('J-end', $stEnd, $wEnd);
    $jCase('J-state', $stEnd, $wEnd, 'state');
    $jCase('J-nores', $stEnd, array_merge($lead, array($P, $T, $M)), 'none');
    // a toggle and its who / when columns moved between two data columns; Notes right after the first toggle's
    $jCase('J-mid', array('columnOrder' => array($jT('done'), $jB('done'), $jO('done'), $jN, 0, 1, $jT('t2'), $jB('t2'), $jO('t2'), 2),
                          'visibleColumns' => array_merge(array('#', 0, 1, 2), $allJ)),
        array('DONE', 'DONE BY', 'DONE ON', 'NOTES', $P, $T, 'TAKEN', 'TAKEN BY', 'TAKEN ON', $M));
    // a toggle hidden with its who / when columns, Notes at the end
    $jCase('J-hidden', array('columnOrder' => array_merge(array_slice($allJ, 0, 6), array(0, 1, 2, $jN)),
                             'visibleColumns' => array('#', $jT('done'), $jB('done'), $jO('done'), 0, 1, 2, $jN)),
        array('DONE', 'DONE BY', 'DONE ON', $P, $T, $M, 'NOTES'));
    // a who column saved before its toggle goes first, not after the toggle; the columns the save did not name
    // (turned on since) follow the one painted before them
    $jCase('J-who-first', array('columnOrder' => array($jB('done'), 0, $jT('done'), $jO('done'), 1, 2),
                                'visibleColumns' => array('#', $jB('done'), 0, $jT('done'), $jO('done'), 1, 2)),
        array('DONE BY', $P, 'DONE', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', 'NOTES', $T, $M));
    // Notes saved after a HIDDEN data column: right after it on the page (its heading is in the row), so after the
    // columns painted after the toggle before it - not right after that toggle
    $jCase('J-hidden-anchor', array('columnOrder' => array(0, $jT('done'), 1, $jN, 2), 'visibleColumns' => array('#', 0, $jT('done'), $jN, 2)),
        array($P, 'DONE', 'DONE BY', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', 'NOTES', $M));
    // a HIDDEN toggle at the end: the columns painted after it follow it there
    $jCase('J-hidden-prev', array('columnOrder' => array(0, 1, 2, $jT('done')), 'visibleColumns' => array('#', 0, 1, 2)),
        array($P, $T, $M, 'DONE BY', 'DONE ON', 'TAKEN', 'TAKEN BY', 'TAKEN ON', 'NOTES'));
    // an old save's '#' in the order: right after it is first, ahead of the columns painted there before it
    $jCase('J-old-hash', array('columnOrder' => array(0, '#', $jN, 1, 2), 'visibleColumns' => array('#', 0, 1, 2, $jN)),
        array_merge(array('NOTES'), array_slice($lead, 0, 6), array($P, $T, $M)));
    // none named: they lead, in the page's order, as before
    $jCase('J-lead', array('columnOrder' => array(2, 0, 1), 'visibleColumns' => array('#', 0, 1, 2)), array_merge($lead, array($M, $P, $T)));
    // an empty visibleColumns is none (main.js _pnbLayoutOf): Notes stays, though the data columns are all hidden
    $jCase('J-vc-empty', array('columnOrder' => array(0, $jN, 1, 2), 'visibleColumns' => array()), $lead);
    // by name (ldlayout): the SQL put TITLE first since the save; Notes stays after TITLE
    $jRows2 = array();
    foreach ($jRows as $r) { $o = array($T => $r[$T]); foreach ($r as $k => $v) if ($k !== $T) $o[$k] = $v; $jRows2[] = $o; }
    $jCase('J-names', array('layoutColumnNames' => array($P, $T, $M), 'columnOrder' => array(0, 1, $jN, 2), 'visibleColumns' => array('#', 0, 1, 2, $jN)),
        array_merge(array_slice($lead, 0, 6), array($P, $T, 'NOTES', $M)), 'run', $jRows2);
    // a caller's own column handed on with the journal's (a test's tag) that a saved place points at is kept
    $jRows3 = array();
    foreach ($jRows as $i => $r) { $r['ZTAG'] = (string)$i; $jRows3[] = $r; }
    $tagAt = array_search('ZTAG', array_keys($jRows3[0]), true);
    $jCase('J-tag', array('columnOrder' => array(0, 1, 2, $tagAt, $jN), 'visibleColumns' => array('#', 0, 1, 2, $jN)),
        array_merge(array_slice($lead, 0, 6), array($P, $T, $M, 'NOTES', 'ZTAG')), 'run', $jRows3, array_merge($JS, array('ZTAG')));

    // J-page: the layouts penumbra_tests\jrnplace opens in the page (harness.html, the staged main.js) and the order it
    // shows them in there (driver.js shownNow: '#' left out) - the same columns in a scheduled output. BASE: the six V_
    // columns shown, the H_ ones hidden; Notes, and the toggle k1 ("Done") with its who / when columns.
    $BASE = array('V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_TEXT', 'H_NUM', 'H_MONEY', 'H_DATE', 'H_HTML',
                  'H_JSON', 'H_ENT', 'H_NL', 'H_NULL', 'H_GROUP', 'H_GROUP2', 'H_AMT', 'H_FLAG', 'H_CODE');
    $pgT = '__JOURNAL_TOGGLE__k1'; $pgB = '__JOURNAL_BY__k1'; $pgO = '__JOURNAL_ON__k1';
    $ORD = array_merge(array(2, 0, 1), range(3, 19)); $VIS = array('#', 2, 0, 1, 3, 4, 5);
    $V = array('V_AMOUNT', 'V_ID', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS');
    $pgRes = array('colMeta' => array(), 'whoMeta' => array(), 'notesName' => 'NOTES');
    $pgResT = array('colMeta' => array(array('name' => 'DONE', 'key' => 'k1')), 'notesName' => 'NOTES',
                    'whoMeta' => array(array('name' => 'DONE BY', 'key' => 'k1', 'kind' => 'by'), array('name' => 'DONE ON', 'key' => 'k1', 'kind' => 'on')));
    $PG = array(   // scenario => [toggle, the result's columns now, columnOrder, visibleColumns, the page's shown order]
        'repend'   => array(false, $BASE, array_merge($ORD, array($jN)), array_merge($VIS, array($jN)), array_merge($V, array('NOTES'))),
        'repmid'   => array(true, array_merge(array('V_NEW'), $BASE), array_merge(array(2, 0, $jN, 1), range(3, 19), array($pgT, $pgB, $pgO)),
                            array_merge($VIS, array($jN, $pgT, $pgB, $pgO)), array('V_AMOUNT', 'V_ID', 'NOTES', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS', 'DONE', 'DONE BY', 'DONE ON')),
        'rephid'   => array(false, $BASE, array_merge($ORD, array($jN)), $VIS, $V),
        'repnone'  => array(false, $BASE, $ORD, $VIS, array_merge(array('NOTES'), $V)),
        'repfirst' => array(false, $BASE, array_merge(array($jN), $ORD), array_merge($VIS, array($jN)), array_merge(array('NOTES'), $V)),
        'tgend'    => array(true, $BASE, array_merge(array($jN), $ORD, array($pgT, $pgB, $pgO)), array_merge($VIS, array($jN, $pgT, $pgB, $pgO)),
                            array_merge(array('NOTES'), $V, array('DONE', 'DONE BY', 'DONE ON'))),
        'tghid'    => array(true, $BASE, array_merge(array($pgB, $pgO, $pgT, $jN), $ORD), array_merge($VIS, array($pgT, $jN)), array_merge(array('DONE', 'NOTES'), $V)),
    );
    $pgBad = array();
    foreach ($PG as $scn => $c) {
        list($tg, $cols, $co, $vc, $want) = $c;
        $keep = $tg ? array('DONE', 'DONE BY', 'DONE ON', 'NOTES') : array('NOTES');
        $row = array();
        foreach ($cols as $cn) $row[$cn] = 'v';
        foreach ($keep as $j) $row[$j] = 'j';
        $setRes($tg ? $pgResT : $pgRes);
        $out = function_exists('apply_state_logic') ? $runAsl(array($row), array('columnOrder' => $co, 'visibleColumns' => $vc, 'layoutColumnNames' => $BASE), $keep) : null;
        $setRes(false);
        $got = (is_array($out) && isset($out['data'][0]) && is_array($out['data'][0])) ? array_map('strval', array_keys($out['data'][0])) : array('ERROR');
        if ($got !== $want) $pgBad[] = "$scn: " . implode(', ', $got) . ' | the page: ' . implode(', ', $want);
    }
    $A('J-page', !$pgBad, $pgBad ? implode(' || ', $pgBad) : count($PG) . ' of the jrnplace page layouts, each in the order the page shows it');

    // J-model: random saved layouts against a model of the page's header row (main.js paintJournalTable -> placeHead
    // -> savedAnchorFor): '#' first, then every data column in the saved order, hidden ones too; each journal heading
    // painted in the page's order right after its anchor (named: the nearest heading before it in the saved order
    // that the row holds, else '#'; not named: the one painted before it, else '#'); the shown ones, less '#'.
    mt_srand(20261026);
    $shuf = function ($a) { for ($i = count($a) - 1; $i > 0; $i--) { $j = mt_rand(0, $i); $t = $a[$i]; $a[$i] = $a[$j]; $a[$j] = $t; } return $a; };
    $bad = array(); $runs = 0; $moved = 0;
    for ($case = 0; $case < 400 && function_exists('apply_state_logic') && function_exists('penumbra_sched_journal_screen_order'); $case++) {
        $nd = mt_rand(2, 5); $data = array();
        for ($i = 0; $i < $nd; $i++) $data[] = 'C' . $i;
        $nt = mt_rand(1, 2); $who = mt_rand(0, 1) === 1; $notes = mt_rand(0, 2) > 0;
        $res = array('colMeta' => array(), 'whoMeta' => array(), 'notesName' => $notes ? 'NOTES' : null);
        $pn = array();   // output name => page name
        for ($t = 1; $t <= $nt; $t++) {
            $res['colMeta'][] = array('name' => 'T' . $t, 'key' => 'k' . $t); $pn['T' . $t] = '__JOURNAL_TOGGLE__k' . $t;
            if ($who) foreach (array('by' => ' BY', 'on' => ' ON') as $kd => $sx) {
                $res['whoMeta'][] = array('name' => 'T' . $t . $sx, 'key' => 'k' . $t, 'kind' => $kd);
                $pn['T' . $t . $sx] = ($kd === 'by' ? '__JOURNAL_BY__k' : '__JOURNAL_ON__k') . $t;
            }
        }
        if ($notes) $pn['NOTES'] = '__JOURNAL_NOTES';
        $screen = penumbra_sched_journal_screen_order($res, array_keys($pn));
        $row = array();
        foreach ($data as $d) $row[$d] = 'v';
        foreach ($screen as $j) $row[$j] = 'j';
        $co = range(0, $nd - 1);
        foreach ($pn as $p) if (mt_rand(0, 3) > 0) $co[] = $p;
        if (mt_rand(0, 4) === 0) $co[] = '__JOURNAL_TOGGLE__gone';   // a toggle the report no longer has
        if (mt_rand(0, 9) === 0) $co[] = '#';                        // an old save's
        $co = $shuf($co);
        $vc = array('#');
        for ($i = 0; $i < $nd; $i++) if (mt_rand(0, 3) > 0) $vc[] = $i;
        foreach ($pn as $p) if (mt_rand(0, 3) > 0) $vc[] = $p;
        $vc = $shuf($vc);
        // the model
        $hdr = array('#');
        foreach ($co as $x) if (is_int($x)) $hdr[] = 'D' . $x;
        $prevH = '#'; $hid = array();
        foreach ($screen as $j) {
            $p = $pn[$j]; $k = array_search($p, $co, true); $anchor = $prevH;
            if ($k !== false) {
                $anchor = '#';
                for ($i = $k - 1; $i >= 0; $i--) {
                    $e = $co[$i];
                    if ($e === '#') break;
                    if (is_int($e)) { $anchor = 'D' . $e; break; }
                    if (in_array('J' . $e, $hdr, true)) { $anchor = 'J' . $e; break; }
                }
                if (!in_array($p, $vc, true)) $hid[$j] = true;
            }
            array_splice($hdr, array_search($anchor, $hdr, true) + 1, 0, array('J' . $p));
            $prevH = 'J' . $p;
        }
        $want = array();
        foreach ($hdr as $h) {
            if ($h === '#') continue;
            if ($h[0] === 'D') { $d = (int)substr($h, 1); if (in_array($d, $vc, true)) $want[] = $data[$d]; continue; }
            $j = array_search(substr($h, 1), $pn, true);
            if (!isset($hid[$j])) $want[] = $j;
        }
        $leadWant = array();
        foreach ($screen as $j) $leadWant[] = $j;
        foreach ($co as $x) if (is_int($x) && in_array($x, $vc, true)) $leadWant[] = $data[$x];
        if ($want !== $leadWant) $moved++;
        $setRes($res);
        $out = $runAsl(array($row), array('columnOrder' => $co, 'visibleColumns' => $vc), $screen);
        $setRes(false);
        $got = (is_array($out) && isset($out['data'][0]) && is_array($out['data'][0])) ? array_map('strval', array_keys($out['data'][0])) : array('ERROR');
        $runs++;
        if ($got !== $want && count($bad) < 2) $bad[] = json_encode(array('co' => $co, 'vc' => $vc, 'got' => $got, 'want' => $want));
        elseif ($got !== $want) $bad[] = '';
    }
    $A('J-model', $runs === 400 && !$bad && $moved > 100, "$runs random layouts, $moved of them not the old lead order; " . count($bad) . ' differ from the page model' . ($bad ? ': ' . implode(' | ', array_filter($bad)) : ''));
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
    'M-lifted', 'M-br', 'M-cleared', 'M-wired', 'O-lifted', 'O-order', 'O-order-null', 'O-lead', 'O-none', 'O-wired',
    'J-lifted', 'J-fixture', 'J-end', 'J-state', 'J-nores', 'J-mid', 'J-hidden', 'J-who-first', 'J-hidden-anchor', 'J-hidden-prev',
    'J-old-hash', 'J-lead', 'J-vc-empty', 'J-names', 'J-tag', 'J-page', 'J-model');

function run_build_child($files, $flatOut = null) {
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_notescol_' . getmypid() . '_' . mt_rand(1000, 9999);
    if (!preg_match('/pnb_notescol_\d+_\d{4}$/', $dir)) { fwrite(STDERR, "bad temp dir\n"); exit(2); }
    mkdir($dir);
    file_put_contents($dir . '/journal_export.php', $files['journal_export.php']);
    $eb = lift_edit_action($files['manage_journal.php']);
    if ($eb !== null) file_put_contents($dir . '/edit.txt', $eb);
    // (round 8) a runner mutant: the child reads the mutated copy
    $runner = $GLOBALS['RUNNER_PATH'];
    if (isset($files['schedule_runner.php'])) { $runner = $dir . '/schedule_runner.php'; file_put_contents($runner, $files['schedule_runner.php']); }
    $php = PHP_BINARY;
    $cmd = '"' . $php . '" -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring "' . __FILE__ . '"';
    $env = array('PNB_SEARCH' => $GLOBALS['SEARCH_PATH'], 'PNB_RUNNER' => $runner, 'PNB_LAYOUT' => $GLOBALS['LAYOUT_PATH'], 'PNB_NOTESCOL_CHILD' => $dir, 'PNB_FLAT_OUT' => (string)$flatOut, 'SystemRoot' => getenv('SystemRoot'), 'TEMP' => getenv('TEMP'), 'TMP' => getenv('TMP'));
    $p = proc_open($cmd, array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes, null, $env);
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    foreach (array('journal_export.php', 'edit.txt', 'schedule_runner.php') as $f) if (file_exists($dir . '/' . $f)) unlink($dir . '/' . $f);
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
