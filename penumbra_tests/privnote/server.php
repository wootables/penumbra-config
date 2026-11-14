<?php
// =============================================================================
// PRIVATE NOTES SUITE "privnote" - SERVER HALF (2026-11-13, PRIVATE_NOTES_SPEC.md sections 3-5)
//
// A journal thread (a root note and its replies) is PRIVATE when its notes carry IS_PRIVATE = 1: only its
// audience - everyone who wrote in it or is @mentioned in it - may see it. To anyone else every journal
// read treats it as missing, and no server output carries it at all.
//   V-*  journalVisibleNotes() (journal_export.php): the rule itself
//   R-*  every read applies it: summary, the index.php badge, list, row_notes (+ parked), row_notes_one,
//        notes_version, attachment
//   A-*  add: the flag, a reply inheriting it, a reply into a hidden thread, Shared notes, the column, mail, audit
//   S-*  set_private: author only, root + replies in one UPDATE, audited, no change, hidden, Shared notes
//   E-*  edit / D-* delete: a hidden note is a missing one; a private note is never a Shared note; D7 audit
//   H-*  journalSharedNoteOf skips private notes; X-* the export resolver leaves them out; I-* install; M-* messages
//
//   php -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring server.php
//        [--app DIR]        the build under test (default: the live webroot)
//        [--control]        DIR is the build BEFORE the change: exactly CONTROL_GREEN pass
//        [--mutant NAME | --mutants]   single-point reverts: exactly the named asserts go red
// Each build runs in a CHILD process. The database is a stub: SQL is matched by shape and answered from
// the fixture below (a WHERE clause the stub does not read is checked as text where it matters).
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
$FILES = array('manage_journal.php', 'journal_export.php', 'index.php');

// --- mutants: name => [file, old, new, must-red] ------------------------------
$MUTANTS = array(
    'rule-mentions' => array('journal_export.php', "            foreach (journalMentionUids(isset(\$n['MENTIONS']) ? \$n['MENTIONS'] : '') as \$u) \$aud[\$t][\$u] = true;\n", "", null),
    'rule-writers'  => array('journal_export.php', "            if (\$by !== '') \$aud[\$t][\$by] = true;\n", "", null),
    'rule-anon'     => array('journal_export.php', "(\$me === '' || !isset(\$aud[\$t][\$me]))", "(\$me !== '' && !isset(\$aud[\$t][\$me]))", null),
    'summary'       => array('manage_journal.php', "                \$rows = array(journalNoteCounts(journalVisibleNotes(queryViaOci8(", "                \$rows = array(journalNoteCounts(pv_all(queryViaOci8(", null),
    'badge'         => array('index.php', "journalVisibleNotes(\$pnbJrnStmt->fetchAll(PDO::FETCH_ASSOC), (string)\$currentUserKey)", "\$pnbJrnStmt->fetchAll(PDO::FETCH_ASSOC)", null),
    'list'          => array('manage_journal.php', "        // Private threads (2026-11-13, privnote): their audience's only.\n        \$rows = journalVisibleNotes(\$rows, \$currentUserKey);\n", "", null),
    'rownotes'      => array('manage_journal.php', "        // Private threads (2026-11-13, privnote): their audience's only - before anything is counted.\n        \$rows = journalVisibleNotes(\$rows, \$currentUserKey);\n", "", null),
    'parked'        => array('manage_journal.php', "\$parkedNotes = journalHasPrivateColumn() ? journalParkedNotesVisible(", "\$parkedNotes = false ? journalParkedNotesVisible(", null),
    'rowone'        => array('manage_journal.php', "utf8ize(\$rows ? journalVisibleNotes(\$rows, \$currentUserKey) : array())", "utf8ize(\$rows ? \$rows : array())", null),
    'version'       => array('manage_journal.php', "    if (\$uid !== null && journalHasPrivateColumn()) {\n        \$parentSel = journalHasParentColumn() ? ', PARENT_ID' : '';\n        \$vis = ", "    if (false) {\n        \$parentSel = journalHasParentColumn() ? ', PARENT_ID' : '';\n        \$vis = ", null),
    'version-flag'  => array('manage_journal.php', "            if (journalNoteIsPrivate(\$r)) \$pv += \$id;\n", "", null),
    'attach'        => array('manage_journal.php', "            if (!\$pm || (journalNoteIsPrivate(\$pm[0]) && !journalNoteVisibleTo(\$pm[0], (int)\$report['ID'], \$currentUserKey))) {", "            if (false) {", null),
    'addhidden'     => array('manage_journal.php', "                        if (!journalVisibleNotes(\$thread, \$currentUserKey)) {", "                        if (false) {", null),
    'inherit'       => array('manage_journal.php', "                        \$thread_private = true;\n", "", null),
    'addshared'     => array('manage_journal.php', "            if (\$scope === 'row' && !empty(journalReportStateFlags(\$report)['shared'])) {\n                http_response_code(400);\n                echo json_encode(array('status' => 'error', 'message' => 'This row\\'s note is shared, so it cannot be private.'));",
                             "            if (false) {\n                http_response_code(400);\n                echo json_encode(array('status' => 'error', 'message' => 'This row\\'s note is shared, so it cannot be private.'));", null),
    'addflag'       => array('manage_journal.php', "        if (\$is_private) \$insertCols['IS_PRIVATE'] = 1;", "        if (false) \$insertCols['IS_PRIVATE'] = 1;", null),
    'mail'          => array('manage_journal.php', "                    , \$is_private                  // (privnote) the mail says who can read it", "                    , false", null),
    'auditadd'      => array('manage_journal.php', "        if (\$is_private) {\n            // A private note's audit row keeps no text", "        if (false) {\n            // A private note's audit row keeps no text", null),
    'setauthor'     => array('manage_journal.php', "strcasecmp((string)\$rootRow['CREATED_BY'], (string)\$currentUserKey) !== 0", "false", null),
    'sethidden'     => array('manage_journal.php', "        if (!\$seen) {\n", "        if (false) {\n", null),
    'setshared'     => array('manage_journal.php', "        if ((string)\$rootRow['SCOPE'] === 'row' && !empty(journalReportStateFlags(\$report)['shared'])) {", "        if (false) {", null),
    'edithidden'    => array('manage_journal.php', "        // A private note (2026-11-13, privnote): to anyone outside its thread, a missing one.\n        \$note_private = journalNoteIsPrivate(\$note);\n        if (\$note_private && !journalNoteVisibleTo(",
                             "        // A private note (2026-11-13, privnote): to anyone outside its thread, a missing one.\n        \$note_private = journalNoteIsPrivate(\$note);\n        if (false && !journalNoteVisibleTo(", null),
    'editshared'    => array('manage_journal.php', "\n               && !\$note_private;   // (privnote) a private note is never anyone's to edit", ";", null),
    'editaudit'     => array('manage_journal.php', "        if (\$note_private) {\n            // No text, no uids in a private note's audit", "        if (false) {\n            // No text, no uids in a private note's audit", null),
    'delhidden'     => array('manage_journal.php', "        // missing one.\n        \$note_private = journalNoteIsPrivate(\$note);\n        if (\$note_private && !journalNoteVisibleTo(",
                             "        // missing one.\n        \$note_private = journalNoteIsPrivate(\$note);\n        if (false && !journalNoteVisibleTo(", null),
    'delaudit'      => array('manage_journal.php', "        if (\$note_private) {\n            // Metadata only for a private note", "        if (false) {\n            // Metadata only for a private note", null),
    'sharedof'      => array('manage_journal.php', "    if (journalHasPrivateColumn()) \$parentWhere .= \" AND NVL(IS_PRIVATE, 0) = 0\";\n", "", null),
    'export-php'    => array('journal_export.php', "                    if (function_exists('journalNoteIsPrivate') && journalNoteIsPrivate(\$n)) continue;   // (privnote) never out of the page\n", "", null),
    'export-sql'    => array('journal_export.php', " . (\$privCol ? \" AND NVL(IS_PRIVATE, 0) = 0\" : '') . \"", " . \"", null),
    'install-alter' => array('manage_journal.php', "        \$runStmt('journal_private_alter', \$stmts['journal_private_alter']);\n", "", null),
    'install-early' => array('manage_journal.php', "if (\$hasPrivate && in_array('PENUMBRA_JOURNAL', \$inSchema, true)", "if (in_array('PENUMBRA_JOURNAL', \$inSchema, true)", null),
    'bulkmsg'       => array('manage_journal.php', "'That would go past this report\\'s limit of ' . JOURNAL_MAX_NOTES_PER_REPORT . ' journal notes.'", "'That would exceed this report\\'s note limit (' . JOURNAL_MAX_NOTES_PER_REPORT . '). It currently has ' . \$existing . '.'", null),
);
// The must-red sets, frozen from the first mutant run (each checked by hand against what the mutant cuts).
$MUST = json_decode(@file_get_contents(__DIR__ . '/mutants_must.json') ?: '{}', true) ?: array();
foreach ($MUTANTS as $k => $v) if (isset($MUST[$k])) $MUTANTS[$k][3] = $MUST[$k];
// The build before the change: only what it already did right passes.
$CONTROL_GREEN = json_decode(@file_get_contents(__DIR__ . '/control_green.json') ?: '[]', true) ?: array();

