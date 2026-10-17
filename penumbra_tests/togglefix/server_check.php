<?php
// togglefix suite - server half (2026-10-07). Round A of the toggle sweep, checked on
// the PHP files under test WITHOUT running them as pages: manage_journal.php and
// manage_snapshots.php connect to Oracle and answer HTTP, and schedule_runner.php
// SENDS EMAIL (never require it). Functions and code blocks are lifted out by brace
// matching and RUN against fakes; journal_export.php (functions only) is required.
// Prints ONE JSON object: { asserts: [{id, ok, detail}] }.
//   php -n server_check.php <dir with journal_export.php, manage_journal.php,
//                            manage_snapshots.php, schedule_runner.php>
//   S-case-*   toggle key columns matched by the row's own (any-case) names
//   S-sid-* / S-snap-*  an all-digit SHORT_ID is a short id first
//   S-gate-*   the six journal reads refuse a plain viewer while the journal is off
//   S-tg-* / S-sched-* / S-dd-*  scheduled sends: grouped and pivot reports carry
//              the toggles, one state read, Checked / Unchecked bands, DB dumps
error_reporting(E_ALL & ~E_DEPRECATED);
$dir = isset($argv[1]) ? rtrim($argv[1], '/\\') : '';
// 'a' = Round A's checks, 'b' = Round B's (the no-op toggle writes), anything else = both.
$mode = isset($argv[2]) ? $argv[2] : 'all';
$RUN_A = ($mode === 'a' || $mode === 'all');
$RUN_B = ($mode === 'b' || $mode === 'all');
$RUN_D = ($mode === 'd' || $mode === 'all');   // Round D (2026-10-08): Toggle History
$RUN_E = ($mode === 'e' || $mode === 'all');   // Round E (2026-10-08): the sweep's items 1-7
$RUN_F = ($mode === 'f' || $mode === 'all');   // Round F (2026-10-08): the toggle write rules
$RUN_G = ($mode === 'g' || $mode === 'all');   // Round G (2026-10-08): the smaller leftovers
$RUN_I = ($mode === 'i' || $mode === 'all');   // Round I (2026-10-08): the who and when columns
$RUN_M = ($mode === 'm' || $mode === 'all');   // Round M (2026-10-08): safe renames
$RUN_N = ($mode === 'n');                       // Round N (2026-10-08): key changes - its OWN fakes (in-memory journal): never with 'all'
$RUN_O = ($mode === 'o');                       // Round O (2026-10-09): accented toggle names - its OWN fakes, mbstring loaded: never with 'all'
$RUN_Q = ($mode === 'q');                       // Round Q (2026-10-09): the toggle columns' consumers - the real resolver + search engine, mbstring: never with 'all'
$RUN_U = ($mode === 'u');                       // Round U (2026-10-09): the note delete rule + one person's share - mode n / p's fakes: never with 'all'
$RUN_T = ($mode === 't');                       // Round T (2026-10-09): the search engine + scheduler fixes - mode q's fakes, mbstring: never with 'all'
$RUN_P = ($mode === 'p');                       // Round P (2026-10-09): the close-out bug sweep - mode n's fakes, mbstring loaded: never with 'all'
$RUN_V = ($mode === 'v');                       // Round V (2026-10-09): ROW_KEY widened to 1500 - mode n's fakes, mbstring loaded: never with 'all'
$OUT = array();
function rec($id, $ok, $detail) { global $OUT; $OUT[] = array('id' => $id, 'ok' => (bool)$ok, 'detail' => (string)$detail); }
function src($name) {
    global $dir;
    $s = @file_get_contents($dir . DIRECTORY_SEPARATOR . $name);
    return ($s === false) ? '' : str_replace("\r\n", "\n", $s);
}
// The text of the brace block that opens at the first '{' at/after $from.
function braceBlock($s, $from) {
    $b = strpos($s, '{', $from);
    if ($b === false) return null;
    $depth = 0;
    for ($i = $b, $n = strlen($s); $i < $n; $i++) {
        $c = $s[$i];
        if ($c === '{') $depth++;
        elseif ($c === '}') { $depth--; if ($depth === 0) return array($b, $i); }
    }
    return null;
}
// A column-0 function, optionally renamed (so a fake can take the real name).
function liftFn($s, $name, $as = null) {
    $a = strpos($s, "\nfunction " . $name . '(');
    if ($a === false) return null;
    $bb = braceBlock($s, $a);
    if (!$bb) return null;
    $code = substr($s, $a + 1, $bb[1] - $a);
    if ($as !== null) $code = preg_replace('/^function ' . preg_quote($name, '/') . '\(/', 'function ' . $as . '(', $code);
    return $code;
}
function defineLifted($s, $name, $as = null) {
    $code = liftFn($s, $name, $as);
    if ($code === null) return false;
    try { eval($code); } catch (Throwable $e) { return false; }
    return true;
}

$mj = src('manage_journal.php');
$ms = src('manage_snapshots.php');
$sr = src('schedule_runner.php');
// Round T (2026-10-09): the condition helpers _snippet_filter_rows / lookup() call, lifted up front for every mode that
// cuts those two out of the runner by name (a build without them lifts nothing).
foreach (array('_snippet_tree_reads_journal', '_snippet_tree_reads_names') as $tfn) {
    if (!function_exists($tfn) && strpos($sr, "\nfunction " . $tfn . '(') !== false) defineLifted($sr, $tfn);
}
$jePath = $dir . DIRECTORY_SEPARATOR . 'journal_export.php';

// ---------------------------------------------------------------- fakes
$GLOBALS['QLOG'] = array();
$GLOBALS['JX'] = array('cols' => 0, 'res' => 0);
// Reports 7 (journal OFF), 8 (ON), 9 (ENCRYPTED); viewer1 is on each one's access
// list but neither owner nor admin; owner1 owns them all.
$GLOBALS['REPORTS'] = array(
    7 => array('ID' => 7, 'SHORT_ID' => 'jroff', 'TITLE' => 'Off', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1'),
    8 => array('ID' => 8, 'SHORT_ID' => 'jron', 'TITLE' => 'On', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1'),
    9 => array('ID' => 9, 'SHORT_ID' => 'jrenc', 'TITLE' => 'Encrypted', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1'),
    // Round F: journal on, the single toggle of old (no journalToggles list).
    10 => array('ID' => 10, 'SHORT_ID' => 'jrleg', 'TITLE' => 'Legacy toggle', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1'),
    // Round G: two labelled columns on a two-part key; an EMPTY list beside the single toggle of old.
    11 => array('ID' => 11, 'SHORT_ID' => 'jrlab', 'TITLE' => 'Labelled', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1'),
    12 => array('ID' => 12, 'SHORT_ID' => 'jrmix', 'TITLE' => 'Empty list', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1'),
);
$GLOBALS['RID_BY_SID'] = array('jroff' => 7, 'jron' => 8, 'jrenc' => 9, 'jrleg' => 10, 'jrlab' => 11, 'jrmix' => 12);
$GLOBALS['STATES'] = array(
    7 => '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalKeyColumns":["ID"]}}',
    8 => '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalKeyColumns":["ID"],"journalToggles":[{"key":"done","label":"Done"}]}}',
    10 => '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalKeyColumns":["ID"],"journalToggle":true}}',
    9 => '{"encrypted":true,"content":"U2FsdGVkX19vcGFxdWU="}',
    11 => '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalKeyColumns":["Protocol No.","Protocol Type"],"journalToggles":[{"key":"toggle1","label":"Reviewed"},{"key":"toggle2","label":"Sent"}]}}',
    12 => '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalKeyColumns":["ID"],"journalToggles":[],"journalToggle":{"label":"Checked"}}}',
);
$allowedUsers = array('appadmin');
$config = null;
function journalGetReport($conn, $id) {
    $R = $GLOBALS['REPORTS'];
    if (is_int($id)) return isset($R[$id]) ? $R[$id] : null;
    $m = $GLOBALS['RID_BY_SID']; $sid = trim((string)$id);
    return isset($m[$sid]) ? $R[$m[$sid]] : null;
}
function journalCallerCanView() { return true; }
function readClobViaOci8($t, $c, $k, $id) { return isset($GLOBALS['STATES'][(int)$id]) ? $GLOBALS['STATES'][(int)$id] : ''; }
function queryViaOci8($sql, $binds = array()) {
    // Round D: a scenario's own answer, when it has one (null = fall through).
    if (isset($GLOBALS['QFAKE']) && is_callable($GLOBALS['QFAKE'])) {
        $GLOBALS['QSEEN'][] = array('sql' => $sql, 'binds' => $binds);
        $ans = call_user_func($GLOBALS['QFAKE'], $sql, $binds);
        if ($ans !== null) return $ans;
    }
    // Round B's read-back of one toggle row (journalToggleCurrent): scripted.
    if (strpos($sql, 'SELECT STATE, UPDATED_BY') !== false) return isset($GLOBALS['CUR_ROWS']) ? $GLOBALS['CUR_ROWS'] : array();
    $GLOBALS['QLOG'][] = $sql;
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ID = :nid') !== false && strpos($sql, 'ATTACH_NAME') !== false) {
        return array(array('REPORT_ID' => $GLOBALS['ATTACH_RID'], 'ATTACH_NAME' => 'a.txt', 'ATTACH_MIME' => 'text/plain', 'ATTACH_SIZE' => 3));
    }
    return array();
}
// Round P (2026-10-09): the streamed read (db_connection.php's queryViaOci8Each), through the fake above.
function queryViaOci8Each($sql, $binds, $cb) { foreach ((array)queryViaOci8($sql, $binds) as $r) $cb($r); }
function penumbraIsReportOwner($owner, $uid) { return strcasecmp(trim((string)$owner), trim((string)$uid)) === 0; }
function journalHasAttachColumn() { return true; }
function journalHasParentColumn() { return true; }
function journalSanitizeToggleKey($k) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string)$k)); }
function utf8ize($x) { return $x; }
function log_scheduler($m) { }
// Scheduler: the two journal_export entry points the toggle block calls, counted.
function sxResolver() {
    return array('colNames' => array('DONE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')),
                 'keyUpper' => array('ID'), 'stateMap' => array('done' => array()));
}
function journalExportToggleColumns($shortId, $state, &$rows) {
    $GLOBALS['JX']['cols']++;
    foreach ($rows as $i => $r) $rows[$i]['DONE'] = '0';
    // whoNames (Round I): what the build's resolver hands back beside colNames when a scenario asks.
    return array('colNames' => array('DONE'), 'whoNames' => isset($GLOBALS['JX_WHO']) ? $GLOBALS['JX_WHO'] : array(),
                 'rowsDecorated' => count($rows), 'resolver' => sxResolver());
}
function journalExportToggleResolver($shortId, $state, $existing = array()) { $GLOBALS['JX']['res']++; return sxResolver(); }
// The level spec's helpers (only the plain, unsplit path is exercised).
function pivot_parse_field_token($t) { return array('split' => null, 'base' => trim((string)$t), 'binWidth' => null, 'binEdges' => null); }
function get_custom_sort_comparator($c, $k) { return function ($a, $b) { return 0; }; }
function pivot_split_comparator($s, $k, $c) { return function ($a, $b) { return 0; }; }
// PDO for the id lookups: report 2025 is "other"; report 99's SHORT_ID is "2025".
$GLOBALS['PDO_REPORTS'] = array(
    array('ID' => 2025, 'SHORT_ID' => 'other', 'TITLE' => 'Other', 'OWNER_ID' => 'x', 'AUTHORIZED' => ''),
    array('ID' => 99, 'SHORT_ID' => '2025', 'TITLE' => 'Digits', 'OWNER_ID' => 'x', 'AUTHORIZED' => ''),
    array('ID' => 7, 'SHORT_ID' => 'jrfix', 'TITLE' => 'Fixture', 'OWNER_ID' => 'x', 'AUTHORIZED' => ''),
);
class FakeStmt {
    public $sql; public $b = array(); public $rows = array();
    function __construct($sql) { $this->sql = $sql; }
    function bindValue($k, $v, $t = null) { $this->b[$k] = $v; return true; }
    function bindParam($k, &$v, $t = null) { $this->b[$k] = $v; return true; }
    function execute($p = null) {
        if (is_array($p)) foreach ($p as $k => $v) $this->b[(strpos($k, ':') === 0 ? $k : ':' . $k)] = $v;
        $this->rows = array();
        foreach ($GLOBALS['PDO_REPORTS'] as $r) {
            if (strpos($this->sql, 'WHERE ID = :rid') !== false && isset($this->b[':rid']) && (int)$r['ID'] === (int)$this->b[':rid']) $this->rows[] = $r;
            if (strpos($this->sql, 'TRIM(SHORT_ID) = :sid') !== false && isset($this->b[':sid']) && trim($r['SHORT_ID']) === (string)$this->b[':sid']) $this->rows[] = $r;
        }
        return true;
    }
    function fetch($m = null) { return $this->rows ? array_shift($this->rows) : false; }
    function fetchColumn($i = 0) { $r = $this->fetch(); return $r ? array_values($r)[$i] : false; }
}
class FakePDO { function prepare($sql) { return new FakeStmt($sql); } }

