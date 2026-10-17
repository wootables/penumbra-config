<?php
// notesfresh suite - SERVER HALF (2026-10-16).
//   php -n server_check.php <path to manage_journal.php>
// Prints one JSON line per check: {"id","ok","detail"}. Reads the file as text: the helpers are
// lifted by tokens and eval'd against a fake queryViaOci8; the action blocks are cut out by
// brace matching and checked for what they call, in what order. Never includes the file.
$file = isset($argv[1]) ? $argv[1] : '';
$src = @file_get_contents($file);
function rec($id, $ok, $detail) { echo json_encode(array('id' => $id, 'ok' => (bool)$ok, 'detail' => (string)$detail)), "\n"; }
if ($src === false || $src === '') { rec('S-where-one', false, 'cannot read ' . $file); exit; }

// A named function's source, by tokens (strings and comments cannot fool the brace count).
function lift_fn($src, $name) {
    $t = token_get_all($src); $n = count($t);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) $j++;
        if (!is_array($t[$j]) || $t[$j][0] !== T_STRING || $t[$j][1] !== $name) continue;
        $out = ''; $depth = 0; $open = false;
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k]; $txt = is_array($tok) ? $tok[1] : $tok;
            $out .= $txt;
            if ($txt === '{' || (is_array($tok) && ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $open = true; }
            elseif ($txt === '}') { $depth--; if ($open && $depth === 0) return $out; }
        }
    }
    return null;
}
// An action's block: from its `if ($action === '...') {` to the matching brace.
function lift_action($src, $action) {
    $head = "if (\$action === '" . $action . "') {";
    $a = strpos($src, $head);
    if ($a === false) return null;
    $t = token_get_all('<?php ' . substr($src, $a));
    $out = ''; $depth = 0; $open = false;
    foreach ($t as $idx => $tok) {
        if ($idx === 0) continue;
        $txt = is_array($tok) ? $tok[1] : $tok;
        $out .= $txt;
        if ($txt === '{' || (is_array($tok) && ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $open = true; }
        elseif ($txt === '}') { $depth--; if ($open && $depth === 0) return $out; }
    }
    return null;
}
function in_order($hay, $needles) {
    $p = -1;
    foreach ($needles as $nd) { $q = strpos($hay, $nd, $p + 1); if ($q === false || $q <= $p) return $nd; $p = $q; }
    return true;
}

define('JOURNAL_PARK_OPEN_SQL', "UNISTR('\\2402')");
$GLOBALS['__q'] = array(); $GLOBALS['__ret'] = array();
function queryViaOci8($sql, $binds) { $GLOBALS['__q'][] = array($sql, $binds); return $GLOBALS['__ret']; }

$where = lift_fn($src, 'journalRowNotesWhere');
$ver = lift_fn($src, 'journalRowNotesVersion');
if ($where) eval($where);
if ($ver) eval($ver);
$rn = lift_action($src, 'row_notes');
$nv = lift_action($src, 'notes_version');
$one = lift_action($src, 'row_notes_one');

// ---- one WHERE --------------------------------------------------------------------------
$w = function_exists('journalRowNotesWhere') ? journalRowNotesWhere() : '';
rec('S-where-one', $w === "REPORT_ID = :rid AND SCOPE IN ('row', 'pivot', 'chart') AND ROW_KEY IS NOT NULL AND (SCOPE = 'pivot' OR SUBSTR(ROW_KEY, 1, 1) <> UNISTR('\\2402'))",
    $w === '' ? 'journalRowNotesWhere missing' : $w);
rec('S-where-uses', $rn && $one && $ver && strpos($rn, '" . journalRowNotesWhere() . "') !== false && strpos($one, '" . journalRowNotesWhere() . "') !== false
    && strpos($ver, 'journalRowNotesWhere()') !== false,
    'row_notes ' . ($rn ? (int)(strpos($rn, 'journalRowNotesWhere()') !== false) : 'missing') . ', row_notes_one ' . ($one ? (int)(strpos($one, 'journalRowNotesWhere()') !== false) : 'missing')
    . ', version ' . ($ver ? (int)(strpos($ver, 'journalRowNotesWhere()') !== false) : 'missing'));
rec('S-where-old-gone', $rn && strpos($rn, "SCOPE IN ('row', 'pivot', 'chart')") === false && strpos($rn, 'JOURNAL_PARK_OPEN_SQL . ")') === false,
    'row_notes keeps no WHERE of its own');

// ---- the version ------------------------------------------------------------------------
$GLOBALS['__q'] = array(); $GLOBALS['__ret'] = array(array('CNT' => '3', 'MX' => '904', 'KH' => '1234', 'TL' => '40', 'TH' => '99'));
$v1 = function_exists('journalRowNotesVersion') ? journalRowNotesVersion('7') : null;
$q = $GLOBALS['__q'] ? $GLOBALS['__q'][0] : array('', array());
$sql = preg_replace('/\s+/', ' ', $q[0]);
rec('S-ver-sql', count($GLOBALS['__q']) === 1 && strpos($sql, 'COUNT(*) AS CNT') !== false && strpos($sql, 'MAX(ID) AS MX') !== false
    && strpos($sql, 'SUM(ORA_HASH(ROW_KEY)) AS KH') !== false && strpos($sql, 'DBMS_LOB.GETLENGTH(NOTE_TEXT)') !== false
    && strpos($sql, 'ORA_HASH(DBMS_LOB.SUBSTR(NOTE_TEXT, 1000, 1))') !== false && strpos($sql, 'FROM PENUMBRA_JOURNAL WHERE ' . $w) !== false
    && $q[1] === array(':rid' => 7) && !preg_match('/(SELECT|,)\s*NOTE_TEXT\s*(,|FROM)/', $sql),
    count($GLOBALS['__q']) . ' queries: ' . $sql . ' binds ' . json_encode($q[1]));
$GLOBALS['__ret'] = array();
$v0 = function_exists('journalRowNotesVersion') ? journalRowNotesVersion(7) : null;
rec('S-ver-format', $v1 === '3.904.1234.40.99' && $v0 === '....', 'with notes ' . var_export($v1, true) . ', none ' . var_export($v0, true));
$pv = $rn ? strpos($rn, 'journalRowNotesVersion(') : false; $ps = $rn ? strpos($rn, 'SELECT ID, SCOPE, ROW_KEY') : false;
rec('S-ver-before', $pv !== false && $ps !== false && $pv < $ps, 'version at ' . var_export($pv, true) . ', the notes SELECT at ' . var_export($ps, true));
rec('S-ver-safe', $rn && strpos($rn, '$ver = null;') !== false && strpos($rn, 'try { $ver = journalRowNotesVersion($report[\'ID\']); }') !== false
    && in_order($rn, array('$ver = null;', 'try { $ver = journalRowNotesVersion', 'catch (Throwable $e)', 'SELECT ID, SCOPE')) === true,
    'a failed version read leaves the notes alone');
rec('S-ver-sent', $rn && preg_match("/'parked' => utf8ize\(\\\$parkedNotes\),\s*'ver' => \\\$ver\)\);/", $rn), "row_notes answers with 'ver'");

// ---- notes_version ----------------------------------------------------------------------
$gates = array('journalGetReport($conn, $report_identifier)', 'journalCallerCanView($report, $currentUserKey, $user_ouc, $isAdmin)',
               'journalCallerCanReadJournal($report, $currentUserKey, $isAdmin)', 'journalEnsureFiledFor($report)');
$r = $nv ? in_order($nv, array_merge(array("\$_GET['report_id']"), $gates, array('journalRowNotesVersion($report[\'ID\'])', "'ver' => \$ver"))) : 'block missing';
rec('S-nv-gates', $r === true, $r === true ? 'GET report_id, the four gates, then the version' : 'out of order / missing: ' . $r);
rec('S-nv-missing', $nv && strpos($nv, 'journalIsMissingTableError') !== false && strpos($nv, "'installed' => false, 'ver' => ''") !== false
    && strpos($nv, 'NOTE_TEXT') === false, 'a missing table answers installed:false; no note text read');

// ---- row_notes_one ----------------------------------------------------------------------
$r = $one ? in_order($one, array_merge(array("\$_GET['row_key']", "in_array(\$kind, array('row', 'pivot', 'chart'), true)"), $gates, array('queryViaOci8('))) : 'block missing';
rec('S-one-gates', $r === true && strpos($one, '$_JSON_BODY') === false, $r === true ? 'GET, kind check, the four gates, then the read' : 'out of order / missing: ' . $r);
rec('S-one-kind', $one && strpos($one, "\$row_key === '' || !in_array(\$kind, array('row', 'pivot', 'chart'), true)") !== false && strpos($one, 'http_response_code(400)') !== false,
    'an unknown kind or an empty key is a 400');
rec('S-one-binds', $one && strpos($one, '" . journalRowNotesWhere() . " AND SCOPE = :sc AND ROW_KEY = :rk') !== false
    && strpos($one, "array(':rid' => (int)\$report['ID'], ':sc' => \$kind, ':rk' => \$row_key)") !== false,
    'the key and the scope are bound, never spliced');
$sel = 'SELECT ID, SCOPE, ROW_KEY, NOTE_TEXT, MENTIONS, CREATED_BY, AUTHOR_NAME" . $attachSel . $parentSel . "';
rec('S-one-order', $one && $rn && substr_count($one, 'ORDER BY CREATED_AT ASC, ID ASC') === 1 && substr_count($rn, 'ORDER BY CREATED_AT ASC, ID ASC') === 1
    && strpos($one, $sel) !== false && strpos($rn, $sel) !== false,
    'row_notes_one reads row_notes\' columns in row_notes\' order');