if ($child === null) {
    // ===== PARENT =====
    $runBuild = function ($files) use ($PHP) {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_pv_' . getmypid() . '_' . mt_rand();
        mkdir($dir);
        foreach ($files as $f => $txt) file_put_contents($dir . '/' . $f, $txt);
        $cmd = escapeshellarg($PHP) . ' -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring '
             . escapeshellarg(__FILE__) . ' --child ' . escapeshellarg($dir);
        $out = shell_exec($cmd . ' 2>&1');
        foreach (glob($dir . '/*') as $f) unlink($f);
        rmdir($dir);
        $p = strrpos((string)$out, "\n@@RESULT ");
        if ($p === false) return array(array('FATAL', false, 'child said: ' . substr((string)$out, -1500)));
        $res = json_decode(substr($out, $p + 10), true);
        $pre = trim(substr((string)$out, 0, $p));
        if ($pre !== '') $res[] = array('OUTPUT', false, 'stray output: ' . substr($pre, 0, 600));
        return $res;
    };
    $base = array();
    foreach ($FILES as $f) {
        if (!is_file($app . '/' . $f)) { fwrite(STDERR, "no $f in $app\n"); exit(2); }
        $base[$f] = file_get_contents($app . '/' . $f);
    }
    echo 'build: ' . $app . ($control ? '   (as the CONTROL: the build before the change)' : '') . "\n";
    if ($oneMutant || $allMutants) {
        $ok = 0; $bad = 0; $found = array();
        foreach (($oneMutant ? explode(',', $oneMutant) : array_keys($MUTANTS)) as $m) {
            list($mf, $old, $new, $must) = $MUTANTS[$m];
            $files = $base;
            $c = substr_count($files[$mf], $old);
            if ($c !== 1) { echo "  FAIL  mutant $m: anchor found $c times\n"; $bad++; continue; }
            $files[$mf] = str_replace($old, $new, $files[$mf]);
            $res = $runBuild($files);
            $red = array(); foreach ($res as $r) if (!$r[1]) $red[] = $r[0];
            sort($red); $found[$m] = $red;
            if ($must === null) { printf("  ????  mutant %-14s (no must set yet)   [red: %s]\n", $m, implode(' ', $red)); $bad += !$red; continue; }
            $want = $must; sort($want);
            $good = ($red === $want) && $red;
            $ok += $good; $bad += !$good;
            printf("  %s  mutant %-14s turns %s red   [red: %s]\n", $good ? 'PASS' : 'FAIL', $m, implode(' ', $must), implode(' ', $red));
            if (!$good) foreach ($res as $r) if (!$r[1]) printf("        %-20s %s\n", $r[0], substr($r[2], 0, 300));
        }
        if (getenv('PNB_PV_WRITE_MUST')) file_put_contents(getenv('PNB_PV_WRITE_MUST'), json_encode($found, JSON_PRETTY_PRINT));
        echo "SUMMARY mutants ok=$ok bad=$bad\n";
        echo ($bad === 0 && $ok > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
        exit(0);
    }
    $res = $runBuild($base);
    $p = 0; $f = 0; $passed = array(); $failed = array();
    foreach ($res as $r) {
        printf("  %s  %-20s %s\n", $r[1] ? 'PASS' : 'FAIL', $r[0], substr($r[2], 0, 400));
        if ($r[1]) { $p++; $passed[] = $r[0]; } else { $f++; $failed[] = $r[0]; }
    }
    echo "TOTAL pass=$p fail=$f   failed: " . implode(' ', $failed) . "\n";
    if ($control) {
        $want = $CONTROL_GREEN; sort($want); sort($passed);
        if (getenv('PNB_PV_WRITE_CONTROL')) file_put_contents(getenv('PNB_PV_WRITE_CONTROL'), json_encode($passed));
        echo 'CONTROL: ' . ($passed === $want ? 'as expected' : 'NOT as expected (want green only: ' . implode(' ', $want) . ')') . "\n";
        echo ($passed === $want) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    } else {
        echo ($f === 0 && $p > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
    }
    exit(0);
}

// ===== CHILD: one build =====
ini_set('display_errors', 'stderr');
ini_set('log_errors', '1');
ini_set('error_log', $child . DIRECTORY_SEPARATOR . 'php_errors.log');   // the actions' error_log lines: not stray output
class PvExit extends Exception {}
$R = array();
function A($id, $ok, $detail = '') { $GLOBALS['R'][] = array($id, (bool)$ok, (string)$detail); }
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], array(E_ERROR, E_PARSE, E_COMPILE_ERROR), true)) A('FATAL', false, $e['message'] . ' @' . $e['line']);
    echo "\n@@RESULT " . json_encode($GLOBALS['R']);
});
$mj = file_get_contents($child . '/manage_journal.php');
$ix = file_get_contents($child . '/index.php');

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
        if (is_array($t) && $t[0] === T_EXIT) { $out .= 'throw new PvExit()'; continue; }
        $out .= $s;
    }
    return $out;
}