// ------------------------------------------- journal_export.php: key column case
if ($RUN_A) {
if (is_file($jePath)) {
    require $jePath;
    $res1 = array('keyUpper' => array('PROPOSAL ID'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')),
                  'stateMap' => array('done' => array('P-1' => array('by' => 'pat'))));
    $sep = "\xE2\x90\x9F";
    $res2 = array('keyUpper' => array('PROTOCOL NO.', 'PROTOCOL TYPE'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')),
                  'stateMap' => array('done' => array('25403' . $sep . 'Exempt' => array('by' => 'pat'))));
    $v = function ($res, $row) { $o = journalExportToggleRowValues($res, $row); return isset($o['DONE']) ? $o['DONE'] : '(none)'; };
    $c1 = $v($res1, array('Proposal ID' => 'P-1', 'Title' => 'x'));
    $c2 = $v($res1, array('proposal id' => 'P-1'));
    $c3 = $v($res2, array('Protocol No.' => '25403', 'Protocol Type' => 'Exempt'));
    $c4 = $v($res1, array('Proposal ID' => 'P-2'));
    rec('S-case-row', $c1 === '1' && $c2 === '1' && $c3 === '1' && $c4 === '0',
        '"Proposal ID"=P-1 -> ' . $c1 . ', "proposal id"=P-1 -> ' . $c2 . ', "Protocol No."+"Protocol Type" -> ' . $c3 . ', unmarked P-2 -> ' . $c4);
    $c5 = $v($res1, array('PROPOSAL ID' => 'P-1'));
    rec('S-case-caps', $c5 === '1', 'all-caps alias -> ' . $c5);
} else {
    rec('S-case-row', false, 'no journal_export.php in ' . $dir);
    rec('S-case-caps', false, 'no journal_export.php in ' . $dir);
}

// ------------------------------------------- the id lookups (journal + snapshots)
$pdo = new FakePDO();
$idOf = function ($r) { return is_array($r) ? (int)$r['ID'] : ($r === null ? 'null' : var_export($r, true)); };
if (defineLifted($mj, 'journalGetReport', 'ut_journalGetReport')) {
    $g = function ($x) use ($pdo, $idOf) { return $idOf(ut_journalGetReport($pdo, $x)); };
    $d = $g('2025');
    rec('S-sid-digits', $d === 99, 'short id "2025" -> report ' . $d . ' (99 has that short id; 2025 is another report\'s internal ID)');
    $s = array('int 2025' => $g(2025), '"7"' => $g('7'), '"jrfix"' => $g('jrfix'), '""' => $g(''), '"nope"' => $g('nope'));
    rec('S-sid-sane', $s['int 2025'] === 2025 && $s['"7"'] === 7 && $s['"jrfix"'] === 7 && $s['""'] === 'null' && $s['"nope"'] === 'null', json_encode($s));
} else {
    rec('S-sid-digits', false, 'journalGetReport not found'); rec('S-sid-sane', false, 'journalGetReport not found');
}
if (defineLifted($ms, 'resolveReportId', 'ut_resolveReportId')) {
    $r = function ($x) use ($pdo) { $v = ut_resolveReportId($pdo, $x); return $v === null ? 'null' : $v; };
    $d = $r('2025');
    rec('S-snap-digits', $d === 99, 'short id "2025" -> report ' . var_export($d, true));
    $s = array('"7"' => $r('7'), '"jrfix"' => $r('jrfix'), '""' => $r(''), 'int 7' => $r(7));
    rec('S-snap-sane', $s['"7"'] === 7 && $s['"jrfix"'] === 7 && $s['""'] === 'null' && $s['int 7'] === 7, json_encode($s));
} else {
    rec('S-snap-digits', false, 'resolveReportId not found'); rec('S-snap-sane', false, 'resolveReportId not found');
}

// ------------------------------------------- the six journal reads, run for real
foreach (array('journalReportStateFlags', 'journalReportJournalEnabled', 'journalTargetCanOpenJournal', 'journalCallerCanReadJournal') as $fn) {
    defineLifted($mj, $fn);   // the build under test's own copies (the older builds lack some)
}
$READS = array('list', 'row_notes', 'toggles', 'toggle_history', 'toggle_history_search', 'attachment');
$lifted = array();
foreach ($READS as $act) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    if (!$bb) continue;
    $body = substr($mj, $bb[0] + 1, $bb[1] - $bb[0] - 1);
    $body = preg_replace('/\bexit\s*(\(\s*\))?\s*;/', 'return;', $body);
    try {
        eval('function ut_read_' . $act . '() { global $conn, $currentUserKey, $user_ouc, $isAdmin, $_JSON_BODY; ' . $body . "\n}");
        $lifted[$act] = true;
    } catch (Throwable $e) { $lifted[$act] = 'parse: ' . $e->getMessage(); }
}
function runRead($act, $sid, $uid, $admin) {
    $GLOBALS['QLOG'] = array();
    $_GET = array('action' => $act, 'report_id' => $sid, 'row_key' => 'k1', 'toggle_key' => 'done', 'note_id' => '55');
    $GLOBALS['ATTACH_RID'] = $GLOBALS['RID_BY_SID'][$sid];
    $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = $uid; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = $admin;
    ob_start(); $err = null;
    try { call_user_func('ut_read_' . $act); } catch (Throwable $e) { $err = get_class($e) . ': ' . $e->getMessage(); }
    $txt = ob_get_clean();
    $q = array_values(array_filter($GLOBALS['QLOG'], function ($s) { return strpos($s, 'ATTACH_NAME') === false || strpos($s, 'WHERE ID = :nid') === false; }));
    return array('refused' => strpos($txt, 'The Report Journal is off for this report.') !== false, 'queries' => count($q), 'err' => $err);
}
$gate = function ($sid, $uid, $admin, $wantRefused) use ($READS, $lifted) {
    $bad = array();
    foreach ($READS as $act) {
        if ($lifted[$act] !== true) { $bad[] = $act . ' not lifted' . (is_string($lifted[$act]) ? ' (' . $lifted[$act] . ')' : ''); continue; }
        $r = runRead($act, $sid, $uid, $admin);
        if ($wantRefused && (!$r['refused'] || $r['queries'] > 0)) $bad[] = $act . ': refused ' . json_encode($r['refused']) . ', ' . $r['queries'] . ' quer' . ($r['queries'] === 1 ? 'y' : 'ies') . ($r['err'] ? ' (' . substr($r['err'], 0, 60) . ')' : '');
        if (!$wantRefused && $r['refused']) $bad[] = $act . ': refused';
    }
    return $bad;
};
$b = $gate('jroff', 'viewer1', false, true);
rec('S-gate-off', !$b, $b ? implode(' | ', $b) : 'a viewer of a journal-off report: all 6 reads refused before any query');
$b = $gate('jron', 'viewer1', false, false);
rec('S-gate-on', !$b, $b ? implode(' | ', $b) : 'journal on: all 6 reads go past the checks');
$b = $gate('jroff', 'owner1', false, false);
rec('S-gate-owner', !$b, $b ? implode(' | ', $b) : 'the owner\'s peek: all 6 reads go past the checks');
$b = $gate('jroff', 'viewer1', true, false);
rec('S-gate-admin', !$b, $b ? implode(' | ', $b) : 'an app admin: all 6 reads go past the checks');
$b = $gate('jrenc', 'viewer1', false, false);
rec('S-gate-enc', !$b, $b ? implode(' | ', $b) : 'an encrypted report (journal state unreadable here): all 6 reads stay open');

// ------------------------------------------- scheduler: groupBy, band labels
$okTg = defineLifted($sr, 'penumbra_sched_toggle_group_by');
if ($okTg) {
    $res = array('colMeta' => array(array('name' => 'DONE', 'key' => 'done'), array('name' => 'TAKEN_2', 'key' => 'taken')));
    $t = array(
        penumbra_sched_toggle_group_by('__JOURNAL_TOGGLE__done', $res),
        penumbra_sched_toggle_group_by('PROTOCOL TYPE,__JOURNAL_TOGGLE__taken', $res),
        penumbra_sched_toggle_group_by('Done', $res),
        penumbra_sched_toggle_group_by('__JOURNAL_TOGGLE__gone', $res),
        penumbra_sched_toggle_group_by('__JOURNAL_TOGGLE__done', null));
    rec('S-tg-groupby', $t === array('DONE', 'PROTOCOL TYPE,TAKEN_2', 'Done', '__JOURNAL_TOGGLE__gone', '__JOURNAL_TOGGLE__done'), json_encode($t));
} else {
    rec('S-tg-groupby', false, 'penumbra_sched_toggle_group_by not found');
}
$okCols = defineLifted($sr, 'penumbra_sched_toggle_cols');
// (2026-10-14, notescol4) the lifted toggle block sets the Notes column's registry too.
if (!function_exists('penumbra_sched_notes_col')) defineLifted($sr, 'penumbra_sched_notes_col');
$okSpec = defineLifted($sr, 'penumbra_group_level_spec');
if ($okCols && $okSpec) {
    $first = array('X' => 'a', 'DONE' => '1');
    penumbra_sched_toggle_cols(array('DONE'));
    $sp = penumbra_group_level_spec('Done', $first, array($first), array());
    $sx = penumbra_group_level_spec('X', $first, array($first), array());
    $l1 = $sp ? call_user_func($sp['label'], array('DONE' => '1')) : null;
    $l0 = $sp ? call_user_func($sp['label'], array('DONE' => '0')) : null;
    $lx = $sx ? call_user_func($sx['label'], array('X' => 'a')) : null;
    penumbra_sched_toggle_cols(array());   // the next task has no toggles
    $sp2 = penumbra_group_level_spec('Done', $first, array($first), array());
    $lc = $sp2 ? call_user_func($sp2['label'], array('DONE' => '1')) : null;
    rec('S-tg-label', $l1 === 'Checked' && $l0 === 'Unchecked' && $lx === 'a' && $lc === '1',
        'toggle band 1 -> ' . json_encode($l1) . ', 0 -> ' . json_encode($l0) . ', a data column -> ' . json_encode($lx) . ', after the registry clears -> ' . json_encode($lc));
} else {
    rec('S-tg-label', false, 'penumbra_sched_toggle_cols ' . ($okCols ? 'ok' : 'missing') . ', penumbra_group_level_spec ' . ($okSpec ? 'ok' : 'missing'));
}

// ------------------------------------------- scheduler: the toggle block, run
// (Round E, 2026-10-08: the block also re-keys the toggle summaries - a build that has the
// helper calls it, one that does not, does not.)
if (!function_exists('penumbra_sched_toggle_summaries')) defineLifted($sr, 'penumbra_sched_toggle_summaries');
$a = strpos($sr, "    \$journal_toggle_cols = array();\n");
$z = ($a === false) ? false : strpos($sr, "    // Engine C (snippets) toggle awareness.", $a);
$blockOk = false;
if ($a !== false && $z !== false && $z - $a < 6000) {
    $blk = substr($sr, $a, $z - $a);
    $blk = str_replace("require_once __DIR__ . '/journal_export.php';", '', $blk);
    try {
        eval('function ut_sched_block($apiData, $state, $report_id) { ' . $blk
            . "\n return array('cols' => \$journal_toggle_cols, 'res' => \$journal_toggle_resolver, 'state' => \$state); }");
        $blockOk = true;
    } catch (Throwable $e) { $blockErr = $e->getMessage(); }
}
$runBlock = function ($state, $viewMode) {
    $GLOBALS['JX'] = array('cols' => 0, 'res' => 0);
    if (function_exists('penumbra_sched_toggle_cols')) penumbra_sched_toggle_cols(array('STALE'));
    $r = ut_sched_block(array('data' => array(array('ID' => '1'), array('ID' => '2')), 'viewMode' => $viewMode), $state, 'jrfix');
    $reg = function_exists('penumbra_sched_toggle_cols') ? array_keys(penumbra_sched_toggle_cols()) : null;
    return array('colsCalls' => $GLOBALS['JX']['cols'], 'resCalls' => $GLOBALS['JX']['res'], 'cols' => $r['cols'],
                 'resolver' => !empty($r['res']), 'groupBy' => isset($r['state']['groupBy']) ? $r['state']['groupBy'] : null, 'registry' => $reg);
};
if ($blockOk) {
    $g = $runBlock(array('groupBy' => '__JOURNAL_TOGGLE__done'), 'grouped');
    rec('S-sched-grouped', $g['colsCalls'] === 1 && $g['resCalls'] === 0 && $g['cols'] === array('DONE') && $g['resolver']
        && $g['groupBy'] === 'DONE' && $g['registry'] === array('DONE'), json_encode($g));
    $p = $runBlock(array('pivot' => array('rows' => array('X'))), 'pivot');
    rec('S-sched-pivot', $p['colsCalls'] === 0 && $p['resCalls'] === 1 && $p['cols'] === array() && $p['resolver'] && $p['registry'] === array(), json_encode($p));
    $f = $runBlock(array(), 'standard');
    rec('S-sched-oneread', $f['colsCalls'] === 1 && $f['resCalls'] === 0 && $f['cols'] === array('DONE') && $f['resolver'], json_encode($f));
} else {
    foreach (array('S-sched-grouped', 'S-sched-pivot', 'S-sched-oneread') as $id) rec($id, false, 'toggle block not lifted' . (isset($blockErr) ? ': ' . $blockErr : ''));
}

// ------------------------------------------- DB dump: a grouped report's flatten
$a = strpos($sr, "                if (\$dbdump_view_mode === 'grouped' && is_array(\$data)) {");
$bb = ($a === false) ? null : braceBlock($sr, $a);
if ($bb) {
    $code = substr($sr, $a, $bb[1] - $a + 1);
    try {
        eval('function ut_dd_flatten($data, $apiResult, $dbdump_view_mode) { ' . $code . "\n return \$data; }");
        $data = ut_dd_flatten(array('Exempt' => array(array('ID' => 1, 'DONE' => '1'), array('ID' => 2, 'DONE' => '0')),
                                    'Expedited' => array(array('ID' => 3, 'DONE' => '0'))),
                              array('journalToggleCols' => array('DONE')), 'grouped');
        $left = 0; foreach ($data as $r) if (is_array($r) && array_key_exists('DONE', $r)) $left++;
        rec('S-dd-strip', count($data) === 3 && $left === 0, count($data) . ' flat rows, ' . $left . ' still carrying the toggle column');
    } catch (Throwable $e) { rec('S-dd-strip', false, 'flatten block threw: ' . $e->getMessage()); }
} else {
    rec('S-dd-strip', false, 'no grouped flatten block');
}
}   // $RUN_A

// ======================= ROUND B (2026-10-07): a toggle write that changes nothing
// writes nothing. set_toggle / set_toggles_bulk are lifted and RUN against a scripted
// OCI layer: oci_num_rows says per execute whether the MERGE changed the row, a
// scripted failure plays the concurrent first mark (ORA-00001), and the read-back
// (journalToggleCurrent) answers from $GLOBALS['CUR_ROWS'].
if ($RUN_B || $RUN_E || $RUN_F || $RUN_G) {
if (!defined('OCI_NO_AUTO_COMMIT')) define('OCI_NO_AUTO_COMMIT', 0);
if (!defined('JOURNAL_BULK_MAX_ROWS')) define('JOURNAL_BULK_MAX_ROWS', 5000);
function getOci8Connection() { return 'oci'; }
function oci_parse($c, $sql) { $GLOBALS['OCI']['sql'][] = $sql; return 'stmt'; }
function oci_bind_by_name($st, $name, &$var, $len = -1) { $GLOBALS['OCI']['binds'][$name] = &$var; return true; }
function oci_execute($st, $mode = 0) {
    $i = $GLOBALS['OCI']['calls']++;
    // OCI8 leaves every variable bound with the default type a STRING once it has run
    // (2026-10-08: that is why the audit holds "state":"1"): so does this fake.
    foreach (array_keys($GLOBALS['OCI']['binds']) as $k) {
        $bv = $GLOBALS['OCI']['binds'][$k];
        if (is_int($bv) || is_float($bv) || is_bool($bv)) $GLOBALS['OCI']['binds'][$k] = ($bv === false) ? '' : (string)$bv;
    }
    $vals = array();
    foreach ($GLOBALS['OCI']['binds'] as $k => $v) $vals[$k] = $v;   // the values NOW, as OCI reads them
    $GLOBALS['OCI']['exec'][] = $vals;
    if (!empty($GLOBALS['OCI']['fail'][$i])) { $GLOBALS['OCI']['err'] = $GLOBALS['OCI']['fail'][$i]; $GLOBALS['OCI']['last'] = 0; return false; }
    $GLOBALS['OCI']['last'] = isset($GLOBALS['OCI']['num'][$i]) ? $GLOBALS['OCI']['num'][$i] : 1;
    return true;
}
function oci_num_rows($st) { return $GLOBALS['OCI']['last']; }
function oci_error($x = null) { return array('message' => isset($GLOBALS['OCI']['err']) ? $GLOBALS['OCI']['err'] : 'fake'); }
function oci_free_statement($st) { return true; }
function oci_commit($c) { return true; }
function oci_rollback($c) { return true; }
function journalIsMissingTableError($m) { return false; }
function logPenumbraAudit($rid, $action, $before, $after, $msg) { $GLOBALS['AUDIT'][] = array('action' => $action, 'after' => json_decode($after, true), 'msg' => $msg); }
defineLifted($mj, 'journalToggleMergeSql');
defineLifted($mj, 'journalToggleCurrent');
$writeActs = array();
// Round F (2026-10-08): the write rules' helpers and constant, from the build under test
// (an older build has none, and its writes do not call them). Guarded: mode a lifts some.
// Round G adds the audit rows' context (journalToggleAuditContext).
foreach (array('journalReportStateFlags', 'journalCallerHoldsGrant', 'journalToggleWriteRefusal', 'journalToggleRowCount', 'journalToggleAuditContext',
               'journalWriteKeyRefusal', 'journalParkedSummary') as $fn) {
    if (!function_exists($fn)) defineLifted($mj, $fn);
}
// Round N (2026-10-08): the key filing runs on the in-memory journal of mode n; on this scripted OCI
// it is a no-op (it would take the scripted answers' places).
if (!function_exists('journalEnsureFiledFor')) { function journalEnsureFiledFor($report, $assumeFrom = null) { return 'ok'; } }
// Round P (2026-10-09): a write holds the filing in its transaction - mode p plays that on the in-memory
// journal; on this scripted OCI it is a no-op too. A row key in the filed form is refused as the build does.
if (!function_exists('journalFilingHold')) { function journalFilingHold($report) { return null; } }
if (!function_exists('journalRowKeyIsFiledForm')) defineLifted($mj, 'journalRowKeyIsFiledForm');
// ... and the build's filing constants, which its reads put in their SQL (journal_export.php holds
// them; the page requires it). An older build has none, and its actions do not use them.
if (preg_match_all("/define\('(JOURNAL_(?:KEYFILE|PARK)_[A-Z_]+)', (.+?)\);/", str_replace("\r\n", "\n", (string)@file_get_contents($jePath)), $nkM, PREG_SET_ORDER)) {
    foreach ($nkM as $nk) if (!defined($nk[1])) define($nk[1], eval('return ' . $nk[2] . ';'));
}
// Every plain numeric JOURNAL_* constant of the build under test (the cap among them; the
// bulk notes need the note limits too).
if (preg_match_all("/define\('(JOURNAL_[A-Z_]+)', (\d+)\);/", $mj, $capM, PREG_SET_ORDER)) {
    foreach ($capM as $cm) if (!defined($cm[1])) define($cm[1], (int)$cm[2]);
}
foreach (array('set_toggle', 'set_toggles_bulk', 'add_notes_bulk') as $act) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    if (!$bb) continue;
    $body = substr($mj, $bb[0] + 1, $bb[1] - $bb[0] - 1);
    $body = preg_replace('/\bexit\s*(\(\s*\))?\s*;/', 'return;', $body);
    $body = str_replace("json_decode(file_get_contents('php://input'), true)", "\$GLOBALS['BULK_BODY']", $body);
    try {
        eval('function ut_write_' . $act . '() { global $conn, $currentUserKey, $user_ouc, $isAdmin, $_JSON_BODY; ' . $body . "\n}");
        $writeActs[$act] = true;
    } catch (Throwable $e) { $writeActs[$act] = 'parse: ' . $e->getMessage(); }
}
function runWrite($act, $body, $num, $fail, $cur) {
    $GLOBALS['OCI'] = array('exec' => array(), 'num' => $num, 'fail' => $fail, 'calls' => 0, 'binds' => array(), 'sql' => array(), 'last' => 0);
    $GLOBALS['AUDIT'] = array(); $GLOBALS['CUR_ROWS'] = $cur; $GLOBALS['QLOG'] = array();
    $GLOBALS['_JSON_BODY'] = $body; $GLOBALS['BULK_BODY'] = $body;
    $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = 'harness'; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = false;
    ob_start(); $err = null;
    try { call_user_func('ut_write_' . $act); } catch (Throwable $e) { $err = get_class($e) . ': ' . $e->getMessage(); }
    $raw = ob_get_clean();
    return array('resp' => json_decode($raw, true), 'raw' => substr($raw, 0, 220), 'err' => $err, 'audit' => $GLOBALS['AUDIT'], 'oci' => $GLOBALS['OCI']);
}
function brief($r) {
    return 'answer ' . ($r['resp'] ? json_encode($r['resp']) : $r['raw']) . ' | audit rows ' . count($r['audit']) . ($r['err'] ? ' | threw ' . $r['err'] : '');
}
// The read-back query: answered from CUR_ROWS (wrapping the Round A fake).
function sbCurRowsFor($sql) { return (strpos($sql, 'SELECT STATE, UPDATED_BY') !== false) ? $GLOBALS['CUR_ROWS'] : null; }
$okSet = isset($writeActs['set_toggle']) && $writeActs['set_toggle'] === true;
$okBulk = isset($writeActs['set_toggles_bulk']) && $writeActs['set_toggles_bulk'] === true;
$KIM = array(array('STATE' => '1', 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-10-07 09:00:00'));
if ($RUN_B) {
if ($okSet) {
    $set = array('action' => 'set_toggle', 'report_id' => 'jron', 'row_key' => 'K1', 'toggle_key' => 'done', 'state' => true);
    // The MERGE skips a row already in the state, and inserts no 0 row.
    $r = runWrite('set_toggle', $set, array(1), array(), array(array('STATE' => '1', 'UPDATED_BY' => 'harness', 'UPDATED_AT' => '2026-10-07 12:00:00')));
    $sql = $r['oci']['sql'] ? end($r['oci']['sql']) : '';
    $ex = $r['oci']['exec'] ? $r['oci']['exec'][0] : array();
    rec('SB-merge-sql', strpos($sql, 'WHERE t.STATE <> :st3') !== false && strpos($sql, 'WHERE :st4 = 1') !== false
        && isset($ex[':st3']) && (int)$ex[':st3'] === 1 && isset($ex[':st4']) && (int)$ex[':st4'] === 1,
        preg_replace('/\s+/', ' ', substr($sql, 0, 400)) . ' | binds ' . json_encode($ex));
    rec('SB-set-changed', !$r['err'] && isset($r['resp']['unchanged']) && $r['resp']['unchanged'] === false && (int)$r['resp']['state'] === 1
        && $r['resp']['by'] === 'harness' && $r['resp']['at'] === '2026-10-07 12:00:00' && count($r['audit']) === 1, brief($r));
    // Already marked by kim: no write took place - no audit row, kim keeps the mark.
    $r = runWrite('set_toggle', $set, array(0), array(), $KIM);
    rec('SB-set-unchanged', !$r['err'] && !empty($r['resp']['unchanged']) && (int)$r['resp']['state'] === 1 && $r['resp']['by'] === 'kim'
        && $r['resp']['at'] === '2026-10-07 09:00:00' && count($r['audit']) === 0, brief($r));
    // Two first marks at once: the second INSERT hits the key, runs again as an update.
    $r = runWrite('set_toggle', $set, array(1 => 0), array(0 => 'ORA-00001: unique constraint (PENUMBRA.PK_PENUMBRA_JRNL_TOGGLE) violated'), $KIM);
    rec('SB-set-dup', !$r['err'] && $r['resp'] && $r['resp']['status'] === 'success' && $r['resp']['by'] === 'kim' && count($r['oci']['exec']) === 2,
        brief($r) . ' | executes ' . count($r['oci']['exec']));
} else {
    foreach (array('SB-merge-sql', 'SB-set-changed', 'SB-set-unchanged', 'SB-set-dup') as $id) rec($id, false, 'set_toggle not lifted');
}
if ($okBulk) {
    $bulk = array('action' => 'set_toggles_bulk', 'report_id' => 'jron', 'toggle_key' => 'done', 'state' => true, 'row_keys' => array('A', 'B', 'C'));
    $r = runWrite('set_toggles_bulk', $bulk, array(1, 0, 1), array(), array());
    $au = $r['audit'] ? $r['audit'][0]['after'] : null;
    rec('SB-bulk-changed', !$r['err'] && $r['resp'] && (int)$r['resp']['count'] === 2 && isset($r['resp']['changed']) && $r['resp']['changed'] === array('A', 'C')
        && isset($r['resp']['skipped']) && (int)$r['resp']['skipped'] === 1 && count($r['audit']) === 1 && $au && $au['row_keys'] === array('A', 'C') && (int)$au['row_count'] === 2,
        brief($r) . ' | audit keys ' . json_encode($au ? $au['row_keys'] : null));
    $r = runWrite('set_toggles_bulk', $bulk, array(0, 0, 0), array(), array());
    rec('SB-bulk-none', !$r['err'] && $r['resp'] && (int)$r['resp']['count'] === 0 && isset($r['resp']['changed']) && $r['resp']['changed'] === array() && count($r['audit']) === 0,
        brief($r));
} else {
    foreach (array('SB-bulk-changed', 'SB-bulk-none') as $id) rec($id, false, 'set_toggles_bulk not lifted');
}
}   // asserts: $RUN_B
}   // $RUN_B || $RUN_E

// ======================= ROUND D (2026-10-08): Toggle History. The per-row history and the
// search are lifted and RUN against a scripted audit log (newest first, AFTER = the JSON the
// writes store); the fake applies the SQL's own INSTR prefilters and FETCH FIRST cap, so a
// query that does not narrow by the row sees only the newest rows - as Oracle would.
if ($RUN_D || $RUN_E || $RUN_G) {
$dActs = array();
foreach (array('toggle_history', 'toggle_history_search') as $act) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    if (!$bb) continue;
    $body = preg_replace('/\bexit\s*(\(\s*\))?\s*;/', 'return;', substr($mj, $bb[0] + 1, $bb[1] - $bb[0] - 1));
    try {
        eval('function ut_d_' . $act . '() { global $conn, $currentUserKey, $user_ouc, $isAdmin, $_JSON_BODY; ' . $body . "\n}");
        $dActs[$act] = true;
    } catch (Throwable $e) { $dActs[$act] = 'parse: ' . $e->getMessage(); }
}
foreach (array('journalReportStateFlags', 'journalReportJournalEnabled', 'journalTargetCanOpenJournal', 'journalCallerCanReadJournal') as $fn) {
    if (!function_exists($fn)) defineLifted($mj, $fn);
}
$SEPD = "\xE2\x90\x9F";
function dRow($by, $ts, $aft) { return array('USER_ID' => $by, 'TS' => $ts, 'AFT' => json_encode($aft)); }
// The audit query, answered from $GLOBALS['DAUDIT'] with the SQL's own INSTR needles and cap.
function dAuditAnswer($sql, $binds) {
    if (strpos($sql, 'PENUMBRA_AUDIT') !== false) {
        $rows = $GLOBALS['DAUDIT'];
        // The row needle and its int-form siblings (:n0..:n3, 2026-10-08) are ONE OR group.
        if (isset($binds[':needle'])) {
            $any = array($binds[':needle']);
            for ($ni = 0; $ni < 4; $ni++) if (isset($binds[':n' . $ni])) $any[] = $binds[':n' . $ni];
            $rows = array_values(array_filter($rows, function ($r) use ($any) {
                foreach ($any as $n) if (strpos($r['AFT'], $n) !== false) return true;
                return false;
            }));
        }
        foreach (array(':tkn', ':stn') as $b) {
            if (!isset($binds[$b])) continue;
            $n = $binds[$b];
            $legacyDone = ($b === ':tkn' && strpos($sql, 'INSTR("AFTER", \'"toggle_key"\') = 0') !== false);
            $rows = array_values(array_filter($rows, function ($r) use ($n, $legacyDone) {
                return strpos($r['AFT'], $n) !== false || ($legacyDone && strpos($r['AFT'], '"toggle_key"') === false);
            }));
        }
        if (preg_match('/FETCH FIRST (\d+) ROWS ONLY/', $sql, $m)) $rows = array_slice($rows, 0, (int)$m[1]);
        return $rows;
    }
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false && strpos($sql, 'STATE = 1') !== false) return $GLOBALS['DMARKS'];
    return null;
}
function runD($act, $get) {
    $GLOBALS['QSEEN'] = array();
    $GLOBALS['QFAKE'] = 'dAuditAnswer';
    $_GET = $get;
    $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = 'viewer1'; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = false;
    ob_start(); $err = null;
    try { call_user_func('ut_d_' . $act); } catch (Throwable $e) { $err = get_class($e) . ': ' . $e->getMessage(); }
    $raw = ob_get_clean();
    unset($GLOBALS['QFAKE']);
    $audit = null;
    foreach ($GLOBALS['QSEEN'] as $q) { if (strpos($q['sql'], 'PENUMBRA_AUDIT') !== false) $audit = $q; }
    return array('resp' => json_decode($raw, true), 'raw' => substr($raw, 0, 200), 'err' => $err, 'audit' => $audit);
}
$okH = isset($dActs['toggle_history']) && $dActs['toggle_history'] === true;
$okS = isset($dActs['toggle_history_search']) && $dActs['toggle_history_search'] === true;
if ($RUN_D) {
// ---- the per-row history: 2,500 newer changes on OTHER rows, then the target row's own two.
$TGT = 'TGT' . $SEPD . '1';
$GLOBALS['DAUDIT'] = array();
for ($i = 0; $i < 2500; $i++) $GLOBALS['DAUDIT'][] = dRow('kim', '2026-10-0' . (8 - intdiv($i, 1000)) . ' 09:00:00', array('row_key' => 'OTHER' . $i, 'toggle_key' => 'done', 'state' => 1));
$GLOBALS['DAUDIT'][] = dRow('lee', '2026-09-02 10:00:00', array('bulk' => true, 'toggle_key' => 'done', 'state' => 0, 'row_count' => 2, 'row_keys' => array('X', $TGT)));
$GLOBALS['DAUDIT'][] = dRow('pat', '2026-09-01 09:00:00', array('row_key' => $TGT, 'toggle_key' => 'done', 'state' => 1));
$GLOBALS['DMARKS'] = array();
if ($okH) {
    $r = runD('toggle_history', array('report_id' => 'jron', 'row_key' => $TGT, 'toggle_key' => 'done'));
    $ev = ($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array();
    $sql = $r['audit'] ? preg_replace('/\s+/', ' ', $r['audit']['sql']) : '';
    $nb = ($r['audit'] && isset($r['audit']['binds'][':needle'])) ? $r['audit']['binds'][':needle'] : null;
    rec('SD-row-sql', !$r['err'] && strpos($sql, 'INSTR("AFTER", :needle) > 0') !== false && $nb === json_encode($TGT)
        && count($ev) === 2 && $ev[0]['by'] === 'lee' && $ev[0]['state'] === 0 && !empty($ev[0]['bulk']) && $ev[1]['by'] === 'pat' && $ev[1]['state'] === 1,
        'events ' . json_encode($ev) . ' | needle ' . json_encode($nb) . ' | ' . substr($sql, 0, 160) . ($r['err'] ? ' | threw ' . $r['err'] : ''));
} else {
    rec('SD-row-sql', false, 'toggle_history not lifted');
}
// ---- the search: three people, single + bulk changes, a second column, the marks now.
// The state is stored the way the writes REALLY store it (live-found 2026-10-08): a STRING -
// set_toggle / set_toggles_bulk bind $state with oci_bind_by_name(), which turns the PHP int
// into a string before the audit row is encoded ("state":"1"). The two oldest keep an int.
$R = function ($n) use ($SEPD) { return 'R' . $n . $SEPD . 'A'; };
$GLOBALS['DAUDIT'] = array(
    dRow('pat', '2026-10-06 09:00:00', array('row_key' => $R(1), 'toggle_key' => 'done', 'state' => '1')),
    dRow('lee', '2026-10-05 09:00:00', array('row_key' => $R(1), 'toggle_key' => 'done', 'state' => '0')),
    dRow('pat', '2026-10-04 09:00:00', array('bulk' => true, 'toggle_key' => 'done', 'state' => '1', 'row_count' => 2, 'row_keys' => array($R(2), $R(3)))),
    dRow('kim', '2026-10-03 09:00:00', array('row_key' => $R(1), 'toggle_key' => 'other', 'state' => '1')),
    dRow('lee', '2026-10-02 09:00:00', array('row_key' => $R(4), 'toggle_key' => 'done', 'state' => 1)),
    dRow('pat', '2026-10-01 09:00:00', array('row_key' => $R(2), 'toggle_key' => 'done', 'state' => 0)),
);
$GLOBALS['DMARKS'] = array(
    array('TOGGLE_KEY' => 'done', 'ROW_KEY' => $R(1), 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-06 09:00:00'),
    array('TOGGLE_KEY' => 'done', 'ROW_KEY' => $R(3), 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-04 09:00:00'),
    array('TOGGLE_KEY' => 'done', 'ROW_KEY' => $R(4), 'UPDATED_BY' => 'lee', 'UPDATED_AT' => '2026-10-02 09:00:00'),
);
$base = array('report_id' => 'jron', 'user' => '', 'from' => '', 'to' => '', 'toggle_key' => 'done');
if ($okS) {
    $r = runD('toggle_history_search', $base);
    $sm = ($r['resp'] && isset($r['resp']['summary'])) ? $r['resp']['summary'] : null;
    $pp = $sm ? $sm['people'] : array();
    rec('SD-search-summary', !$r['err'] && $sm && $sm['changes'] === 6 && $sm['marked'] === 4 && $sm['unmarked'] === 2 && $sm['rows'] === 4
        && count($pp) === 2 && $pp[0]['user'] === 'pat' && $pp[0]['marked'] === 3 && $pp[0]['unmarked'] === 1 && $pp[1]['user'] === 'lee' && $pp[1]['marked'] === 1 && $pp[1]['unmarked'] === 1,
        'summary ' . json_encode($sm) . ($r['err'] ? ' | threw ' . $r['err'] : ''));
    $nows = array();
    foreach (($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array() as $e) {
        $nows[] = explode($SEPD, $e['rowKey'])[0] . ':' . (isset($e['now']) ? ($e['now']['on'] ? 'on/' . $e['now']['by'] : 'off') : '-');
    }
    rec('SD-search-now', $nows === array('R1:on/pat', 'R1:on/pat', 'R2:off', 'R3:on/pat', 'R4:on/lee', 'R2:off'), json_encode($nows));
    $r = runD('toggle_history_search', $base + array('mode' => 'latest'));
    $lt = array();
    foreach (($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array() as $e) $lt[] = explode($SEPD, $e['rowKey'])[0] . ':' . $e['by'] . '/' . $e['state'];
    rec('SD-search-latest', $lt === array('R1:pat/1', 'R2:pat/1', 'R3:pat/1', 'R4:lee/1') && $r['resp']['summary']['changes'] === 6, json_encode($lt));
    // Unmarked only / Marked only: every stored form (string or int) - the fake applies any
    // SQL needle on AFTER, so one that misses the string form drops those rows.
    $r = runD('toggle_history_search', $base + array('state' => '0'));
    $sql = $r['audit'] ? preg_replace('/\s+/', ' ', $r['audit']['sql']) : '';
    $st = array();
    foreach (($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array() as $e) $st[] = explode($SEPD, $e['rowKey'])[0] . ':' . $e['state'];
    $r1 = runD('toggle_history_search', $base + array('state' => '1'));
    $st1 = array();
    foreach (($r1['resp'] && isset($r1['resp']['events'])) ? $r1['resp']['events'] : array() as $e) $st1[] = explode($SEPD, $e['rowKey'])[0] . ':' . $e['state'];
    rec('SD-search-state', $st === array('R1:0', 'R2:0') && $r['resp']['summary']['marked'] === 0 && $r['resp']['summary']['unmarked'] === 2
        && $st1 === array('R1:1', 'R2:1', 'R3:1', 'R4:1') && $r1['resp']['summary']['marked'] === 4 && $r1['resp']['summary']['unmarked'] === 0,
        'unmarked ' . json_encode($st) . ', marked ' . json_encode($st1) . ' | ' . substr($sql, strpos($sql, 'WHERE'), 220));
    $r = runD('toggle_history_search', array('toggle_key' => 'other') + $base);
    $sql = $r['audit'] ? preg_replace('/\s+/', ' ', $r['audit']['sql']) : '';
    $tk = array();
    foreach (($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array() as $e) $tk[] = $e['toggle'] . ':' . $e['by'];
    rec('SD-search-tkfilter', strpos($sql, 'INSTR("AFTER", :tkn) > 0') !== false && isset($r['audit']['binds'][':tkn']) && $r['audit']['binds'][':tkn'] === '"toggle_key":"other"'
        && $tk === array('other:kim'), json_encode($tk) . ' | ' . substr($sql, strpos($sql, 'WHERE'), 220));
    // Past the list's 1,500-event cap the summary keeps counting: a bulk flip of 1,600 rows,
    // then two older single changes. A scan that hits its 5,000-row cap answers partial.
    $bk = array();
    for ($i = 0; $i < 1600; $i++) $bk[] = 'B' . $i . $SEPD . 'A';
    $GLOBALS['DAUDIT'] = array(
        dRow('kim', '2026-10-06 09:00:00', array('bulk' => true, 'toggle_key' => 'done', 'state' => 1, 'row_count' => 1600, 'row_keys' => $bk)),
        dRow('lee', '2026-10-05 09:00:00', array('row_key' => $R(1), 'toggle_key' => 'done', 'state' => 0)),
        dRow('pat', '2026-10-04 09:00:00', array('row_key' => $R(2), 'toggle_key' => 'done', 'state' => 1)),
    );
    $GLOBALS['DMARKS'] = array();
    $r = runD('toggle_history_search', $base);
    $sm = ($r['resp'] && isset($r['resp']['summary'])) ? $r['resp']['summary'] : null;
    $ne = ($r['resp'] && isset($r['resp']['events'])) ? count($r['resp']['events']) : -1;
    $c1 = $sm && $sm['changes'] === 1602 && $sm['marked'] === 1601 && $sm['unmarked'] === 1 && $sm['rows'] === 1602 && count($sm['people']) === 3
        && $ne === 1500 && !empty($r['resp']['truncated']) && $r['resp']['partial'] === false;
    $d1 = 'summary ' . ($sm ? $sm['changes'] . '/' . $sm['marked'] . '/' . $sm['unmarked'] . ' rows ' . $sm['rows'] . ' people ' . count($sm['people']) : 'none')
        . ', events ' . $ne . ', truncated ' . json_encode($r['resp'] ? $r['resp']['truncated'] : null) . ', partial ' . json_encode($r['resp'] && isset($r['resp']['partial']) ? $r['resp']['partial'] : null);
    $GLOBALS['DAUDIT'] = array();
    for ($i = 0; $i < 5001; $i++) $GLOBALS['DAUDIT'][] = dRow('kim', '2026-10-06 09:00:00', array('row_key' => 'S' . $i, 'toggle_key' => 'done', 'state' => 1));
    $r = runD('toggle_history_search', $base);
    $c2 = $r['resp'] && isset($r['resp']['partial']) && $r['resp']['partial'] === true && $r['resp']['summary']['changes'] === 5000;
    rec('SD-search-cap', $c1 && $c2, $d1 . ' | scan cap: partial ' . json_encode($r['resp'] && isset($r['resp']['partial']) ? $r['resp']['partial'] : null)
        . ', changes ' . json_encode($r['resp'] && isset($r['resp']['summary']) ? $r['resp']['summary']['changes'] : null));
} else {
    foreach (array('SD-search-summary', 'SD-search-now', 'SD-search-latest', 'SD-search-state', 'SD-search-tkfilter', 'SD-search-cap') as $id) rec($id, false, 'toggle_history_search not lifted');
}
}   // asserts: $RUN_D
}   // $RUN_D || $RUN_E

// ======================= ROUND E (2026-10-08): the sweep's items 1-7, server half.
//   SE-bulk-strval   a bulk write audits an all-digit key as a STRING
//   SE-hist-int      the row's hover history finds a bulk row that holds the key as a number
//   SE-used-keys     the toggles answer lists every key with rows in any state
//   SE-sum-remap     a toggle summary re-keyed onto the output column's name
//   SE-is-toggle     the task's toggle columns count as toggles for the summary rules
//   SE-sched-sum     the scheduler's toggle block re-keys the summaries
//   SE-eval-keep     a row that carries the toggle column keeps it (format() counts)
if ($RUN_E) {
// ---- 1: the bulk writer
if ($okBulk) {
    $bulk = array('action' => 'set_toggles_bulk', 'report_id' => 'jron', 'toggle_key' => 'done', 'state' => true, 'row_keys' => array('12345', 'A', '00123'));
    $r = runWrite('set_toggles_bulk', $bulk, array(1, 1, 1), array(), array());
    $au = $r['audit'] ? $r['audit'][0]['after'] : null;
    $types = $au ? array_map('gettype', $au['row_keys']) : array();
    $chg = ($r['resp'] && isset($r['resp']['changed'])) ? array_map('gettype', $r['resp']['changed']) : array();
    rec('SE-bulk-strval', !$r['err'] && $au && $au['row_keys'] === array('12345', 'A', '00123') && $chg === array('string', 'string', 'string'),
        'audit keys ' . json_encode($au ? $au['row_keys'] : null) . ' ' . json_encode($types) . ' | answer changed ' . json_encode($chg) . ($r['err'] ? ' | threw ' . $r['err'] : ''));
} else {
    rec('SE-bulk-strval', false, 'set_toggles_bulk not lifted');
}
// ---- 1: the reader
if ($okH) {
    $GLOBALS['DAUDIT'] = array(
        // as written before 2026-10-08: the bulk key a NUMBER
        array('USER_ID' => 'lee', 'TS' => '2026-10-05 09:00:00', 'AFT' => '{"bulk":true,"toggle_key":"done","state":"1","row_count":2,"row_keys":[12345,7]}'),
        array('USER_ID' => 'kim', 'TS' => '2026-10-04 09:00:00', 'AFT' => '{"bulk":true,"toggle_key":"done","state":"1","row_count":1,"row_keys":[123456]}'),
        array('USER_ID' => 'bo', 'TS' => '2026-10-03 09:00:00', 'AFT' => '{"bulk":true,"toggle_key":"done","state":"0","row_count":2,"row_keys":["A","12345"]}'),
        array('USER_ID' => 'pat', 'TS' => '2026-10-02 09:00:00', 'AFT' => '{"row_key":"12345","toggle_key":"done","state":"1"}'),
    );
    $GLOBALS['DMARKS'] = array();
    $r = runD('toggle_history', array('report_id' => 'jron', 'row_key' => '12345', 'toggle_key' => 'done'));
    $by = array();
    foreach (($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array() as $e) $by[] = $e['by'];
    $sql = $r['audit'] ? preg_replace('/\s+/', ' ', $r['audit']['sql']) : '';
    rec('SE-hist-int', !$r['err'] && $by === array('lee', 'bo', 'pat') && strpos($sql, 'INSTR("AFTER", :n0) > 0') !== false,
        'events by ' . json_encode($by) . ' | ' . substr($sql, strpos($sql, 'WHERE'), 260) . ($r['err'] ? ' | threw ' . $r['err'] : ''));
} else {
    rec('SE-hist-int', false, 'toggle_history not lifted');
}
// ---- 7b: the toggles answer
$a = strpos($mj, "    if (\$action === 'toggles') {");
$bb = ($a === false) ? null : braceBlock($mj, $a);
$okT = false;
if ($bb) {
    $body = preg_replace('/\bexit\s*(\(\s*\))?\s*;/', 'return;', substr($mj, $bb[0] + 1, $bb[1] - $bb[0] - 1));
    try { eval('function ut_e_toggles() { global $conn, $currentUserKey, $user_ouc, $isAdmin; ' . $body . "\n}"); $okT = true; } catch (Throwable $e) { $okT = false; }
}
if ($okT) {
    $GLOBALS['QSEEN'] = array();
    $GLOBALS['QFAKE'] = function ($sql, $binds) {
        if (strpos($sql, 'COUNT(*) AS N') !== false) return array();   // Round N: nothing filed under an old key
        if (strpos($sql, 'DISTINCT TOGGLE_KEY') !== false) return array(array('TOGGLE_KEY' => 'done'), array('TOGGLE_KEY' => 'old'));
        if (strpos($sql, 'STATE = 1') !== false) return array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => 'R1', 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'));
        return null;
    };
    $_GET = array('report_id' => 'jron');
    $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = 'viewer1'; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = false;
    ob_start(); $terr = null;
    try { ut_e_toggles(); } catch (Throwable $e) { $terr = $e->getMessage(); }
    $tr = json_decode(ob_get_clean(), true);
    unset($GLOBALS['QFAKE']);
    rec('SE-used-keys', !$terr && $tr && isset($tr['used_keys']) && $tr['used_keys'] === array('done', 'old') && isset($tr['toggles']['done']['R1']),
        json_encode($tr) . ($terr ? ' | threw ' . $terr : ''));
} else {
    rec('SE-used-keys', false, 'the toggles action not lifted');
}
// ---- 5: the summaries
if (!function_exists('penumbra_sched_toggle_cols')) defineLifted($sr, 'penumbra_sched_toggle_cols');
if (!function_exists('penumbra_sched_toggle_group_by')) defineLifted($sr, 'penumbra_sched_toggle_group_by');
$okRemap = function_exists('penumbra_sched_toggle_summaries') || defineLifted($sr, 'penumbra_sched_toggle_summaries');
if (!function_exists('penumbra_sched_notes_col')) defineLifted($sr, 'penumbra_sched_notes_col');   // (2026-10-14, notescol4) set inside the lifted block
if ($okRemap) {
    $res = array('colMeta' => array(array('name' => 'DONE', 'key' => 'done'), array('name' => 'REVIEWED', 'key' => 'toggle1')));
    $st = penumbra_sched_toggle_summaries(array(
        'columnSummaries' => array('__JOURNAL_TOGGLE__DONE' => 'sum', '__JOURNAL_TOGGLE__TOGGLE1' => 'count_filled', 'REVIEWED' => 'avg', 'TITLE' => 'count'),
        'columnSummaryFormulas' => array('__journal_toggle__done' => 'sum / count')), $res);
    $cs = $st['columnSummaries']; $cf = $st['columnSummaryFormulas'];
    rec('SE-sum-remap', isset($cs['DONE']) && $cs['DONE'] === 'sum' && $cs['REVIEWED'] === 'avg' && $cs['TITLE'] === 'count'
        && isset($cf['DONE']) && $cf['DONE'] === 'sum / count',
        'summaries ' . json_encode($cs) . ' | formulas ' . json_encode($cf));
} else {
    rec('SE-sum-remap', false, 'penumbra_sched_toggle_summaries not found');
}
$okIs = function_exists('penumbra_is_toggle_column') || defineLifted($sr, 'penumbra_is_toggle_column');
if ($okIs && function_exists('penumbra_sched_toggle_cols')) {
    penumbra_sched_toggle_cols(array('DONE'));
    $i1 = penumbra_is_toggle_column('Done'); $i2 = penumbra_is_toggle_column('TITLE'); $i3 = penumbra_is_toggle_column('__JOURNAL_TOGGLE__x');
    penumbra_sched_toggle_cols(array());
    $i4 = penumbra_is_toggle_column('DONE');
    rec('SE-is-toggle', $i1 === true && $i2 === false && $i3 === true && $i4 === false,
        'DONE ' . json_encode($i1) . ', TITLE ' . json_encode($i2) . ', the internal name ' . json_encode($i3) . ', DONE after the registry clears ' . json_encode($i4));
} else {
    rec('SE-is-toggle', false, 'penumbra_is_toggle_column / penumbra_sched_toggle_cols not found');
}
// ---- 5: the scheduler's toggle block re-keys them (the block Round A lifts, run again)
$a = strpos($sr, "    \$journal_toggle_cols = array();\n");
$z = ($a === false) ? false : strpos($sr, "    // Engine C (snippets) toggle awareness.", $a);
$okBlk = false;
if ($a !== false && $z !== false && $z - $a < 6000) {
    $blk = str_replace("require_once __DIR__ . '/journal_export.php';", '', substr($sr, $a, $z - $a));
    try {
        eval('function ut_sched_block_e($apiData, $state, $report_id) { ' . $blk . "\n return \$state; }");
        $okBlk = true;
    } catch (Throwable $e) { $okBlk = false; }
}
if ($okBlk) {
    $st = ut_sched_block_e(array('data' => array(array('ID' => '1')), 'viewMode' => 'standard'),
        array('columnSummaries' => array('__JOURNAL_TOGGLE__DONE' => 'sum')), 'jrfix');
    rec('SE-sched-sum', isset($st['columnSummaries']['DONE']) && $st['columnSummaries']['DONE'] === 'sum', json_encode(isset($st['columnSummaries']) ? $st['columnSummaries'] : null));
} else {
    rec('SE-sched-sum', false, 'the scheduler toggle block not lifted');
}
// ---- 7e: a row that carries the toggle column keeps it
if (!function_exists('journalExportToggleRowValues') && is_file($jePath)) require_once $jePath;
$okEv = function_exists('_snippet_toggle_eval_row') || defineLifted($sr, '_snippet_toggle_eval_row');
if ($okEv && function_exists('journalExportToggleRowValues')) {
    $jt = array('keyUpper' => array('ID'), 'colMeta' => array(array('name' => 'DONE', 'key' => 'done')),
                'stateMap' => array('done' => array('1' => array('by' => 'pat', 'at' => '2026-10-01 09:00:00'))));
    $k1 = _snippet_toggle_eval_row(array('TITLE' => 'x', 'DONE' => '1'), $jt);   // the key column hidden: rendered without it
    $k2 = _snippet_toggle_eval_row(array('ID' => '1'), $jt);
    $k3 = _snippet_toggle_eval_row(array('ID' => '2'), $jt);
    rec('SE-eval-keep', $k1['DONE'] === '1' && $k2['DONE'] === '1' && $k3['DONE'] === '0',
        'rendered row (no key) ' . json_encode($k1) . ', full rows ' . json_encode($k2) . ' ' . json_encode($k3));
} else {
    rec('SE-eval-keep', false, '_snippet_toggle_eval_row / journalExportToggleRowValues not found');
}
}   // $RUN_E

// ======================= ROUND F (2026-10-08): the toggle write rules (item 12). The writes
// are RUN (the Round B fakes) as different callers on reports 7 (journal OFF), 8 (ON, saved
// column "done"), 9 (ENCRYPTED) and 10 (ON, the single toggle of old).
//   SF-off-mark   journal off: a mark (single, bulk) refused - for the owner too - nothing run
//   SF-off-notes  journal off: bulk notes refused
//   SF-enc-open   encrypted: open (the flag cannot be read)
//   SF-key-viewer a viewer: an unsaved toggle key refused, the saved one written
//   SF-key-bulk   the same for a bulk mark
//   SF-key-editor the owner and an app admin may tick a column not saved yet
//   SF-legacy     the single toggle of old is the key "done"
//   SF-cap        the row cap: a mark at the cap refused, an unmark not; a bulk past it refused
if ($RUN_F || $RUN_G) {
// php -n loads no extensions: bulk notes measure the text with mb_strlen first.
if (!function_exists('mb_strlen')) { function mb_strlen($s, $enc = null) { return strlen((string)$s); } }
function runWriteAs($act, $body, $num, $user, $admin, $count = 0) {
    $GLOBALS['OCI'] = array('exec' => array(), 'num' => $num, 'fail' => array(), 'calls' => 0, 'binds' => array(), 'sql' => array(), 'last' => 0);
    $GLOBALS['AUDIT'] = array(); $GLOBALS['CUR_ROWS'] = array(); $GLOBALS['QLOG'] = array();
    $GLOBALS['_JSON_BODY'] = $body; $GLOBALS['BULK_BODY'] = $body;
    $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = $user; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = $admin;
    $GLOBALS['TCOUNT'] = $count;
    $GLOBALS['QFAKE'] = function ($sql, $binds) {
        if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid') !== false && strpos($sql, 'COUNT(*)') !== false) return array(array('C' => $GLOBALS['TCOUNT']));
        return null;
    };
    ob_start(); $err = null;
    try { call_user_func('ut_write_' . $act); } catch (Throwable $e) { $err = get_class($e) . ': ' . $e->getMessage(); }
    $raw = ob_get_clean();
    unset($GLOBALS['QFAKE']);
    $resp = json_decode($raw, true);
    return array('resp' => $resp, 'ok' => is_array($resp) && isset($resp['status']) && $resp['status'] === 'success',
                 'msg' => (is_array($resp) && isset($resp['message'])) ? $resp['message'] : '', 'exec' => count($GLOBALS['OCI']['exec']),
                 'raw' => substr($raw, 0, 200), 'err' => $err);
}
function fb($r) { return ($r['ok'] ? 'written' : 'refused "' . $r['msg'] . '"') . ' (executes ' . $r['exec'] . ')' . ($r['err'] ? ' threw ' . $r['err'] : ''); }
$okW = isset($writeActs['set_toggle']) && $writeActs['set_toggle'] === true && isset($writeActs['set_toggles_bulk']) && $writeActs['set_toggles_bulk'] === true;
$okN = isset($writeActs['add_notes_bulk']) && $writeActs['add_notes_bulk'] === true;
$one = function ($rid, $tk, $state = true) { return array('action' => 'set_toggle', 'report_id' => $rid, 'row_key' => 'K1', 'toggle_key' => $tk, 'state' => $state); };
$many = function ($rid, $tk, $keys = array('A', 'B')) { return array('action' => 'set_toggles_bulk', 'report_id' => $rid, 'toggle_key' => $tk, 'state' => true, 'row_keys' => $keys); };
if ($RUN_F) {
if ($okW) {
    $a1 = runWriteAs('set_toggle', $one('jroff', 'done'), array(1), 'viewer1', false);
    $a2 = runWriteAs('set_toggle', $one('jroff', 'done'), array(1), 'owner1', false);
    $a3 = runWriteAs('set_toggles_bulk', $many('jroff', 'done'), array(1, 1), 'viewer1', false);
    rec('SF-off-mark', !$a1['ok'] && !$a2['ok'] && !$a3['ok'] && $a1['exec'] + $a2['exec'] + $a3['exec'] === 0 && stripos($a1['msg'], 'off') !== false,
        'viewer ' . fb($a1) . ' | owner ' . fb($a2) . ' | bulk ' . fb($a3));
    $e1 = runWriteAs('set_toggle', $one('jrenc', 'anything'), array(1), 'viewer1', false);
    rec('SF-enc-open', $e1['ok'] && $e1['exec'] === 1, fb($e1));
    $k1 = runWriteAs('set_toggle', $one('jron', 'madeup'), array(1), 'viewer1', false);
    $k2 = runWriteAs('set_toggle', $one('jron', 'done'), array(1), 'viewer1', false);
    rec('SF-key-viewer', !$k1['ok'] && $k1['exec'] === 0 && stripos($k1['msg'], 'not part of this report') !== false && $k2['ok'] && $k2['exec'] === 1,
        'unsaved key ' . fb($k1) . ' | saved key ' . fb($k2));
    $k3 = runWriteAs('set_toggles_bulk', $many('jron', 'madeup'), array(1, 1), 'viewer1', false);
    $k4 = runWriteAs('set_toggles_bulk', $many('jron', 'done'), array(1, 1), 'viewer1', false);
    rec('SF-key-bulk', !$k3['ok'] && $k3['exec'] === 0 && $k4['ok'] && $k4['exec'] === 2, 'unsaved key ' . fb($k3) . ' | saved key ' . fb($k4));
    $d1 = runWriteAs('set_toggle', $one('jron', 'toggle9'), array(1), 'owner1', false);
    $d2 = runWriteAs('set_toggle', $one('jron', 'toggle9'), array(1), 'someadmin', true);
    rec('SF-key-editor', $d1['ok'] && $d1['exec'] === 1 && $d2['ok'] && $d2['exec'] === 1, 'owner ' . fb($d1) . ' | admin ' . fb($d2));
    $l1 = runWriteAs('set_toggle', $one('jrleg', 'done'), array(1), 'viewer1', false);
    $l2 = runWriteAs('set_toggle', $one('jrleg', 'other'), array(1), 'viewer1', false);
    rec('SF-legacy', $l1['ok'] && !$l2['ok'], '"done" ' . fb($l1) . ' | "other" ' . fb($l2));
    $cap = defined('JOURNAL_MAX_TOGGLE_ROWS') ? JOURNAL_MAX_TOGGLE_ROWS : 250000;
    $c1 = runWriteAs('set_toggle', $one('jron', 'done', true), array(1), 'viewer1', false, $cap);
    $c2 = runWriteAs('set_toggle', $one('jron', 'done', false), array(1), 'viewer1', false, $cap);
    $c3 = runWriteAs('set_toggles_bulk', $many('jron', 'done'), array(1, 1), 'viewer1', false, $cap - 1);
    $c4 = runWriteAs('set_toggles_bulk', $many('jron', 'done'), array(1, 1), 'viewer1', false, $cap - 2);
    rec('SF-cap', defined('JOURNAL_MAX_TOGGLE_ROWS') && !$c1['ok'] && $c1['exec'] === 0 && $c2['ok'] && !$c3['ok'] && $c3['exec'] === 0 && $c4['ok'] && $c4['exec'] === 2,
        'cap ' . (defined('JOURNAL_MAX_TOGGLE_ROWS') ? JOURNAL_MAX_TOGGLE_ROWS : 'none') . ': a mark at the cap ' . fb($c1) . ' | an unmark ' . fb($c2) . ' | a bulk past it ' . fb($c3) . ' | a bulk up to it ' . fb($c4));
} else {
    foreach (array('SF-off-mark', 'SF-enc-open', 'SF-key-viewer', 'SF-key-bulk', 'SF-key-editor', 'SF-legacy', 'SF-cap') as $id) rec($id, false, 'the toggle writes not lifted');
}
if ($okN) {
    $n1 = runWriteAs('add_notes_bulk', array('action' => 'add_notes_bulk', 'report_id' => 'jroff', 'note_text' => 'Checked.', 'row_keys' => array('A', 'B')), array(1, 1), 'viewer1', false);
    rec('SF-off-notes', !$n1['ok'] && stripos($n1['msg'], 'off') !== false, fb($n1));
} else {
    rec('SF-off-notes', false, 'add_notes_bulk not lifted');
}
}   // $RUN_F asserts

// ======================= ROUND G (2026-10-08): the smaller leftovers - the server half.
//   SG-audit-one   a mark's audit row keeps what its column and the key columns were called
//                  (from the SAVED state, never the request)
//   SG-audit-bulk  the same for a bulk mark
//   SG-audit-none  nothing added when not known: an encrypted state; a column not saved yet
//                  (no label - the key columns still)
//   SG-flags-list  the saved columns read as the page reads them: an EMPTY list falls through
//                  to the single toggle of old (a viewer's mark written, its label recorded)
//   SG-search-ctx  Toggle History hands back each change's names (none on an older row)
//   SG-export-legacy  the single toggle of old is a column of the emails / API: the REAL
//                  journal_export.php resolver, lifted (a fake above takes its name)
if ($RUN_G) {
$gAft = function () { return !empty($GLOBALS['AUDIT']) ? $GLOBALS['AUDIT'][0]['after'] : null; };
$gKc = array('Protocol No.', 'Protocol Type');
if ($okW) {
    $g1 = runWriteAs('set_toggle', $one('jrlab', 'toggle2'), array(1), 'viewer1', false); $ga1 = $gAft();
    rec('SG-audit-one', $g1['ok'] && is_array($ga1) && isset($ga1['label']) && $ga1['label'] === 'Sent'
        && isset($ga1['key_cols']) && $ga1['key_cols'] === $gKc, fb($g1) . ' | audit ' . json_encode($ga1));
    $g2 = runWriteAs('set_toggles_bulk', $many('jrlab', 'toggle1'), array(1, 1), 'viewer1', false); $ga2 = $gAft();
    rec('SG-audit-bulk', $g2['ok'] && is_array($ga2) && !empty($ga2['bulk']) && isset($ga2['label']) && $ga2['label'] === 'Reviewed'
        && isset($ga2['key_cols']) && $ga2['key_cols'] === $gKc, fb($g2) . ' | audit ' . json_encode($ga2));
    $g3 = runWriteAs('set_toggle', $one('jrenc', 'toggle1'), array(1), 'viewer1', false); $ga3 = $gAft();
    $g4 = runWriteAs('set_toggle', $one('jrlab', 'toggle9'), array(1), 'owner1', false); $ga4 = $gAft();
    rec('SG-audit-none', $g3['ok'] && is_array($ga3) && !array_key_exists('label', $ga3) && !array_key_exists('key_cols', $ga3)
        && $g4['ok'] && is_array($ga4) && !array_key_exists('label', $ga4) && isset($ga4['key_cols']) && $ga4['key_cols'] === $gKc,
        'encrypted: ' . fb($g3) . ' audit ' . json_encode($ga3) . ' | a column not saved yet: ' . fb($g4) . ' audit ' . json_encode($ga4));
    $g5 = runWriteAs('set_toggle', $one('jrmix', 'done'), array(1), 'viewer1', false); $ga5 = $gAft();
    rec('SG-flags-list', $g5['ok'] && is_array($ga5) && isset($ga5['label']) && $ga5['label'] === 'Checked', fb($g5) . ' | audit ' . json_encode($ga5));
} else {
    foreach (array('SG-audit-one', 'SG-audit-bulk', 'SG-audit-none', 'SG-flags-list') as $id) rec($id, false, 'the toggle writes not lifted');
}
if ($okS) {
    $GLOBALS['DAUDIT'] = array(
        dRow('pat', '2026-10-07 09:00:00', array('row_key' => 'K1', 'toggle_key' => 'toggle7', 'state' => '1', 'label' => 'Approved', 'key_cols' => array('Proposal ID'))),
        dRow('kim', '2026-10-06 09:00:00', array('bulk' => true, 'toggle_key' => 'toggle1', 'state' => '1', 'row_count' => 2, 'row_keys' => array('K2', 'K3'),
                                                 'label' => 'Reviewed', 'key_cols' => array('ID'))),
        dRow('lee', '2026-10-05 09:00:00', array('row_key' => 'K4', 'toggle_key' => 'toggle1', 'state' => '0')),
    );
    $GLOBALS['DMARKS'] = array();
    $r = runD('toggle_history_search', array('report_id' => 'jrlab'));
    $gs = array();
    foreach ((($r['resp'] && isset($r['resp']['events'])) ? $r['resp']['events'] : array()) as $e) {
        $gs[] = $e['rowKey'] . ':' . (isset($e['label']) ? $e['label'] : '-') . ':' . (isset($e['keyCols']) ? implode('+', $e['keyCols']) : '-');
    }
    rec('SG-search-ctx', implode(' | ', $gs) === 'K1:Approved:Proposal ID | K2:Reviewed:ID | K3:Reviewed:ID | K4:-:-',
        implode(' | ', $gs) . ($r['err'] ? ' | threw ' . $r['err'] : '') . (!$gs ? ' | ' . $r['raw'] : ''));
} else {
    rec('SG-search-ctx', false, 'toggle_history_search not lifted');
}
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$gJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
$gRa = strpos($gJe, "\n    function journalExportToggleResolver(");
$gRb = ($gRa === false) ? null : braceBlock($gJe, $gRa);
$gOk = false;
if ($gRb) {
    $gCode = preg_replace('/^\s*function journalExportToggleResolver\(/', 'function gRealResolver(', substr($gJe, $gRa + 1, $gRb[1] - $gRa));
    try { eval($gCode); $gOk = function_exists('gRealResolver'); } catch (Throwable $e) { $gOk = false; }
}
if ($gOk) {
    $GLOBALS['QFAKE'] = function ($sql, $binds) {
        if (strpos($sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) return array(array('ID' => 10));
        if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID') !== false) return array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '5'));
        return null;
    };
    $gVo = function ($extra) { return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID')), $extra)); };
    $x1 = gRealResolver('jrleg', $gVo(array('journalToggle' => array('label' => 'Checked'))), array('ID'));
    $x2 = gRealResolver('jrleg', $gVo(array('journalToggle' => true)), array('ID'));
    $x3 = gRealResolver('jrleg', $gVo(array('journalToggles' => array(array('key' => 'toggle1', 'label' => 'Reviewed')), 'journalToggle' => true)), array('ID'));
    unset($GLOBALS['QFAKE']);
    $gCm = function ($x) { return is_array($x) ? json_encode($x['colMeta']) : 'null'; };
    rec('SG-export-legacy', is_array($x1) && $x1['colMeta'] === array(array('name' => 'CHECKED', 'key' => 'done')) && isset($x1['stateMap']['done']['5'])
        && is_array($x2) && $x2['colMeta'] === array(array('name' => 'DONE', 'key' => 'done'))
        && is_array($x3) && $x3['colMeta'] === array(array('name' => 'REVIEWED', 'key' => 'toggle1')),
        'the single toggle {label: Checked} -> ' . $gCm($x1) . ' | true -> ' . $gCm($x2) . ' | a list beside it -> ' . $gCm($x3));
} else {
    rec('SG-export-legacy', false, 'journalExportToggleResolver not lifted from ' . $jePath);
}
}   // $RUN_G
}   // $RUN_F || $RUN_G

// ======================= ROUND I (2026-10-08): the who and when columns (item 9) - the server half.
//   SI-res       with viewOptions.journalToggleWho the resolver reads who / when and names "DONE BY" /
//                "DONE ON" - in whoMeta / whoNames, APART from colNames (the toggles alone)
//   SI-res-off   without it: no who columns, the old query
//   SI-values    a marked row: 1 / pat / 2026-10-01; an unmarked one: 0 / '' / ''; $withWho false: the toggle alone
//   SI-decorate  a snapshot row takes the toggle, not who / when
//   SI-columns   the materialized rows carry all three; whoNames is handed back beside colNames
//   SI-sched     the scheduler re-keys a who summary, maps a who grouping, lets snippets name them
//   SI-block     the runner's toggle block: the registry holds the toggles alone, the who columns beside
//   SI-filter    a task filter on "DONE BY" / "DONE ON" (rawData stays clean)
if ($RUN_I) {
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$iJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
$iLift = function ($name, $as, $renames) use ($iJe) {
    $a = strpos($iJe, "\n    function " . $name . '(');
    $bb = ($a === false) ? null : braceBlock($iJe, $a);
    if (!$bb) return false;
    $code = preg_replace('/^\s*function ' . preg_quote($name, '/') . '\(/', 'function ' . $as . '(', substr($iJe, $a + 1, $bb[1] - $a));
    foreach ($renames as $from => $to) $code = str_replace($from, $to, $code);
    try { eval($code); } catch (Throwable $e) { return false; }
    return function_exists($as);
};
$iOk = $iLift('journalExportToggleResolver', 'iRealResolver', array())
    && $iLift('journalExportToggleColumns', 'iRealColumns', array('journalExportToggleResolver(' => 'iRealResolver('));
$iQ = function ($sql, $binds) {
    $GLOBALS['ISQL'][] = $sql;
    if (strpos($sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) return array(array('ID' => 10));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID') !== false) {
        $r = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '5'));
        if (strpos($sql, 'UPDATED_BY') !== false) { $r[0]['UPDATED_BY'] = 'pat'; $r[0]['UPDATED_ON'] = '2026-10-01'; }
        return $r;
    }
    return null;
};
$iState = function ($who) {
    return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID'),
        'journalToggles' => array(array('key' => 'done', 'label' => 'Done'))), $who ? array('journalToggleWho' => true) : array()));
};
if ($iOk) {
    $GLOBALS['ISQL'] = array(); $GLOBALS['QFAKE'] = $iQ;
    $res = iRealResolver('jrleg', $iState(true), array('ID'));
    $sqlWho = implode(' | ', $GLOBALS['ISQL']);
    $GLOBALS['ISQL'] = array();
    $resOff = iRealResolver('jrleg', $iState(false), array('ID'));
    $sqlOff = implode(' | ', $GLOBALS['ISQL']);
    unset($GLOBALS['QFAKE']);
    $kinds = (is_array($res) && isset($res['whoMeta'])) ? array_map(function ($w) { return $w['name'] . ':' . $w['kind']; }, $res['whoMeta']) : array();
    rec('SI-res', is_array($res) && $res['colNames'] === array('DONE') && count($res['colMeta']) === 1
        && isset($res['whoNames']) && $res['whoNames'] === array('DONE BY', 'DONE ON') && $kinds === array('DONE BY:by', 'DONE ON:on')
        && strpos($sqlWho, 'UPDATED_BY') !== false,
        'colNames ' . json_encode(is_array($res) ? $res['colNames'] : null) . ', who ' . json_encode($kinds) . ' | the query reads UPDATED_BY ' . (strpos($sqlWho, 'UPDATED_BY') !== false ? 'yes' : 'no'));
    rec('SI-res-off', is_array($resOff) && empty($resOff['whoNames']) && strpos($sqlOff, 'UPDATED_BY') === false,
        'who ' . json_encode((is_array($resOff) && isset($resOff['whoNames'])) ? $resOff['whoNames'] : null) . ' | the query reads UPDATED_BY ' . (strpos($sqlOff, 'UPDATED_BY') !== false ? 'yes' : 'no'));
    $v1 = journalExportToggleRowValues($res, array('ID' => '5'));
    $v2 = journalExportToggleRowValues($res, array('ID' => '6'));
    $v3 = journalExportToggleRowValues($res, array('ID' => '5'), false);
    rec('SI-values', $v1 === array('DONE' => '1', 'DONE BY' => 'pat', 'DONE ON' => '2026-10-01') && $v2 === array('DONE' => '0', 'DONE BY' => '', 'DONE ON' => '')
        && $v3 === array('DONE' => '1'),
        'marked ' . json_encode($v1) . ' | unmarked ' . json_encode($v2) . ' | without who ' . json_encode($v3));
    $dec = journalDecorateRowsWithToggles(array(array('ID' => '5')), array('journalToggleResolver' => $res));
    rec('SI-decorate', isset($dec[0]['DONE']) && $dec[0]['DONE'] === '1' && !array_key_exists('DONE BY', $dec[0]) && !array_key_exists('DONE ON', $dec[0]),
        'a snapshot row ' . json_encode($dec[0]));
    $iRows = array(array('ID' => '5'), array('ID' => '6'));
    $GLOBALS['QFAKE'] = $iQ;
    $cx = iRealColumns('jrleg', $iState(true), $iRows);
    unset($GLOBALS['QFAKE']);
    rec('SI-columns', $cx['colNames'] === array('DONE') && isset($cx['whoNames']) && $cx['whoNames'] === array('DONE BY', 'DONE ON')
        && isset($iRows[0]['DONE BY']) && $iRows[0]['DONE BY'] === 'pat' && isset($iRows[0]['DONE']) && $iRows[0]['DONE'] === '1'
        && array_key_exists('DONE ON', $iRows[1]) && $iRows[1]['DONE ON'] === '',
        'colNames ' . json_encode($cx['colNames']) . ', whoNames ' . json_encode(isset($cx['whoNames']) ? $cx['whoNames'] : null) . ' | rows ' . json_encode($iRows));
    foreach (array('penumbra_sched_toggle_summaries', 'penumbra_sched_toggle_group_by', '_snippet_merge_journal_cols') as $fn) {
        if (!function_exists($fn)) defineLifted($sr, $fn);
    }
    $ss = penumbra_sched_toggle_summaries(array('columnSummaries' => array('__JOURNAL_BY__DONE' => 'count_distinct', '__JOURNAL_TOGGLE__DONE' => 'sum')), $res);
    $gb = penumbra_sched_toggle_group_by('__JOURNAL_ON__done', $res);
    $mc = _snippet_merge_journal_cols(array('ID'), $res);
    rec('SI-sched', isset($ss['columnSummaries']['DONE BY']) && $ss['columnSummaries']['DONE BY'] === 'count_distinct' && isset($ss['columnSummaries']['DONE'])
        && $gb === 'DONE ON' && $mc === array('ID', 'DONE', 'DONE BY', 'DONE ON'),
        'summaries ' . json_encode($ss['columnSummaries']) . ' | a grouping ' . json_encode($gb) . ' | snippet columns ' . json_encode($mc));
    $psPath = $dir . DIRECTORY_SEPARATOR . 'penumbra_search.php';
    if (!function_exists('php_apply_search_filter') && is_file($psPath)) require_once $psPath;
    if (function_exists('php_apply_search_filter')) {
        $raw = array(array('ID' => '5', 'T' => 'a'), array('ID' => '6', 'T' => 'b'));
        $f1 = php_apply_search_filter($raw, 'standard', 'DONE BY = pat', null, $res);
        $f2 = php_apply_search_filter($raw, 'standard', 'DONE ON >= 2026-10-01', null, $res);
        $f3 = php_apply_search_filter($raw, 'standard', 'DONE = 1', null, $res);
        $ids = function ($rows) { return implode(',', array_map(function ($r) { return isset($r['ID']) ? $r['ID'] : '?'; }, is_array($rows) ? array_values($rows) : array())); };
        $f1v = is_array($f1) ? array_values($f1) : array();
        rec('SI-filter', $ids($f1) === '5' && $ids($f2) === '5' && $ids($f3) === '5' && isset($f1v[0]) && !array_key_exists('DONE BY', $f1v[0]),
            '"DONE BY = pat" -> ' . $ids($f1) . ', "DONE ON >= 2026-10-01" -> ' . $ids($f2) . ', "DONE = 1" -> ' . $ids($f3) . ' | the row it keeps ' . json_encode(isset($f1v[0]) ? $f1v[0] : null));
    } else {
        rec('SI-filter', false, 'no php_apply_search_filter in ' . $psPath);
    }
} else {
    foreach (array('SI-res', 'SI-res-off', 'SI-values', 'SI-decorate', 'SI-columns', 'SI-sched', 'SI-filter') as $id) rec($id, false, 'journal_export.php not lifted');
}
// The runner's toggle block, run with a whoNames-carrying fake: the registry holds the toggles alone.
$ia = strpos($sr, "    \$journal_toggle_cols = array();\n");
$iz = ($ia === false) ? false : strpos($sr, "    // Engine C (snippets) toggle awareness.", $ia);
$iBlk = false;
if ($ia !== false && $iz !== false && $iz - $ia < 6000) {
    $iBlkSrc = str_replace("require_once __DIR__ . '/journal_export.php';", '', substr($sr, $ia, $iz - $ia));
    try {
        eval('function ut_sched_block_i($apiData, $state, $report_id) { ' . $iBlkSrc
            . "\n return array('cols' => \$journal_toggle_cols, 'who' => isset(\$journal_who_cols) ? \$journal_who_cols : null); }");
        $iBlk = true;
    } catch (Throwable $e) { $iBlk = false; }
}
if ($iBlk) {
    // penumbra_sched_notes_col (2026-10-14, notescol4): the block sets the Notes column's registry too.
    foreach (array('penumbra_sched_toggle_cols', 'penumbra_sched_toggle_group_by', 'penumbra_sched_toggle_summaries', 'penumbra_sched_notes_col') as $fn) {
        if (!function_exists($fn)) defineLifted($sr, $fn);
    }
    $GLOBALS['JX_WHO'] = array('DONE BY', 'DONE ON');
    if (function_exists('penumbra_sched_toggle_cols')) penumbra_sched_toggle_cols(array('STALE'));
    $b = ut_sched_block_i(array('data' => array(array('ID' => '1')), 'viewMode' => 'standard'), array(), 'jrfix');
    unset($GLOBALS['JX_WHO']);
    $reg = function_exists('penumbra_sched_toggle_cols') ? array_keys(penumbra_sched_toggle_cols()) : null;
    rec('SI-block', $b['cols'] === array('DONE') && $b['who'] === array('DONE BY', 'DONE ON') && $reg === array('DONE'),
        json_encode(array('toggles' => $b['cols'], 'who' => $b['who'], 'registry' => $reg)));
} else {
    rec('SI-block', false, 'the runner toggle block not lifted');
}
}   // $RUN_I

// ======================= ROUND M (2026-10-08): safe renames (item 10) - the server half.
//   SM-res          a renamed toggle's old names (viewOptions.journalToggles[].oldLabels) map to the column it
//                   is now - its who / when columns' too - never a name a column holds (the data's, another
//                   toggle's) nor "Notes"; journalExportCanonicalCol reads braces through
//   SM-filter       a task filter / the API's search on an old name: the toggle, braces, a who column
//   SM-filter-real  ...but a data column of that name keeps it
//   SM-snippet      snippets: the old names join the column list, a condition tree on one is pointed at the column
//   SM-filterrows   count(Done = ☑): _snippet_filter_rows end to end (the condition parser / evaluator faked)
//   SM-lookup       lookup(T, Done = ☑)
//   SM-format       format(): a condition and a cell target on an old name, only where the rows carry the column
//   SM-rewrite      rewrite(): the same
//   SM-groupby      a grouping level saved under an old name
//   SM-agg          a group summary saved on an old name ("Sum of Done"); a data column of that name keeps it
//   SM-tpl          a template's {Done} / {Done by}; a data column of that name keeps it
if ($RUN_M) {
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$mPs = $dir . DIRECTORY_SEPARATOR . 'penumbra_search.php';
if (!function_exists('php_apply_search_filter') && is_file($mPs)) require_once $mPs;
$mTp = $dir . DIRECTORY_SEPARATOR . 'penumbra_template.php';
if (!function_exists('penumbra_tpl_flat_source') && is_file($mTp)) require_once $mTp;
$mJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
$mOk = false;
$ma = strpos($mJe, "\n    function journalExportToggleResolver(");
$mbb = ($ma === false) ? null : braceBlock($mJe, $ma);
if ($mbb) {
    $mCode = preg_replace('/^\s*function journalExportToggleResolver\(/', 'function mRealResolver(', substr($mJe, $ma + 1, $mbb[1] - $ma));
    try { eval($mCode); $mOk = function_exists('mRealResolver'); } catch (Throwable $e) { $mOk = false; }
}
// Fakes for what the lifted runner functions call beyond the journal (each only if the process lacks it).
if (!function_exists('parse_css_properties')) { function parse_css_properties($s, $allowed) { return array('color' => 'red'); } }
if (!function_exists('cf_agg_fn_names')) { function cf_agg_fn_names() { return 'sum|count|avg|min|max'; } }
if (!function_exists('parse_format_condition')) {
    // "COL = VALUE": a column condition when COL is in the list (braces read through), else a literal.
    function parse_format_condition($c, $cols) {
        if (!preg_match('/^\s*(\{[^}]+\}|[A-Za-z ]+?)\s*=\s*(\S+)\s*$/u', (string)$c, $m)) return array();
        $u = strtoupper(trim($m[1], '{} '));
        foreach ((array)$cols as $x) {
            if (strtoupper((string)$x) === $u) return array(array('type' => 'condition', 'column' => $m[1], 'op' => '=', 'value' => $m[2]));
        }
        return array(array('type' => 'literal', 'leftValue' => $m[1], 'op' => '=', 'value' => $m[2]));
    }
}
if (!function_exists('evaluate_format_condition')) {
    function evaluate_format_condition($row, $parsed) {
        foreach ((array)$parsed as $c) {
            if (!isset($c['type']) || $c['type'] !== 'condition') return false;
            $k = strtoupper(trim($c['column'], '{} ')); $v = null;
            foreach ($row as $rk => $rv) { if (strtoupper((string)$rk) === $k) $v = (string)$rv; }
            if ($v !== (string)$c['value']) return false;
        }
        return true;
    }
}
if (!function_exists('_snippet_set_expanded_columns')) { function _snippet_set_expanded_columns($a = null, $b = null) { return null; } }
if (!function_exists('_snippet_expand_virtual_rows')) { function _snippet_expand_virtual_rows($d, $t, $c, $cols) { return $d; } }
if (!function_exists('penumbra_group_agg_registry_type')) { function penumbra_group_agg_registry_type($t) { return $t; } }
if (!function_exists('penumbra_compute_summary')) {
    function penumbra_compute_summary($cells, $type, $isToggle) {
        $GLOBALS['MSUM'][] = array('cells' => $cells, 'toggle' => $isToggle);
        $s = 0; $n = 0;
        foreach ($cells as $c) { if (is_numeric($c)) { $s += (float)$c; $n++; } }
        return $n ? array('value' => $s) : null;
    }
}
if (!function_exists('penumbra_is_toggle_column')) { function penumbra_is_toggle_column($n) { return strtoupper((string)$n) === 'COMPLETE'; } }
foreach (array('_snippet_journal_toggles', '_snippet_merge_journal_cols', '_snippet_normalize_toggle_tree', '_snippet_toggle_eval_row',
               '_snippet_filter_rows', '_snippet_notes_available', '_snippet_notes_tree', '_snippet_lookup', '_cf_clean_raw_value', 'prepare_format_rules', 'prepare_rewrite_rules',
               'penumbra_sched_toggle_group_by', '_cf_compute_group_agg_raw') as $fn) {
    if (!function_exists($fn)) defineLifted($sr, $fn);
}
$mQ = function ($sql, $binds) {
    if (strpos($sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) return array(array('ID' => 10));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID') !== false) {
        $r = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '5'));
        if (strpos($sql, 'UPDATED_BY') !== false) { $r[0]['UPDATED_BY'] = 'pat'; $r[0]['UPDATED_ON'] = '2026-10-01'; }
        return $r;
    }
    return null;
};
$mState = function ($toggles, $who) {
    return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID'), 'journalToggles' => $toggles),
        $who ? array('journalToggleWho' => true) : array()));
};
$mAm = function ($r) { return (is_array($r) && array_key_exists('aliasMap', $r)) ? $r['aliasMap'] : '(no aliasMap)'; };
$mIds = function ($rows) { return implode(',', array_map(function ($r) { return isset($r['ID']) ? $r['ID'] : '?'; }, is_array($rows) ? array_values($rows) : array())); };
if ($mOk) {
    $GLOBALS['QFAKE'] = $mQ;
    // Renamed from "Done" (and once "Notes") to "Complete", who / when on.
    $resA = mRealResolver('jrleg', $mState(array(array('key' => 'done', 'label' => 'Complete', 'oldLabels' => array('Done', 'Notes'))), true), array('ID', 'T'));
    // Old names the data (STATUS) and another toggle ("Sent") hold now; who / when off.
    $resB = mRealResolver('jrleg', $mState(array(array('key' => 'done', 'label' => 'Complete', 'oldLabels' => array('Done', 'Status', 'Sent')),
                                                 array('key' => 'sent', 'label' => 'Sent')), false), array('ID', 'STATUS'));
    $resC = mRealResolver('jrleg', $mState(array(array('key' => 'done', 'label' => 'Complete')), false), array('ID'));
    unset($GLOBALS['QFAKE']);
    $cc = function_exists('journalExportCanonicalCol');
    $c1 = $cc ? journalExportCanonicalCol('{ done }', $resA) : '-';
    $c2 = $cc ? journalExportCanonicalCol('Done by', $resA) : '-';
    $c3 = $cc ? journalExportCanonicalCol('Status', $resB) : '-';
    rec('SM-res', $mAm($resA) === array('DONE' => 'COMPLETE', 'DONE BY' => 'COMPLETE BY', 'DONE ON' => 'COMPLETE ON')
        && $mAm($resB) === array('DONE' => 'COMPLETE') && $mAm($resC) === array() && $c1 === 'COMPLETE' && $c2 === 'COMPLETE BY' && $c3 === null,
        'renamed, who on ' . json_encode($mAm($resA)) . ' | beside a data column STATUS and a toggle "Sent" ' . json_encode($mAm($resB))
        . ' | never renamed ' . json_encode($mAm($resC)) . ' | "{ done }" -> ' . json_encode($c1) . ', "Done by" -> ' . json_encode($c2) . ', "Status" -> ' . json_encode($c3));
    if (function_exists('php_apply_search_filter')) {
        $raw = array(array('ID' => '5', 'T' => 'a'), array('ID' => '6', 'T' => 'b'));
        $f1 = php_apply_search_filter($raw, 'standard', 'Done = ☑', null, $resA);
        $f2 = php_apply_search_filter($raw, 'standard', 'done = ☐', null, $resA);
        $f3 = php_apply_search_filter($raw, 'standard', '{Done} = 1', null, $resA);
        $f4 = php_apply_search_filter($raw, 'standard', 'Done by = pat', null, $resA);
        $f5 = php_apply_search_filter($raw, 'standard', 'Complete = ☑', null, $resA);
        rec('SM-filter', $mIds($f1) === '5' && $mIds($f2) === '6' && $mIds($f3) === '5' && $mIds($f4) === '5' && $mIds($f5) === '5',
            '"Done = ☑" -> ' . $mIds($f1) . ', "done = ☐" -> ' . $mIds($f2) . ', "{Done} = 1" -> ' . $mIds($f3) . ', "Done by = pat" -> ' . $mIds($f4)
            . ', "Complete = ☑" -> ' . $mIds($f5));
        $raw2 = array(array('ID' => '5', 'DONE' => 'no'), array('ID' => '6', 'DONE' => 'yes'));
        $f6 = php_apply_search_filter($raw2, 'standard', 'Done = yes', null, $resA);
        rec('SM-filter-real', $mIds($f6) === '6', 'rows with a data column DONE: "Done = yes" -> ' . $mIds($f6) . ' (the data column: 6)');
    } else {
        rec('SM-filter', false, 'no php_apply_search_filter in ' . $mPs);
        rec('SM-filter-real', false, 'no php_apply_search_filter in ' . $mPs);
    }
    $mc = _snippet_merge_journal_cols(array('ID'), $resA);
    $mcReal = _snippet_merge_journal_cols(array('ID', 'DONE'), $resA);
    $alias = function_exists('journalExportAliasMapFor') ? journalExportAliasMapFor($resA, array('ID')) : array();
    $tree = array(array('type' => 'condition', 'column' => 'Done', 'op' => '=', 'value' => '☑'), array('type' => 'logical', 'op' => 'and'),
                  array(array('type' => 'condition', 'column' => '{Done by}', 'op' => '=', 'value' => 'pat')));
    $nt = _snippet_normalize_toggle_tree($tree, $resA, $alias);
    rec('SM-snippet', $mc === array('ID', 'COMPLETE', 'COMPLETE BY', 'COMPLETE ON', 'DONE', 'DONE BY', 'DONE ON')
        && $mcReal === array('ID', 'DONE', 'COMPLETE', 'COMPLETE BY', 'COMPLETE ON', 'DONE BY', 'DONE ON')
        && $nt[0]['column'] === 'COMPLETE' && $nt[0]['value'] === '1' && $nt[2][0]['column'] === 'COMPLETE BY' && $nt[2][0]['value'] === 'pat',
        'columns ' . json_encode($mc) . ' | beside a data column DONE ' . json_encode($mcReal) . ' | the tree ' . json_encode($nt));
    _snippet_journal_toggles($resA);
    $rowsS = array(array('ID' => '5', 'T' => 'a'), array('ID' => '6', 'T' => 'b'));
    $fr = _snippet_filter_rows($rowsS, array('ID', 'T'), 'Done = ☑');
    $frB = _snippet_filter_rows($rowsS, array('ID', 'T'), 'Done by = pat');
    rec('SM-filterrows', $mIds($fr) === '5' && $mIds($frB) === '5' && isset($fr[0]) && !array_key_exists('COMPLETE', $fr[0]),
        '"Done = ☑" -> ' . $mIds($fr) . ', "Done by = pat" -> ' . $mIds($frB) . ' | the row it keeps ' . json_encode(isset($fr[0]) ? $fr[0] : null));
    $lk = _snippet_lookup(array('T', 'Done = ☑'), $rowsS, array('ID', 'T'));
    rec('SM-lookup', $lk === "\x02a\x02", 'lookup(T, Done = ☑) -> ' . json_encode($lk));
    $rule = array('type' => 'cell', 'targetColumn' => 'DONE', 'condition' => 'Done = ☑', 'style' => 'color: red');
    $pf = prepare_format_rules(array($rule), array('ID', 'COMPLETE', 'COMPLETE BY', 'COMPLETE ON'));
    $pfP = prepare_format_rules(array($rule), array('ID'));   // a pivot's rows: no toggle column
    $fc = isset($pf['cell'][0]) ? $pf['cell'][0] : array();
    $fcP = isset($pfP['cell'][0]) ? $pfP['cell'][0] : array();
    rec('SM-format', isset($fc['targetColumn']) && $fc['targetColumn'] === 'COMPLETE' && isset($fc['_parsed'][0]['column']) && $fc['_parsed'][0]['column'] === 'COMPLETE'
        && $fc['_parsed'][0]['value'] === '1' && isset($fcP['targetColumn']) && $fcP['targetColumn'] === 'DONE' && isset($fcP['_parsed'][0]['type']) && $fcP['_parsed'][0]['type'] === 'literal',
        'rows with the column: target ' . json_encode(isset($fc['targetColumn']) ? $fc['targetColumn'] : null) . ', condition ' . json_encode(isset($fc['_parsed']) ? $fc['_parsed'] : null)
        . ' | a pivot\'s: target ' . json_encode(isset($fcP['targetColumn']) ? $fcP['targetColumn'] : null) . ', condition ' . json_encode(isset($fcP['_parsed']) ? $fcP['_parsed'] : null));
    $pr = prepare_rewrite_rules(array(array('targetColumn' => 'DONE', 'condition' => 'done = ☐', 'template' => 'todo')), array('ID', 'COMPLETE'));
    $rw = isset($pr[0]) ? $pr[0] : array();
    rec('SM-rewrite', isset($rw['targetColumn']) && $rw['targetColumn'] === 'COMPLETE' && isset($rw['_parsed'][0]['column']) && $rw['_parsed'][0]['column'] === 'COMPLETE'
        && $rw['_parsed'][0]['value'] === '0', 'target ' . json_encode(isset($rw['targetColumn']) ? $rw['targetColumn'] : null) . ', condition ' . json_encode(isset($rw['_parsed']) ? $rw['_parsed'] : null));
    $g1 = penumbra_sched_toggle_group_by('Done', $resA);
    $g2 = penumbra_sched_toggle_group_by('PROTOCOL TYPE, done by', $resA);
    $g3 = penumbra_sched_toggle_group_by('Status', $resB);
    rec('SM-groupby', $g1 === 'COMPLETE' && $g2 === 'PROTOCOL TYPE,COMPLETE BY' && $g3 === 'Status',
        '"Done" -> ' . json_encode($g1) . ', "PROTOCOL TYPE, done by" -> ' . json_encode($g2) . ', "Status" (a data column) -> ' . json_encode($g3));
    $GLOBALS['MSUM'] = array();
    $a1 = _cf_compute_group_agg_raw(array(array('ID' => '1', 'COMPLETE' => '1'), array('ID' => '2', 'COMPLETE' => '0'), array('ID' => '3', 'COMPLETE' => '1')), 'Done', 'sum');
    $a2 = _cf_compute_group_agg_raw(array(array('ID' => '1', 'DONE' => '4', 'COMPLETE' => '1'), array('ID' => '2', 'DONE' => '3', 'COMPLETE' => '0')), 'Done', 'sum');
    _snippet_journal_toggles(false);
    $a3 = _cf_compute_group_agg_raw(array(array('ID' => '1', 'COMPLETE' => '1')), 'Done', 'sum');
    $t1 = isset($GLOBALS['MSUM'][0]['toggle']) ? $GLOBALS['MSUM'][0]['toggle'] : null;
    rec('SM-agg', $a1['value'] == 2 && $t1 === true && $a2['value'] == 7 && $a3['value'] === null,
        'Sum of Done over COMPLETE 1/0/1: ' . json_encode($a1['value']) . ' (the toggle rule ' . json_encode($t1) . ') | rows with a data column DONE 4/3: '
        . json_encode($a2['value']) . ' | no resolver: ' . json_encode($a3['value']));
    if (function_exists('penumbra_tpl_flat_source')) {
        $tRows = array(array('ID' => '5', 'COMPLETE' => '1', 'COMPLETE BY' => 'pat'), array('ID' => '6', 'COMPLETE' => '0', 'COMPLETE BY' => ''));
        $l1 = penumbra_tpl_render_body('{ID}:{Done}:{Done by}:{Complete}', penumbra_tpl_flat_source(array('data' => $tRows, 'viewMode' => 'standard', 'journalToggleResolver' => $resA)), null);
        $l2 = penumbra_tpl_render_body('{Done}', penumbra_tpl_flat_source(array('data' => array(array('ID' => '5', 'DONE' => 'own', 'COMPLETE' => '1')), 'viewMode' => 'standard',
                                                                                'journalToggleResolver' => $resA)), null);
        rec('SM-tpl', $l1 === array('5:1:pat:1', '6:0::0') && $l2 === array('own'), json_encode($l1) . ' | beside a data column DONE: ' . json_encode($l2));
    } else {
        rec('SM-tpl', false, 'no penumbra_tpl_flat_source in ' . $mTp);
    }
} else {
    foreach (array('SM-res', 'SM-filter', 'SM-filter-real', 'SM-snippet', 'SM-filterrows', 'SM-lookup', 'SM-format', 'SM-rewrite', 'SM-groupby', 'SM-agg', 'SM-tpl') as $id) {
        rec($id, false, 'journal_export.php not lifted');
    }
}
}   // $RUN_M

// ======================= ROUND N (2026-10-08): key changes (item 11) - the server half.
// Run on an IN-MEMORY journal (NT: PENUMBRA_JOURNAL_TOGGLE, NN: PENUMBRA_JOURNAL, NA: the audit)
// whose fake OCI applies each statement of the build the way Oracle would (SUBSTR in characters,
// a statement's NOT EXISTS seeing the table as the statement found it, a rollback restoring the
// last commit).
//   SN-sig       a key's signature (upper-cased, KEY_SEP), the tag, splitting a filed ROW_KEY
//   SN-first     a report never filed: its saved key is recorded; nothing moves
//   SN-refile    the saved key changed: every plain mark (any state, every column) and row note is filed
//                under the key recorded (pivot / report notes untouched; a key too long for the tag stays
//                plain); what was filed under the saved key is plain again (one the key holds already
//                stays filed); the record names the saved key
//   SN-once      a second check changes nothing; a re-file that finds the record moved does nothing
//   SN-reads     toggles / row_notes / list never hand out another key's - the filed ones summarized by
//                key (list: the note's own key + FILED_UNDER); used keys leave the record out
//   SN-plan      rekey step 1 (the owner) on a report never filed: its plain ones are taken as the OLD
//                key's (filed under it), and the keys filed under it are listed
//   SN-move      rekey step 2: each old key's marks (any state, every column) and notes go to the new key;
//                a mark the new key holds already stays filed; ONE audit row keeps the new -> old map;
//                what stays is counted
//   SN-refuse    a viewer, the saved key itself, an encrypted report ('nokey')
//   SN-writes    a mark from other key columns refused; the saved ones written (filed first); the
//                record's own toggle key refused
//   SN-history   a moved row's hover history reaches its changes under the old key
//   SN-export    the API / scheduler resolver files first and reads the saved key's marks alone; a
//                failed filing reads none
if ($RUN_N || $RUN_P || $RUN_U || $RUN_V) {
if (!function_exists('mb_strlen')) { function mb_strlen($s, $enc = null) { return (int)preg_match_all('/./us', (string)$s); } }
if (!defined('OCI_NO_AUTO_COMMIT')) define('OCI_NO_AUTO_COMMIT', 0);
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$GLOBALS['NT'] = array(); $GLOBALS['NN'] = array(); $GLOBALS['NA'] = array(); $GLOBALS['NTX'] = null; $GLOBALS['NCLOCK'] = 0;
// Round V (2026-10-09): ROW_KEY's width per table - VARCHAR2(1000) unless a test widens it (NWIDTH; the install
// action's MODIFY sets it through nDdl).
function nWidth($t) { return isset($GLOBALS['NWIDTH'][$t]) ? (int)$GLOBALS['NWIDTH'][$t] : 1000; }
// Round V: the install action's DDL, as Oracle answers it here - a table or index there already (ORA-00955) and a
// column there already (ORA-01430), which the action reads as "nothing to do"; a MODIFY of ROW_KEY sets the width.
// NDDLFAIL[table] = that table's MODIFY fails with the given error instead.
function nDdl($s) {
    $GLOBALS['NDDL'][] = $s;
    if (preg_match('/^ALTER TABLE (?:\w+\.)?(PENUMBRA_JOURNAL(?:_TOGGLE)?) MODIFY \(ROW_KEY VARCHAR2\((\d+)(?: BYTE)?\)\)$/', $s, $m)) {
        if (!empty($GLOBALS['NDDLFAIL'][$m[1]])) { $GLOBALS['NERR'] = $GLOBALS['NDDLFAIL'][$m[1]]; return false; }
        $GLOBALS['NWIDTH'][$m[1]] = (int)$m[2];
        return true;
    }
    if (strpos($s, 'CREATE ') === 0) { $GLOBALS['NERR'] = 'ORA-00955: name is already used by an existing object'; return false; }
    if (preg_match('/^ALTER TABLE \S+ ADD /', $s)) { $GLOBALS['NERR'] = 'ORA-01430: column being added already exists in table'; return false; }
    $GLOBALS['NERR'] = 'ORA-00900: a statement the harness does not know: ' . substr($s, 0, 80);
    return false;
}
function nNow() { $GLOBALS['NCLOCK']++; return sprintf('2026-10-08 12:%02d:%02d', intdiv($GLOBALS['NCLOCK'], 60) % 60, $GLOBALS['NCLOCK'] % 60); }
function nChars($s) { return preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY); }
function nSubstr($s, $start, $len = null) { return implode('', array_slice(nChars($s), $start - 1, $len)); }
function nTx() { if ($GLOBALS['NTX'] === null) $GLOBALS['NTX'] = array($GLOBALS['NT'], $GLOBALS['NN']); }
if (!function_exists('oci_parse')) {
    function getOci8Connection() { return 'oci'; }
    function oci_parse($c, $sql) { $o = new stdClass(); $o->sql = $sql; $o->binds = array(); $o->n = 0; $GLOBALS['NSQL'][] = $sql; return $o; }
    function oci_bind_by_name($st, $name, &$var, $len = -1, $type = 0) { $st->binds[$name] = &$var; return true; }
    function oci_execute($st, $mode = 0) {
        if (!empty($GLOBALS['NFAIL']) && preg_match($GLOBALS['NFAIL'], preg_replace('/\s+/', ' ', $st->sql))) { $GLOBALS['NERR'] = 'ORA-00060: forced'; return false; }
        // Round V (2026-10-09): the install action's DDL.
        if (preg_match('/^\s*(CREATE|ALTER)\s/', $st->sql)) return nDdl(preg_replace('/\s+/', ' ', trim($st->sql)));
        // Round P: another session's change, committed just before this statement (a race, played).
        if (!empty($GLOBALS['NHOOK']) && is_callable($GLOBALS['NHOOK'])) call_user_func($GLOBALS['NHOOK'], preg_replace('/\s+/', ' ', $st->sql));
        $b = array();
        foreach ($st->binds as $k => $v) $b[$k] = (string)$v;   // OCI reads every bind as text
        nTx();
        $keep = $GLOBALS['NT']; $keepN = $GLOBALS['NN'];
        $st->n = nExec($st->sql, $b);
        // ROW_KEY's width, per table (VARCHAR2(1000) unless a test widens it - Round V, nWidth): a longer one fails
        // the statement (ORA-12899).
        foreach (array('NT' => 'PENUMBRA_JOURNAL_TOGGLE', 'NN' => 'PENUMBRA_JOURNAL') as $tbl => $tname) {
            foreach ($GLOBALS[$tbl] as $r) {
                if (isset($r['ROW_KEY']) && strlen((string)$r['ROW_KEY']) > nWidth($tname)) {
                    $GLOBALS['NT'] = $keep; $GLOBALS['NN'] = $keepN; $GLOBALS['NERR'] = 'ORA-12899: value too large for column "' . $tname . '"."ROW_KEY"'; return false;
                }
            }
        }
        // The table's primary key (REPORT_ID, ROW_KEY, TOGGLE_KEY), as Oracle keeps it: a statement
        // that would break it changes nothing and fails.
        $seen = array();
        foreach ($GLOBALS['NT'] as $r) {
            $pk = $r['REPORT_ID'] . "\x00" . $r['ROW_KEY'] . "\x00" . $r['TOGGLE_KEY'];
            if (isset($seen[$pk])) { $GLOBALS['NT'] = $keep; $GLOBALS['NERR'] = 'ORA-00001: unique constraint (PK_PENUMBRA_JRNL_TOGGLE) violated'; return false; }
            $seen[$pk] = true;
        }
        return true;
    }
    function oci_num_rows($st) { return $st->n; }
    function oci_error($x = null) { return array('message' => isset($GLOBALS['NERR']) ? $GLOBALS['NERR'] : 'fake'); }
    function oci_free_statement($st) { return true; }
    function oci_commit($c) { $GLOBALS['NTX'] = null; $GLOBALS['NSQL'][] = '#COMMIT'; return true; }
    function oci_rollback($c) { if ($GLOBALS['NTX'] !== null) { $GLOBALS['NT'] = $GLOBALS['NTX'][0]; $GLOBALS['NN'] = $GLOBALS['NTX'][1]; } $GLOBALS['NTX'] = null; $GLOBALS['NSQL'][] = '#ROLLBACK'; return true; }
}
if (!function_exists('logPenumbraAudit')) {
    function logPenumbraAudit($rid, $action, $before, $after, $msg) {
        $GLOBALS['NA'][] = array('REPORT_ID' => (int)$rid, 'ACTION' => $action, 'USER_ID' => $GLOBALS['currentUserKey'], 'TS' => nNow(), 'AFTER' => $after, 'MSG' => $msg);
    }
}
if (!function_exists('journalIsMissingTableError')) { function journalIsMissingTableError($m) { return false; } }
// A note's insert (Round P): into the in-memory journal, in the current transaction; committed unless the
// caller says it commits ($noCommit, 2026-10-09). $GLOBALS['NINSFAIL'] = n fails the n-th insert.
if (!function_exists('execClobInsert')) {
    function execClobInsert($pdo, $table, $cols, $clobCols, $rawCols = array(), $returnIdCol = null, $noCommit = false) {
        $GLOBALS['NINSN'] = (isset($GLOBALS['NINSN']) ? $GLOBALS['NINSN'] : 0) + 1;
        if (!empty($GLOBALS['NINSFAIL']) && $GLOBALS['NINSN'] >= $GLOBALS['NINSFAIL']) throw new Exception('OCI8 execute failed: ORA-01653: forced');
        nTx();
        $GLOBALS['NNID'] = (isset($GLOBALS['NNID']) ? $GLOBALS['NNID'] : 100) + 1;
        $row = array('ID' => $GLOBALS['NNID'], 'PARENT_ID' => null);
        foreach ($cols as $k => $v) $row[trim($k, '"')] = $v;
        $row['REPORT_ID'] = (int)$row['REPORT_ID'];
        $GLOBALS['NN'][] = $row;
        $GLOBALS['NSQL'][] = 'INSERT INTO ' . $table;
        if (!$noCommit) oci_commit('oci');
        return null;
    }
}
// Statements that write (journalOciRun, rekey's moves, the MERGE of a mark).
function nExec($sql, $b) {
    $s = preg_replace('/\s+/', ' ', $sql); $P = JOURNAL_PARK_OPEN; $n = 0;
    // Round P (2026-10-09): the report row locked before a first record; a stray record dropped; a note deleted;
    // the harness's own table (db_connection.php's insert, run on its own).
    if (strpos($s, 'SELECT ID FROM PENUMBRA_REPORTS WHERE ID = :lrid FOR UPDATE') === 0) { $GLOBALS['NLOCKS'][] = 'report:' . $b[':lrid']; return 0; }
    if (strpos($s, 'DELETE FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :drid AND TOGGLE_KEY = :dkf') === 0) {
        foreach ($GLOBALS['NT'] as $i => $r) {
            if ($r['REPORT_ID'] == $b[':drid'] && $r['TOGGLE_KEY'] === $b[':dkf'] && (int)$r['STATE'] === 9 && $r['ROW_KEY'] !== $b[':dold']) { unset($GLOBALS['NT'][$i]); $n++; }
        }
        $GLOBALS['NT'] = array_values($GLOBALS['NT']);
        return $n;
    }
    if (strpos($s, 'DELETE FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND (') === 0) {
        $ids = array(); foreach ($b as $k => $v) if (preg_match('/^:d\d+$/', $k)) $ids[] = (int)$v;
        foreach ($GLOBALS['NN'] as $i => $r) if ($r['REPORT_ID'] == $b[':rid'] && in_array((int)$r['ID'], $ids, true)) { unset($GLOBALS['NN'][$i]); $n++; }
        $GLOBALS['NN'] = array_values($GLOBALS['NN']);
        return $n;
    }
    if (strpos($s, 'INSERT INTO PNB_HARNESS_T') === 0) return 1;
    if (strpos($s, 'INSERT INTO PENUMBRA_JOURNAL_TOGGLE') === 0 && strpos($s, 'WHERE NOT EXISTS') !== false) {
        foreach ($GLOBALS['NT'] as $r) if ($r['REPORT_ID'] == $b[':rid2'] && $r['TOGGLE_KEY'] === $b[':kf2'] && (int)$r['STATE'] === 9) return 0;
        $GLOBALS['NT'][] = array('REPORT_ID' => (int)$b[':rid'], 'ROW_KEY' => $b[':sig'], 'TOGGLE_KEY' => $b[':kf'], 'STATE' => 9, 'UPDATED_BY' => 'penumbra', 'UPDATED_AT' => nNow());
        return 1;
    }
    if (strpos($s, 'SET ROW_KEY = :knew') !== false) {
        foreach ($GLOBALS['NT'] as $i => $r) {
            if ($r['REPORT_ID'] == $b[':krid'] && $r['TOGGLE_KEY'] === $b[':kkf'] && (int)$r['STATE'] === 9 && $r['ROW_KEY'] === $b[':kold']) {
                $GLOBALS['NT'][$i]['ROW_KEY'] = $b[':knew']; $GLOBALS['NT'][$i]['UPDATED_AT'] = nNow(); $n++;
            }
        }
        return $n;
    }
    if (preg_match('/SET ROW_KEY = :ptag \|\| (T\.)?ROW_KEY/', $s)) {
        // Each clause as the statement has it: a mutant that drops one is judged as Oracle would judge it.
        $notMarker = (bool)preg_match('/TOGGLE_KEY <> :pkf/', $s);
        $plainOnly = (bool)preg_match('/SUBSTR\((T\.)?ROW_KEY, 1, 1\) <> UNISTR/', $s);
        $fits = (strpos($s, 'LENGTHB(') !== false);
        $guard = (strpos($s, 'NOT EXISTS') !== false);   // its filed copy there already: stays plain
        $before = $GLOBALS['NT'];
        foreach ($before as $i => $r) {
            if ($r['REPORT_ID'] != $b[':prid'] || ($notMarker && $r['TOGGLE_KEY'] === $b[':pkf'])) continue;
            if (($plainOnly && strpos($r['ROW_KEY'], $P) === 0) || ($fits && strlen($r['ROW_KEY']) > (int)$b[':pmax'])) continue;
            $clash = false;
            if ($guard) foreach ($before as $r2) if ($r2['REPORT_ID'] == $b[':prid2'] && $r2['TOGGLE_KEY'] === $r['TOGGLE_KEY'] && $r2['ROW_KEY'] === $b[':ptag2'] . $r['ROW_KEY']) $clash = true;
            if ($clash) continue;
            $GLOBALS['NT'][$i]['ROW_KEY'] = $b[':ptag'] . $r['ROW_KEY']; $n++;
        }
        return $n;
    }
    if (strpos($s, 'SET ROW_KEY = :ntag || ROW_KEY') !== false) {
        foreach ($GLOBALS['NN'] as $i => $r) {
            if ($r['REPORT_ID'] == $b[':nrid'] && $r['SCOPE'] === 'row' && $r['ROW_KEY'] !== null && strpos($r['ROW_KEY'], $P) !== 0
                && (strpos($s, 'LENGTHB(') === false || strlen($r['ROW_KEY']) <= (int)$b[':nmax'])) {
                $GLOBALS['NN'][$i]['ROW_KEY'] = $b[':ntag'] . $r['ROW_KEY']; $n++;
            }
        }
        return $n;
    }
    if (strpos($s, 'SET ROW_KEY = SUBSTR(T.ROW_KEY, :ufrom)') !== false) {
        $before = $GLOBALS['NT'];
        foreach ($before as $i => $r) {
            if ($r['REPORT_ID'] != $b[':urid'] || nSubstr($r['ROW_KEY'], 1, (int)$b[':ulen']) !== $b[':utag']) continue;
            $plain = nSubstr($r['ROW_KEY'], (int)$b[':ufrom']);
            $clash = false;
            if (strpos($s, 'NOT EXISTS') !== false)
                foreach ($before as $r2) if ($r2['REPORT_ID'] == $b[':urid2'] && $r2['TOGGLE_KEY'] === $r['TOGGLE_KEY'] && $r2['ROW_KEY'] === nSubstr($r['ROW_KEY'], (int)$b[':ufrom2'])) $clash = true;
            if ($clash) continue;
            $GLOBALS['NT'][$i]['ROW_KEY'] = $plain; $n++;
        }
        return $n;
    }
    if (strpos($s, 'SET ROW_KEY = SUBSTR(ROW_KEY, :vfrom)') !== false) {
        foreach ($GLOBALS['NN'] as $i => $r) {
            if ($r['REPORT_ID'] == $b[':vrid'] && $r['SCOPE'] === 'row' && $r['ROW_KEY'] !== null && nSubstr($r['ROW_KEY'], 1, (int)$b[':vlen']) === $b[':vtag']) {
                $GLOBALS['NN'][$i]['ROW_KEY'] = nSubstr($r['ROW_KEY'], (int)$b[':vfrom']); $n++;
            }
        }
        return $n;
    }
    if (strpos($s, 'SET ROW_KEY = :mnew') !== false) {
        $before = $GLOBALS['NT'];
        foreach ($before as $i => $r) {
            if ($r['REPORT_ID'] != $b[':mrid'] || $r['ROW_KEY'] !== $b[':mold'] || (strpos($s, 'TOGGLE_KEY <> :mkf') !== false && $r['TOGGLE_KEY'] === $b[':mkf'])) continue;
            $clash = false;
            if (strpos($s, 'NOT EXISTS') !== false)
                foreach ($before as $r2) if ($r2['REPORT_ID'] == $b[':mrid2'] && $r2['TOGGLE_KEY'] === $r['TOGGLE_KEY'] && $r2['ROW_KEY'] === $b[':mnew2']) $clash = true;
            if ($clash) continue;
            $GLOBALS['NT'][$i]['ROW_KEY'] = $b[':mnew']; $n++;
        }
        return $n;
    }
    if (strpos($s, 'SET ROW_KEY = :qnew') !== false) {
        foreach ($GLOBALS['NN'] as $i => $r) {
            if ($r['REPORT_ID'] == $b[':qrid'] && $r['SCOPE'] === 'row' && $r['ROW_KEY'] === $b[':qold']) { $GLOBALS['NN'][$i]['ROW_KEY'] = $b[':qnew']; $n++; }
        }
        return $n;
    }
    if (strpos($s, 'MERGE INTO PENUMBRA_JOURNAL_TOGGLE') === 0) {
        foreach ($GLOBALS['NT'] as $i => $r) {
            if ($r['REPORT_ID'] == $b[':rid'] && $r['ROW_KEY'] === $b[':rk'] && $r['TOGGLE_KEY'] === $b[':tk']) {
                if ((string)$r['STATE'] === $b[':st3']) return 0;
                $GLOBALS['NT'][$i]['STATE'] = (int)$b[':st']; $GLOBALS['NT'][$i]['UPDATED_BY'] = $b[':usr']; $GLOBALS['NT'][$i]['UPDATED_AT'] = nNow();
                return 1;
            }
        }
        if ($b[':st4'] !== '1') return 0;
        $GLOBALS['NT'][] = array('REPORT_ID' => (int)$b[':rid'], 'ROW_KEY' => $b[':rk'], 'TOGGLE_KEY' => $b[':tk'], 'STATE' => (int)$b[':st2'], 'UPDATED_BY' => $b[':usr2'], 'UPDATED_AT' => nNow());
        return 1;
    }
    $GLOBALS['NUNKNOWN'][] = $s;
    return 0;
}
// Statements that read (queryViaOci8, through the top fake's QFAKE hook).
function nQuery($sql, $binds) {
    $s = preg_replace('/\s+/', ' ', $sql); $P = JOURNAL_PARK_OPEN; $C = JOURNAL_PARK_CLOSE;
    if (!empty($GLOBALS['NQFAIL']) && preg_match($GLOBALS['NQFAIL'], $s)) throw new Exception('ORA-03113: forced');
    $b = array(); foreach ($binds as $k => $v) $b[$k] = $v;
    $rid = isset($b[':rid']) ? (int)$b[':rid'] : -1;
    // Round P (2026-10-09): the hold - the report's key record, locked (a race may move it first: NHOOK).
    if (strpos($s, 'FOR UPDATE WAIT') !== false && strpos($s, 'TOGGLE_KEY = :hkf') !== false) {
        $GLOBALS['NSQL'][] = $sql;
        if (!empty($GLOBALS['NHOOK']) && is_callable($GLOBALS['NHOOK'])) call_user_func($GLOBALS['NHOOK'], $s);
        $out = array();
        foreach ($GLOBALS['NT'] as $r) if ($r['REPORT_ID'] === (int)$b[':hrid'] && $r['TOGGLE_KEY'] === $b[':hkf'] && (int)$r['STATE'] === 9) $out[] = array('ROW_KEY' => $r['ROW_KEY'], 'AT' => $r['UPDATED_AT']);
        return $out;
    }
    $NT = $GLOBALS['NT']; $NN = $GLOBALS['NN'];
    if (strpos($s, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) {
        $m = $GLOBALS['RID_BY_SID'];
        return isset($m[trim((string)$b[':sid'])]) ? array(array('ID' => $m[trim((string)$b[':sid'])])) : array();
    }
    // Round V (2026-10-09): ROW_KEY's width from the dictionary - NCOLS when a test sets it (rows with an OWNER), else
    // the fake's own widths in the app's schema; an OWNER = CURRENT_SCHEMA clause leaves other schemas' rows out.
    if (strpos($s, 'ALL_TAB_COLUMNS') !== false && strpos($s, 'DATA_LENGTH') !== false) {
        if (!empty($GLOBALS['NCAPFAIL'])) throw new Exception('ORA-01031: forced');
        $GLOBALS['NCAPREADS'] = (isset($GLOBALS['NCAPREADS']) ? $GLOBALS['NCAPREADS'] : 0) + 1;
        $rows = isset($GLOBALS['NCOLS']) ? $GLOBALS['NCOLS'] : array(
            array('OWNER' => 'NC_REPORTING', 'TABLE_NAME' => 'PENUMBRA_JOURNAL', 'CHAR_USED' => 'B', 'CHAR_LENGTH' => nWidth('PENUMBRA_JOURNAL'), 'DATA_LENGTH' => nWidth('PENUMBRA_JOURNAL')),
            array('OWNER' => 'NC_REPORTING', 'TABLE_NAME' => 'PENUMBRA_JOURNAL_TOGGLE', 'CHAR_USED' => 'B', 'CHAR_LENGTH' => nWidth('PENUMBRA_JOURNAL_TOGGLE'), 'DATA_LENGTH' => nWidth('PENUMBRA_JOURNAL_TOGGLE')));
        $own = (bool)preg_match("/OWNER = SYS_CONTEXT\('USERENV', ?'CURRENT_SCHEMA'\)/", $s);
        $out = array();
        foreach ($rows as $r) { if ($own && $r['OWNER'] !== 'NC_REPORTING') continue; unset($r['OWNER']); $out[] = $r; }
        return $out;
    }
    // Round V: the install action's discovery - the session, the journal tables there (NTABLES), the later columns' counts (NCNTCOLS).
    if (strpos($s, "SYS_CONTEXT('USERENV','SESSION_USER')") !== false) return array(array('SESS_USER' => 'PENUMBRA_APP', 'CUR_SCHEMA' => 'NC_REPORTING'));
    if (strpos($s, 'FROM ALL_TABLES') !== false) return isset($GLOBALS['NTABLES']) ? $GLOBALS['NTABLES'] : array();
    if (strpos($s, 'ALL_TAB_COLUMNS') !== false && isset($GLOBALS['NCNTCOLS'])) return array(array('CNT' => $GLOBALS['NCNTCOLS']));
    if (strpos($s, 'ALL_TAB_COLUMNS') !== false) return array(array('CNT' => 0));
    if (strpos($s, 'SELECT ROW_KEY FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND TOGGLE_KEY = :kf AND STATE = 9') === 0) {
        $out = array();
        foreach ($NT as $r) if ($r['REPORT_ID'] === $rid && $r['TOGGLE_KEY'] === $b[':kf'] && (int)$r['STATE'] === 9) $out[] = $r;
        usort($out, function ($x, $y) { return strcmp($y['UPDATED_AT'], $x['UPDATED_AT']); });
        return array_map(function ($r) { return array('ROW_KEY' => $r['ROW_KEY']); }, $out);
    }
    if (strpos($s, 'AS SIG, COUNT(*) AS N') !== false) {
        $notes = strpos($s, 'FROM PENUMBRA_JOURNAL WHERE') !== false; $g = array();
        foreach ($notes ? $NN : $NT as $r) {
            if ($r['REPORT_ID'] !== $rid || $r['ROW_KEY'] === null || strpos($r['ROW_KEY'], $P) !== 0) continue;
            if ($notes ? ($r['SCOPE'] !== 'row') : ((int)$r['STATE'] !== 1)) continue;
            $e = strpos($r['ROW_KEY'], $C);
            if ($e === false) continue;
            $sig = substr($r['ROW_KEY'], strlen($P), $e - strlen($P));
            $g[$sig] = isset($g[$sig]) ? $g[$sig] + 1 : 1;
        }
        $out = array(); foreach ($g as $sig => $c) $out[] = array('SIG' => (string)$sig, 'N' => (string)$c);
        return $out;
    }
    if (strpos($s, 'SELECT DISTINCT SUBSTR(ROW_KEY, :a1) AS K') === 0) {
        $k = array();
        foreach ($NT as $r) if ($r['REPORT_ID'] === $rid && $r['TOGGLE_KEY'] !== $b[':kf'] && nSubstr($r['ROW_KEY'], 1, (int)$b[':a2']) === $b[':tag']) $k[nSubstr($r['ROW_KEY'], (int)$b[':a1'])] = 1;
        foreach ($NN as $r) if ($r['REPORT_ID'] === (int)$b[':rid2'] && $r['SCOPE'] === 'row' && $r['ROW_KEY'] !== null && nSubstr($r['ROW_KEY'], 1, (int)$b[':b2']) === $b[':tag2']) $k[nSubstr($r['ROW_KEY'], (int)$b[':b1'])] = 1;
        return array_map(function ($x) { return array('K' => (string)$x); }, array_keys($k));
    }
    if (strpos($s, 'SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid AND STATE = 1 AND SUBSTR(ROW_KEY, 1, :ln) = :tag') === 0) {
        $c = 0; foreach ($NT as $r) if ($r['REPORT_ID'] === $rid && (int)$r['STATE'] === 1 && nSubstr($r['ROW_KEY'], 1, (int)$b[':ln']) === $b[':tag']) $c++;
        return array(array('C' => (string)$c));
    }
    if (strpos($s, "SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND SCOPE = 'row' AND SUBSTR(ROW_KEY, 1, :ln) = :tag") === 0) {
        $c = 0; foreach ($NN as $r) if ($r['REPORT_ID'] === $rid && $r['SCOPE'] === 'row' && $r['ROW_KEY'] !== null && nSubstr($r['ROW_KEY'], 1, (int)$b[':ln']) === $b[':tag']) $c++;
        return array(array('C' => (string)$c));
    }
    if (strpos($s, 'SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid') === 0) {
        $c = 0; foreach ($NT as $r) if ($r['REPORT_ID'] === $rid) $c++;
        return array(array('C' => (string)$c));
    }
    if (strpos($s, 'SELECT DISTINCT TOGGLE_KEY FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID = :rid') === 0) {
        $k = array();
        foreach ($NT as $r) if ($r['REPORT_ID'] === $rid && (strpos($s, 'TOGGLE_KEY <> :kf') === false || $r['TOGGLE_KEY'] !== $b[':kf'])) $k[$r['TOGGLE_KEY']] = 1;
        return array_map(function ($x) { return array('TOGGLE_KEY' => (string)$x); }, array_keys($k));
    }
    if (strpos($s, 'SELECT TOGGLE_KEY, ROW_KEY') === 0) {
        $plainOnly = strpos($s, 'SUBSTR(ROW_KEY, 1, 1) <> UNISTR') !== false; $out = array();
        foreach ($NT as $r) {
            if ($r['REPORT_ID'] !== $rid || (int)$r['STATE'] !== 1 || ($plainOnly && strpos($r['ROW_KEY'], $P) === 0)) continue;
            $out[] = array('TOGGLE_KEY' => $r['TOGGLE_KEY'], 'ROW_KEY' => $r['ROW_KEY'], 'UPDATED_BY' => $r['UPDATED_BY'], 'UPDATED_AT' => $r['UPDATED_AT'],
                           'UPDATED_ON' => substr($r['UPDATED_AT'], 0, 10));
        }
        return $out;
    }
    if (strpos($s, 'SELECT STATE, UPDATED_BY') === 0) {
        foreach ($NT as $r) if ($r['REPORT_ID'] === $rid && $r['ROW_KEY'] === $b[':rk'] && $r['TOGGLE_KEY'] === $b[':tk']) return array(array('STATE' => (string)$r['STATE'], 'UPDATED_BY' => $r['UPDATED_BY'], 'UPDATED_AT' => $r['UPDATED_AT']));
        return array();
    }
    // notesfresh (2026-10-16): row_notes' version (journalRowNotesVersion) over the notes its WHERE reads -
    // row / pivot / chart, a key, not a row's filed under an earlier key. ORA_HASH as crc32.
    if (strpos($s, 'SELECT COUNT(*) AS CNT, MAX(ID) AS MX, SUM(ORA_HASH(ROW_KEY)) AS KH') === 0) {
        $c = 0; $mx = null; $kh = 0; $tl = 0; $th = 0;
        foreach ($NN as $r) {
            if ($r['REPORT_ID'] !== $rid || !in_array($r['SCOPE'], array('row', 'pivot', 'chart'), true) || $r['ROW_KEY'] === null) continue;
            if (strpos($s, "SCOPE = 'pivot' OR SUBSTR(ROW_KEY, 1, 1) <>") !== false && $r['SCOPE'] !== 'pivot' && strpos($r['ROW_KEY'], $P) === 0) continue;
            $c++; $mx = $mx === null ? (int)$r['ID'] : max($mx, (int)$r['ID']);
            $t = isset($r['NOTE_TEXT']) ? (string)$r['NOTE_TEXT'] : '';
            $kh += crc32($r['ROW_KEY']); $tl += strlen($t); $th += crc32(substr($t, 0, 1000));
        }
        return array(array('CNT' => (string)$c, 'MX' => $mx === null ? null : (string)$mx, 'KH' => $c ? (string)$kh : null,
                           'TL' => $c ? (string)$tl : null, 'TH' => $c ? (string)$th : null));
    }
    if (strpos($s, 'SELECT ID, SCOPE, ROW_KEY, NOTE_TEXT, MENTIONS') === 0) {
        $out = array();
        foreach ($NN as $r) {
            if ($r['REPORT_ID'] !== $rid || ($r['SCOPE'] !== 'row' && $r['SCOPE'] !== 'pivot') || $r['ROW_KEY'] === null) continue;
            if (strpos($s, "SCOPE = 'pivot' OR SUBSTR(ROW_KEY, 1, 1) <>") !== false && $r['SCOPE'] === 'row' && strpos($r['ROW_KEY'], $P) === 0) continue;
            $out[] = $r + array('MENTIONS' => null, 'CREATED_BY' => 'pat', 'AUTHOR_NAME' => 'Pat', 'CREATED_AT' => '2026-10-01 09:00:00');
        }
        return $out;
    }
    if (strpos($s, 'SELECT ID, SCOPE, ROW_KEY, NOTE_TEXT, ROW_SNAPSHOT') === 0) {
        $out = array();
        foreach ($NN as $r) if ($r['REPORT_ID'] === $rid) $out[] = $r + array('ROW_SNAPSHOT' => null, 'MENTIONS' => null, 'RESOLVED' => 0, 'CREATED_BY' => 'pat', 'AUTHOR_NAME' => 'Pat', 'CREATED_AT' => '2026-10-01 09:00:00');
        return $out;
    }
    if (strpos($s, "ACTION = 'JOURNAL_REKEY'") !== false || strpos($s, "ACTION = 'JOURNAL_TOGGLE'") !== false) {
        $act = strpos($s, "ACTION = 'JOURNAL_REKEY'") !== false ? 'JOURNAL_REKEY' : 'JOURNAL_TOGGLE';
        $needles = array(); foreach ($b as $k => $v) if (!in_array($k, array(':rid', ':usr', ':tkn', ':dfrom', ':dto'), true) && preg_match('/' . preg_quote($k, '/') . '(?![A-Za-z0-9_])/', $s)) $needles[] = (string)$v;
        // Round P: the person filter - contains, or that one person (user_exact).
        $usr = (isset($b[':usr']) && strpos($s, ':usr') !== false) ? strtoupper((string)$b[':usr']) : null;
        $usrExact = strpos($s, 'UPPER(USER_ID) = UPPER(:usr)') !== false;
        $out = array();
        foreach (array_reverse($GLOBALS['NA']) as $a) {
            if ($a['REPORT_ID'] !== $rid || $a['ACTION'] !== $act) continue;
            if ($usr !== null && ($usrExact ? strtoupper($a['USER_ID']) !== $usr : strpos(strtoupper($a['USER_ID']), $usr) === false)) continue;
            $hit = !$needles;
            foreach ($needles as $nd) if (strpos($a['AFTER'], $nd) !== false) $hit = true;
            if ($hit) $out[] = array('USER_ID' => $a['USER_ID'], 'TS' => $a['TS'], 'AFT' => $a['AFTER']);
        }
        usort($out, function ($x, $y) { return strcmp($y['TS'], $x['TS']); });   // ORDER BY "TIMESTAMP" DESC
        return $out;
    }
    // Round P (2026-10-09): the page's other reads - a note's add (its thread, the cap, the reply's people),
    // the badge's counts, a delete, an attachment, the bulk notes' cap.
    if (strpos($s, 'SELECT ID, PARENT_ID, SCOPE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE ID = :pid AND REPORT_ID = :rid') === 0) {
        foreach ($NN as $r) if ((int)$r['ID'] === (int)$b[':pid'] && $r['REPORT_ID'] === $rid)
            return array(array('ID' => (string)$r['ID'], 'PARENT_ID' => isset($r['PARENT_ID']) ? $r['PARENT_ID'] : null, 'SCOPE' => $r['SCOPE'], 'ROW_KEY' => $r['ROW_KEY']));
        return array();
    }
    if (strpos($s, 'SELECT 1 AS OK FROM PENUMBRA_JOURNAL WHERE ID = :rid2 AND REPORT_ID = :rid') === 0) {
        foreach ($NN as $r) if ((int)$r['ID'] === (int)$b[':rid2'] && $r['REPORT_ID'] === $rid) return array(array('OK' => '1'));
        return array();
    }
    // Round U: one person's notes on a report (the CREATED_BY clause applied as written)
    if (strpos($s, 'SELECT COUNT(*) AS MINE FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid AND UPPER(CREATED_BY) = UPPER(:cby)') === 0) {
        $c = 0; foreach ($NN as $r) if ($r['REPORT_ID'] === $rid && strtoupper((string)$r['CREATED_BY']) === strtoupper((string)$b[':cby'])) $c++;
        return array(array('MINE' => (string)$c));
    }
    if (strpos($s, 'SELECT COUNT(*) AS CNT FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid') === 0 || strpos($s, 'SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid') === 0) {
        $c = 0; foreach ($NN as $r) if ($r['REPORT_ID'] === $rid) $c++;
        return array(array('CNT' => (string)$c, 'C' => (string)$c));
    }
    if (strpos($s, 'SELECT DISTINCT LOWER(CREATED_BY) AS CREATOR FROM PENUMBRA_JOURNAL') === 0) {
        $u = array();
        foreach ($NN as $r) {
            $root = (isset($r['PARENT_ID']) && $r['PARENT_ID'] !== null) ? (int)$r['PARENT_ID'] : (int)$r['ID'];
            if ($r['REPORT_ID'] === $rid && $root === (int)$b[':root']) $u[strtolower(isset($r['CREATED_BY']) ? $r['CREATED_BY'] : 'pat')] = 1;
        }
        return array_map(function ($x) { return array('CREATOR' => $x); }, array_keys($u));
    }
    if (strpos($s, 'SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL WHERE ID = :root') === 0) {
        foreach ($NN as $r) if ((int)$r['ID'] === (int)$b[':root']) return array(array('ROW_SNAPSHOT' => isset($r['ROW_SNAPSHOT']) ? $r['ROW_SNAPSHOT'] : null));
        return array();
    }
    if (strpos($s, 'SELECT COUNT(*) AS TOTAL') === 0) {
        $GLOBALS['NSUMMARY'] = (isset($GLOBALS['NSUMMARY']) ? $GLOBALS['NSUMMARY'] : 0) + 1;
        $c = 0; foreach ($NN as $r) if ($r['REPORT_ID'] === $rid) $c++;
        return array(array('TOTAL' => (string)$c, 'UNSEEN' => (string)$c, 'LATEST_AT' => '2026-10-01 09:00:00'));
    }
    if (strpos($s, 'SELECT ID, REPORT_ID, NOTE_TEXT, MENTIONS, CREATED_BY, AUTHOR_NAME') === 0 && strpos($s, 'WHERE ID = :nid') !== false) {
        foreach ($NN as $r) if ((int)$r['ID'] === (int)$b[':nid'])
            return array(array('ID' => (string)$r['ID'], 'REPORT_ID' => (string)$r['REPORT_ID'], 'NOTE_TEXT' => $r['NOTE_TEXT'], 'MENTIONS' => null,
                               'CREATED_BY' => isset($r['CREATED_BY']) ? $r['CREATED_BY'] : 'pat', 'AUTHOR_NAME' => null,
                               'PARENT_ID' => isset($r['PARENT_ID']) ? $r['PARENT_ID'] : null, 'CREATED_AT' => '2026-10-01 09:00:00'));
        return array();
    }
    if (strpos($s, 'SELECT ID, REPORT_ID, PARENT_ID, NOTE_TEXT, MENTIONS, CREATED_BY, AUTHOR_NAME') === 0) {
        $out = array(); foreach ($NN as $r) if (isset($r['PARENT_ID']) && $r['PARENT_ID'] !== null && (int)$r['PARENT_ID'] === (int)$b[':nid'] && $r['REPORT_ID'] === $rid) $out[] = $r;
        return $out;
    }
    if (strpos($s, 'SELECT REPORT_ID, ATTACH_NAME, ATTACH_MIME, ATTACH_SIZE FROM PENUMBRA_JOURNAL WHERE ID = :nid') === 0) {
        foreach ($NN as $r) if ((int)$r['ID'] === (int)$b[':nid'])
            return array(array('REPORT_ID' => (string)$r['REPORT_ID'], 'ATTACH_NAME' => isset($r['ATTACH_NAME']) ? $r['ATTACH_NAME'] : null,
                               'ATTACH_MIME' => isset($r['ATTACH_MIME']) ? $r['ATTACH_MIME'] : null, 'ATTACH_SIZE' => '3'));
        return array();
    }
    $GLOBALS['NUNKNOWNQ'][] = $s;
    return null;
}
// The build's actions, run as a page would call them.
foreach (array('journalReportStateFlags', 'journalReportJournalEnabled', 'journalTargetCanOpenJournal', 'journalCallerCanReadJournal',
               'journalCallerHoldsGrant', 'journalToggleWriteRefusal', 'journalToggleRowCount', 'journalToggleAuditContext', 'journalToggleMergeSql',
               'journalToggleCurrent', 'journalEnsureFiledFor', 'journalWriteKeyRefusal', 'journalCallerCanEditReport', 'journalParkedSummary',
               'journalHasAttachColumn', 'journalHasParentColumn',
               // Round P (2026-10-09): the hold, the filed form, and what the page's other actions call
               'journalFilingHold', 'journalRowKeyIsFiledForm', 'journalTargetCanView', 'journalSafeFilename', 'journalRowRefText',
               'journalRowRefLine', 'journalValidPivotKey', 'journalAuthorName',
               // Round U (2026-10-09): one person's share of the notes
               'journalAuthorCapRefusal',
               // Round V (2026-10-09): the install action's DDL
               'journalInstallStatements',
               // notesfresh (2026-10-16): row_notes' one WHERE and its version
               'journalRowNotesWhere', 'journalRowNotesVersion') as $fn) {
    if (!function_exists($fn)) defineLifted($mj, $fn);
}
if (preg_match_all("/define\('(JOURNAL_[A-Z_]+)', (\d+)\);/", $mj, $capM, PREG_SET_ORDER)) {
    foreach ($capM as $cm) if (!defined($cm[1])) define($cm[1], (int)$cm[2]);
}
$nActs = array();
foreach (array('toggles', 'row_notes', 'list', 'rekey', 'set_toggle', 'toggle_history',
               // Round P (2026-10-09)
               'set_toggles_bulk', 'add_notes_bulk', 'add', 'delete', 'attachment', 'summary', 'toggle_history_search',
               // Round V (2026-10-09)
               'install') as $act) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    if (!$bb) continue;
    $body = substr($mj, $bb[0] + 1, $bb[1] - $bb[0] - 1);
    $body = preg_replace('/\bexit\s*(\(\s*\))?\s*;/', 'return;', $body);
    $body = str_replace("json_decode(file_get_contents('php://input'), true)", "\$GLOBALS['BULK_BODY']", $body);
    try {
        eval('function nAct_' . $act . '() { global $conn, $currentUserKey, $user_ouc, $isAdmin, $_JSON_BODY; ' . $body . "\n}");
        $nActs[$act] = true;
    } catch (Throwable $e) { $nActs[$act] = 'parse: ' . $e->getMessage(); }
}
function nRun($act, $get, $body, $user = 'owner1', $admin = false) {
    if (!function_exists('nAct_' . $act)) return array('resp' => null, 'raw' => '', 'err' => 'not lifted');
    $_GET = $get; $GLOBALS['_JSON_BODY'] = $body; $GLOBALS['BULK_BODY'] = $body;
    $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = $user; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = $admin;
    $GLOBALS['QFAKE'] = 'nQuery';
    ob_start(); $err = null;
    try { call_user_func('nAct_' . $act); } catch (Throwable $e) { $err = get_class($e) . ': ' . $e->getMessage(); }
    $raw = ob_get_clean();
    return array('resp' => json_decode($raw, true), 'raw' => substr($raw, 0, 300), 'err' => $err);
}
function nRows($rid, $which = 'NT') {
    $out = array();
    foreach ($GLOBALS[$which] as $r) if ($r['REPORT_ID'] === $rid) $out[] = ($which === 'NT') ? ($r['TOGGLE_KEY'] . ':' . $r['ROW_KEY'] . ':' . $r['STATE']) : ($r['SCOPE'] . ':' . $r['ROW_KEY']);
    sort($out);
    return $out;
}
function nShow($v) { return str_replace(array("\xE2\x90\x82", "\xE2\x90\x83", "\xE2\x90\x9F"), array('<', '>', '+'), json_encode($v, JSON_UNESCAPED_UNICODE)); }
$S = "\xE2\x90\x9F";
// Reports: 13 saved with the key TITLE, 14 with ID; 9 is ENCRYPTED. owner1 owns them; viewer1 may view.
$GLOBALS['REPORTS'][13] = array('ID' => 13, 'SHORT_ID' => 'jrkt', 'TITLE' => 'Key TITLE', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1');
$GLOBALS['REPORTS'][14] = array('ID' => 14, 'SHORT_ID' => 'jrki', 'TITLE' => 'Key ID', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1');
$GLOBALS['RID_BY_SID']['jrkt'] = 13; $GLOBALS['RID_BY_SID']['jrki'] = 14;
$GLOBALS['STATES'][13] = '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalKeyColumns":["Title"],"journalToggles":[{"key":"done","label":"Done"},{"key":"sent","label":"Sent"}]}}';
$GLOBALS['STATES'][14] = '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalKeyColumns":["ID"],"journalToggles":[{"key":"done","label":"Done"},{"key":"__keyfile","label":"Filed"}]}}';
$GLOBALS['QFAKE'] = 'nQuery';
if ($RUN_N) {
$jeOk = function_exists('journalEnsureFiled') && function_exists('journalKeySig');
if ($jeOk) {
    $sig = journalKeySig(array(' protocol no. ', 'Protocol Type', '')); $tag = journalParkTag('ID'); $sp = journalSplitParked($tag . '5');
    rec('SN-sig', $sig === 'PROTOCOL NO.' . $S . 'PROTOCOL TYPE' && $tag === "\xE2\x90\x82ID\xE2\x90\x83" && $sp === array('5', 'ID') && journalSplitParked('5') === array('5', null),
        nShow(array('sig' => $sig, 'tag' => $tag, 'split' => $sp)));
    // A report never filed: its key is recorded, nothing moves.
    $GLOBALS['NT'] = array(array('REPORT_ID' => 14, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'));
    $GLOBALS['NN'] = array(array('ID' => 1, 'REPORT_ID' => 14, 'SCOPE' => 'row', 'ROW_KEY' => '5', 'NOTE_TEXT' => 'n'));
    $f1 = journalEnsureFiled(14, array('ID'));
    rec('SN-first', $f1 === 'created' && nRows(14) === array('__keyfile:ID:9', 'done:5:1') && nRows(14, 'NN') === array('row:5'),
        'state ' . $f1 . ' | marks ' . nShow(nRows(14)) . ' | notes ' . nShow(nRows(14, 'NN')));
    // Report 13 was keyed on PROTOCOL NO. (recorded), and is saved with TITLE now. $L: a key the
    // PROTOCOL NO. tag (18 bytes) cannot take - and filed under TITLE (11 bytes) at an earlier change.
    $L = str_repeat('x', 985);
    $GLOBALS['NT'] = array(
        array('REPORT_ID' => 13, 'ROW_KEY' => 'PROTOCOL NO.', 'TOGGLE_KEY' => '__keyfile', 'STATE' => 9, 'UPDATED_BY' => 'penumbra', 'UPDATED_AT' => '2026-10-01 08:00:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => '6', 'TOGGLE_KEY' => 'done', 'STATE' => 0, 'UPDATED_BY' => 'lee', 'UPDATED_AT' => '2026-10-01 09:10:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'sent', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:20:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => $L, 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:30:00'),
        // its PROTOCOL NO. copy filed already (it could not come back at an earlier change): this one stays plain
        array('REPORT_ID' => 13, 'ROW_KEY' => '6', 'TOGGLE_KEY' => 'sent', 'STATE' => 0, 'UPDATED_BY' => 'lee', 'UPDATED_AT' => '2026-10-01 09:40:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => journalParkTag('PROTOCOL NO.') . '6', 'TOGGLE_KEY' => 'sent', 'STATE' => 0, 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-09-01 09:40:00'),
        // filed under TITLE at an earlier change: given back - but the long one's spot in "done" is taken (it stays plain)
        array('REPORT_ID' => 13, 'ROW_KEY' => journalParkTag('TITLE') . 'Beta', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-09-01 09:00:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => journalParkTag('TITLE') . $L, 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-09-01 09:05:00'),
        array('REPORT_ID' => 99, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'));
    $GLOBALS['NN'] = array(
        array('ID' => 1, 'REPORT_ID' => 13, 'SCOPE' => 'row', 'ROW_KEY' => '5', 'NOTE_TEXT' => 'a'),
        array('ID' => 2, 'REPORT_ID' => 13, 'SCOPE' => 'pivot', 'ROW_KEY' => '[["ID","5"]]', 'NOTE_TEXT' => 'b'),
        array('ID' => 3, 'REPORT_ID' => 13, 'SCOPE' => 'report', 'ROW_KEY' => null, 'NOTE_TEXT' => 'c'),
        array('ID' => 4, 'REPORT_ID' => 13, 'SCOPE' => 'row', 'ROW_KEY' => journalParkTag('TITLE') . 'Beta', 'NOTE_TEXT' => 'd'));
    $f2 = journalEnsureFiled(13, array('Title'));
    $tI = journalParkTag('ID'); $tP = journalParkTag('PROTOCOL NO.');
    $wantT = array('__keyfile:TITLE:9', 'done:Beta:1', 'done:' . $L . ':1', 'done:' . $tP . '5:1', 'done:' . $tP . '6:0', 'done:' . journalParkTag('TITLE') . $L . ':1', 'sent:' . $tP . '5:1',
                   'sent:6:0', 'sent:' . $tP . '6:0');
    sort($wantT);
    $wantN = array('pivot:[["ID","5"]]', 'report:', 'row:Beta', 'row:' . $tP . '5'); sort($wantN);
    rec('SN-refile', $f2 === 'refiled' && nRows(13) === $wantT && nRows(13, 'NN') === $wantN && nRows(99) === array('done:5:1'),
        'state ' . $f2 . ' | marks ' . nShow(nRows(13)) . ' | notes ' . nShow(nRows(13, 'NN')) . ' | another report ' . nShow(nRows(99)));
    $beforeOnce = array(nRows(13), nRows(13, 'NN'));
    $f3 = journalEnsureFiled(13, array('TITLE'));
    // Someone else re-filed between the read and the write: the record names another key now.
    try { $r4 = journalRefile(13, 'PROTOCOL NO.', 'OTHER'); } catch (Throwable $e) { $r4 = 'threw: ' . $e->getMessage(); }
    rec('SN-once', $f3 === 'ok' && $r4 === false && array(nRows(13), nRows(13, 'NN')) === $beforeOnce && $GLOBALS['NTX'] === null,
        'again ' . $f3 . ' | a stale re-file ' . json_encode($r4) . ' | unchanged ' . json_encode(array(nRows(13), nRows(13, 'NN')) === $beforeOnce));
    // What a page reads now.
    $rt = nRun('toggles', array('report_id' => 'jrkt'), null, 'viewer1');
    $rn = nRun('row_notes', array('report_id' => 'jrkt'), null, 'viewer1');
    $rl = nRun('list', array('report_id' => 'jrkt'), null, 'viewer1');
    $tg = isset($rt['resp']['toggles']) ? $rt['resp']['toggles'] : null;
    $pl = null; if (isset($rl['resp']['data'])) foreach ($rl['resp']['data'] as $d) if ((int)$d['ID'] === 1) $pl = $d;
    $tgDone = (is_array($tg) && isset($tg['done'])) ? array_map('strval', array_keys($tg['done'])) : array(); sort($tgDone);
    $wantDone = array('Beta', $L); sort($wantDone);
    rec('SN-reads', is_array($tg) && array_keys($tg) === array('done') && $tgDone === $wantDone
        && isset($rt['resp']['used_keys']) && !in_array('__keyfile', $rt['resp']['used_keys'], true) && in_array('sent', $rt['resp']['used_keys'], true)
        && isset($rt['resp']['parked']) && $rt['resp']['parked'] === array(array('cols' => array('PROTOCOL NO.'), 'marks' => 2), array('cols' => array('TITLE'), 'marks' => 1))
        && isset($rn['resp']['counts']) && array_keys($rn['resp']['counts']) === array('Beta') && isset($rn['resp']['pivot_counts']['[["ID","5"]]'])
        && isset($rn['resp']['parked']) && $rn['resp']['parked'] === array(array('cols' => array('PROTOCOL NO.'), 'notes' => 1))
        && is_array($pl) && $pl['ROW_KEY'] === '5' && isset($pl['FILED_UNDER']) && $pl['FILED_UNDER'] === array('PROTOCOL NO.'),
        'toggles ' . nShow($tg) . ' used ' . nShow(isset($rt['resp']['used_keys']) ? $rt['resp']['used_keys'] : null) . ' parked ' . nShow(isset($rt['resp']['parked']) ? $rt['resp']['parked'] : $rt['raw'])
        . ' | row notes ' . nShow(isset($rn['resp']['counts']) ? $rn['resp']['counts'] : $rn['raw']) . ' parked ' . nShow(isset($rn['resp']['parked']) ? $rn['resp']['parked'] : null)
        . ' | list note 1 ' . nShow($pl));
    // A page's first read after the key changed files first (each read on its own - the first files both):
    // report 13 recorded as ID, saved with TITLE; a mark and a note on 5.
    $rfSeed = function () {
        $GLOBALS['NT'] = array(
            array('REPORT_ID' => 13, 'ROW_KEY' => 'ID', 'TOGGLE_KEY' => '__keyfile', 'STATE' => 9, 'UPDATED_BY' => 'penumbra', 'UPDATED_AT' => '2026-10-01 08:00:00'),
            array('REPORT_ID' => 13, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'));
        $GLOBALS['NN'] = array(array('ID' => 1, 'REPORT_ID' => 13, 'SCOPE' => 'row', 'ROW_KEY' => '5', 'NOTE_TEXT' => 'a'));
    };
    $rfSeed(); $rfT = nRun('toggles', array('report_id' => 'jrkt'), null, 'viewer1');
    $rfSeed(); $rfN = nRun('row_notes', array('report_id' => 'jrkt'), null, 'viewer1');
    $rfTg = isset($rfT['resp']['toggles']) ? $rfT['resp']['toggles'] : null;
    $rfCn = isset($rfN['resp']['counts']) ? $rfN['resp']['counts'] : null;
    rec('SN-read-files', $rfTg === array() && isset($rfT['resp']['parked']) && $rfT['resp']['parked'] === array(array('cols' => array('ID'), 'marks' => 1))
        && $rfCn === array() && isset($rfN['resp']['parked']) && $rfN['resp']['parked'] === array(array('cols' => array('ID'), 'notes' => 1)),
        'toggles ' . nShow($rfTg) . ' parked ' . nShow(isset($rfT['resp']['parked']) ? $rfT['resp']['parked'] : $rfT['raw'])
        . ' | row notes ' . nShow($rfCn) . ' parked ' . nShow(isset($rfN['resp']['parked']) ? $rfN['resp']['parked'] : $rfN['raw']));
    // rekey step 1 on report 14 (recorded as ID) - moving from ID to... 14 is saved with ID: refused (the saved key itself).
    $GLOBALS['NT'] = array(); $GLOBALS['NN'] = array(); $GLOBALS['NA'] = array();
    $q1 = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrki', 'from_cols' => array('id')), 'owner1');
    $q2 = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrkt', 'from_cols' => array('ID')), 'viewer1');
    $q3 = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrenc', 'from_cols' => array('ID')), 'owner1');
    rec('SN-refuse', isset($q1['resp']['status']) && $q1['resp']['status'] === 'error' && stripos($q1['resp']['message'], 'saved with already') !== false
        && isset($q2['resp']['status']) && $q2['resp']['status'] === 'error' && stripos($q2['resp']['message'], 'edit the report') !== false
        && isset($q3['resp']['reason']) && $q3['resp']['reason'] === 'nokey' && empty($GLOBALS['NT']),
        'the saved key ' . nShow($q1['resp'] ? $q1['resp'] : $q1['raw']) . ' | a viewer ' . nShow($q2['resp'] ? $q2['resp'] : $q2['raw']) . ' | encrypted ' . nShow($q3['resp'] ? $q3['resp'] : $q3['raw']));
    // Report 13 (saved TITLE), never filed, marks written under ID: step 1 files them under ID, lists 5 / 6 / 7.
    $GLOBALS['NT'] = array(
        array('REPORT_ID' => 13, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => '6', 'TOGGLE_KEY' => 'done', 'STATE' => 0, 'UPDATED_BY' => 'lee', 'UPDATED_AT' => '2026-10-01 09:10:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'sent', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:20:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => '7', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:30:00'),
        array('REPORT_ID' => 13, 'ROW_KEY' => 'Gamma', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-09-01 09:00:00'));
    $GLOBALS['NN'] = array(array('ID' => 1, 'REPORT_ID' => 13, 'SCOPE' => 'row', 'ROW_KEY' => '5', 'NOTE_TEXT' => 'a'),
                           array('ID' => 2, 'REPORT_ID' => 13, 'SCOPE' => 'row', 'ROW_KEY' => '8', 'NOTE_TEXT' => 'b'));
    $GLOBALS['NA'] = array(array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'pat', 'TS' => '2026-10-01 09:00:00',
                                 'AFTER' => json_encode(array('row_key' => '5', 'toggle_key' => 'done', 'state' => 1, 'key_cols' => array('ID')))),
                           array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'kim', 'TS' => '2026-09-01 09:00:00',
                                 'AFTER' => json_encode(array('row_key' => 'Alpha', 'toggle_key' => 'done', 'state' => 1))));
    $p1 = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrkt', 'from_cols' => array('id')), 'owner1');
    $keys = isset($p1['resp']['keys']) ? $p1['resp']['keys'] : array(); sort($keys);
    rec('SN-plan', isset($p1['resp']['status']) && $p1['resp']['status'] === 'success' && $keys === array('5', '6', '7', '8', 'Gamma') && in_array('__keyfile:TITLE:9', nRows(13), true)
        && in_array('done:' . $tI . '5:1', nRows(13), true) && in_array('done:' . $tI . 'Gamma:1', nRows(13), true),
        'answer ' . nShow($p1['resp'] ? $p1['resp'] : $p1['raw']) . ' | marks ' . nShow(nRows(13)));
    // Step 2: 5 -> Alpha, 6 -> Beta, 8 -> Delta; 7 -> Gamma, whose "done" spot is taken (a mark filed with it at
    // step 1 and a fresh plain one): 7 stays filed.
    $GLOBALS['NT'][] = array('REPORT_ID' => 13, 'ROW_KEY' => 'Gamma', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-10-08 08:00:00');
    $m1 = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrkt', 'from_cols' => array('ID'),
                                       'pairs' => array(array('5', 'Alpha'), array('6', 'Beta'), array('8', 'Delta'), array('7', 'Gamma'), array('9', 'Zeta'),
                                                        // an old key twice: the first one goes; a new key in the filed form: refused
                                                        array('5', 'Omega'), array('Gamma', journalParkTag('TITLE') . 'x'))), 'owner1');
    $rk = null; foreach ($GLOBALS['NA'] as $a) if ($a['ACTION'] === 'JOURNAL_REKEY') $rk = json_decode($a['AFTER'], true);
    rec('SN-move', isset($m1['resp']['status']) && $m1['resp']['status'] === 'success' && $m1['resp']['marks'] === 3 && $m1['resp']['notes'] === 2
        && $m1['resp']['left_marks'] === 2 && $m1['resp']['left_notes'] === 0
        && in_array('done:Alpha:1', nRows(13), true) && in_array('sent:Alpha:1', nRows(13), true) && in_array('done:Beta:0', nRows(13), true)
        && in_array('done:' . $tI . '7:1', nRows(13), true) && in_array('done:Gamma:1', nRows(13), true) && nRows(13, 'NN') === array('row:Alpha', 'row:Delta')
        && is_array($rk) && $rk['marks'] === 3 && $rk['notes'] === 2 && $rk['moved'] === array('Alpha' => '5', 'Beta' => '6', 'Delta' => '8')
        && $rk['from_cols'] === array('ID') && $rk['to_cols'] === array('Title'),
        'answer ' . nShow($m1['resp'] ? $m1['resp'] : $m1['raw']) . ' | marks ' . nShow(nRows(13)) . ' | notes ' . nShow(nRows(13, 'NN')) . ' | audit ' . nShow($rk));
    // Alpha's hover history: its change under the old key 5, and the old Alpha change (a different row then) - both.
    $h1 = nRun('toggle_history', array('report_id' => 'jrkt', 'row_key' => 'Alpha', 'toggle_key' => 'done'), null, 'viewer1');
    $hb = isset($h1['resp']['events']) ? array_map(function ($e) { return $e['by']; }, $h1['resp']['events']) : null;
    rec('SN-history', $hb === array('pat', 'kim'), 'events by ' . nShow($hb) . ($h1['err'] ? ' threw ' . $h1['err'] : ''));
    // Writes: other key columns refused; the saved ones written (the report filed first); the record's key refused.
    $GLOBALS['NT'] = array(array('REPORT_ID' => 14, 'ROW_KEY' => 'x', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'));
    $GLOBALS['NN'] = array();
    $w1 = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrki', 'row_key' => '9', 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('TITLE')), 'viewer1');
    $n1 = count($GLOBALS['NT']);
    $w2 = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrki', 'row_key' => '9', 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('id')), 'viewer1');
    $w3 = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrki', 'row_key' => '9', 'toggle_key' => '__keyfile', 'state' => true), 'owner1');
    rec('SN-writes', isset($w1['resp']['status']) && $w1['resp']['status'] === 'error' && stripos($w1['resp']['message'], 'key columns on this page') !== false && $n1 === 1
        && isset($w2['resp']['status']) && $w2['resp']['status'] === 'success' && nRows(14) === array('__keyfile:ID:9', 'done:9:1', 'done:x:1')
        && isset($w3['resp']['status']) && $w3['resp']['status'] === 'error',
        'other key ' . nShow($w1['resp'] ? $w1['resp'] : $w1['raw']) . ' | saved key ' . nShow($w2['resp'] ? $w2['resp'] : $w2['raw']) . ' | the record\'s key ' . nShow($w3['resp'] ? $w3['resp'] : $w3['raw'])
        . ' | marks ' . nShow(nRows(14)));
    // The resolver (the API, the scheduler): files first, reads the saved key's marks alone; a failed filing reads none.
    $nJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
    $na = strpos($nJe, "\n    function journalExportToggleResolver(");
    $nbb = ($na === false) ? null : braceBlock($nJe, $na);
    $nOk = false;
    if ($nbb) {
        try { eval(preg_replace('/^\s*function journalExportToggleResolver\(/', 'function nRealResolver(', substr($nJe, $na + 1, $nbb[1] - $na))); $nOk = function_exists('nRealResolver'); }
        catch (Throwable $e) { $nOk = false; }
    }
    if ($nOk) {
        $GLOBALS['NT'] = array(
            array('REPORT_ID' => 13, 'ROW_KEY' => 'ID', 'TOGGLE_KEY' => '__keyfile', 'STATE' => 9, 'UPDATED_BY' => 'penumbra', 'UPDATED_AT' => '2026-10-01 08:00:00'),
            array('REPORT_ID' => 13, 'ROW_KEY' => 'Alpha', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'),
            array('REPORT_ID' => 13, 'ROW_KEY' => journalParkTag('TITLE') . 'Beta', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'kim', 'UPDATED_AT' => '2026-09-01 09:00:00'));
        $GLOBALS['NN'] = array();
        $st13 = json_decode($GLOBALS['STATES'][13], true);
        $res = nRealResolver('jrkt', $st13, array('TITLE'));
        $sm = (is_array($res) && isset($res['stateMap']['done'])) ? array_keys($res['stateMap']['done']) : null;
        // A failed filing (the record cannot be read): no toggle read at all.
        $GLOBALS['NQFAIL'] = '/TOGGLE_KEY = :kf AND STATE = 9/';
        $res2 = nRealResolver('jrkt', $st13, array('TITLE'));
        unset($GLOBALS['NQFAIL']);
        rec('SN-export', $sm === array('Beta') && $res2 === null && in_array('done:' . $tI . 'Alpha:1', nRows(13), true),
            'marks read ' . nShow($sm) . ' | after a failed filing ' . nShow($res2) . ' | marks ' . nShow(nRows(13)));
    } else {
        rec('SN-export', false, 'journalExportToggleResolver not lifted');
    }
} else {
    foreach (array('SN-sig', 'SN-first', 'SN-refile', 'SN-once', 'SN-reads', 'SN-read-files', 'SN-plan', 'SN-move', 'SN-refuse', 'SN-writes', 'SN-history', 'SN-export') as $id) {
        rec($id, false, 'journal_export.php has no key filing (journalEnsureFiled)');
    }
}
// Wiring (2026-10-08): every row write of the page files the report first and holds the page to the saved
// key, the marks' writes refuse the record's own toggle key, and the page loads the filing.
$wired = array(); $wiredOk = true;
foreach (array('set_toggle' => 3, 'set_toggles_bulk' => 3, 'add_notes_bulk' => 2, 'add' => 2) as $act => $need) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    $body = $bb ? substr($mj, $bb[0], $bb[1] - $bb[0]) : '';
    $have = (strpos($body, 'journalEnsureFiledFor($report)') !== false ? 1 : 0) + (strpos($body, 'journalWriteKeyRefusal($report, ') !== false ? 1 : 0)
          + (strpos($body, "strpos(\$toggle_key, '__') === 0") !== false ? 1 : 0);
    $wired[$act] = $have . '/' . $need;
    if ($have !== $need) $wiredOk = false;
}
$wiredReq = strpos($mj, "\nrequire_once 'journal_export.php';") !== false;
rec('SN-wired', $wiredOk && $wiredReq, json_encode($wired) . ' | requires journal_export.php ' . json_encode($wiredReq));
if (!empty($GLOBALS['NUNKNOWN']) || !empty($GLOBALS['NUNKNOWNQ'])) {
    rec('SN-sql', false, 'statements the fake does not know: ' . nShow(array_slice(array_merge((array)@$GLOBALS['NUNKNOWN'], (array)@$GLOBALS['NUNKNOWNQ']), 0, 6)));
} else {
    rec('SN-sql', true, 'every statement known to the fake');
}
}   // the mode n asserts
if ($RUN_P || $RUN_U) {   // mode u (Round U) shares this setup; the SP asserts below are mode p's
// ======================= ROUND P (2026-10-09): the journal / toggle close-out bug sweep, server half - on
// mode n's in-memory journal (its fakes above); the build's actions run as the page calls them.
//   SP-saved-key   the resolver files by the SAVED key: another version's state reads none, moves nothing (K3)
//   SP-enc         an encrypted report is never filed: the scheduler reads its marks as the page does (K1)
//   SP-one-record  a first filing locks the report row before it records; a second record is dropped (K4)
//   SP-race        a re-file that lost a race reads the record again and files by it (K4)
//   SP-long-key    a key too long to record is not filed: the report's marks still write (K12)
//   SP-hold        every row write holds the filing in its transaction: a key changed under it refuses (K6)
//   SP-cleared     a page naming a key after the report's key was cleared is refused (K7)
//   SP-rekey-page  the move refuses a page whose key is not the saved one (K5)
//   SP-filed-form  a row key in the filed form is refused by every row write (S5)
//   SP-add-gate    a note on a journal-off report: refused for a viewer, written for the owner (S2)
//   SP-reply-filed a reply goes where its thread is filed, and its e-mail names the row plainly (S6)
//   SP-mention-row the row's values go only to a mention who may view the report (S7)
//   SP-summary     a viewer of a journal-off report gets no counts, and none are read (S8)
//   SP-bulk-atomic bulk notes are all or none (S9)
//   SP-delete      the documented rule holds: a note's author or an app admin deletes it, the report's owner does
//                  not (a guard: the sweep's S3 asked to change it - a decision for the user, not a fix)
//   SP-grant       a mentioned report-grant holder may view the report (S4)
//   SP-filename    an attachment's name fits 400 bytes and keeps its extension (S10)
//   SP-attach-fail a failed attachment read is an error, not an empty file (S12)
//   SP-hist-legacy a change from before toggle keys is the "done" column's only (S11)
//   SP-hist-era    the hover history leaves out a change made under other key columns (K11)
//   SP-hist-memory both history reads stop at the memory line and say partial (S1)
//   SP-user-exact  the exact-person filter is that person only (P3)
//   SP-db          execClobInsert's $noCommit and queryViaOci8Each, from the build's db_connection.php
//   SP-wired       the five row writes hold the filing; the page files by the state it read
//   SP-safe-msg    every message the row writes throw on purpose is on the endpoint's safe list (else generic)
//   SP-sql         every statement known to the fake
$GLOBALS['NUNKNOWN'] = array(); $GLOBALS['NUNKNOWNQ'] = array();
$P = JOURNAL_PARK_OPEN; $PC = JOURNAL_PARK_CLOSE;
if (!function_exists('journalResolveMentionAccess')) {
    function journalResolveMentionAccess($conn, $report, $uids) {
        $out = array();
        foreach ($uids as $u) { $u = strtolower(trim($u)); $out[$u] = array('authorized' => !empty($GLOBALS['MENTION_AUTH'][$u]), 'ouc' => '', 'name' => ''); }
        return $out;
    }
}
if (!function_exists('journalSendMentionEmail')) {
    function journalSendMentionEmail($toUid, $toName, $authorUid, $authorName, $report, $noteText, $isAuthorized, $rowLine = '') {
        $GLOBALS['MAILS'][] = array('kind' => 'mention', 'to' => $toUid, 'row' => (string)$rowLine);
        return true;
    }
}
if (!function_exists('journalSendReplyEmail')) {
    function journalSendReplyEmail($toUid, $toName, $authorUid, $authorName, $report, $noteText, $rowLine = '') {
        $GLOBALS['MAILS'][] = array('kind' => 'reply', 'to' => $toUid, 'row' => (string)$rowLine);
        return true;
    }
}
if (!function_exists('penumbraNormalizeGrants')) { function penumbraNormalizeGrants($cfg, $uid) { return isset($GLOBALS['GRANTS'][$uid]) ? $GLOBALS['GRANTS'][$uid] : array(); } }
if (!function_exists('penumbraReportGrantMatches')) { function penumbraReportGrantMatches($grants, $sid) { return in_array($sid, (array)$grants, true); } }
if (!function_exists('extractAuthIdentifier')) { function extractAuthIdentifier($e) { return strtolower(trim((string)$e)); } }
if (!function_exists('penumbra_result_memory_budget_bytes')) { function penumbra_result_memory_budget_bytes($c = array()) { return isset($GLOBALS['MEMLINE']) ? (int)$GLOBALS['MEMLINE'] : 0; } }
if (!function_exists('oci_fetch_assoc')) { function oci_fetch_assoc($st) { return false; } }
if (!function_exists('queryViaOci8On')) {
    function queryViaOci8On($oci, $sql, $binds = array(), $t = 0, $m = 0, $cb = null) {
        $rows = array(array('A' => 1), array('A' => 2));
        if ($cb === null) return $rows;
        foreach ($rows as $r) $cb($r);
        return array();
    }
}
function pReset() {
    $GLOBALS['NT'] = array(); $GLOBALS['NN'] = array(); $GLOBALS['NA'] = array(); $GLOBALS['NTX'] = null;
    $GLOBALS['NSQL'] = array(); $GLOBALS['NLOCKS'] = array(); $GLOBALS['MAILS'] = array(); $GLOBALS['NSUMMARY'] = 0;
    $GLOBALS['NINSN'] = 0; $GLOBALS['NINSFAIL'] = 0; $GLOBALS['MEMLINE'] = 0; $GLOBALS['MENTION_AUTH'] = array();
    unset($GLOBALS['NFAIL'], $GLOBALS['NQFAIL'], $GLOBALS['NHOOK']);
}
function pMark($rid, $rk, $tk = 'done', $st = 1, $by = 'pat', $at = '2026-10-01 09:00:00') {
    return array('REPORT_ID' => $rid, 'ROW_KEY' => $rk, 'TOGGLE_KEY' => $tk, 'STATE' => $st, 'UPDATED_BY' => $by, 'UPDATED_AT' => $at);
}
function pRecord($rid, $sig, $at = '2026-10-01 08:00:00') { return pMark($rid, $sig, '__keyfile', 9, 'penumbra', $at); }
function pNote($id, $rid, $scope, $rk, $by = 'pat', $extra = array()) {
    return array_merge(array('ID' => $id, 'REPORT_ID' => $rid, 'SCOPE' => $scope, 'ROW_KEY' => $rk, 'NOTE_TEXT' => 'note ' . $id, 'CREATED_BY' => $by,
                             'PARENT_ID' => null, 'ROW_SNAPSHOT' => null), $extra);
}
// Another session's change, committed just before this statement: in the data and in this transaction's start.
function pCommitted($f) {
    $GLOBALS['NT'] = $f($GLOBALS['NT']);
    if ($GLOBALS['NTX'] !== null) $GLOBALS['NTX'][0] = $f($GLOBALS['NTX'][0]);
}
function pMoveRecord($rid, $from, $to) {
    pCommitted(function ($rows) use ($rid, $from, $to) {
        foreach ($rows as $i => $r) if ($r['REPORT_ID'] === $rid && $r['TOGGLE_KEY'] === '__keyfile' && $r['ROW_KEY'] === $from) $rows[$i]['ROW_KEY'] = $to;
        return $rows;
    });
}
function pResp($r) { return nShow($r['resp'] ? $r['resp'] : ($r['raw'] . ($r['err'] ? ' threw ' . $r['err'] : ''))); }
function pIsErr($r, $needle = '') { return isset($r['resp']['status']) && $r['resp']['status'] === 'error' && ($needle === '' || stripos((string)$r['resp']['message'], $needle) !== false); }
function pIsOk($r) { return isset($r['resp']['status']) && $r['resp']['status'] === 'success'; }
function pBy($r) { return (isset($r['resp']['events']) && is_array($r['resp']['events'])) ? array_map(function ($e) { return $e['by']; }, $r['resp']['events']) : null; }
// Mode p's reports, besides 7-9 and 13-14: 15 keyed on three long column names (a signature past 1,000 bytes),
// 16 with its key cleared; both journal on, owner1 owns them, viewer1 may view.
$LONGK = array(str_repeat('A', 400), str_repeat('B', 400), str_repeat('C', 400));
$GLOBALS['REPORTS'][15] = array('ID' => 15, 'SHORT_ID' => 'jrlong', 'TITLE' => 'Long key', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1');
$GLOBALS['REPORTS'][16] = array('ID' => 16, 'SHORT_ID' => 'jrclr', 'TITLE' => 'Key cleared', 'OWNER_ID' => 'owner1', 'AUTHORIZED' => 'viewer1');
$GLOBALS['RID_BY_SID']['jrlong'] = 15; $GLOBALS['RID_BY_SID']['jrclr'] = 16;
$GLOBALS['STATES'][15] = json_encode(array('query' => 'SELECT 1 FROM DUAL', 'viewOptions' => array('journalEnabled' => true, 'journalKeyColumns' => $LONGK,
    'journalToggles' => array(array('key' => 'done', 'label' => 'Done')))));
$GLOBALS['STATES'][16] = '{"query":"SELECT 1 FROM DUAL","viewOptions":{"journalEnabled":true,"journalToggles":[{"key":"done","label":"Done"}]}}';
$jeP = function_exists('journalEnsureFiled') && function_exists('journalKeySig');
if (!function_exists('nRealResolver')) {
    $pJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
    $pa = strpos($pJe, "\n    function journalExportToggleResolver(");
    $pbb = ($pa === false) ? null : braceBlock($pJe, $pa);
    if ($pbb) { try { eval(preg_replace('/^\s*function journalExportToggleResolver\(/', 'function nRealResolver(', substr($pJe, $pa + 1, $pbb[1] - $pa))); } catch (Throwable $e) { } }
}
$okRes = function_exists('nRealResolver');
$st13 = json_decode($GLOBALS['STATES'][13], true);

if ($RUN_P) {   // the SP asserts
// ---- K3: the resolver files by the SAVED key (13 is saved with TITLE; a state keyed on ID is another version's)
pReset();
$GLOBALS['NT'] = array(pRecord(13, 'TITLE'), pMark(13, 'Beta'), pMark(13, $P . 'ID' . $PC . '5'));
$k3Before = nRows(13);
$stOld = $st13; $stOld['viewOptions']['journalKeyColumns'] = array('ID');
$k3a = $okRes ? nRealResolver('jrkt', $stOld, array('ID')) : 'not lifted';
$k3Same = (nRows(13) === $k3Before);
$k3b = $okRes ? nRealResolver('jrkt', $st13, array('TITLE')) : 'not lifted';
$k3Map = (is_array($k3b) && isset($k3b['stateMap']['done'])) ? array_map('strval', array_keys($k3b['stateMap']['done'])) : null;
rec('SP-saved-key', $k3a === null && $k3Same && $k3Map === array('Beta'),
    'another version (key ID): ' . ($k3a === null ? 'nothing read' : 'READ ' . nShow(is_array($k3a) && isset($k3a['stateMap']) ? $k3a['stateMap'] : $k3a))
    . ', marks ' . ($k3Same ? 'unmoved' : 'MOVED ' . nShow(nRows(13))) . ' | the saved key reads ' . nShow($k3Map));

// ---- K1: an encrypted report is never filed (the scheduler decrypts it; the page cannot)
pReset();
$GLOBALS['NT'] = array(pMark(9, '5'), pMark(9, '6', 'done', 0));
$stEnc = array('query' => 'SELECT 1 FROM DUAL', 'viewOptions' => array('journalEnabled' => true, 'journalKeyColumns' => array('ID'),
    'journalToggles' => array(array('key' => 'done', 'label' => 'Done'))));
$k1r = $okRes ? nRealResolver('jrenc', $stEnc, array('ID')) : 'not lifted';
$k1Map = (is_array($k1r) && isset($k1r['stateMap']['done'])) ? array_map('strval', array_keys($k1r['stateMap']['done'])) : null;
rec('SP-enc', $k1Map === array('5') && nRows(9) === array('done:5:1', 'done:6:0'),
    'the scheduler reads an encrypted report: ' . nShow($k1Map) . ' | its rows ' . nShow(nRows(9)));

// ---- K4: one record - the report row locked before a first one; a second one dropped before a re-file
pReset();
$GLOBALS['NT'] = array(pMark(14, 'x'));
$k4a = $jeP ? journalEnsureFiled(14, array('ID')) : 'none';
$lockAt = -1; $insAt = -1;
foreach ($GLOBALS['NSQL'] as $i => $q) {
    $q = preg_replace('/\s+/', ' ', $q);
    if ($lockAt < 0 && strpos($q, 'FROM PENUMBRA_REPORTS WHERE ID = :lrid FOR UPDATE') !== false) $lockAt = $i;
    if ($insAt < 0 && strpos($q, 'INSERT INTO PENUMBRA_JOURNAL_TOGGLE') === 0) $insAt = $i;
}
pReset();
$GLOBALS['NT'] = array(pRecord(14, 'TITLE', '2026-10-02 08:00:00'), pRecord(14, 'ID', '2026-10-01 08:00:00'), pMark(14, 'x'));
$k4b = $jeP ? journalEnsureFiled(14, array('ID')) : 'none';
rec('SP-one-record', $k4a === 'created' && $lockAt >= 0 && $insAt > $lockAt && $k4b === 'refiled' && nRows(14) === array('__keyfile:ID:9', 'done:' . $P . 'TITLE' . $PC . 'x:1'),
    'a first filing: ' . $k4a . ', the report row locked at statement ' . $lockAt . ', the record written at ' . $insAt
    . ' | two records (TITLE newer; saved ID): ' . $k4b . ' -> ' . nShow(nRows(14)));

// ---- K4: a re-file another request beat to it (ID -> OTHER) reads the record again
pReset();
$GLOBALS['NT'] = array(pRecord(13, 'ID'), pMark(13, '5'));
$GLOBALS['PHOOKN'] = 0;
$GLOBALS['NHOOK'] = function ($s) {
    if (strpos($s, 'SET ROW_KEY = :knew') === false || $GLOBALS['PHOOKN']++ > 0) return;
    pCommitted(function ($rows) {
        foreach ($rows as $i => $r) {
            if ($r['REPORT_ID'] !== 13) continue;
            if ($r['TOGGLE_KEY'] === '__keyfile') $rows[$i]['ROW_KEY'] = 'OTHER';
            elseif (strpos($r['ROW_KEY'], JOURNAL_PARK_OPEN) !== 0) $rows[$i]['ROW_KEY'] = journalParkTag('ID') . $r['ROW_KEY'];
        }
        return $rows;
    });
};
$k4c = $jeP ? journalEnsureFiled(13, array('Title')) : 'none';
unset($GLOBALS['NHOOK']);
rec('SP-race', $k4c === 'refiled' && nRows(13) === array('__keyfile:TITLE:9', 'done:' . $P . 'ID' . $PC . '5:1'),
    'a re-file another request beat to it: ' . $k4c . ' -> ' . nShow(nRows(13)));

// ---- K12: a key too long to record
pReset();
$kl = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrlong', 'row_key' => 'L1', 'toggle_key' => 'done', 'state' => true, 'key_cols' => $LONGK), 'viewer1');
rec('SP-long-key', pIsOk($kl) && nRows(15) === array('done:L1:1'), 'a mark, the key\'s signature past 1,000 bytes: ' . pResp($kl) . ' | rows ' . nShow(nRows(15)));

// ---- K6: every row write holds the filing - the key moved just as each one took the hold
pReset();
$GLOBALS['NT'] = array(pRecord(14, 'ID'));
$GLOBALS['NHOOK'] = function ($s) { if (strpos($s, 'FOR UPDATE WAIT') !== false && strpos($s, ':hkf') !== false) pMoveRecord(14, 'ID', 'TITLE'); };
$hw = array();
$hw['mark'] = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrki', 'row_key' => '9', 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('ID')), 'viewer1');
pMoveRecord(14, 'TITLE', 'ID');
$hw['marks'] = nRun('set_toggles_bulk', array(), array('action' => 'set_toggles_bulk', 'report_id' => 'jrki', 'row_keys' => array('9', '10'), 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('ID')), 'viewer1');
pMoveRecord(14, 'TITLE', 'ID');
$hw['notes'] = nRun('add_notes_bulk', array(), array('action' => 'add_notes_bulk', 'report_id' => 'jrki', 'note_text' => 'bulk', 'row_keys' => array('9'), 'key_cols' => array('ID')), 'viewer1');
pMoveRecord(14, 'TITLE', 'ID');
$hw['note'] = nRun('add', array(), array('action' => 'add', 'report_id' => 'jrki', 'note_text' => 'one', 'scope' => 'row', 'row_key' => '9', 'key_cols' => array('ID')), 'viewer1');
pMoveRecord(14, 'TITLE', 'ID');
$hw['move'] = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrki', 'from_cols' => array('TITLE'), 'pairs' => array(array('a', '9'))), 'owner1');
unset($GLOBALS['NHOOK']);
pMoveRecord(14, 'TITLE', 'ID');
$hwOk = true; $hwShow = array();
foreach ($hw as $k => $r) { $one = pIsErr($r, 'changed just now'); $hwOk = $hwOk && $one; $hwShow[] = $k . ' ' . ($one ? 'refused' : pResp($r)); }
$hwRows = nRows(14); $hwNotes = nRows(14, 'NN');
// ...and a mark with nothing in its way: the hold, the MERGE, then the commit - one transaction.
pReset();
$GLOBALS['NT'] = array(pRecord(14, 'ID'));
$hm = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrki', 'row_key' => '9', 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('ID')), 'viewer1');
$seq = array();
foreach ($GLOBALS['NSQL'] as $q) {
    $q = preg_replace('/\s+/', ' ', $q);
    if (strpos($q, 'FOR UPDATE WAIT') !== false && strpos($q, ':hkf') !== false) $seq[] = 'hold';
    elseif (strpos($q, 'MERGE INTO PENUMBRA_JOURNAL_TOGGLE') === 0) $seq[] = 'merge';
    elseif ($q === '#COMMIT') $seq[] = 'commit';
    elseif ($q === '#ROLLBACK') $seq[] = 'rollback';
}
rec('SP-hold', $hwOk && $hwRows === array('__keyfile:ID:9') && $hwNotes === array() && pIsOk($hm) && $seq === array('hold', 'merge', 'commit') && nRows(14) === array('__keyfile:ID:9', 'done:9:1'),
    implode(' | ', $hwShow) . ' | left: marks ' . nShow($hwRows) . ', notes ' . nShow($hwNotes) . ' | a mark in the clear: ' . (pIsOk($hm) ? 'written' : pResp($hm)) . ' (' . implode(' > ', $seq) . ')');

// ---- K7: a page still naming a key after the report's key was cleared
pReset();
$kc1 = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrclr', 'row_key' => '9', 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('ID')), 'viewer1');
$kc2 = nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jrclr', 'row_key' => '7', 'toggle_key' => 'done', 'state' => true, 'key_cols' => array()), 'viewer1');
rec('SP-cleared', pIsErr($kc1, 'no key columns saved') && pIsOk($kc2) && nRows(16) === array('done:7:1'),
    'a page still on key ID: ' . pResp($kc1) . ' | a page with none: ' . pResp($kc2) . ' | rows ' . nShow(nRows(16)));

// ---- K5: the move checks the page's key
pReset();
$GLOBALS['NT'] = array(pRecord(13, 'TITLE'), pMark(13, $P . 'ID' . $PC . '5'));
$k5a = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrkt', 'from_cols' => array('ID'), 'to_cols' => array('Protocol No.')), 'owner1');
$k5b = nRun('rekey', array(), array('action' => 'rekey', 'report_id' => 'jrkt', 'from_cols' => array('ID'), 'to_cols' => array('title')), 'owner1');
rec('SP-rekey-page', isset($k5a['resp']['reason']) && $k5a['resp']['reason'] === 'stale' && pIsOk($k5b) && isset($k5b['resp']['keys']) && $k5b['resp']['keys'] === array('5'),
    'a page on another key: ' . pResp($k5a) . ' | the saved key (any case): ' . pResp($k5b));

// ---- S5: a row key in the filed form, refused by every row write
pReset();
$GLOBALS['NT'] = array(pRecord(8, 'ID'));
$FK = $P . 'TITLE' . $PC . '5';
$ff = array(
    'mark' => nRun('set_toggle', array(), array('action' => 'set_toggle', 'report_id' => 'jron', 'row_key' => $FK, 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('ID')), 'viewer1'),
    'marks' => nRun('set_toggles_bulk', array(), array('action' => 'set_toggles_bulk', 'report_id' => 'jron', 'row_keys' => array('1', $FK), 'toggle_key' => 'done', 'state' => true, 'key_cols' => array('ID')), 'viewer1'),
    'notes' => nRun('add_notes_bulk', array(), array('action' => 'add_notes_bulk', 'report_id' => 'jron', 'note_text' => 'bulk', 'row_keys' => array('1', $FK), 'key_cols' => array('ID')), 'viewer1'),
    'note' => nRun('add', array(), array('action' => 'add', 'report_id' => 'jron', 'note_text' => 'one', 'scope' => 'row', 'row_key' => $FK, 'key_cols' => array('ID')), 'viewer1'));
$ffOk = true; $ffShow = array();
foreach ($ff as $k => $r) { $one = pIsErr($r, 'not valid'); $ffOk = $ffOk && $one; $ffShow[] = $k . ' ' . ($one ? 'refused' : pResp($r)); }
rec('SP-filed-form', $ffOk && nRows(8) === array('__keyfile:ID:9') && nRows(8, 'NN') === array(),
    implode(' | ', $ffShow) . ' | marks ' . nShow(nRows(8)) . ', notes ' . nShow(nRows(8, 'NN')));

// ---- S2: a note only where it can be read
pReset();
$ga = nRun('add', array(), array('action' => 'add', 'report_id' => 'jroff', 'note_text' => 'hello'), 'viewer1');
$gb = nRun('add', array(), array('action' => 'add', 'report_id' => 'jroff', 'note_text' => 'hello'), 'owner1');
rec('SP-add-gate', pIsErr($ga, 'off') && pIsOk($gb) && nRows(7, 'NN') === array('report:'),
    'a viewer, journal off: ' . pResp($ga) . ' | the owner: ' . (pIsOk($gb) ? 'written' : pResp($gb)) . ' | notes ' . nShow(nRows(7, 'NN')));

// ---- S6: a reply goes where its thread is filed (13: the thread on 5 written under ID; saved with TITLE)
pReset();
$GLOBALS['NT'] = array(pRecord(13, 'ID'));
$GLOBALS['NN'] = array(pNote(1, 13, 'row', '5', 'pat'));
$GLOBALS['MENTION_AUTH'] = array('pat' => true);
$rp = nRun('add', array(), array('action' => 'add', 'report_id' => 'jrkt', 'note_text' => 'a reply', 'parent_id' => 1), 'viewer1');
$tagged = $P . 'ID' . $PC . '5';
$rpMail = null; foreach ($GLOBALS['MAILS'] as $m) if ($m['kind'] === 'reply') $rpMail = $m;
rec('SP-reply-filed', pIsOk($rp) && nRows(13, 'NN') === array('row:' . $tagged, 'row:' . $tagged) && is_array($rpMail) && $rpMail['row'] !== '' && strpos($rpMail['row'], $P) === false,
    'a reply: ' . (pIsOk($rp) ? 'written' : pResp($rp)) . ' | notes ' . nShow(nRows(13, 'NN')) . ' | the reply e-mail\'s row line ' . nShow($rpMail ? $rpMail['row'] : null));

// ---- S7: the row's values only to a mention who may view the report
pReset();
$GLOBALS['NT'] = array(pRecord(8, 'ID'));
$GLOBALS['MENTION_AUTH'] = array('viewer1' => true);
$mr = nRun('add', array(), array('action' => 'add', 'report_id' => 'jron', 'note_text' => '@viewer1 and @viewer2, see this', 'scope' => 'row', 'row_key' => '5',
    'row_snapshot' => '{"ID":"5","Title":"Alpha"}', 'key_cols' => array('ID'),
    'mentions' => array(array('user' => 'viewer1', 'name' => 'V One'), array('user' => 'viewer2', 'name' => 'V Two'))), 'owner1');
$mrRow = array(); foreach ($GLOBALS['MAILS'] as $m) if ($m['kind'] === 'mention') $mrRow[$m['to']] = $m['row'];
rec('SP-mention-row', pIsOk($mr) && isset($mrRow['viewer1'], $mrRow['viewer2']) && strpos($mrRow['viewer1'], 'ID: 5') !== false && $mrRow['viewer2'] === '',
    (pIsOk($mr) ? 'written' : pResp($mr)) . ' | the row line to each: ' . nShow($mrRow));

// ---- S8: the badge's counts
pReset();
$GLOBALS['NN'] = array(pNote(41, 7, 'report', null), pNote(42, 7, 'report', null), pNote(43, 7, 'report', null));
$sm1 = nRun('summary', array('report_id' => 'jroff'), null, 'viewer1'); $smQ = $GLOBALS['NSUMMARY'];
$sm2 = nRun('summary', array('report_id' => 'jroff'), null, 'owner1');
rec('SP-summary', isset($sm1['resp']['total']) && $sm1['resp']['total'] === 0 && $smQ === 0 && isset($sm2['resp']['total']) && $sm2['resp']['total'] === 3,
    'a viewer, journal off: ' . pResp($sm1) . ' (counted ' . $smQ . 'x) | the owner: ' . pResp($sm2));

// ---- S9: bulk notes, all or none (the third of three inserts fails)
pReset();
$GLOBALS['NT'] = array(pRecord(8, 'ID'));
$GLOBALS['NINSFAIL'] = 3;
$ba = nRun('add_notes_bulk', array(), array('action' => 'add_notes_bulk', 'report_id' => 'jron', 'note_text' => 'bulk', 'row_keys' => array('1', '2', '3'), 'key_cols' => array('ID')), 'viewer1');
$GLOBALS['NINSFAIL'] = 0;
rec('SP-bulk-atomic', nRows(8, 'NN') === array() && $ba['err'] !== null && stripos($ba['err'], 'no notes were added') !== false,
    'the third insert failed: ' . pResp($ba) . ' | notes left ' . nShow(nRows(8, 'NN')));

// ---- the delete rule: the author or an app admin deletes a note; another viewer does not. (The report's owner and
// editors: since Round U, 2026-10-09 - mode u's SU-delete.)
pReset();
$GLOBALS['NN'] = array(pNote(21, 8, 'report', null, 'owner1'), pNote(22, 8, 'report', null, 'viewer1'), pNote(23, 8, 'report', null, 'viewer1'));
$d1 = nRun('delete', array(), array('action' => 'delete', 'note_id' => 21), 'viewer1');
$d2 = nRun('delete', array(), array('action' => 'delete', 'note_id' => 22), 'viewer1');
$d3 = nRun('delete', array(), array('action' => 'delete', 'note_id' => 23), 'appadmin', true);
$dLeft = array(); foreach ($GLOBALS['NN'] as $r) $dLeft[] = (int)$r['ID'];
rec('SP-delete', pIsErr($d1, 'can delete this note') && pIsOk($d2) && pIsOk($d3) && $dLeft === array(21),
    'a viewer, the owner\'s note: ' . pResp($d1) . ' | its author: ' . pResp($d2) . ' | an app admin: ' . pResp($d3) . ' | left ' . nShow($dLeft));

// ---- S4: a mentioned report-grant holder
$GLOBALS['config'] = array('harness' => true); $GLOBALS['GRANTS'] = array('editor9' => array('jron'));
$tv = function_exists('journalTargetCanView');
$tg1 = $tv ? journalTargetCanView($GLOBALS['REPORTS'][8], 'editor9', '') : null;
$tg2 = $tv ? journalTargetCanView($GLOBALS['REPORTS'][8], 'stranger', '') : null;
$tg3 = $tv ? journalTargetCanView($GLOBALS['REPORTS'][8], 'viewer1', '') : null;
$GLOBALS['config'] = null; $GLOBALS['GRANTS'] = array();
rec('SP-grant', $tg1 === true && $tg2 === false && $tg3 === true, 'a grant holder ' . json_encode($tg1) . ', a stranger ' . json_encode($tg2) . ', on the access list ' . json_encode($tg3));

// ---- S10: an attachment's name
$sfn = function_exists('journalSafeFilename');
$fn1 = $sfn ? journalSafeFilename(str_repeat("\xE6\x96\x87", 190) . '.xlsx') : '';
$fn2 = $sfn ? journalSafeFilename(str_repeat('n', 300) . '.pdf') : '';
rec('SP-filename', $sfn && strlen($fn1) <= 400 && substr($fn1, -5) === '.xlsx' && mb_check_encoding($fn1, 'UTF-8') && mb_strlen($fn2, 'UTF-8') <= 200 && substr($fn2, -4) === '.pdf',
    '190 CJK characters + .xlsx -> ' . strlen($fn1) . ' bytes, ending ' . json_encode(substr($fn1, -5)) . ' | 300 + .pdf -> ' . mb_strlen($fn2, 'UTF-8') . ' characters, ending ' . json_encode(substr($fn2, -4)));

// ---- S12: a failed attachment read
pReset();
$GLOBALS['NN'] = array(pNote(31, 8, 'report', null, 'pat', array('ATTACH_NAME' => 'a.txt', 'ATTACH_MIME' => 'text/plain')));
$GLOBALS['NFAIL'] = '/SELECT ATTACH_DATA/';
$af = nRun('attachment', array('note_id' => '31'), null, 'viewer1');
unset($GLOBALS['NFAIL']);
rec('SP-attach-fail', pIsErr($af, 'could not be read'),
    'the file\'s read failed: ' . ($af['resp'] ? nShow($af['resp']) : 'sent ' . strlen($af['raw']) . ' bytes as the file' . ($af['err'] ? ', threw ' . $af['err'] : '')));

// ---- S11: a change from before toggle keys is the "done" column's
pReset();
$GLOBALS['NA'] = array(
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'pat', 'TS' => '2026-10-05 09:00:00', 'AFTER' => json_encode(array('row_key' => 'Alpha', 'toggle_key' => 'sent', 'state' => '1'))),
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'old1', 'TS' => '2026-09-01 09:00:00', 'AFTER' => json_encode(array('row_key' => 'Alpha', 'state' => '1'))));
$hs = nRun('toggle_history', array('report_id' => 'jrkt', 'row_key' => 'Alpha', 'toggle_key' => 'sent'), null, 'viewer1');
$hd = nRun('toggle_history', array('report_id' => 'jrkt', 'row_key' => 'Alpha', 'toggle_key' => 'done'), null, 'viewer1');
rec('SP-hist-legacy', pBy($hs) === array('pat') && pBy($hd) === array('old1'), '"sent" by ' . nShow(pBy($hs)) . ' | "done" by ' . nShow(pBy($hd)));

// ---- K11: the hover history leaves out a change made under other key columns (13 is saved with TITLE)
pReset();
$GLOBALS['NA'] = array(
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'pat', 'TS' => '2026-10-05 09:00:00', 'AFTER' => json_encode(array('row_key' => '5', 'toggle_key' => 'done', 'state' => '1', 'key_cols' => array('Title')))),
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'era1', 'TS' => '2026-10-04 09:00:00', 'AFTER' => json_encode(array('row_key' => '5', 'toggle_key' => 'done', 'state' => '1', 'key_cols' => array('ID')))),
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'old', 'TS' => '2026-09-01 09:00:00', 'AFTER' => json_encode(array('row_key' => '5', 'toggle_key' => 'done', 'state' => '1'))));
$he = nRun('toggle_history', array('report_id' => 'jrkt', 'row_key' => '5', 'toggle_key' => 'done'), null, 'viewer1');
rec('SP-hist-era', pBy($he) === array('pat', 'old'), 'row 5 by ' . nShow(pBy($he)) . ' (era1 marked an ID-keyed 5)');

// ---- S1: both history reads stop at the memory line and say so
pReset();
$GLOBALS['NA'] = array(
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'pat', 'TS' => '2026-10-05 09:00:00', 'AFTER' => json_encode(array('row_key' => 'Alpha', 'toggle_key' => 'done', 'state' => '1'))),
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'kim', 'TS' => '2026-10-04 09:00:00', 'AFTER' => json_encode(array('bulk' => true, 'toggle_key' => 'done', 'state' => '1', 'row_keys' => array('Alpha', 'Beta')))));
$GLOBALS['MEMLINE'] = 1;
$mh = nRun('toggle_history', array('report_id' => 'jrkt', 'row_key' => 'Alpha', 'toggle_key' => 'done'), null, 'viewer1');
$ms = nRun('toggle_history_search', array('report_id' => 'jrkt'), null, 'viewer1');
$GLOBALS['MEMLINE'] = 0;
$mh2 = nRun('toggle_history', array('report_id' => 'jrkt', 'row_key' => 'Alpha', 'toggle_key' => 'done'), null, 'viewer1');
rec('SP-hist-memory', pIsOk($mh) && !empty($mh['resp']['partial']) && pBy($mh) === array() && pIsOk($ms) && !empty($ms['resp']['partial']) && !empty($ms['resp']['truncated'])
    && pBy($mh2) === array('pat', 'kim') && empty($mh2['resp']['partial']),
    'past the line: the row ' . pResp($mh) . ' | the search partial ' . json_encode(isset($ms['resp']['partial']) ? $ms['resp']['partial'] : null) . ' ' . (pIsOk($ms) ? '' : pResp($ms))
    . ' | under it: by ' . nShow(pBy($mh2)));

// ---- P3: the exact person
pReset();
$GLOBALS['NA'] = array(
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'pat', 'TS' => '2026-10-05 09:00:00', 'AFTER' => json_encode(array('row_key' => 'A', 'toggle_key' => 'done', 'state' => '1'))),
    array('REPORT_ID' => 13, 'ACTION' => 'JOURNAL_TOGGLE', 'USER_ID' => 'patel', 'TS' => '2026-10-04 09:00:00', 'AFTER' => json_encode(array('row_key' => 'B', 'toggle_key' => 'done', 'state' => '1'))));
$ue1 = nRun('toggle_history_search', array('report_id' => 'jrkt', 'user' => 'pat', 'user_exact' => '1'), null, 'viewer1');
$ue2 = nRun('toggle_history_search', array('report_id' => 'jrkt', 'user' => 'pat'), null, 'viewer1');
rec('SP-user-exact', pBy($ue1) === array('pat') && pBy($ue2) === array('pat', 'patel'), 'exact: by ' . nShow(pBy($ue1)) . ' | contains: by ' . nShow(pBy($ue2)));

// ---- db_connection.php: execClobInsert's $noCommit; queryViaOci8Each streams
$dbSrc = src('db_connection.php');
$dbLift = (defineLifted($dbSrc, 'execClobInsert', 'pDbExecClobInsert') ? 1 : 0) + (defineLifted($dbSrc, 'queryViaOci8Each', 'pDbQueryEach') ? 1 : 0);
$dbC = array();
if (function_exists('pDbExecClobInsert')) {
    foreach (array(false, true) as $nc) {
        $GLOBALS['NSQL'] = array(); $GLOBALS['NTX'] = null;
        try { pDbExecClobInsert(null, 'PNB_HARNESS_T', array('A' => 1), array(), array(), null, $nc); } catch (Throwable $e) { $dbC[] = 'threw ' . $e->getMessage(); continue; }
        $dbC[] = count(array_keys($GLOBALS['NSQL'], '#COMMIT', true));
    }
}
$dbRows = array();
if (function_exists('pDbQueryEach')) {
    try { pDbQueryEach('SELECT A FROM PNB_HARNESS_T', array(), function ($r) use (&$dbRows) { $dbRows[] = $r['A']; }); } catch (Throwable $e) { $dbRows = 'threw ' . $e->getMessage(); }
}
rec('SP-db', $dbLift === 2 && $dbC === array(1, 0) && $dbRows === array(1, 2),
    'lifted ' . $dbLift . '/2 | commits (by default, with $noCommit) ' . json_encode($dbC) . ' | streamed ' . json_encode($dbRows));

// ---- the wiring
$wiredP = array(); $wpOk = true;
foreach (array('set_toggle', 'set_toggles_bulk', 'add_notes_bulk', 'add', 'rekey') as $act) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    $have = $bb ? substr_count(substr($mj, $bb[0], $bb[1] - $bb[0]), 'journalFilingHold($report)') : 0;
    $wiredP[$act] = $have;
    if ($have !== 1) $wpOk = false;
}
$fromDb = strpos($mj, "journalEnsureFiled((int)\$report['ID'], \$f['keyCols'], \$assumeFrom, true)") !== false;
rec('SP-wired', $wpOk && $fromDb, 'the hold in each row write ' . json_encode($wiredP) . ' | the page files by the state it read ' . json_encode($fromDb));
// The messages the row writes throw on purpose, against the endpoint's safe list (the catch at the end).
$safeAt = strpos($mj, '$safe_messages = array(');
$safeBb = ($safeAt === false) ? null : strpos($mj, ');', $safeAt);
$safeList = ($safeBb === null || $safeBb === false) ? '' : substr($mj, $safeAt, $safeBb - $safeAt);
$thrown = array();
foreach (array('set_toggle', 'set_toggles_bulk', 'add_notes_bulk', 'rekey') as $act) {
    $a = strpos($mj, "    if (\$action === '" . $act . "') {");
    $bb = ($a === false) ? null : braceBlock($mj, $a);
    if (!$bb) continue;
    if (preg_match_all('/throw new Exception\((["\'])(.+?)\1\)/', substr($mj, $bb[0], $bb[1] - $bb[0]), $tm, PREG_SET_ORDER)) {
        foreach ($tm as $t) $thrown[$t[2]] = (strpos($safeList, "'" . $t[2] . "'") !== false);
    }
}
$unsafe = array_keys(array_filter($thrown, function ($ok) { return !$ok; }));
rec('SP-safe-msg', $safeList !== '' && count($thrown) >= 4 && !$unsafe,
    count($thrown) . ' messages thrown on purpose; not on the safe list (the page shows the generic one): ' . nShow($unsafe));
if (!empty($GLOBALS['NUNKNOWN']) || !empty($GLOBALS['NUNKNOWNQ'])) {
    rec('SP-sql', false, 'statements the fake does not know: ' . nShow(array_slice(array_merge((array)$GLOBALS['NUNKNOWN'], (array)$GLOBALS['NUNKNOWNQ']), 0, 6)));
} else {
    rec('SP-sql', true, 'every statement known to the fake');
}
}   // $RUN_P asserts
}   // $RUN_P || $RUN_U: the setup

if ($RUN_U) {
// ======================= ROUND U (2026-10-09, "fix them all": the close-out's S3) =======================
//   SU-delete  the report's owner and a report-grant editor delete a viewer's note; a viewer does not delete the
//              owner's (the message names who may)
//   SU-cap     one person who cannot edit the report keeps at most 500 of its notes - a bulk add past that is
//              refused whole, one note within it goes in, the owner is not held to it; the count is theirs alone
pReset();
$GLOBALS['NN'] = array(pNote(21, 8, 'report', null, 'viewer1'), pNote(22, 8, 'report', null, 'viewer1'), pNote(24, 8, 'report', null, 'owner1'));
$u0 = nRun('delete', array(), array('action' => 'delete', 'note_id' => 24), 'viewer1');
$u1 = nRun('delete', array(), array('action' => 'delete', 'note_id' => 21), 'owner1');
$GLOBALS['config'] = array('harness' => true); $GLOBALS['GRANTS'] = array('editor9' => array('jron')); $GLOBALS['userGrants'] = array('jron');   // the caller's own grants (db_connection.php's)
$u2 = nRun('delete', array(), array('action' => 'delete', 'note_id' => 22), 'editor9');
$GLOBALS['config'] = null; $GLOBALS['GRANTS'] = array(); $GLOBALS['userGrants'] = null;
$uLeft = array(); foreach ($GLOBALS['NN'] as $r) $uLeft[] = (int)$r['ID'];
rec('SU-delete', pIsErr($u0, "owner or editors") && pIsOk($u1) && pIsOk($u2) && $uLeft === array(24),
    'a viewer, the owner\'s note: ' . pResp($u0) . ' | the owner, a viewer\'s: ' . pResp($u1) . ' | a grant editor, a viewer\'s: ' . pResp($u2) . ' | left ' . nShow($uLeft));
pReset();
$GLOBALS['NT'] = array(pRecord(8, 'ID'));
$cap = array();
for ($i = 0; $i < 499; $i++) $cap[] = pNote(3000 + $i, 8, 'report', null, 'viewer1');
for ($i = 0; $i < 300; $i++) $cap[] = pNote(4000 + $i, 8, 'report', null, 'pat');
$GLOBALS['NN'] = $cap;
$c1 = nRun('add_notes_bulk', array(), array('action' => 'add_notes_bulk', 'report_id' => 'jron', 'note_text' => 'bulk', 'row_keys' => array('1', '2'), 'key_cols' => array('ID')), 'viewer1');
$n1 = count($GLOBALS['NN']);
$c2 = nRun('add', array(), array('action' => 'add', 'report_id' => 'jron', 'note_text' => 'the 500th'), 'viewer1');
$n2 = count($GLOBALS['NN']);
$c3 = nRun('add', array(), array('action' => 'add', 'report_id' => 'jron', 'note_text' => 'the 501st'), 'viewer1');
$c4 = nRun('add_notes_bulk', array(), array('action' => 'add_notes_bulk', 'report_id' => 'jron', 'note_text' => 'owner bulk', 'row_keys' => array('1', '2'), 'key_cols' => array('ID')), 'owner1');
$n4 = count($GLOBALS['NN']);
rec('SU-cap', pIsErr($c1, 'at most 500') && $n1 === 799 && pIsOk($c2) && $n2 === 800 && pIsErr($c3, 'at most 500') && pIsOk($c4) && $n4 === 802,
    'viewer1 (499 notes; pat 300): a bulk of 2 ' . pResp($c1) . ' (notes ' . $n1 . ') | one ' . pResp($c2) . ' (' . $n2 . ') | one more ' . pResp($c3)
    . ' | the owner\'s bulk of 2 ' . pResp($c4) . ' (' . $n4 . ')');
$GLOBALS['NN'] = array();
for ($i = 0; $i < 600; $i++) { $GLOBALS['NN'][] = pNote(5000 + $i, 8, 'report', null, 'owner1'); $GLOBALS['NN'][] = pNote(6000 + $i, 8, 'report', null, 'viewer1'); }
$GLOBALS['QFAKE'] = 'nQuery';
$hasCap = function_exists('journalAuthorCapRefusal');
$ex1 = $hasCap ? journalAuthorCapRefusal($GLOBALS['REPORTS'][8], 'owner1', false, 1) : 'no journalAuthorCapRefusal';
$ex2 = $hasCap ? journalAuthorCapRefusal($GLOBALS['REPORTS'][8], 'viewer1', false, 1) : null;
$ex3 = $hasCap ? journalAuthorCapRefusal($GLOBALS['REPORTS'][8], 'appadmin', true, 1) : 'no journalAuthorCapRefusal';
rec('SU-cap-exempt', $ex1 === null && is_string($ex2) && stripos($ex2, 'at most 500') !== false && $ex3 === null,
    '600 notes each - the owner: ' . nShow($ex1) . ' | a viewer: ' . nShow($ex2) . ' | an app admin: ' . nShow($ex3));
}
if ($RUN_V) {
// ======================= ROUND V (2026-10-09, "yes, widen the column and deploy after testing") =======================
//   SV-cap        the width the filing may use: both tables' ROW_KEY -> the narrower; none read, one table, a failed
//                 read -> 1000; a CHAR-semantics column -> its CHAR_LENGTH; a copy in another schema is not read;
//                 read once a request
//   SV-file-long  at 1500 a 1,000-byte key takes the tag of a 400-byte signature (a mark and a row note); at 1000
//                 (before the ALTER), or 1500 with the width unread, it stays plain and the re-file still says 'refiled'
//   SV-install    the install action widens only a narrow column (never narrows a wider one), then reads as installed;
//                 a failed widen = an error and the filing keeps the narrower width; a non-admin is refused
//   SV-ddl        the DDL: both CREATEs at 1500 BYTE; both MODIFYs after the CREATEs, schema-qualified in Copy DDL
$vCapFn = function_exists('journalRowKeyCapacity');
$vCol = function ($t, $bytes, $own = 'NC_REPORTING', $cu = 'B', $chars = null) {
    return array('OWNER' => $own, 'TABLE_NAME' => $t, 'CHAR_USED' => $cu, 'CHAR_LENGTH' => ($chars === null ? $bytes : $chars), 'DATA_LENGTH' => $bytes);
};
$vCap = function ($cols, $fail = false) use ($vCapFn) {
    if ($cols === null) unset($GLOBALS['NCOLS']); else $GLOBALS['NCOLS'] = $cols;
    $GLOBALS['NCAPFAIL'] = $fail;
    $c = $vCapFn ? journalRowKeyCapacity(true) : 'no journalRowKeyCapacity';
    unset($GLOBALS['NCOLS']); $GLOBALS['NCAPFAIL'] = false;
    return $c;
};
$J = 'PENUMBRA_JOURNAL'; $TT = 'PENUMBRA_JOURNAL_TOGGLE';
$GLOBALS['NWIDTH'] = array();
$cv = array(
    'as made' => $vCap(null),
    'none' => $vCap(array()),
    'both 1500' => $vCap(array($vCol($J, 1500), $vCol($TT, 1500))),
    'one narrow' => $vCap(array($vCol($J, 1500), $vCol($TT, 1000))),
    'one table' => $vCap(array($vCol($TT, 1500))),
    'read fails' => $vCap(array($vCol($J, 1500), $vCol($TT, 1500)), true),
    'CHAR 1200' => $vCap(array($vCol($J, 4000, 'NC_REPORTING', 'C', 1200), $vCol($TT, 1500))),
    'elsewhere' => $vCap(array($vCol($J, 1500), $vCol($TT, 1500), $vCol($J, 1000, 'OTHER_SCHEMA'), $vCol($TT, 1000, 'OTHER_SCHEMA'))),
);
$wantCv = array('as made' => 1000, 'none' => 1000, 'both 1500' => 1500, 'one narrow' => 1000, 'one table' => 1000,
                'read fails' => 1000, 'CHAR 1200' => 1200, 'elsewhere' => 1500);
$GLOBALS['NCAPREADS'] = 0;
if ($vCapFn) { journalRowKeyCapacity(true); journalRowKeyCapacity(); journalRowKeyCapacity(); }
$vReads = $GLOBALS['NCAPREADS'];
rec('SV-cap', $cv === $wantCv && $vReads === 1, nShow($cv) . ' | dictionary reads for a fresh ask + 2 more: ' . $vReads);

// A 1,000-byte key (the page's limit) under the tag of a 400-byte signature (JOURNAL_KEYFILE_MAX_SIG): 1,406 bytes.
$K = str_repeat('K', 400); $tK = journalParkTag($K); $L = str_repeat('y', 1000);
$vFile = function ($width, $capFail = false) use ($K, $L, $vCapFn) {
    $GLOBALS['NWIDTH'] = array('PENUMBRA_JOURNAL' => $width, 'PENUMBRA_JOURNAL_TOGGLE' => $width);
    $GLOBALS['NT'] = array(
        array('REPORT_ID' => 14, 'ROW_KEY' => $K, 'TOGGLE_KEY' => '__keyfile', 'STATE' => 9, 'UPDATED_BY' => 'penumbra', 'UPDATED_AT' => '2026-10-01 08:00:00'),
        array('REPORT_ID' => 14, 'ROW_KEY' => '5', 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:00:00'),
        array('REPORT_ID' => 14, 'ROW_KEY' => $L, 'TOGGLE_KEY' => 'done', 'STATE' => 1, 'UPDATED_BY' => 'pat', 'UPDATED_AT' => '2026-10-01 09:10:00'));
    $GLOBALS['NN'] = array(array('ID' => 1, 'REPORT_ID' => 14, 'SCOPE' => 'row', 'ROW_KEY' => $L, 'NOTE_TEXT' => 'long'));
    $GLOBALS['NTX'] = null;
    $GLOBALS['NCAPFAIL'] = $capFail;   // the dictionary unreadable for the whole request
    if ($vCapFn) journalRowKeyCapacity(true);   // this request's read of the width
    $st = journalEnsureFiled(14, array('ID'), null, true);
    $GLOBALS['NCAPFAIL'] = false;
    return array($st, nRows(14), nRows(14, 'NN'));
};
$vShort = function ($rows) {
    return nShow(array_map(function ($r) { return preg_replace_callback('/(.)\1{9,}/u', function ($m) { return $m[1] . '{' . strlen($m[0]) . '}'; }, $r); }, $rows));
};
list($s15, $t15, $n15) = $vFile(1500);
list($s10, $t10, $n10) = $vFile(1000);
list($sUn, $tUn, $nUn) = $vFile(1500, true);
$want15 = array('__keyfile:ID:9', 'done:' . $tK . '5:1', 'done:' . $tK . $L . ':1'); sort($want15);
$want10 = array('__keyfile:ID:9', 'done:' . $L . ':1', 'done:' . $tK . '5:1'); sort($want10);
rec('SV-file-long', $s15 === 'refiled' && $t15 === $want15 && $n15 === array('row:' . $tK . $L)
    && $s10 === 'refiled' && $t10 === $want10 && $n10 === array('row:' . $L)
    && $sUn === 'refiled' && $tUn === $want10 && $nUn === array('row:' . $L),
    'at 1500: ' . $s15 . ' ' . $vShort($t15) . ' ' . $vShort($n15) . ' | at 1000: ' . $s10 . ' ' . $vShort($t10) . ' ' . $vShort($n10)
    . ' | 1500, the width unread: ' . $sUn . ' ' . $vShort($tUn) . ' ' . $vShort($nUn));

// The install action, on a database with the three tables, their later columns, and ROW_KEY as the test sets it.
$GLOBALS['NTABLES'] = array(array('OWNER' => 'NC_REPORTING', 'TABLE_NAME' => $J), array('OWNER' => 'NC_REPORTING', 'TABLE_NAME' => 'PENUMBRA_JOURNAL_SEEN'),
                            array('OWNER' => 'NC_REPORTING', 'TABLE_NAME' => $TT));
$GLOBALS['NCNTCOLS'] = 1;   // ATTACH_DATA and PARENT_ID are there
$GLOBALS['NT'] = array(); $GLOBALS['NN'] = array();
$vInst = function ($admin = true, $body = array('action' => 'install')) {
    $GLOBALS['NDDL'] = array();
    $r = nRun('install', array(), $body, $admin ? 'appadmin' : 'owner1', $admin);
    return array($r['resp'], $GLOBALS['NDDL'], $r);
};
$vRes = function ($resp, $k) { return (is_array($resp) && isset($resp['results'][$k])) ? (string)$resp['results'][$k] : null; };
$vMods = function ($d) { return count(array_filter((array)$d, function ($x) { return strpos($x, 'MODIFY (ROW_KEY') !== false; })); };
$vIv = function ($i, $d, $r = null) use ($vRes, $vMods) {
    if (!is_array($i)) return 'no answer ' . ($r ? nShow(array($r['raw'], $r['err'])) : '');
    return $i['status'] . ' [' . nShow(array($vRes($i, 'journal_rowkey_widen'), $vRes($i, 'toggle_rowkey_widen'), $vRes($i, 'row_key_width'))) . '] MODIFYs ' . $vMods($d) . ' of ' . count((array)$d) . ' DDL';
};
$GLOBALS['NWIDTH'] = array($J => 1000, $TT => 1000);
list($i1, $d1, $r1) = $vInst();
$w1 = $GLOBALS['NWIDTH']; $cap1 = $vCapFn ? journalRowKeyCapacity(true) : null;
list($i2, $d2, $r2) = $vInst();
$GLOBALS['NWIDTH'] = array($J => 2000, $TT => 1000);
list($i3, $d3, $r3) = $vInst();
$w3 = $GLOBALS['NWIDTH'];
$GLOBALS['NWIDTH'] = array($J => 1000, $TT => 1000);
$GLOBALS['NDDLFAIL'] = array($TT => 'ORA-00054: resource busy and acquire with NOWAIT specified or timeout expired');
list($i4, $d4, $r4) = $vInst();
$GLOBALS['NDDLFAIL'] = array();
$w4 = $GLOBALS['NWIDTH']; $cap4 = $vCapFn ? journalRowKeyCapacity(true) : null;
list($i5, $d5, $r5) = $vInst(false);
$ok1 = is_array($i1) && $i1['status'] === 'success' && $vRes($i1, 'journal_rowkey_widen') === 'widened from 1000 to 1500 bytes'
    && $vRes($i1, 'toggle_rowkey_widen') === 'widened from 1000 to 1500 bytes' && $w1 === array($J => 1500, $TT => 1500) && $cap1 === 1500 && $vMods($d1) === 2;
$ok2 = is_array($i2) && $i2['status'] === 'success' && $vRes($i2, 'row_key_width') === '1500 bytes' && $d2 === array();
$ok3 = is_array($i3) && $i3['status'] === 'success' && $vRes($i3, 'journal_rowkey_widen') === null
    && $vRes($i3, 'toggle_rowkey_widen') === 'widened from 1000 to 1500 bytes' && $w3 === array($J => 2000, $TT => 1500) && $vMods($d3) === 1;
$ok4 = is_array($i4) && $i4['status'] === 'error' && strpos((string)$vRes($i4, 'toggle_rowkey_widen'), 'ERROR: ORA-00054') === 0
    && $w4 === array($J => 1500, $TT => 1000) && $cap4 === 1000;
$ok5 = is_array($i5) && $i5['status'] === 'error' && stripos((string)$i5['message'], 'administrator') !== false && $d5 === array();
rec('SV-install', $ok1 && $ok2 && $ok3 && $ok4 && $ok5,
    'both 1000: ' . $vIv($i1, $d1, $r1) . ' -> ' . nShow($w1) . ' cap ' . nShow($cap1) . ' | again: ' . $vIv($i2, $d2, $r2)
    . ' | 2000 + 1000: ' . $vIv($i3, $d3, $r3) . ' -> ' . nShow($w3) . ' | the toggle table busy: ' . $vIv($i4, $d4, $r4) . ' -> ' . nShow($w4) . ' cap ' . nShow($cap4)
    . ' | not an admin: ' . (is_array($i5) ? $i5['status'] . ' ' . $i5['message'] : 'no answer') . ' DDL ' . count((array)$d5));

$dq = function_exists('journalInstallStatements') ? journalInstallStatements(true, true) : array();
$du = function_exists('journalInstallStatements') ? journalInstallStatements(true) : array();
$kq = array_keys($dq);
$okD = isset($dq['journal_table'], $dq['toggle_table'], $dq['journal_rowkey_widen'], $dq['toggle_rowkey_widen'], $du['toggle_rowkey_widen'])
    && strpos($dq['journal_table'], "ROW_KEY VARCHAR2(1500 BYTE),\n") !== false
    && strpos($dq['toggle_table'], "ROW_KEY VARCHAR2(1500 BYTE) NOT NULL,\n") !== false
    && $dq['journal_rowkey_widen'] === 'ALTER TABLE NC_REPORTING.PENUMBRA_JOURNAL MODIFY (ROW_KEY VARCHAR2(1500 BYTE))'
    && $dq['toggle_rowkey_widen'] === 'ALTER TABLE NC_REPORTING.PENUMBRA_JOURNAL_TOGGLE MODIFY (ROW_KEY VARCHAR2(1500 BYTE))'
    && $du['toggle_rowkey_widen'] === 'ALTER TABLE PENUMBRA_JOURNAL_TOGGLE MODIFY (ROW_KEY VARCHAR2(1500 BYTE))'
    && array_search('journal_rowkey_widen', $kq) > array_search('journal_table', $kq)
    && array_search('toggle_rowkey_widen', $kq) > array_search('toggle_table', $kq);
list($i6) = $vInst(true, array('action' => 'install', 'dry' => 1));
$okDry = is_array($i6) && isset($i6['statements']['toggle_rowkey_widen'], $dq['toggle_rowkey_widen']) && $i6['statements']['toggle_rowkey_widen'] === $dq['toggle_rowkey_widen'];
$vRk = function ($sql) { return preg_match('/ROW_KEY VARCHAR2\([^)]*\)[^,\n]*/', (string)$sql, $m) ? $m[0] : '-'; };
rec('SV-ddl', $okD && $okDry,
    'CREATE ' . nShow(array($vRk(isset($dq['journal_table']) ? $dq['journal_table'] : ''), $vRk(isset($dq['toggle_table']) ? $dq['toggle_table'] : '')))
    . ' | widen ' . nShow(array(isset($dq['journal_rowkey_widen']) ? $dq['journal_rowkey_widen'] : null, isset($du['toggle_rowkey_widen']) ? $du['toggle_rowkey_widen'] : null))
    . ' | dry ' . (is_array($i6) ? nShow(isset($i6['statements']['toggle_rowkey_widen']) ? $i6['statements']['toggle_rowkey_widen'] : null) : 'no answer'));
}
}   // $RUN_N || $RUN_P || $RUN_U || $RUN_V

// ======================= ROUND O (2026-10-09): accented letters in toggle names - the server half.
//   SO-mb       this mode runs with mbstring, as the server does (run.py loads it for mode o): without it
//               journalUpperKey falls back to ASCII and every check below is moot
//   SO-names    a toggle's column is named by its label upper-cased as the browser does it (Unicode - the
//               parity list driver.js's O-names holds for main.js journalToggleColumnMap), its who / when
//               columns with it; a data column of its name, whatever the case of its accents, takes the
//               name (the toggle gives way: _2), as in the browser
//   SO-alias    the forms the ASCII-only engines read a typed name in ("RéVISé", "éTé RéVISé") name the
//               column the Unicode form names - the toggle's, or the data column it gave way to - never over a
//               column's own name; an old accented name by every form; journalExportCanonicalCol both ways
//   SO-filter   a task filter / the API's search: "Révisé = ☑", "révisé = ☐", "RÉVISÉ = ☑", "{Été révisé} = ☑",
//               "été révisé = ☐", "Révisé by = pat"; beside a data column of that name, the data column
//   SO-snippet  a scheduled email's snippets: the condition tree, count(...) rows, lookup(...)
//   SO-format   format() and rewrite() on an accented name: the cell target and the condition
//   SO-groupby  a grouping level and a band summary ("Sum of Révisé") on it
//   SO-tpl      {Révisé} / {révisé by} / {RÉVISÉ} in a template (already Unicode-aware: a guard)
if ($RUN_O) {
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$oPs = $dir . DIRECTORY_SEPARATOR . 'penumbra_search.php';
if (!function_exists('php_apply_search_filter') && is_file($oPs)) require_once $oPs;
$oTp = $dir . DIRECTORY_SEPARATOR . 'penumbra_template.php';
if (!function_exists('penumbra_tpl_flat_source') && is_file($oTp)) require_once $oTp;
rec('SO-mb', function_exists('mb_strtoupper') && function_exists('mb_strtolower') && mb_strtoupper('é', 'UTF-8') === 'É',
    'mbstring ' . (function_exists('mb_strtoupper') ? 'loaded' : 'MISSING (run.py loads it for mode o)'));
$oJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
$oOk = false;
$oa = strpos($oJe, "\n    function journalExportToggleResolver(");
$obb = ($oa === false) ? null : braceBlock($oJe, $oa);
if ($obb) {
    $oCode = preg_replace('/^\s*function journalExportToggleResolver\(/', 'function oRealResolver(', substr($oJe, $oa + 1, $obb[1] - $oa));
    try { eval($oCode); $oOk = function_exists('oRealResolver'); } catch (Throwable $e) { $oOk = false; }
}
// The runner's condition parser / evaluator, faked as they match a column: ASCII strtoupper on both sides
// (schedule_runner.php parse_format_condition's column map) - names of any letters.
if (!function_exists('parse_format_condition')) {
    function parse_format_condition($c, $cols) {
        if (!preg_match('/^\s*(\{[^}]+\}|[^=<>!{}]+?)\s*=\s*(\S+)\s*$/u', (string)$c, $m)) return array();
        $u = strtoupper(trim($m[1], '{} '));
        foreach ((array)$cols as $x) {
            if (strtoupper((string)$x) === $u) return array(array('type' => 'condition', 'column' => $m[1], 'op' => '=', 'value' => $m[2]));
        }
        return array(array('type' => 'literal', 'leftValue' => $m[1], 'op' => '=', 'value' => $m[2]));
    }
}
if (!function_exists('evaluate_format_condition')) {
    function evaluate_format_condition($row, $parsed) {
        foreach ((array)$parsed as $c) {
            if (!isset($c['type']) || $c['type'] !== 'condition') return false;
            $k = strtoupper(trim($c['column'], '{} ')); $v = null;
            foreach ($row as $rk => $rv) { if (strtoupper((string)$rk) === $k) $v = (string)$rv; }
            if ($v !== (string)$c['value']) return false;
        }
        return true;
    }
}
if (!function_exists('parse_css_properties')) { function parse_css_properties($s, $allowed) { return array('color' => 'red'); } }
if (!function_exists('cf_agg_fn_names')) { function cf_agg_fn_names() { return 'sum|count|avg|min|max'; } }
if (!function_exists('_snippet_set_expanded_columns')) { function _snippet_set_expanded_columns($a = null, $b = null) { return null; } }
if (!function_exists('_snippet_expand_virtual_rows')) { function _snippet_expand_virtual_rows($d, $t, $c, $cols) { return $d; } }
if (!function_exists('penumbra_group_agg_registry_type')) { function penumbra_group_agg_registry_type($t) { return $t; } }
if (!function_exists('penumbra_compute_summary')) {
    function penumbra_compute_summary($cells, $type, $isToggle) {
        $GLOBALS['MSUM'][] = array('cells' => $cells, 'toggle' => $isToggle);
        $s = 0; $n = 0;
        foreach ($cells as $c) { if (is_numeric($c)) { $s += (float)$c; $n++; } }
        return $n ? array('value' => $s) : null;
    }
}
// The task's toggle registry, as the runner keys it (strtoupper of the resolver's names).
if (!function_exists('penumbra_is_toggle_column')) { function penumbra_is_toggle_column($n) { return in_array(strtoupper((string)$n), array('RÉVISÉ', 'ÉTÉ RÉVISÉ'), true); } }
foreach (array('_snippet_journal_toggles', '_snippet_merge_journal_cols', '_snippet_normalize_toggle_tree', '_snippet_toggle_eval_row',
               '_snippet_filter_rows', '_snippet_notes_available', '_snippet_notes_tree', '_snippet_lookup', '_cf_clean_raw_value', 'prepare_format_rules', 'prepare_rewrite_rules',
               'penumbra_sched_toggle_group_by', '_cf_compute_group_agg_raw') as $fn) {
    if (!function_exists($fn)) defineLifted($sr, $fn);
}
$oQ = function ($sql, $binds) {
    if (strpos($sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) return array(array('ID' => 10));
    if (strpos($sql, 'TOGGLE_KEY = :kf') !== false) return array();   // the key filing's record (Round N): none
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID') !== false) {
        $r = array(array('TOGGLE_KEY' => 'rev', 'ROW_KEY' => '5'), array('TOGGLE_KEY' => 'ete', 'ROW_KEY' => '6'));
        if (strpos($sql, 'UPDATED_BY') !== false) { foreach ($r as $i => $x) { $r[$i]['UPDATED_BY'] = 'pat'; $r[$i]['UPDATED_ON'] = '2026-10-01'; } }
        return $r;
    }
    return null;
};
$oState = function ($toggles, $who) {
    return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID'), 'journalToggles' => $toggles),
        $who ? array('journalToggleWho' => true) : array()));
};
$oAm = function ($r) { return (is_array($r) && array_key_exists('aliasMap', $r)) ? $r['aliasMap'] : '(no aliasMap)'; };
$oCn = function ($r) { return is_array($r) ? $r['colNames'] : null; };
$oIds = function ($rows) { return implode(',', array_map(function ($r) { return isset($r['ID']) ? $r['ID'] : '?'; }, is_array($rows) ? array_values($rows) : array())); };
$oJ = function ($v) { return json_encode($v, JSON_UNESCAPED_UNICODE); };
// The parity list: driver.js O-names holds the same names for main.js (String.toUpperCase).
$PARITY = array('Révisé' => 'RÉVISÉ', 'Été révisé' => 'ÉTÉ RÉVISÉ', 'Ñandú' => 'ÑANDÚ', 'Überprüft' => 'ÜBERPRÜFT', 'straße' => 'STRASSE',
                'œuvre' => 'ŒUVRE', 'Ångström' => 'ÅNGSTRÖM', 'Done' => 'DONE');
if ($oOk) {
    $GLOBALS['QFAKE'] = $oQ;
    $pt = array(); $pi = 0;
    foreach (array_keys($PARITY) as $lbl) $pt[] = array('key' => 'p' . ($pi++), 'label' => (string)$lbl);
    $resP = oRealResolver('jracc', $oState($pt, false), array('ID'));
    $resF = oRealResolver('jracc', $oState(array(array('key' => 'rev', 'label' => 'Révisé'), array('key' => 'ete', 'label' => 'Été révisé')), true), array('ID', 'T'));
    $resC1 = oRealResolver('jracc', $oState(array(array('key' => 'rev', 'label' => 'Révisé')), false), array('ID', 'Révisé'));
    $resC2 = oRealResolver('jracc', $oState(array(array('key' => 'rev', 'label' => 'révisé')), false), array('ID', 'RÉVISÉ'));
    $resO = oRealResolver('jracc', $oState(array(array('key' => 'rev', 'label' => 'Checked', 'oldLabels' => array('Révisé'))), false), array('ID'));
    $resO2 = oRealResolver('jracc', $oState(array(array('key' => 'rev', 'label' => 'Checked', 'oldLabels' => array('Révisé'))), false), array('ID', 'Révisé'));
    unset($GLOBALS['QFAKE']);
    rec('SO-names', $oCn($resP) === array_values($PARITY) && $oCn($resF) === array('RÉVISÉ', 'ÉTÉ RÉVISÉ')
        && is_array($resF) && $resF['whoNames'] === array('RÉVISÉ BY', 'RÉVISÉ ON', 'ÉTÉ RÉVISÉ BY', 'ÉTÉ RÉVISÉ ON')
        && $oCn($resC1) === array('RÉVISÉ_2') && $oCn($resC2) === array('RÉVISÉ_2'),
        'parity ' . $oJ($oCn($resP)) . ' | who on ' . $oJ(array($oCn($resF), is_array($resF) ? $resF['whoNames'] : null))
        . ' | beside a data column "Révisé" ' . $oJ($oCn($resC1)) . ', "RÉVISÉ" ' . $oJ($oCn($resC2)));
    $cc = function_exists('journalExportCanonicalCol');
    $k1 = $cc ? journalExportCanonicalCol('révisé', $resF) : '-';
    $k2 = $cc ? journalExportCanonicalCol('{Révisé by}', $resF) : '-';
    $k3 = $cc ? journalExportCanonicalCol('RÉVISÉ', $resF) : '-';
    $k4 = $cc ? journalExportCanonicalCol('rÉvisé', $resO) : '-';
    // A context with a data column of the old name (a template's rows, a snippet's columns): that column keeps it.
    $am5 = function_exists('journalExportAliasMapFor') ? journalExportAliasMapFor($resO, array('ID', 'Révisé')) : '-';
    rec('SO-alias', $oAm($resF) === array('RéVISé' => 'RÉVISÉ', 'RéVISé BY' => 'RÉVISÉ BY', 'RéVISé ON' => 'RÉVISÉ ON',
                                          'ÉTé RéVISé' => 'ÉTÉ RÉVISÉ', 'ÉTé RéVISé BY' => 'ÉTÉ RÉVISÉ BY', 'ÉTé RéVISé ON' => 'ÉTÉ RÉVISÉ ON',
                                          'éTé RéVISé' => 'ÉTÉ RÉVISÉ', 'éTé RéVISé BY' => 'ÉTÉ RÉVISÉ BY', 'éTé RéVISé ON' => 'ÉTÉ RÉVISÉ ON')
        && $oAm($resC1) === array() && $oAm($resC2) === array('RéVISé' => 'RÉVISÉ')
        && $oAm($resO) === array('RÉVISÉ' => 'CHECKED', 'RéVISé' => 'CHECKED') && $oAm($resO2) === array()
        && $k1 === 'RÉVISÉ' && $k2 === 'RÉVISÉ BY' && $k3 === null && $k4 === 'CHECKED' && $am5 === array(),
        'who on ' . $oJ($oAm($resF)) . ' | gave way to "Révisé" ' . $oJ($oAm($resC1)) . ', to "RÉVISÉ" ' . $oJ($oAm($resC2))
        . ' | an old name ' . $oJ($oAm($resO)) . ', beside a data column of it ' . $oJ($oAm($resO2))
        . ' | canonical "révisé" ' . $oJ($k1) . ', "{Révisé by}" ' . $oJ($k2) . ', "RÉVISÉ" ' . $oJ($k3) . ', "rÉvisé" (old) ' . $oJ($k4)
        . ' | the old name beside a data column "Révisé" ' . $oJ($am5));
    if (function_exists('php_apply_search_filter')) {
        $raw = array(array('ID' => '5', 'T' => 'a'), array('ID' => '6', 'T' => 'b'));
        $qs = array('Révisé = ☑' => '5', 'révisé = ☐' => '6', 'RÉVISÉ = ☑' => '5', '{Été révisé} = ☑' => '6', 'été révisé = ☐' => '5', 'Révisé by = pat' => '5');
        $got = array(); $ok = true;
        foreach ($qs as $q => $want) { $got[$q] = $oIds(php_apply_search_filter($raw, 'standard', $q, null, $resF)); if ($got[$q] !== $want) $ok = false; }
        $raw2 = array(array('ID' => '5', 'RÉVISÉ' => 'x'), array('ID' => '6', 'RÉVISÉ' => 'y'));
        $f7 = $oIds(php_apply_search_filter($raw2, 'standard', 'révisé = y', null, $resC2));
        rec('SO-filter', $ok && $f7 === '6', $oJ($got) . ' | beside a data column RÉVISÉ: "révisé = y" -> ' . $f7 . ' (the data column: 6)');
    } else {
        rec('SO-filter', false, 'no php_apply_search_filter in ' . $oPs);
    }
    _snippet_journal_toggles($resF);
    $alias = function_exists('journalExportAliasMapFor') ? journalExportAliasMapFor($resF, array('ID', 'T')) : array();
    $tree = array(array('type' => 'condition', 'column' => 'Révisé', 'op' => '=', 'value' => '☑'), array('type' => 'logical', 'op' => 'and'),
                  array(array('type' => 'condition', 'column' => '{été révisé}', 'op' => '=', 'value' => '☐')));
    $nt = _snippet_normalize_toggle_tree($tree, $resF, $alias);
    $rowsS = array(array('ID' => '5', 'T' => 'a'), array('ID' => '6', 'T' => 'b'));
    $fr1 = $oIds(_snippet_filter_rows($rowsS, array('ID', 'T'), 'Révisé = ☑'));
    $fr2 = $oIds(_snippet_filter_rows($rowsS, array('ID', 'T'), 'été révisé = ☑'));
    $fr3 = $oIds(_snippet_filter_rows($rowsS, array('ID', 'T'), 'RÉVISÉ = ☐'));
    $lk = _snippet_lookup(array('T', 'révisé = ☑'), $rowsS, array('ID', 'T'));
    rec('SO-snippet', isset($nt[0]['column']) && $nt[0]['column'] === 'RÉVISÉ' && $nt[0]['value'] === '1'
        && isset($nt[2][0]['column']) && $nt[2][0]['column'] === 'ÉTÉ RÉVISÉ' && $nt[2][0]['value'] === '0'
        && $fr1 === '5' && $fr2 === '6' && $fr3 === '6' && $lk === "\x02a\x02",
        'the tree ' . $oJ($nt) . ' | count rows "Révisé = ☑" ' . $fr1 . ', "été révisé = ☑" ' . $fr2 . ', "RÉVISÉ = ☐" ' . $fr3 . ' | lookup ' . $oJ($lk));
    $pf = prepare_format_rules(array(array('type' => 'cell', 'targetColumn' => strtoupper('Révisé'), 'condition' => 'révisé = ☑', 'style' => 'color: red')),
                               array('ID', 'RÉVISÉ', 'RÉVISÉ BY', 'RÉVISÉ ON', 'ÉTÉ RÉVISÉ'));
    $fc = isset($pf['cell'][0]) ? $pf['cell'][0] : array();
    $pr = prepare_rewrite_rules(array(array('targetColumn' => strtoupper('été révisé'), 'condition' => 'Été révisé = ☐', 'template' => 'todo')), array('ID', 'ÉTÉ RÉVISÉ'));
    $rw = isset($pr[0]) ? $pr[0] : array();
    rec('SO-format', isset($fc['targetColumn']) && $fc['targetColumn'] === 'RÉVISÉ' && isset($fc['_parsed'][0]['column']) && $fc['_parsed'][0]['column'] === 'RÉVISÉ'
        && $fc['_parsed'][0]['value'] === '1' && isset($rw['targetColumn']) && $rw['targetColumn'] === 'ÉTÉ RÉVISÉ'
        && isset($rw['_parsed'][0]['column']) && $rw['_parsed'][0]['column'] === 'ÉTÉ RÉVISÉ' && $rw['_parsed'][0]['value'] === '0',
        'format(cell, Révisé, révisé = ☑): target ' . $oJ(isset($fc['targetColumn']) ? $fc['targetColumn'] : null) . ', condition ' . $oJ(isset($fc['_parsed']) ? $fc['_parsed'] : null)
        . ' | rewrite(été révisé, Été révisé = ☐): target ' . $oJ(isset($rw['targetColumn']) ? $rw['targetColumn'] : null) . ', condition ' . $oJ(isset($rw['_parsed']) ? $rw['_parsed'] : null));
    $g1 = penumbra_sched_toggle_group_by('Révisé', $resF);
    $g2 = penumbra_sched_toggle_group_by('T, été révisé, révisé by', $resF);
    $g3 = penumbra_sched_toggle_group_by('RÉVISÉ', $resF);
    $GLOBALS['MSUM'] = array();
    $a1 = _cf_compute_group_agg_raw(array(array('ID' => '1', 'RÉVISÉ' => '1'), array('ID' => '2', 'RÉVISÉ' => '0'), array('ID' => '3', 'RÉVISÉ' => '1')), 'Révisé', 'sum');
    $t1 = isset($GLOBALS['MSUM'][0]['toggle']) ? $GLOBALS['MSUM'][0]['toggle'] : null;
    rec('SO-groupby', $g1 === 'RÉVISÉ' && $g2 === 'T,ÉTÉ RÉVISÉ,RÉVISÉ BY' && $g3 === 'RÉVISÉ' && is_array($a1) && $a1['value'] == 2 && $t1 === true,
        '"Révisé" -> ' . $oJ($g1) . ', "T, été révisé, révisé by" -> ' . $oJ($g2) . ', "RÉVISÉ" -> ' . $oJ($g3)
        . ' | Sum of Révisé over 1/0/1: ' . $oJ(is_array($a1) ? $a1['value'] : $a1) . ' (the toggle rule ' . $oJ($t1) . ')');
    _snippet_journal_toggles(false);
    if (function_exists('penumbra_tpl_flat_source')) {
        $tRows = array(array('ID' => '5', 'RÉVISÉ' => '1', 'RÉVISÉ BY' => 'pat'), array('ID' => '6', 'RÉVISÉ' => '0', 'RÉVISÉ BY' => ''));
        $l1 = penumbra_tpl_render_body('{ID}:{Révisé}:{révisé by}:{RÉVISÉ}', penumbra_tpl_flat_source(array('data' => $tRows, 'viewMode' => 'standard', 'journalToggleResolver' => $resF)), null);
        rec('SO-tpl', $l1 === array('5:1:pat:1', '6:0::0'), $oJ($l1));
    } else {
        rec('SO-tpl', false, 'no penumbra_tpl_flat_source in ' . $oTp);
    }
} else {
    foreach (array('SO-names', 'SO-alias', 'SO-filter', 'SO-snippet', 'SO-format', 'SO-groupby', 'SO-tpl') as $id) rec($id, false, 'journal_export.php not lifted');
}
}   // $RUN_O

// ======================= ROUND Q (2026-10-09): the close-out bug sweep - the toggle columns' consumers. The REAL
// resolver (lifted), the REAL search engine (penumbra_search.php), the runner's group-summary branch lifted (its
// re-group and the summary's arithmetic faked: the toggle handling is under test).
//   SQ-keys     toggle keys and labels read as the page reads them (C12)
//   SQ-keymiss  a key column the data lacks: no toggle columns (C4)
//   SQ-bare     a bare term reads the data's own columns (C7)
//   SQ-dual     a regex / alternation / comparison on a toggle tests both forms, negated once (C9)
//   SQ-groupsum a task filter naming the band summary reads the toggles as the other branch does (C1)
//   SQ-who-sig  the who / when columns out of change signatures and analyses (C5)
//   SQ-sort     a saved sort by a toggle's internal name sorts its output column (C6)
//   SQ-group    grouping levels by a toggle's internal / who / old name; the comma guard (C10)

// ============================================================================================================
// Round T (2026-10-09): the search engine and the scheduler (the user: "fix them all", after the live E2E)
//   ST-bare-mat    a bare term on rows that ALREADY carry the toggle / who columns (the ?json=1 API appends them
//                  before &search=) reads the data's own columns only
//   ST-zero        "0" is a search: the parser keeps it, the filter applies it
//   ST-filter-set  penumbra_search_filter_set: "0" yes; '', '  ', null, an array no
//   ST-range       a range bound reads as parseFloat: "-" and "1,-5" no longer match 0 / 3; "1-5" still does
//   ST-runner-zero the scheduler's task filter tests read "0" as a filter (no !empty($searchFilter) left)
//   ST-vcache      the snippet engine's nested-column cache tells two same-size data sets apart
//   ST-c8-read     a condition's row copy is built only when it reads a journal column (either side)
//   ST-c8-wire     _snippet_filter_rows and lookup() take the copy only then
//   ST-c8-upper    the key lookup reads a key column by any case of its name, row after row (the name cache)
//   ST-c8-memo     the resolver memo: on, a second build reads no marks; off, it reads them again
//   ST-c8-memo-wire the per-recipient re-run turns the memo on around its call, and off after
// ============================================================================================================
if ($RUN_T) {
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$tPs = $dir . DIRECTORY_SEPARATOR . 'penumbra_search.php';
if (!function_exists('php_apply_search_filter') && is_file($tPs)) require_once $tPs;
$tJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
$ta = strpos($tJe, "\n    function journalExportToggleResolver(");
$tbb = ($ta === false) ? null : braceBlock($tJe, $ta);
$tOk = false;
if ($tbb) {
    try { eval(preg_replace('/^\s*function journalExportToggleResolver\(/', 'function tRealResolver(', substr($tJe, $ta + 1, $tbb[1] - $ta))); $tOk = function_exists('tRealResolver'); }
    catch (Throwable $e) { $tOk = false; }
}
$GLOBALS['TREADS'] = 0;
$tQ = function ($sql, $binds) {
    if (strpos($sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) return array(array('ID' => 20));
    if (strpos($sql, 'TOGGLE_KEY = :kf') !== false) return array();
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID') !== false) {
        $GLOBALS['TREADS']++;
        $r = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '1'), array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '3'));
        if (strpos($sql, 'UPDATED_BY') !== false) { foreach ($r as $i => $x) { $r[$i]['UPDATED_BY'] = 'jsmith'; $r[$i]['UPDATED_ON'] = '2026-10-01'; } }
        return $r;
    }
    return null;
};
$tState = function ($who) {
    return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID'), 'journalToggles' => array(array('key' => 'done', 'label' => 'Done'))),
        $who ? array('journalToggleWho' => true) : array()));
};
$tJ = function ($v) { return json_encode($v, JSON_UNESCAPED_UNICODE); };
$tIds = function ($rows) { $o = array(); foreach ((array)$rows as $r) { if (is_array($r) && isset($r['ID'])) $o[] = $r['ID']; } return implode(',', $o); };
$tRows = array(
    array('ID' => '1', 'NAME' => 'alpha', 'AMOUNT' => '50'),
    array('ID' => '2', 'NAME' => 'jsmithers', 'AMOUNT' => '70'),
    array('ID' => '3', 'NAME' => 'gamma', 'AMOUNT' => '200'));