// --- the fixture: report 100's notes ---------------------------------------------------------------------
define('PV_OPEN', "\xE2\x90\x82");
define('PV_CLOSE', "\xE2\x90\x83");
function n($id, $scope, $rk, $by, $text, $parent = null, $priv = 0, $mentions = null, $at = null, $file = null) {
    return array('ID' => (string)$id, 'REPORT_ID' => '100', 'SCOPE' => $scope, 'ROW_KEY' => $rk, 'NOTE_TEXT' => $text, 'ROW_SNAPSHOT' => null,
        'MENTIONS' => $mentions, 'RESOLVED' => '0', 'CREATED_BY' => $by, 'AUTHOR_NAME' => ucfirst($by) . ' Doe',
        'ATTACH_NAME' => $file, 'ATTACH_MIME' => $file ? 'application/pdf' : null, 'ATTACH_SIZE' => $file ? '10' : null,
        'PARENT_ID' => $parent === null ? null : (string)$parent, 'IS_PRIVATE' => (string)$priv,
        'CREATED_AT' => $at ? $at : sprintf('2026-11-%02d 09:00:00', 1 + ($id % 27)));
}
function fixture() {
    $parked = PV_OPEN . 'OLD' . PV_CLOSE . 'K9';
    return array(
        n(10, 'row', 'K1', 'ann', 'secret plan @bob', null, 1, 'bob', null, 'plan.pdf'),
        n(11, 'row', 'K1', 'bob', 'loop in @cat', 10, 1, 'cat'),
        n(12, 'row', 'K1', 'dan', 'noted', 10, 1),
        n(20, 'row', 'K1', 'eve', 'public note', null, 0),
        n(21, 'row', 'K1', 'ann', 'public reply', 20, 0),
        n(30, 'report', null, 'eve', 'a note to self', null, 1),
        n(40, 'pivot', 'PK', 'ann', 'pivot secret', null, 1),
        n(50, 'row', $parked, 'ann', 'parked secret', null, 1),
        n(51, 'row', $parked, 'bob', 'parked public', null, 0),
        n(60, 'row', 'K2', 'ann', 'mine, public', null, 0),
        n(61, 'row', 'K2', 'bob', 'a reply to it', 60, 0),
    );
}
$GLOBALS['NOTES'] = fixture();
function ids($rows) { $o = array(); foreach ((array)$rows as $r) $o[] = (int)$r['ID']; sort($o); return $o; }
function by_id($id) { foreach ($GLOBALS['NOTES'] as $r) if ((int)$r['ID'] === (int)$id) return $r; return null; }
function thread_of($root) { $o = array(); foreach ($GLOBALS['NOTES'] as $r) if ((int)$r['ID'] === (int)$root || (string)$r['PARENT_ID'] === (string)$root) $o[] = $r; return $o; }
function is_parked($r) { return is_string($r['ROW_KEY']) && strpos($r['ROW_KEY'], PV_OPEN) === 0; }
function pick($r, $cols) { $o = array(); foreach ($cols as $c) $o[$c] = array_key_exists($c, $r) ? $r[$c] : null; return $o; }

// --- stubs ----------------------------------------------------------------------------------------------
function queryViaOci8($sql, $binds = array()) {
    $GLOBALS['Q'][] = array($sql, $binds);
    $N = $GLOBALS['NOTES'];
    if (strpos($sql, 'ALL_TAB_COLUMNS') !== false) {
        if (strpos($sql, "'IS_PRIVATE'") !== false) return array(array('CNT' => $GLOBALS['PRIVCOL']));
        return array(array('CNT' => 1));
    }
    // the summary's (and the index.php badge's) per-viewer read - before the reports table, which the badge joins
    if (strpos($sql, 'UNSEEN_FLAG') !== false) {
        $o = array();
        foreach ($N as $r) { $x = pick($r, array('ID', 'PARENT_ID', 'CREATED_BY', 'MENTIONS', 'IS_PRIVATE', 'CREATED_AT')); $x['UNSEEN_FLAG'] = $r['CREATED_BY'] !== $binds[':usr'] ? '1' : '0'; $o[] = $x; }
        return $o;
    }
    if (strpos($sql, 'AS TOTAL') !== false && (strpos($sql, 'COUNT(*)') !== false || strpos($sql, 'COUNT(j.ID)') !== false)) {
        $u = 0; foreach ($N as $r) if ($r['CREATED_BY'] !== $binds[':usr']) $u++;
        return array(array('TOTAL' => count($N), 'UNSEEN' => $u, 'LATEST_AT' => '2026-11-30 09:00:00'));
    }
    if (strpos($sql, 'FROM PENUMBRA_REPORTS') !== false) return array(array('ID' => 100));
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL_TOGGLE') !== false) return array();
    // a thread: its root and replies (journalNoteVisibleTo, add, set_private)
    if (preg_match('/AND \(ID = :root( OR PARENT_ID = :root2)?\)/', $sql)) {
        $o = array(); foreach (thread_of($binds[':root']) as $r) $o[] = $r; return $o;
    }
    // notes_version, per viewer
    if (strpos($sql, 'ORA_HASH(ROW_KEY) AS KH') !== false) {
        $o = array();
        foreach ($N as $r) { if (!in_array($r['SCOPE'], array('row', 'pivot', 'chart'), true) || is_parked($r)) continue;
            $x = pick($r, array('ID', 'PARENT_ID', 'CREATED_BY', 'MENTIONS', 'IS_PRIVATE')); $x['KH'] = (string)crc32((string)$r['ROW_KEY']); $x['TL'] = (string)strlen($r['NOTE_TEXT']); $x['TH'] = (string)crc32($r['NOTE_TEXT']); $o[] = $x; }
        return $o;
    }
    if (strpos($sql, 'SUM(ORA_HASH(ROW_KEY)) AS KH') !== false) {
        $c = 0; $mx = 0; $kh = 0; $tl = 0; $th = 0;
        foreach ($N as $r) { if (!in_array($r['SCOPE'], array('row', 'pivot', 'chart'), true) || is_parked($r)) continue; $c++; $mx = max($mx, (int)$r['ID']); $kh += crc32((string)$r['ROW_KEY']); $tl += strlen($r['NOTE_TEXT']); $th += crc32($r['NOTE_TEXT']); }
        return array(array('CNT' => $c, 'MX' => $mx, 'KH' => $kh, 'TL' => $tl, 'TH' => $th));
    }
    // the parked notes, one row each (journalParkedNotesVisible)
    if (strpos($sql, 'IS_PRIVATE, ROW_KEY FROM PENUMBRA_JOURNAL') !== false) {
        $o = array(); foreach ($N as $r) if (is_parked($r)) $o[] = $r; return $o;
    }
    // row_notes_one
    if (strpos($sql, 'AND SCOPE = :sc AND ROW_KEY = :rk') !== false) {
        $o = array(); foreach ($N as $r) if ($r['SCOPE'] === $binds[':sc'] && $r['ROW_KEY'] === $binds[':rk']) $o[] = $r; return $o;
    }
    // row_notes
    if (strpos($sql, "SCOPE IN ('row', 'pivot', 'chart')") !== false && strpos($sql, 'ORDER BY CREATED_AT ASC') !== false) {
        $o = array(); foreach ($N as $r) if (in_array($r['SCOPE'], array('row', 'pivot', 'chart'), true) && !is_parked($r)) $o[] = $r; return $o;
    }
    // list (every scope)
    if (strpos($sql, 'ROW_SNAPSHOT, MENTIONS, RESOLVED') !== false) return $N;
    // one note by id: attachment, edit, delete, set_private
    if (strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ID = :nid') !== false && strpos($sql, 'ATTACH_DATA') === false) {
        $r = by_id($binds[':nid']); return $r ? array($r) : array();
    }
    // delete: a root's replies
    if (strpos($sql, 'WHERE PARENT_ID = :nid AND REPORT_ID = :rid ORDER BY ID') !== false) {
        $o = array(); foreach ($N as $r) if ((string)$r['PARENT_ID'] === (string)$binds[':nid']) $o[] = $r; return $o;
    }
    // add: the parent, its root alive, the cap, the snapshot, the thread's writers
    if (strpos($sql, 'SELECT ID, PARENT_ID, SCOPE, ROW_KEY FROM PENUMBRA_JOURNAL WHERE ID = :pid') !== false) {
        $r = by_id($binds[':pid']); return $r ? array($r) : array();
    }
    if (strpos($sql, 'SELECT 1 AS OK FROM PENUMBRA_JOURNAL WHERE ID = :rid2') !== false) return by_id($binds[':rid2']) ? array(array('OK' => 1)) : array();
    if (strpos($sql, 'SELECT COUNT(*) AS CNT FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid') !== false) return array(array('CNT' => count($N)));
    if (strpos($sql, 'SELECT COUNT(*) AS C FROM PENUMBRA_JOURNAL WHERE REPORT_ID = :rid') !== false) return array(array('C' => count($N)));
    if (strpos($sql, 'SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL') !== false) return array();
    if (strpos($sql, 'SELECT DISTINCT LOWER(CREATED_BY) AS CREATOR') !== false) {
        $o = array(); $seen = array();
        foreach (thread_of($binds[':root']) as $r) { $u = strtolower($r['CREATED_BY']); if (!isset($seen[$u])) { $seen[$u] = 1; $o[] = array('CREATOR' => $u); } }
        return $o;
    }
    // journalSharedNoteOf: a row's newest root (the stub honors the private clause: it is SQL-only there)
    if (strpos($sql, "SCOPE = 'row' AND ROW_KEY = :rk") !== false && strpos($sql, 'ORDER BY CREATED_AT DESC') !== false) {
        $o = array();
        foreach ($N as $r) {
            if ($r['SCOPE'] !== 'row' || $r['ROW_KEY'] !== $binds[':rk'] || $r['PARENT_ID'] !== null) continue;
            if (strpos($sql, 'NVL(IS_PRIVATE, 0) = 0') !== false && (string)$r['IS_PRIVATE'] === '1') continue;
            $o[] = $r;
        }
        usort($o, function ($a, $b) { return strcmp($b['CREATED_AT'], $a['CREATED_AT']) ?: ((int)$b['ID'] - (int)$a['ID']); });
        return $o;
    }
    // the export resolver's reader: every row note - the stub does NOT read the private clause (X-export-sql checks it)
    if (strpos($sql, "SCOPE = 'row' AND ROW_KEY IS NOT NULL") !== false) {
        $o = array();
        foreach ($N as $r) if ($r['SCOPE'] === 'row' && !is_parked($r)) {
            $x = pick($r, array('ID', 'ROW_KEY', 'NOTE_TEXT', 'CREATED_BY', 'AUTHOR_NAME', 'CREATED_AT'));
            if (strpos($sql, 'PARENT_ID') !== false) { $x['PARENT_ID'] = $r['PARENT_ID']; $x['ATTACH_NAME'] = $r['ATTACH_NAME']; }
            if (strpos($sql, 'IS_PRIVATE') !== false) $x['IS_PRIVATE'] = $r['IS_PRIVATE'];
            $o[] = $x;
        }
        $GLOBALS['EXPORT_SQL'][] = $sql;
        return $o;
    }
    throw new Exception('unexpected SQL: ' . substr(preg_replace('/\s+/', ' ', $sql), 0, 220));
}
$GLOBALS['OCI'] = array();
function oci_parse($c, $sql) { $k = 's' . (count($GLOBALS['OCI']) + 1); $GLOBALS['OCI'][$k] = array('sql' => $sql, 'binds' => array(), 'runs' => 0); return $k; }
function oci_bind_by_name($st, $name, &$var, $len = -1, $type = 0) { $GLOBALS['OCI'][$st]['binds'][$name] = &$var; return true; }
function oci_execute($st, $mode = 0) {
    $GLOBALS['OCI'][$st]['runs']++;
    if (strpos($GLOBALS['OCI'][$st]['sql'], 'SELECT ATTACH_DATA') !== false) return false;   // the file's bytes: "could not read" (the gate was passed)
    return true;
}
function oci_num_rows($st) { return isset($GLOBALS['NUMROWS']) ? $GLOBALS['NUMROWS'] : 1; }
function oci_commit($c) { return true; }
function oci_rollback($c) { return true; }
function oci_free_statement($st) { return true; }
function oci_error($x = null) { return array('message' => 'stub'); }
function oci_new_descriptor($c, $t = 0) { return new PvLob(); }
class PvLob { function writeTemporary($v, $t = 0) { return true; } function free() { return true; } }
function getOci8Connection() { return 'oci'; }
function pv_all($rows, $uid = null) { return $rows; }   // a mutant's stand-in for journalVisibleNotes: every note
function utf8ize($x) { return $x; }
function logPenumbraAudit($rid, $action, $before, $after, $msg) { $GLOBALS['AUDIT'][] = array('action' => $action, 'before' => $before, 'after' => $after, 'msg' => $msg); }
function journalGetReport($conn, $id) { return array('ID' => 100, 'SHORT_ID' => 'rpt', 'TITLE' => 'Report', 'OWNER_ID' => 'owner'); }
function journalCallerCanView($r, $u, $o, $a) { return true; }
function journalCallerCanReadJournal($r, $u, $a) { return true; }
function journalCallerCanEditReport($r, $u, $a) { return $u === 'edi' || $a; }
function journalEnsureFiledFor($r, $x = null) { return 'ok'; }
function journalIsMissingTableError($m) { return strpos($m, 'ORA-00942') !== false; }
function journalHasAttachColumn() { return true; }
function journalHasParentColumn() { return true; }
function journalParkedSummary($sql, $rid, $field) { $GLOBALS['PARKED_SQL'][] = $sql; return array(array('cols' => array('OLD'), $field => 99)); }
function journalRowKeyIsFiledForm($k) { return false; }
function journalValidPivotKey($k) { return true; }
function journalValidChartKey($k) { return true; }
function journalWriteKeyRefusal($r, $d) { return null; }
function journalReportStateFlags($r) { return array('on' => true, 'enc' => false, 'shared' => !empty($GLOBALS['SHARED']), 'toggles' => array(), 'labels' => array(), 'keyCols' => array('ID')); }
function journalSharedConflict($now, $msg) { $GLOBALS['CONFLICT'] = $msg; throw new PvExit(); }
function journalAuthorCapRefusal($r, $u, $a, $n) { return null; }
function journalFilingHold($r) { return null; }
function execClobInsert($conn, $table, $cols, $clob, $raw = array()) { $GLOBALS['INSERTS'][] = $cols; return 1; }
function journalInsertNoteReturningId($cols, $clob, $blob) { $GLOBALS['INSERTS'][] = $cols; return 999; }
function journalRowRefLine($scope, $t) { return ''; }
function journalRowRefText($scope, $k, $snap) { return ''; }
function journalResolveMentionAccess($c, $r, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = array('authorized' => true, 'name' => ucfirst($u) . ' Doe'); return $o; }
function journalTargetCanOpenJournal($r, $u) { return true; }
function journalSendMentionEmail() { $GLOBALS['MAILS'][] = array('mention', func_get_args()); return true; }
function journalSendReplyEmail() { $GLOBALS['MAILS'][] = array('reply', func_get_args()); return true; }
function journalAuthorName() { return 'Kim Doe'; }
function journalUpdateNoteText($id, $rid, $text, $m, $base = null, $editor = null) { $GLOBALS['UPDATES'][] = array($id, $text, $m, $base); return 1; }
function journalDeleteSharedNote($id, $rid, $base) { return 1; }
function journalSharedHasReplies($id, $rid) { return false; }
function journalLookupNames($conn, $uids) { $o = array(); foreach ($uids as $u) $o[$u] = 'Named ' . $u; return $o; }
if (!defined('JOURNAL_NOTE_MAX_CHARS')) define('JOURNAL_NOTE_MAX_CHARS', 8000);
if (!defined('JOURNAL_MAX_MENTIONS')) define('JOURNAL_MAX_MENTIONS', 20);
if (!defined('JOURNAL_MAX_NOTES_PER_REPORT')) define('JOURNAL_MAX_NOTES_PER_REPORT', 1000);
if (!defined('JOURNAL_ATTACH_MAX_BYTES')) define('JOURNAL_ATTACH_MAX_BYTES', 5242880);
if (!defined('JOURNAL_ROW_KEY_BYTES')) define('JOURNAL_ROW_KEY_BYTES', 1500);
if (!defined('OCI_NO_AUTO_COMMIT')) define('OCI_NO_AUTO_COMMIT', 0);
if (!defined('OCI_D_LOB')) define('OCI_D_LOB', 50);
if (!defined('OCI_B_CLOB')) define('OCI_B_CLOB', 112);
if (!defined('OCI_TEMP_CLOB')) define('OCI_TEMP_CLOB', 2);
if (!defined('SQLT_CHR')) define('SQLT_CHR', 1);