if ($tOk && function_exists('php_apply_search_filter') && function_exists('journalExportToggleRowValues')) {
    $GLOBALS['QFAKE'] = $tQ;
    // ---- T1: the API's rows carry DONE (1 on rows 1, 3) and DONE BY / DONE ON (jsmith) before &search=
    $res = tRealResolver('jrt', $tState(true), array('ID', 'NAME', 'AMOUNT'));
    $mat = $tRows;
    foreach ($mat as $i => $r) { foreach (journalExportToggleRowValues($res, $r) as $n => $v) $mat[$i][$n] = $v; }
    $b1 = $tIds(php_apply_search_filter($mat, 'standard', '1', null, $res));
    $bj = $tIds(php_apply_search_filter($mat, 'standard', 'jsmith', null, $res));
    $bd = $tIds(php_apply_search_filter($mat, 'standard', 'Done = 1', null, $res));
    rec('ST-bare-mat', $b1 === '1' && $bj === '2' && $bd === '1,3',
        'rows carrying ' . $tJ(array_keys($mat[0])) . ': bare "1" -> ' . $b1 . ' (data: 1), bare "jsmith" -> ' . $bj . ' (data: 2), "Done = 1" -> ' . $bd);
    // ---- T2: "0"
    $zRows = array(array('ID' => '7', 'V' => '0'), array('ID' => '8', 'V' => 'x'), array('ID' => '9', 'V' => 'y'));
    $z = $tIds(php_apply_search_filter($zRows, 'standard', '0', null, null));
    $zp = function_exists('php_parse_search_query') ? php_parse_search_query('0', array('ID', 'V')) : null;
    rec('ST-zero', $z === '7' && !empty($zp), 'bare "0" -> ' . $z . ' (want 7) | parsed ' . $tJ($zp));
    $fs = function_exists('penumbra_search_filter_set')
        ? array(penumbra_search_filter_set('0'), penumbra_search_filter_set(''), penumbra_search_filter_set('  '), penumbra_search_filter_set(null), penumbra_search_filter_set(array('x')), penumbra_search_filter_set('a'))
        : null;
    rec('ST-filter-set', $fs === array(true, false, false, false, false, true), $fs === null ? 'no penumbra_search_filter_set' : $tJ($fs));
    // ---- T3: range bounds
    $rg = function_exists('php_test_search_condition')
        ? array(php_test_search_condition('=', '-', '0'), php_test_search_condition('=', '1,-5', '3'), php_test_search_condition('=', '1-5', '3'), php_test_search_condition('=', '1,-5', '1'), php_test_search_condition('=', '1,,3', '0'))
        : null;
    rec('ST-range', $rg === array(false, false, true, true, false), '"-" on 0, "1,-5" on 3, "1-5" on 3, "1,-5" on 1, "1,,3" on 0: ' . $tJ($rg) . ' (want false,false,true,true,false)');
    unset($GLOBALS['QFAKE']);
} else {
    foreach (array('ST-bare-mat', 'ST-zero', 'ST-filter-set', 'ST-range') as $id) rec($id, false, 'resolver ' . ($tOk ? 'lifted' : 'NOT lifted') . ', engine ' . (function_exists('php_apply_search_filter') ? 'loaded' : 'NOT loaded'));
}
// ---- T2 in the scheduler: the task filter's tests
$tNe = substr_count($sr, '!empty($searchFilter)');
$tSet = substr_count($sr, 'penumbra_search_filter_set($searchFilter)');
rec('ST-runner-zero', $sr !== '' && $tNe === 0 && $tSet >= 14, '!empty($searchFilter) left ' . $tNe . ', penumbra_search_filter_set($searchFilter) ' . $tSet);
// ---- T4: the nested-column cache
if (!function_exists('_snippet_detect_virtual_columns')) defineLifted($sr, '_snippet_detect_virtual_columns');
if (function_exists('_snippet_detect_virtual_columns') && function_exists('_search_get_virtual_columns')) {
    $vA = array(); $vB = array();
    for ($i = 0; $i < 3; $i++) {
        $vA[] = array('ID' => (string)$i, 'SUB' => '@@JSON' . json_encode(array(array('XA' => 'a' . $i))));
        $vB[] = array('ID' => (string)$i, 'SUB' => '@@JSON' . json_encode(array(array('YB' => 'b' . $i))));
    }
    $ca = array_keys(_snippet_detect_virtual_columns($vA));
    $cb = array_keys(_snippet_detect_virtual_columns($vB));
    rec('ST-vcache', $ca === array('XA') && $cb === array('YB'), 'data set A ' . $tJ($ca) . ', then B (same size) ' . $tJ($cb));
} else {
    rec('ST-vcache', false, 'not lifted');
}
// ---- T5 (C8): the condition reads a journal column?
foreach (array('_snippet_tree_reads_journal', '_snippet_tree_reads_names') as $fn) { if (!function_exists($fn)) defineLifted($sr, $fn); }
if (function_exists('_snippet_tree_reads_journal')) {
    $jtx = array('colNames' => array('DONE'), 'whoNames' => array('DONE BY', 'DONE ON'));
    $cnd = function ($col, $val) { return array(array('type' => 'condition', 'column' => $col, 'operator' => '=', 'value' => $val)); };
    $rd = array(
        _snippet_tree_reads_journal($cnd('AMOUNT', '5'), $jtx),
        _snippet_tree_reads_journal($cnd('Done', '1'), $jtx),
        _snippet_tree_reads_journal($cnd('{DONE BY}', 'x'), $jtx),
        _snippet_tree_reads_journal($cnd('NAME', '{Done}'), $jtx),
        _snippet_tree_reads_journal(array(array('type' => 'group', 'items' => $cnd('AMOUNT', '1')), $cnd('done on', '2026')), $jtx),
        _snippet_tree_reads_journal($cnd('Done', '1'), null));
    rec('ST-c8-read', $rd === array(false, true, true, true, true, false), 'AMOUNT, Done, {DONE BY}, value {Done}, a group + "done on", no toggles: ' . $tJ($rd));
} else {
    rec('ST-c8-read', false, 'no _snippet_tree_reads_journal');
}
$fa = strpos($sr, "\nfunction _snippet_filter_rows(");
$fbb = ($fa === false) ? null : braceBlock($sr, $fa);
$fsrc = $fbb ? substr($sr, $fa, $fbb[1] - $fa) : '';
$la = strpos($sr, "\n    \$data = _snippet_expand_virtual_rows(\$data, \$returnCol, \$conditionStr, \$columns);");
$lsrc = ($la === false) ? '' : substr($sr, $la, 1800);
$wire = function ($src) { return strpos($src, '$jtRead = $jt && _snippet_tree_reads_journal($parsed, $jt);') !== false && strpos($src, '$jtRead ? _snippet_toggle_eval_row($row, $jt) : $row') !== false && strpos($src, '$jt ? _snippet_toggle_eval_row($row, $jt) : $row') === false; };
rec('ST-c8-wire', $fsrc !== '' && $lsrc !== '' && $wire($fsrc) && $wire($lsrc), '_snippet_filter_rows ' . ($fsrc !== '' && $wire($fsrc) ? 'reads first' : 'copies every row') . ', lookup ' . ($lsrc !== '' && $wire($lsrc) ? 'reads first' : 'copies every row'));
if ($tOk && function_exists('journalExportToggleRowValues')) {
    $GLOBALS['QFAKE'] = $tQ;
    $rK = tRealResolver('jrt', $tState(false), array('id', 'NAME'));
    $u = array();
    foreach (array(array('id' => '1', 'NAME' => 'n1'), array('NAME' => 'n3', 'ID' => '3'), array('Id' => '2', 'NAME' => 'n2'), array('X' => 'q', 'id' => '3', 'NAME' => 'z')) as $row) { $vv = journalExportToggleRowValues($rK, $row); $u[] = isset($vv['DONE']) ? $vv['DONE'] : '-'; }
    rec('ST-c8-upper', $u === array('1', '1', '0', '1'), 'rows keyed id / ID / Id / id: ' . $tJ($u) . ' (want 1,1,0,1)');
    // ---- the memo
    $GLOBALS['TREADS'] = 0;
    tRealResolver('jrt', $tState(false), array('ID')); tRealResolver('jrt', $tState(false), array('ID'));
    $off = $GLOBALS['TREADS'];
    $GLOBALS['TREADS'] = 0;
    $GLOBALS['penumbra_jt_resolver_memo'] = array();
    $m1 = tRealResolver('jrt', $tState(false), array('ID')); $m2 = tRealResolver('jrt', $tState(false), array('ID'));
    $m3 = tRealResolver('jrt', $tState(true), array('ID'));   // another state: built afresh
    $on = $GLOBALS['TREADS'];
    unset($GLOBALS['penumbra_jt_resolver_memo']);
    rec('ST-c8-memo', $off >= 2 && $on === $off && is_array($m1) && $m1 === $m2 && is_array($m3) && !empty($m3['whoNames']),
        'marks reads for two builds: memo off ' . $off . ', memo on ' . $on . ' (the second from the memo; a third with another state read again) | same answer ' . ($m1 === $m2 ? 'yes' : 'NO'));
    unset($GLOBALS['QFAKE']);
} else {
    foreach (array('ST-c8-upper', 'ST-c8-memo') as $id) rec($id, false, 'resolver not lifted');
}
$pa = strpos($sr, '$perRecipResult = execute_scheduled_report($task[\'REPORT_ID\'], $apiUrlBase, $task[\'SUBJECT\'], $report_password, $prompt_answers, $task[\'RECIPIENTS\'], $r, me_map: $task_me_map);');
$pre = ($pa === false) ? '' : substr($sr, max(0, $pa - 200), 200);
$post = ($pa === false) ? '' : substr($sr, $pa, 400);
$fe = strpos($sr, "\$jtResolverMemo = array();   // one marks read for every recipient's re-run");
$fl = strpos($sr, 'foreach ($parsed_recipients as $r) {', $fe === false ? 0 : $fe);
rec('ST-c8-memo-wire', $pa !== false && strpos($pre, "\$GLOBALS['penumbra_jt_resolver_memo'] = \$jtResolverMemo;") !== false
        && strpos($post, "unset(\$GLOBALS['penumbra_jt_resolver_memo']);") !== false && $fe !== false && $fl !== false && $fl - $fe < 200,
    'call ' . ($pa !== false ? 'found' : 'NOT found') . ', memo on before ' . (strpos($pre, "penumbra_jt_resolver_memo'] = \$jtResolverMemo") !== false ? 'yes' : 'no')
    . ', off after ' . (strpos($post, "unset(\$GLOBALS['penumbra_jt_resolver_memo'])") !== false ? 'yes' : 'no') . ', reset per task ' . ($fe !== false && $fl !== false && $fl - $fe < 200 ? 'yes' : 'no'));
}