// The column probe, uncached (the build's caches per process; these checks switch the column on and off),
// and the key filing the export resolver runs first (its own suites test it): both before the build's
// journal_export.php, whose functions are each guarded by function_exists.
function journalHasPrivateColumn() {
    $r = queryViaOci8("SELECT COUNT(*) AS CNT FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'PENUMBRA_JOURNAL' AND COLUMN_NAME = 'IS_PRIVATE'");
    return isset($r[0]['CNT']) && (int)$r[0]['CNT'] > 0;
}
// journalEnsureFiled reads the saved state's key columns first: an encrypted state is 'ok' at once
function readClobViaOci8($t, $c, $k, $id) { return '{"encrypted":true,"payload":"x"}'; }
// the build's journal_export.php: the rule, and the export resolver
require $child . '/journal_export.php';

// the actions and the functions they call, from the build
$bodies = array();
foreach (array('summary', 'list', 'row_notes', 'notes_version', 'row_notes_one', 'add', 'attachment', 'edit', 'set_private', 'delete', 'add_notes_bulk', 'install') as $ac) {
    $bodies[$ac] = lift_tokens($mj, "if (\$action === '$ac') {", false);
}
$fns = array();
foreach (array('journalRowNotesWhere', 'journalRowNotesVersion', 'journalNoteVisibleTo', 'journalParkedNotesVisible', 'journalSharedNoteOf', 'journalInstallStatements') as $fn) {
    $fns[$fn] = lift_tokens($mj, "function $fn(", true);
}
foreach ($fns as $fn => $code) { if ($code !== '' && !function_exists($fn)) eval($code); }
$badge = lift_tokens($ix, "if (\$pnbJrnWanted && !empty(\$currentUserKey)) {", false);
$badge = str_replace("require_once __DIR__ . '/journal_export.php';", '', $badge);
A('P-lifted', $bodies['set_private'] !== '' && $bodies['add'] !== '' && $bodies['summary'] !== '' && function_exists('journalVisibleNotes')
    && function_exists('journalNoteVisibleTo') && function_exists('journalParkedNotesVisible') && $badge !== '',
    'lifted: ' . json_encode(array_map('strlen', $bodies)) . ' badge ' . strlen($badge));

// run one action as $user (its exit becomes PvExit); returns the JSON answer, the HTTP code and what it did
$run = function ($action, $user, $setup = array()) use ($bodies) {
    foreach (array('Q', 'AUDIT', 'INSERTS', 'MAILS', 'UPDATES', 'PARKED_SQL', 'EXPORT_SQL') as $g) $GLOBALS[$g] = array();
    $GLOBALS['OCI'] = array();
    $GLOBALS['CONFLICT'] = null;
    $GLOBALS['NOTES'] = isset($setup['notes']) ? $setup['notes'] : fixture();
    $GLOBALS['PRIVCOL'] = array_key_exists('privcol', $setup) ? $setup['privcol'] : 1;
    $GLOBALS['SHARED'] = !empty($setup['shared']);
    $GLOBALS['NUMROWS'] = isset($setup['numrows']) ? $setup['numrows'] : 1;
    $_GET = isset($setup['get']) ? $setup['get'] : array();
    $_POST = array(); $_FILES = array();
    $GLOBALS['currentUserKey'] = $user;   // journalRowNotesVersion reads the request's user as manage_journal.php's global
    $body = $bodies[$action];
    if ($body === '') return array('j' => array(), 'code' => 0, 'thrown' => 'not lifted', 'audit' => array(), 'inserts' => array(), 'mails' => array(), 'updates' => array(), 'oci' => array());
    $fn = eval('return function ($_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin, $action) { ' . $body . ' };');
    ob_start();
    $thrown = '';
    @http_response_code(200);
    try { $fn(isset($setup['body']) ? $setup['body'] : null, 'conn', $user, '', !empty($setup['admin']), $action); }
    catch (PvExit $e) { }
    catch (Throwable $e) { $thrown = $e->getMessage(); }
    $out = ob_get_clean();
    $j = json_decode($out, true);
    return array('j' => is_array($j) ? $j : array('raw' => substr($out, 0, 300)), 'code' => @http_response_code(), 'thrown' => $thrown,
                 'audit' => $GLOBALS['AUDIT'], 'inserts' => $GLOBALS['INSERTS'], 'mails' => $GLOBALS['MAILS'], 'updates' => $GLOBALS['UPDATES'], 'oci' => $GLOBALS['OCI']);
};
$brief = function ($r) { return json_encode(array('code' => $r['code'], 'j' => $r['j'], 'thrown' => $r['thrown'])); };
$ran = function ($r, $needle) { foreach ($r['oci'] as $s) if (strpos($s['sql'], $needle) !== false && $s['runs'] > 0) return $s; return null; };

// ===== V: the rule ==========================================================================================
$vis = function ($rows, $uid) { return function_exists('journalVisibleNotes') ? ids(journalVisibleNotes($rows, $uid)) : array(-1); };
$T = array(n(1, 'row', 'K', 'a1', 'root', null, 1, 'm1'), n(2, 'row', 'K', 'w1', 'reply', 1, 1, 'm2'), n(3, 'row', 'K', 'x9', 'public', null, 0));
A('V-author',        $vis($T, 'a1') === array(1, 2, 3), json_encode($vis($T, 'a1')));
A('V-root-mention',  $vis($T, 'm1') === array(1, 2, 3), json_encode($vis($T, 'm1')));
A('V-reply-mention', $vis($T, 'm2') === array(1, 2, 3), json_encode($vis($T, 'm2')));
A('V-writer',        $vis($T, 'w1') === array(1, 2, 3), json_encode($vis($T, 'w1')));
A('V-other',         $vis($T, 'zz') === array(3), json_encode($vis($T, 'zz')));
A('V-case',          $vis($T, 'A1') === array(1, 2, 3) && $vis($T, ' M1 ') === array(1, 2, 3), json_encode(array($vis($T, 'A1'), $vis($T, ' M1 '))));
A('V-anon',          $vis($T, '') === array(3), json_encode($vis($T, '')));
$O = array(n(5, 'row', 'K', 'a1', 'orphan reply', 99, 1), n(6, 'row', 'K', 'b1', 'public orphan', 98, 0));
A('V-orphan',        $vis($O, 'a1') === array(5, 6) && $vis($O, 'zz') === array(6), json_encode(array($vis($O, 'a1'), $vis($O, 'zz'))));
$M = array(n(7, 'row', 'K', 'a1', 'mixed root', null, 0), n(8, 'row', 'K', 'a1', 'flagged reply', 7, 1));
A('V-mixed',         $vis($M, 'zz') === array() && $vis($M, 'a1') === array(7, 8), json_encode(array($vis($M, 'zz'), $vis($M, 'a1'))));
$E = array(n(9, 'row', 'K', 'a1', 'mention gone', null, 1, 'm1'));
A('V-removed',       $vis($E, 'fay') === array(), json_encode($vis($E, 'fay')));
A('V-public-same',   function_exists('journalVisibleNotes') && journalVisibleNotes(array($T[2]), 'zz') === array($T[2]), 'a public list comes back as it was');

// ===== R: every read =========================================================================================
$SUM = array();
foreach (array('ann', 'bob', 'cat', 'dan', 'eve', 'fay') as $u) { $r = $run('summary', $u, array('get' => array('report_id' => 'rpt'))); $SUM[$u] = array($r['j']['total'] ?? null, $r['j']['unseen'] ?? null); }
// ann: 10 notes (not 30), 5 by others; bob, cat, dan: thread 10 + the 5 public; eve: her note to self + the 5 public
A('R-summary', $SUM === array('ann' => array(10, 5), 'bob' => array(8, 5), 'cat' => array(8, 8), 'dan' => array(8, 7), 'eve' => array(6, 4), 'fay' => array(5, 5)), json_encode($SUM));
$r = $run('summary', 'ann', array('get' => array('report_id' => 'rpt'), 'privcol' => 0));
A('R-summary-nocol', ($r['j']['total'] ?? null) === 11, 'a table without the flag counts as before: ' . $brief($r));

// the index.php badge (PDO)
class PvPdo { function prepare($sql) { return new PvStmt($sql); } }
class PvStmt {
    public $sql; public $b = array();
    function __construct($s) { $this->sql = $s; }
    function bindValue($k, $v, $t = 0) { $this->b[$k] = $v; return true; }
    function execute() { if (strpos($this->sql, 'IS_PRIVATE') !== false && empty($GLOBALS['PRIVCOL'])) throw new Exception('ORA-00904: "J"."IS_PRIVATE": invalid identifier'); return true; }
    function fetchAll($m = 0) { return queryViaOci8($this->sql, array(':usr' => $this->b[':usr'])); }
    function fetch($m = 0) { $rows = queryViaOci8($this->sql, array(':usr' => $this->b[':usr'])); return $rows ? $rows[0] : false; }
}
$runBadge = function ($user, $privcol = 1) use ($badge) {
    $GLOBALS['NOTES'] = fixture(); $GLOBALS['PRIVCOL'] = $privcol; $GLOBALS['Q'] = array();
    if ($badge === '') return null;
    $fn = eval('return function ($oracleConn, $currentUserKey, $report_id_lookup, $pnbJrnEnabled) { $pnb_journal = null; ' . $badge . ' return $pnb_journal; };');
    try { return $fn(new PvPdo(), $user, 'rpt', true); } catch (Throwable $e) { return array('thrown' => $e->getMessage()); }
};
$B = array(); foreach (array('ann', 'eve', 'fay') as $u) { $x = $runBadge($u); $B[$u] = array($x['total'] ?? null, $x['unseen'] ?? null); }
A('R-badge', $B === array('ann' => array(10, 5), 'eve' => array(6, 4), 'fay' => array(5, 5)), json_encode($B));
$x = $runBadge('ann', 0);
A('R-badge-nocol', ($x['total'] ?? null) === 11, 'old table: the old count ' . json_encode($x));

$L = array(); foreach (array('ann', 'bob', 'eve', 'fay') as $u) { $r = $run('list', $u, array('get' => array('report_id' => 'rpt'))); $L[$u] = ids($r['j']['data'] ?? array()); }
A('R-list', $L === array('ann' => array(10, 11, 12, 20, 21, 40, 50, 51, 60, 61), 'bob' => array(10, 11, 12, 20, 21, 51, 60, 61),
    'eve' => array(20, 21, 30, 51, 60, 61), 'fay' => array(20, 21, 51, 60, 61)), json_encode($L));
$r = $run('list', 'ann', array('get' => array('report_id' => 'rpt')));
A('R-list-ready', ($r['j']['private_ready'] ?? null) === true, 'list says private_ready: ' . json_encode($r['j']['private_ready'] ?? null));

$RN = array(); $RNraw = '';
foreach (array('ann', 'eve') as $u) {
    $r = $run('row_notes', $u, array('get' => array('report_id' => 'rpt')));
    if ($u === 'ann') $RNraw = substr($brief($r), 0, 400);
    $RN[$u] = array('K1' => $r['j']['counts']['K1'] ?? null, 'K1ids' => ids($r['j']['notes']['K1'] ?? array()), 'PK' => $r['j']['pivot_counts']['PK'] ?? 0,
                    'parked' => isset($r['j']['parked'][0]) ? $r['j']['parked'][0]['notes'] : null, 'ready' => $r['j']['private_ready'] ?? null);
}
A('R-row-notes', $RN['ann']['K1'] === 5 && $RN['ann']['K1ids'] === array(10, 11, 12, 20, 21) && $RN['ann']['PK'] === 1
    && $RN['eve']['K1'] === 2 && $RN['eve']['K1ids'] === array(20, 21) && $RN['eve']['PK'] === 0, json_encode($RN) . ' raw: ' . $RNraw);
A('R-parked', $RN['ann']['parked'] === 2 && $RN['eve']['parked'] === 1, 'parked counts per viewer: ' . json_encode(array($RN['ann']['parked'], $RN['eve']['parked'])));
A('R-row-ready', $RN['ann']['ready'] === true, 'row_notes says private_ready');

$ONE = array(); foreach (array('ann', 'eve') as $u) { $r = $run('row_notes_one', $u, array('get' => array('report_id' => 'rpt', 'kind' => 'row', 'row_key' => 'K1'))); $ONE[$u] = ids($r['j']['notes'] ?? array()); }
A('R-row-one', $ONE === array('ann' => array(10, 11, 12, 20, 21), 'eve' => array(20, 21)), json_encode($ONE));

$ver = function ($u, $notes) use ($run) { $r = $run('notes_version', $u, array('get' => array('report_id' => 'rpt'), 'notes' => $notes)); return $r['j']['ver'] ?? ('ERR ' . $r['thrown'] . json_encode($r['j'])); };
$F2 = fixture(); $F2[0]['NOTE_TEXT'] = 'secret plan, edited @bob';   // a private note changed
$F3 = fixture(); foreach ($F3 as $i => $r) if (in_array((int)$r['ID'], array(10, 11, 12), true)) $F3[$i]['IS_PRIVATE'] = '0';   // thread 10 made public
A('R-version-outsider', $ver('eve', fixture()) === $ver('eve', $F2), 'a private change is not seen in an outsider\'s version: ' . json_encode(array($ver('eve', fixture()), $ver('eve', $F2))));
A('R-version-member',   $ver('ann', fixture()) !== $ver('ann', $F2), 'a member\'s version moves with it');
A('R-version-flip',     $ver('ann', fixture()) !== $ver('ann', $F3) && $ver('eve', fixture()) !== $ver('eve', $F3), 'a flip moves both: ' . json_encode(array($ver('ann', fixture()), $ver('ann', $F3))));