if ($RUN_Q) {
if (!function_exists('journalUpperKey') && is_file($jePath)) require_once $jePath;
$qPs = $dir . DIRECTORY_SEPARATOR . 'penumbra_search.php';
if (!function_exists('php_apply_search_filter') && is_file($qPs)) require_once $qPs;
$qJe = str_replace("\r\n", "\n", (string)@file_get_contents($jePath));
$qa = strpos($qJe, "\n    function journalExportToggleResolver(");
$qbb = ($qa === false) ? null : braceBlock($qJe, $qa);
$qOk = false;
if ($qbb) {
    try { eval(preg_replace('/^\s*function journalExportToggleResolver\(/', 'function qRealResolver(', substr($qJe, $qa + 1, $qbb[1] - $qa))); $qOk = function_exists('qRealResolver'); }
    catch (Throwable $e) { $qOk = false; }
}
foreach (array('_cf_apply_group_summary_filter', '_cf_split_group_summary_query', '_cf_match_group_summary', '_cf_compare_group_summary') as $fn) {
    if (!function_exists($fn)) defineLifted($sr, $fn);
}
if (!function_exists('apply_state_logic')) {
    function apply_state_logic($rows, $state, $preserve = array()) {
        $GLOBALS['QASL'][] = $preserve;
        $gb = isset($state['groupBy']) ? (string)$state['groupBy'] : '';
        if ($gb === '') return array('data' => $rows, 'viewMode' => 'standard');
        $g = array();
        foreach ($rows as $r) { $k = isset($r[$gb]) ? (string)$r[$gb] : '[Blank]'; $g[$k][] = $r; }
        return array('data' => $g, 'viewMode' => 'grouped', 'groupAgg' => isset($state['groupAgg']) ? $state['groupAgg'] : null);
    }
}
if (!function_exists('_cf_compute_group_agg_raw')) {
    function _cf_compute_group_agg_raw($rows, $aggCol, $aggType, $gb = null, $gk = null) {
        $s = 0; $n = 0;
        foreach ((array)$rows as $r) {
            foreach ((array)$r as $k => $v) { if (strtoupper((string)$k) === strtoupper((string)$aggCol) && is_numeric($v)) { $s += (float)$v; $n++; } }
        }
        return array('value' => $n ? $s : null, 'isDate' => false);
    }
}
$qQ = function ($sql, $binds) {
    if (strpos($sql, 'FROM PENUMBRA_REPORTS WHERE TRIM(SHORT_ID)') !== false) return array(array('ID' => 20));
    if (strpos($sql, 'TOGGLE_KEY = :kf') !== false) return array();
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE WHERE REPORT_ID') !== false) {
        $r = array(array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '1'), array('TOGGLE_KEY' => 'done', 'ROW_KEY' => '3'));
        if (strpos($sql, 'UPDATED_BY') !== false) { foreach ($r as $i => $x) { $r[$i]['UPDATED_BY'] = 'jsmith'; $r[$i]['UPDATED_ON'] = '2026-10-01'; } }
        return $r;
    }
    return null;
};
$qState = function ($toggles, $who) {
    return array('viewOptions' => array_merge(array('journalEnabled' => true, 'journalKeyColumns' => array('ID'), 'journalToggles' => $toggles),
        $who ? array('journalToggleWho' => true) : array()));
};
$qJ = function ($v) { return json_encode($v, JSON_UNESCAPED_UNICODE); };
$qRows = array(
    array('ID' => '1', 'DEPT' => 'A', 'NAME' => 'alpha', 'AMOUNT' => '50'),
    array('ID' => '2', 'DEPT' => 'A', 'NAME' => 'jsmithers', 'AMOUNT' => '70'),
    array('ID' => '3', 'DEPT' => 'B', 'NAME' => 'gamma', 'AMOUNT' => '200'));