$r = $run('attachment', 'eve', array('get' => array('note_id' => '10')));
A('R-attach-hidden', $r['code'] === 404 && ($r['j']['message'] ?? '') === 'Attachment not found.' && !$ran($r, 'SELECT ATTACH_DATA'), 'eve, a guessed id: ' . $brief($r));
$r = $run('attachment', 'cat', array('get' => array('note_id' => '10')));
A('R-attach-member', $r['code'] === 500 && $ran($r, 'SELECT ATTACH_DATA') !== null, 'cat (mentioned in a reply) gets past the gate: ' . $brief($r));

// ===== A: add ===============================================================================================
$addBody = function ($extra) { return array_merge(array('report_id' => 'rpt', 'scope' => 'row', 'row_key' => 'K5', 'note_text' => 'hello', 'mentions' => array()), $extra); };
$r = $run('add', 'ann', array('body' => $addBody(array('private' => 1, 'note_text' => 'for @bob only', 'mentions' => array(array('user' => 'bob', 'name' => 'Bob'))))));
$ins = $r['inserts'] ? $r['inserts'][0] : array();
A('A-add-flag', ($ins['IS_PRIVATE'] ?? null) === 1 && ($r['j']['private'] ?? null) === 1, $brief($r) . ' cols=' . json_encode(array_keys($ins)));
$m = $r['mails'] ? $r['mails'][0][1] : array();
A('A-add-mail', isset($m[8]) && $m[8] === true, 'the mention mail is told it is private: ' . json_encode($m ? array_slice($m, 7) : null));
$au = $r['audit'] ? $r['audit'][0] : array();
A('A-add-audit', ($au['action'] ?? '') === 'JOURNAL_ADD' && strpos((string)$au['after'], 'for @bob') === false && strpos((string)$au['after'], 'excerpt') === false
    && strpos((string)$au['after'], '"bob"') === false && strpos((string)$au['msg'], 'bob') === false && strpos((string)$au['after'], '"private":1') !== false, json_encode($au));
$r = $run('add', 'ann', array('body' => $addBody(array())));
$ins = $r['inserts'] ? $r['inserts'][0] : array();
A('A-add-public', !isset($ins['IS_PRIVATE']) && ($r['j']['private'] ?? null) === 0 && strpos((string)($r['audit'][0]['after'] ?? ''), '"excerpt":"hello"') !== false, $brief($r));
$r = $run('add', 'bob', array('body' => $addBody(array('parent_id' => 11, 'note_text' => 'a reply'))));
$ins = $r['inserts'] ? $r['inserts'][0] : array();
$rm = array(); foreach ($r['mails'] as $mm) if ($mm[0] === 'reply') $rm[] = $mm[1];
A('A-add-inherit', ($ins['IS_PRIVATE'] ?? null) === 1 && ($ins['PARENT_ID'] ?? null) === 10 && $rm && $rm[0][7] === true, 'a reply takes the thread\'s flag: ' . $brief($r) . ' ' . json_encode(array_keys($ins)));
$r = $run('add', 'eve', array('body' => $addBody(array('parent_id' => 10, 'note_text' => 'let me in'))));
A('A-add-hidden', $r['code'] === 404 && ($r['j']['message'] ?? '') === 'Note not found.' && !$r['inserts'], $brief($r));
$r = $run('add', 'ann', array('body' => $addBody(array('private' => 1)), 'shared' => true));
A('A-add-shared', $r['code'] === 400 && strpos(($r['j']['message'] ?? ''), 'shared') !== false && !$r['inserts'], $brief($r));
$r = $run('add', 'ann', array('body' => $addBody(array('private' => 1)), 'privcol' => 0));
A('A-add-nocol', $r['code'] === 400 && strpos(($r['j']['message'] ?? ''), 'journal table update') !== false && !$r['inserts'], $brief($r));
$r = $run('add', 'ann', array('body' => $addBody(array('private' => 1, 'scope' => 'pivot', 'row_key' => 'PK2')), 'shared' => true));
A('A-add-pivot-shared', ($r['j']['status'] ?? '') === 'success' && (($r['inserts'][0]['IS_PRIVATE'] ?? null) === 1), 'a pivot thread on a Shared-note report may be private: ' . $brief($r));

// ===== S: set_private =======================================================================================
$r = $run('set_private', 'ann', array('body' => array('note_id' => 60, 'private' => 1), 'numrows' => 2));
$up = $ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
$au = $r['audit'] ? $r['audit'][0] : array();
$aud = array(); foreach (($r['j']['audience'] ?? array()) as $a) $aud[] = $a['user'] . '=' . $a['name'];
A('S-set-make', $up !== null && $up['binds'][':p'] === 1 && $up['binds'][':root'] === 60 && strpos($up['sql'], 'OR PARENT_ID = :root2') !== false
    && ($au['action'] ?? '') === 'JOURNAL_PRIVACY' && json_decode($au['after'], true) === array('id' => 60, 'private' => 1, 'thread_notes' => 2, 'audience_size' => 2)
    && $aud === array('ann=Ann Doe', 'bob=Bob Doe') && !$r['mails'], $brief($r) . ' ' . json_encode($au));
$r = $run('set_private', 'ann', array('body' => array('note_id' => 12, 'private' => 0), 'numrows' => 3));
$up = $ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE');
A('S-set-unmake', $up !== null && $up['binds'][':p'] === 0 && $up['binds'][':root'] === 10 && (json_decode($r['audit'][0]['before'] ?? '{}', true)['private'] ?? null) === 1,
    'a reply\'s id flips its root\'s thread: ' . $brief($r));
$r = $run('set_private', 'bob', array('body' => array('note_id' => 10, 'private' => 0)));
A('S-set-notauthor', strpos(($r['j']['message'] ?? ''), 'Only the note\'s author') === 0 && !$ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE') && !$r['audit'], $brief($r));
$r = $run('set_private', 'eve', array('body' => array('note_id' => 10, 'private' => 0)));
A('S-set-hidden', $r['code'] === 404 && ($r['j']['message'] ?? '') === 'Note not found.' && !$ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE'), $brief($r));
$r = $run('set_private', 'ann', array('body' => array('note_id' => 10, 'private' => 1)));
A('S-set-same', !empty($r['j']['unchanged']) && !$ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE') && !$r['audit'], $brief($r));
$r = $run('set_private', 'ann', array('body' => array('note_id' => 60, 'private' => 1), 'shared' => true));
A('S-set-shared', strpos(($r['j']['message'] ?? ''), 'shared note a row') !== false && !$ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE'), $brief($r));
$r = $run('set_private', 'ann', array('body' => array('note_id' => 40, 'private' => 0), 'shared' => true));
A('S-set-pivot-shared', $ran($r, 'UPDATE PENUMBRA_JOURNAL SET IS_PRIVATE') !== null, 'a pivot thread flips on a Shared-note report: ' . $brief($r));
$r = $run('set_private', 'ann', array('body' => array('note_id' => 60, 'private' => 1), 'privcol' => 0));
A('S-set-nocol', $r['code'] === 400 && strpos(($r['j']['message'] ?? ''), 'journal table update') !== false, $brief($r));

// ===== E: edit, D: delete ===================================================================================
$r = $run('edit', 'eve', array('body' => array('note_id' => 10, 'note_text' => 'hijack', 'mentions' => array())));
A('E-edit-hidden', $r['code'] === 404 && ($r['j']['message'] ?? '') === 'Note not found.' && !$r['updates'], $brief($r));
$r = $run('edit', 'ann', array('body' => array('note_id' => 10, 'note_text' => 'secret plan v2 @bob @cat', 'mentions' => array(array('user' => 'bob', 'name' => 'Bob'), array('user' => 'cat', 'name' => 'Cat')))));
$au = $r['audit'] ? $r['audit'][0] : array();
$mm = $r['mails'] ? $r['mails'][0][1] : array();
A('E-edit-audit', count($r['updates']) === 1 && ($au['action'] ?? '') === 'JOURNAL_EDIT' && strpos((string)$au['before'], 'secret') === false && strpos((string)$au['after'], 'secret') === false
    && strpos((string)$au['after'], 'excerpt') === false && strpos((string)$au['msg'], 'cat') === false && strpos((string)$au['before'], '"private":1') !== false, json_encode($au));
A('E-edit-mail', isset($mm[8]) && $mm[8] === true, 'a new mention in a private note is told it is private: ' . json_encode($mm ? array_slice($mm, 7) : null));
$r = $run('edit', 'bob', array('body' => array('note_id' => 10, 'note_text' => 'bob rewrites it', 'mentions' => array()), 'shared' => true));
A('E-shared-never', strpos(($r['j']['message'] ?? ''), 'Only the note\'s author can edit it.') === 0 && !$r['updates'], 'a private note is never a Shared note anyone edits: ' . $brief($r));

$r = $run('delete', 'eve', array('body' => array('note_id' => 10)));
A('D-del-hidden', $r['code'] === 404 && ($r['j']['message'] ?? '') === 'Note not found.' && !$ran($r, 'DELETE FROM PENUMBRA_JOURNAL'), $brief($r));
$r = $run('delete', 'adm', array('body' => array('note_id' => 10), 'admin' => true));
A('D-del-admin', $r['code'] === 404 && !$ran($r, 'DELETE FROM PENUMBRA_JOURNAL'), 'an admin gets no bypass: ' . $brief($r));
$r = $run('delete', 'ann', array('body' => array('note_id' => 10)));
$au = $r['audit'] ? $r['audit'][0] : array();
$bf = json_decode((string)($au['before'] ?? ''), true);
A('D-del-audit', $ran($r, 'DELETE FROM PENUMBRA_JOURNAL') !== null && strpos((string)$au['before'], 'secret') === false && strpos((string)$au['before'], 'loop in') === false
    && ($bf['PRIVATE'] ?? null) === 1 && count($bf['REPLIES'] ?? array()) === 2 && ($bf['TEXT_LEN'] ?? null) === 16, json_encode($au));
$r = $run('delete', 'ann', array('body' => array('note_id' => 21)));
A('D-del-public-audit', strpos((string)($r['audit'][0]['before'] ?? ''), 'public reply') !== false, 'a public note keeps its copy: ' . json_encode($r['audit']));

// ===== H: Shared notes =======================================================================================
$GLOBALS['NOTES'] = array_merge(fixture(), array(n(70, 'row', 'K3', 'eve', 'shared, older', null, 0, null, '2026-11-02 09:00:00'), n(71, 'row', 'K3', 'ann', 'private, newer', null, 1, null, '2026-11-03 09:00:00')));
$GLOBALS['PRIVCOL'] = 1; $GLOBALS['Q'] = array();
$sn = function_exists('journalSharedNoteOf') ? journalSharedNoteOf(100, 'K3') : null;
A('H-shared-of', $sn !== null && (int)$sn['ID'] === 70, 'the row\'s Shared note skips a private one: ' . json_encode($sn ? $sn['ID'] : null));

// ===== X: server output ======================================================================================
function pv_vo() { return array('viewOptions' => array('journalEnabled' => true, 'journalKeyColumns' => array('KEY'), 'journalRowNotes' => true, 'journalNotesExport' => true)); }
$GLOBALS['NOTES'] = fixture(); $GLOBALS['PRIVCOL'] = 1; $GLOBALS['EXPORT_SQL'] = array();
if (isset($GLOBALS['penumbra_jt_resolver_memo'])) $GLOBALS['penumbra_jt_resolver_memo'] = array();
$rows = array(array('KEY' => 'K1', 'T' => 'a'), array('KEY' => 'K2', 'T' => 'b'));
$jt = null; $xerr = '';
try { $jt = journalExportToggleColumns('rpt', pv_vo(), $rows); } catch (Throwable $e) { $xerr = $e->getMessage(); }
$k1 = isset($rows[0]['NOTES']) ? $rows[0]['NOTES'] : '(none)';
A('X-export', strpos($k1, 'public note') !== false && strpos($k1, 'secret') === false && strpos($k1, 'loop in') === false && strpos($k1, 'noted') === false,
    'K1 NOTES: ' . json_encode($k1) . ' ' . $xerr);
A('X-export-sql', $GLOBALS['EXPORT_SQL'] && strpos($GLOBALS['EXPORT_SQL'][0], 'NVL(IS_PRIVATE, 0) = 0') !== false, 'the reader asks for no private note');
$sv = (!empty($jt['resolver']) && function_exists('journalExportNotesSearchValues')) ? journalExportNotesSearchValues($jt['resolver'], array('KEY' => 'K1')) : array();
A('X-search', ($sv[JOURNAL_NOTES_COUNT_KEY] ?? null) === '2', 'a search counts the public notes only: ' . json_encode($sv));
$GLOBALS['PRIVCOL'] = 0; $GLOBALS['EXPORT_SQL'] = array();
if (isset($GLOBALS['penumbra_jt_resolver_memo'])) $GLOBALS['penumbra_jt_resolver_memo'] = array();
$rows = array(array('KEY' => 'K1', 'T' => 'a'));
try { journalExportToggleColumns('rpt', pv_vo(), $rows); } catch (Throwable $e) { }
A('X-nocol', $GLOBALS['EXPORT_SQL'] && strpos($GLOBALS['EXPORT_SQL'][0], 'IS_PRIVATE') === false, 'a table without the flag is read as before');

// ===== I: install, M: messages ===============================================================================
$st = function_exists('journalInstallStatements') ? journalInstallStatements(true, true) : array();
A('I-create', isset($st['journal_table']) && strpos($st['journal_table'], 'IS_PRIVATE NUMBER(1) DEFAULT 0,') !== false, 'the CREATE has the flag');
A('I-alter', ($st['journal_private_alter'] ?? '') === 'ALTER TABLE NC_REPORTING.PENUMBRA_JOURNAL ADD (IS_PRIVATE NUMBER(1) DEFAULT 0)', json_encode($st['journal_private_alter'] ?? null));
A('I-run', strpos($bodies['install'], "\$runStmt('journal_private_alter', \$stmts['journal_private_alter']);") !== false, 'the install runs the ALTER');
A('I-early', strpos($bodies['install'], "if (\$hasPrivate && in_array('PENUMBRA_JOURNAL', \$inSchema, true)") !== false, 'the "already installed" answer waits for the flag');
A('M-bulk-msg', strpos($bodies['add_notes_bulk'], 'It currently has') === false && strpos($bodies['add_notes_bulk'], "limit of ' . JOURNAL_MAX_NOTES_PER_REPORT . ' journal notes.") !== false,
    'the bulk refusal states the limit, never a total');