$qIds = function ($rows) {
    $o = array();
    foreach ((array)$rows as $r) { if (is_array($r) && isset($r['ID'])) $o[] = $r['ID']; }
    return implode(',', $o);
};
if ($qOk) {
    $GLOBALS['QFAKE'] = $qQ;
    $resW = qRealResolver('jrq', $qState(array(array('key' => 'done', 'label' => 'Done')), true), array('ID', 'DEPT', 'NAME', 'AMOUNT'));
    // ---- C12: a key "Done" (the marks are stored under "done") and a toggle with no label
    $resK = qRealResolver('jrq', $qState(array(array('key' => 'Done', 'label' => 'Reviewed'), array('key' => 'toggle2')), false), array('ID'));
    $kv = (is_array($resK) && function_exists('journalExportToggleRowValues')) ? journalExportToggleRowValues($resK, array('ID' => '1')) : null;
    rec('SQ-keys', is_array($resK) && $resK['colNames'] === array('REVIEWED', 'DONE') && is_array($kv) && isset($kv['REVIEWED']) && $kv['REVIEWED'] === '1',
        'names ' . $qJ(is_array($resK) ? $resK['colNames'] : $resK) . ' | row 1 ' . $qJ($kv));
    // ---- C4: the key column ID not in the data
    $resM = qRealResolver('jrq', $qState(array(array('key' => 'done', 'label' => 'Done')), false), array('PROP_ID', 'AMOUNT'));
    $resM2 = qRealResolver('jrq', $qState(array(array('key' => 'done', 'label' => 'Done')), false), array('id', 'AMOUNT'));
    rec('SQ-keymiss', $resM === null && is_array($resM2),
        'key ID, data PROP_ID / AMOUNT: ' . ($resM === null ? 'no toggle columns' : 'columns ' . $qJ($resM['colNames'])) . ' | data "id": ' . (is_array($resM2) ? 'read' : 'NOT read'));
    // ---- C7 / C9 through the real engine
    $f = function ($filter) use ($qRows, $resW, $qIds) { return $qIds(php_apply_search_filter($qRows, 'standard', $filter, null, $resW)); };
    $b1 = $f('jsmith'); $b2 = $f('2026'); $b3 = $f('gamma'); $b4 = $f('{DONE BY} = jsmith');
    rec('SQ-bare', strpos(',' . $b1 . ',', ',1,') === false && strpos(',' . $b1 . ',', ',3,') === false && $b2 === '' && $b3 === '3' && $b4 === '1,3',
        'bare "jsmith" -> [' . $b1 . '] (1 and 3 were marked by jsmith) | "2026" -> [' . $b2 . '] | "gamma" -> [' . $b3 . '] | {DONE BY} = jsmith -> [' . $b4 . ']');
    $d1 = $f("Done = /^(?:\xE2\x98\x90|\xE2\x98\x91)$/"); $d2 = $f("Done != /^(?:\xE2\x98\x90|\xE2\x98\x91)$/"); $d3 = $f("Done = \xE2\x98\x91");
    $d4 = $f('Done > 0'); $d5 = $f("Done = /\xE2\x98\x91/");
    rec('SQ-dual', $d1 === '1,2,3' && $d2 === '' && $d3 === '1,3' && $d4 === '1,3' && $d5 === '1,3',
        'both boxes [' . $d1 . '] | not both [' . $d2 . '] | = checked [' . $d3 . '] | > 0 [' . $d4 . '] | /checked/ [' . $d5 . ']');
    // ---- C1: the group-summary branch
    $apiR = array('rawData' => $qRows, 'data' => $qRows, 'groupBy' => 'DEPT', 'groupAgg' => array('column' => 'AMOUNT', 'type' => 'sum'),
                  'journalToggleResolver' => $resW, 'journalToggleCols' => array('DONE', 'DONE BY', 'DONE ON'), 'viewMode' => 'grouped');
    $gsOk = function_exists('_cf_apply_group_summary_filter');
    $GLOBALS['QASL'] = array();
    $gs = null; $gs2 = null; $gsErr = '';
    try {
        if ($gsOk) $gs = _cf_apply_group_summary_filter($apiR, $qRows, "Done = \xE2\x98\x90 and Sum of AMOUNT > 60", 'DEPT', $apiR['groupAgg'], 'Sum of AMOUNT');
        $gsPres = $GLOBALS['QASL'] ? end($GLOBALS['QASL']) : null;
        $apiR2 = $apiR; $apiR2['groupAgg'] = array('column' => 'DONE', 'type' => 'sum');
        if ($gsOk) $gs2 = _cf_apply_group_summary_filter($apiR2, $qRows, 'Sum of DONE > 0', 'DEPT', $apiR2['groupAgg'], 'Sum of DONE');
    } catch (Throwable $e) { $gsErr = get_class($e) . ': ' . $e->getMessage(); $gsPres = null; }
    $gsData = (is_array($gs) && isset($gs['data']) && is_array($gs['data'])) ? $gs['data'] : null;
    $gsA = (is_array($gsData) && isset($gsData['A'])) ? $gsData['A'] : null;
    $gsRow = (is_array($gsA) && isset($gsA[0])) ? $gsA[0] : null;
    $gs2Keys = (is_array($gs2) && isset($gs2['data']) && is_array($gs2['data'])) ? implode(',', array_keys($gs2['data'])) : null;
    rec('SQ-groupsum', is_array($gsData) && array_keys($gsData) === array('A') && $qIds($gsA) === '2' && is_array($gsRow) && isset($gsRow['DONE']) && $gsRow['DONE'] === '0'
        && is_array($gsPres) && in_array('DONE', $gsPres, true) && $gs2Keys === 'A,B',
        '"Done = unchecked and Sum of AMOUNT > 60": groups ' . $qJ(is_array($gsData) ? array_keys($gsData) : $gsData) . ', A rows [' . $qIds($gsA) . '], its DONE '
        . $qJ(is_array($gsRow) && isset($gsRow['DONE']) ? $gsRow['DONE'] : null) . ', kept through the re-group ' . $qJ($gsPres)
        . ' | "Sum of DONE > 0": groups ' . $qJ($gs2Keys) . ($gsErr ? ' | threw ' . $gsErr : ''));
    unset($GLOBALS['QFAKE']);
    // ---- C5: the who / when columns out of signatures and analyses
    $wRows = array(array('ID' => '1', 'DONE' => '1', 'DONE BY' => 'jsmith', 'DONE ON' => '2026-10-01'), array('ID' => '2', 'DONE' => '0', 'DONE BY' => '', 'DONE ON' => ''));
    $sw = function_exists('journalStripWhoCols');
    $s1 = $sw ? journalStripWhoCols($wRows, $resW) : null;
    $s2 = $sw ? journalStripWhoCols(array('A' => $wRows), array('journalToggleResolver' => $resW)) : null;
    $s3 = $sw ? journalStripWhoCols(array(array('rows' => $wRows)), $resW) : null;
    $s4 = $sw ? journalStripWhoCols($wRows, $resK) : null;
    $sites = substr_count($sr, 'journalStripWhoCols(');
    rec('SQ-who-sig', $sw && array_keys($s1[0]) === array('ID', 'DONE') && array_keys($s2['A'][1]) === array('ID', 'DONE')
        && array_keys($s3[0]['rows'][0]) === array('ID', 'DONE') && $s4 === $wRows && $sites >= 5,
        'flat ' . $qJ($s1 ? array_keys($s1[0]) : null) . ' | grouped ' . $qJ($s2 ? array_keys($s2['A'][1]) : null) . ' | {rows} ' . $qJ($s3 ? array_keys($s3[0]['rows'][0]) : null)
        . ' | no who columns: ' . ($s4 === $wRows ? 'unchanged' : 'CHANGED') . ' | the runner\'s signature / analysis sites ' . $sites);
    // ---- C6: the saved sort
    $crit = array(array('colIdentifier' => '__JOURNAL_TOGGLE__done', 'colIndex' => '__JOURNAL_TOGGLE__done', 'direction' => 'desc'),
                  array('colIdentifier' => '__JOURNAL_ON__done', 'colIndex' => '__JOURNAL_ON__done', 'direction' => 'asc'),
                  array('colIdentifier' => 'AMOUNT', 'colIndex' => 3, 'direction' => 'asc'));
    $mc = function_exists('journalExportMapSortCriteria') ? journalExportMapSortCriteria($crit, $resW) : null;
    $srSort = strpos($sr, "\$state['sortCriteria'] = journalExportMapSortCriteria(\$state['sortCriteria'], \$journal_toggle_resolver);") !== false;
    rec('SQ-sort', is_array($mc) && $mc[0]['colIdentifier'] === 'DONE' && $mc[0]['colIndex'] === 'DONE' && $mc[1]['colIdentifier'] === 'DONE ON'
        && $mc[2]['colIdentifier'] === 'AMOUNT' && $mc[2]['colIndex'] === 3 && $srSort,
        'mapped ' . $qJ($mc) . ' | the runner maps its state\'s sort ' . $qJ($srSort));
    // ---- C10: grouping levels
    $gRes = array('colMeta' => array(array('name' => 'DONE', 'key' => 'done'), array('name' => 'REVIEWED, SIGNED', 'key' => 'rs')),
                  'whoMeta' => array(array('name' => 'DONE BY', 'key' => 'done', 'kind' => 'by')), 'aliasMap' => array('OLDNAME' => 'DONE'));
    $gf = function ($gb) use ($gRes) { return function_exists('journalExportToggleGroupBy') ? journalExportToggleGroupBy($gb, $gRes) : null; };
    $g1 = $gf('DEPT,__JOURNAL_TOGGLE__done'); $g2 = $gf('__JOURNAL_BY__done'); $g3 = $gf('OldName'); $g4 = $gf('DEPT,__JOURNAL_TOGGLE__rs');
    $srDel = strpos($sr, "if (function_exists('journalExportToggleGroupBy')) return journalExportToggleGroupBy(\$groupBy, \$resolver);") !== false;
    rec('SQ-group', $g1 === 'DEPT,DONE' && $g2 === 'DONE BY' && $g3 === 'DONE' && $g4 === 'DEPT,__JOURNAL_TOGGLE__rs' && $srDel,
        $qJ(array($g1, $g2, $g3, $g4)) . ' | the runner\'s map is the shared one ' . $qJ($srDel));
} else {
    foreach (array('SQ-keys', 'SQ-keymiss', 'SQ-bare', 'SQ-dual', 'SQ-groupsum', 'SQ-who-sig', 'SQ-sort', 'SQ-group') as $id) rec($id, false, 'journalExportToggleResolver not lifted');
}
}   // $RUN_Q

echo json_encode(array('asserts' => $OUT));
