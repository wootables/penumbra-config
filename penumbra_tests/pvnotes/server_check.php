<?php
// pvnotes suite - server half (2026-10-06). Reads the manage_journal.php under
// test WITHOUT running it (it connects to Oracle and answers HTTP): lifts
// journalValidPivotKey() out by brace matching and runs it on good and bad
// keys, and checks the add / reply / row_notes code for the 'pivot' scope.
// Prints one JSON object: { asserts: [{id, ok, detail}] }.
//   php server_check.php <path to manage_journal.php>
$path = isset($argv[1]) ? $argv[1] : '';
$mode = isset($argv[2]) ? $argv[2] : '';   // 'r3' = round 3's checks only
$src = @file_get_contents($path);
$out = array();
function rec(&$out, $id, $ok, $detail) { $out[] = array('id' => $id, 'ok' => (bool)$ok, 'detail' => (string)$detail); }
if ($src === false || $src === '') {
    echo json_encode(array('fatal' => 'cannot read ' . $path));
    exit(1);
}

function liftFn($src, $name) {
    $a = strpos($src, 'function ' . $name . '(');
    if ($a === false) return null;
    $b = strpos($src, '{', $a); $depth = 0;
    for ($i = $b, $n = strlen($src); $i < $n; $i++) {
        if ($src[$i] === '{') $depth++;
        elseif ($src[$i] === '}') { $depth--; if ($depth === 0) return substr($src, $a, $i - $a + 1); }
    }
    return null;
}
if ($mode === 'r6') {
    // Round 6 (2026-10-07): the thread delete removes EXACTLY the notes it read (note IDs
    // are not in time order). The delete block is lifted out of the manage_journal.php
    // under test and RUN against a fake OCI layer: the SQL is recorded, the bound
    // variables are read BY REFERENCE at execute time (as OCI reads them), and the
    // JSON answer is captured.
    $ids6 = array('S-del-exact', 'S-del-order', 'S-del-reply', 'S-del-chunks', 'S-del-audit');
    $a6 = strpos($src, "    if (\$action === 'delete') {");
    $body6 = null;
    if ($a6 !== false) {
        $b6 = strpos($src, '{', $a6); $depth = 0;
        for ($i = $b6, $n = strlen($src); $i < $n; $i++) {
            if ($src[$i] === '{') $depth++;
            elseif ($src[$i] === '}') { $depth--; if ($depth === 0) { $body6 = substr($src, $b6 + 1, $i - $b6 - 1); break; } }
        }
    }
    if ($body6 === null) {
        foreach ($ids6 as $id) rec($out, $id, false, 'no delete action in ' . basename($path));
        echo json_encode(array('asserts' => $out));
        exit(0);
    }
    $GLOBALS['FK'] = array();
    function journalHasParentColumn() { return true; }
    function journalGetReport($c, $id) { return array('ID' => $id, 'SHORT_ID' => 'fixture'); }
    function journalCallerCanView() { return true; }
    function utf8ize($x) { return $x; }
    function getOci8Connection() { return 'oci'; }
    function queryViaOci8($sql, $binds) {
        if (strpos($sql, 'WHERE ID = :nid') !== false) return array($GLOBALS['FK']['note']);
        if (strpos($sql, 'WHERE PARENT_ID = :nid') !== false) { $GLOBALS['FK']['readReplies'] = true; return $GLOBALS['FK']['replies']; }
        return array();
    }
    function oci_parse($c, $sql) { $GLOBALS['FK']['sql'][] = $sql; $GLOBALS['FK']['binds'] = array(); return 'stmt'; }
    function oci_bind_by_name($st, $name, &$var) { $GLOBALS['FK']['binds'][$name] = &$var; return true; }
    function oci_execute($st) {
        $vals = array();
        foreach ($GLOBALS['FK']['binds'] as $k => $v) { $vals[$k] = $v; }   // the values NOW, at execute
        $GLOBALS['FK']['exec'][] = $vals;
        return true;
    }
    function oci_error($st) { return array('message' => 'fake'); }
    function oci_free_statement($st) { return true; }
    function logPenumbraAudit($rid, $action, $before, $after, $msg) { $GLOBALS['FK']['audit'][] = array('action' => $action, 'before' => $before, 'msg' => $msg); }
    eval('function pvRunDelete6() { global $_JSON_BODY, $conn, $currentUserKey, $user_ouc, $isAdmin; '
        . str_replace('exit;', 'return;', $body6) . ' }');
    function pvDel6($note, $replies) {
        $GLOBALS['FK'] = array('note' => $note, 'replies' => $replies, 'sql' => array(), 'exec' => array(), 'audit' => array(), 'readReplies' => false, 'binds' => array());
        $GLOBALS['_JSON_BODY'] = array('action' => 'delete', 'note_id' => (int)$note['ID']);
        $GLOBALS['conn'] = 'pdo'; $GLOBALS['currentUserKey'] = 'harness'; $GLOBALS['user_ouc'] = ''; $GLOBALS['isAdmin'] = false;
        ob_start();
        $err = null;
        try { pvRunDelete6(); } catch (Throwable $e) { $err = $e->getMessage(); }
        $resp = json_decode(ob_get_clean(), true);
        $F = $GLOBALS['FK'];
        $sql = ''; $bound = array(); $rid = null;
        foreach ($F['sql'] as $i => $q) {
            if (stripos(ltrim($q), 'DELETE') !== 0) continue;
            $sql = $q;
            foreach ((isset($F['exec'][$i]) ? $F['exec'][$i] : array()) as $k => $v) {
                if ($k === ':rid') $rid = $v; else $bound[] = (int)$v;
            }
        }
        sort($bound);
        $lists = preg_match_all('/ID IN \(([^)]*)\)/', $sql, $mm) ? array_map(function ($l) { return count(explode(',', $l)); }, $mm[1]) : array();
        return array('err' => $err, 'resp' => $resp, 'sql' => $sql, 'bound' => $bound, 'rid' => $rid, 'lists' => $lists,
                     'readReplies' => $F['readReplies'], 'audit' => $F['audit']);
    }
    function pvNote6($id, $parent, $by) { return array('ID' => (string)$id, 'REPORT_ID' => '7', 'NOTE_TEXT' => 'n' . $id, 'MENTIONS' => null, 'CREATED_BY' => $by, 'AUTHOR_NAME' => $by, 'PARENT_ID' => $parent === null ? null : (string)$parent, 'CREATED_AT' => '2026-10-07 12:00:00'); }
    function pvBroad6($r) { return strpos($r['sql'], '<=') !== false || stripos($r['sql'], 'PARENT_ID') !== false; }
    // A root (204) whose one reply got a LOWER id (183): seen live, 2026-10-07.
    $r1 = pvDel6(pvNote6(204, null, 'harness'), array(pvNote6(183, 204, 'lee')));
    rec($out, 'S-del-exact', !$r1['err'] && !pvBroad6($r1) && $r1['bound'] === array(183, 204) && (string)$r1['rid'] === '7'
        && isset($r1['resp']['deleted']) && $r1['resp']['deleted'] === 2 && $r1['resp']['replies'] === 1,
        'bound ' . json_encode($r1['bound']) . ' rid ' . json_encode($r1['rid']) . ' | ' . substr($r1['sql'], 0, 150) . ' | answer ' . json_encode($r1['resp']) . ($r1['err'] ? ' | threw ' . $r1['err'] : ''));
    // Replies in no order, ids around the root: each bound to its own slot, none twice.
    $r2 = pvDel6(pvNote6(200, null, 'harness'), array(pvNote6(205, 200, 'lee'), pvNote6(190, 200, 'pat'), pvNote6(210, 200, 'lee')));
    rec($out, 'S-del-order', !$r2['err'] && !pvBroad6($r2) && $r2['bound'] === array(190, 200, 205, 210) && $r2['resp']['replies'] === 3,
        'bound ' . json_encode($r2['bound']) . ' | ' . substr($r2['sql'], 0, 150));
    // A reply on its own: no replies read, only itself.
    $r3 = pvDel6(pvNote6(185, 184, 'harness'), array(pvNote6(999, 185, 'lee')));
    rec($out, 'S-del-reply', !$r3['err'] && !$r3['readReplies'] && !pvBroad6($r3) && $r3['bound'] === array(185) && $r3['resp']['deleted'] === 1 && $r3['resp']['replies'] === 0,
        'read replies ' . json_encode($r3['readReplies']) . ', bound ' . json_encode($r3['bound']) . ' | ' . substr($r3['sql'], 0, 120));
    // 1,500 replies: no IN list over 900 (Oracle stops at 1,000), every id bound once.
    $many = array(); for ($k = 0; $k < 1500; $k++) $many[] = pvNote6(5000 + $k, 4000, 'lee');
    $r4 = pvDel6(pvNote6(4000, null, 'harness'), $many);
    $want4 = range(4000, 4000); for ($k = 0; $k < 1500; $k++) $want4[] = 5000 + $k;
    $okLists = $r4['lists'] && max($r4['lists']) <= 900 && array_sum($r4['lists']) === 1501;
    rec($out, 'S-del-chunks', !$r4['err'] && !pvBroad6($r4) && $okLists && $r4['bound'] === $want4,
        'lists ' . json_encode($r4['lists']) . ', bound ' . count($r4['bound']) . ' (distinct ' . count(array_unique($r4['bound'])) . ')');
    // The audit row keeps the root AND every reply it removed.
    $au = isset($r1['audit'][0]) ? $r1['audit'][0] : null;
    $bf = $au ? json_decode($au['before'], true) : null;
    rec($out, 'S-del-audit', $au && $au['action'] === 'JOURNAL_DELETE' && isset($bf['REPLIES'][0]['ID']) && (string)$bf['REPLIES'][0]['ID'] === '183'
        && strpos($au['msg'], '#204') !== false && strpos($au['msg'], 'its 1 reply') !== false,
        $au ? ($au['action'] . ' | ' . $au['msg'] . ' | replies in BEFORE ' . (isset($bf['REPLIES']) ? count($bf['REPLIES']) : 0)) : 'no audit row');
    echo json_encode(array('asserts' => $out));
    exit(0);
}
if ($mode === 'r4') {
    // Round 4 (2026-10-07): deleting a thread's root deletes the thread. Needs the
    // database to RUN, so this reads the wiring; the live end-to-end run drives it.
    $need = array(
        "if (\$parentSel !== '' && (\$note['PARENT_ID'] === null || \$note['PARENT_ID'] === '')) {",
        "FROM PENUMBRA_JOURNAL WHERE PARENT_ID = :nid AND REPORT_ID = :rid ORDER BY ID",
        // (the DELETE itself: round 6 RUNS it - S-del-*, mode r6)
        "if (\$replies) \$before['REPLIES'] = \$replies;",
        "'deleted' => 1 + \$nrep, 'replies' => \$nrep",
    );
    $miss = array();
    foreach ($need as $n) { if (strpos($src, $n) === false) $miss[] = substr($n, 0, 70); }
    rec($out, 'S-del-cascade', !$miss, $miss ? 'missing: ' . implode(' | ', $miss) : 'a root deletes with exactly the replies it read; each is in the audit BEFORE; the count comes back');
    echo json_encode(array('asserts' => $out));
    exit(0);
}
if ($mode === 'r12') {
    // Round 12 (2026-10-09, the bug sweep): the key's 5th part; a chart's snapshot rebuilt from its four fields.
    $v = liftFn($src, 'journalValidChartKey');
    if ($v === null) rec($out, 'S-cw-key5', false, 'no journalValidChartKey()');
    else {
        eval($v);
        $cases = array(
            array('["DEPT","","AMOUNT","sum","1a2b3c4d"]', true),
            array('["DEPT","","AMOUNT","sum"]', true),
            array('["DEPT","","","' . str_repeat('a', 41) . '"]', true),
            array('["DEPT","","AMOUNT","sum","not hex!"]', false),
            array('["DEPT","","AMOUNT","sum",""]', false),
            array('["DEPT","","AMOUNT","sum","1a2b","x"]', false),
            array('["DEPT","","AMOUNT","' . str_repeat('a', 201) . '"]', false),
            array('["DEPT","","AMOUNT","sum",7]', false),
        );
        $wrong = array();
        foreach ($cases as $c) { $got = journalValidChartKey($c[0]); if ($got !== $c[1]) $wrong[] = substr($c[0], 0, 44) . ' -> ' . var_export($got, true); }
        rec($out, 'S-cw-key5', !$wrong, $wrong ? implode(' | ', $wrong) : 'a hex 5th part passes (and a 41-byte aggregate); a bad 5th, a 6th, a 201-byte part are refused');
    }
    $sf = liftFn($src, 'journalChartSnapshot');
    if ($sf === null) rec($out, 'S-cw-snap', false, 'no journalChartSnapshot()');
    else {
        eval($sf);
        $ell = "\xE2\x80\xA6";
        $g = array(
            journalChartSnapshot(array('Chart' => 'By dept', 'Category' => 'DEPT', 'Measure' => 'AMOUNT (sum)', 'Evil' => '<b>', 'Split' => array('x'))),
            journalChartSnapshot('{"Chart":"' . str_repeat('t', 1000) . '","Category":"DEPT"}'),
            journalChartSnapshot("{\"Chart\":\"Caf\xC3\xA9 / A\"}"),
            journalChartSnapshot('not json'),
            journalChartSnapshot(array('Chart' => '   ')),
        );
        $want1 = '{"Chart":"By dept","Category":"DEPT","Measure":"AMOUNT (sum)"}';
        $d2 = json_decode((string)$g[1], true);
        $ok = $g[0] === $want1 && is_array($d2) && mb_strlen($d2['Chart'], 'UTF-8') === 300 && mb_substr($d2['Chart'], -1, 1, 'UTF-8') === $ell
           && $g[2] === "{\"Chart\":\"Caf\xC3\xA9 / A\"}" && $g[3] === null && $g[4] === null
           && strpos($src, "\$cs = journalChartSnapshot(utf8ize(\$src['row_snapshot']));") !== false;
        rec($out, 'S-cw-snap', $ok, $ok ? 'the four scalar fields only, each capped at 300, compact JSON; nothing usable gives none; add rebuilds a chart\'s' : json_encode($g));
    }
    echo json_encode(array('asserts' => $out));
    exit(0);
}
if ($mode === 'r11') {
    // Round 11 (2026-10-09): a whole chart's notes, SCOPE='chart', keyed by what the chart shows.
    $v = liftFn($src, 'journalValidChartKey');
    if ($v === null) {
        rec($out, 'S-cw-key', false, 'no journalValidChartKey() in ' . basename($path));
    } else {
        eval($v);
        $cases = array(
            array('["DEPT","FY","AMOUNT","sum"]', true),
            array('["DEPT","","","count"]', true),
            array('["AWARD_DATE:fy","DEPT","AMOUNT","avg"]', true),
            array('[]', false),
            array('["DEPT","FY","AMOUNT"]', false),
            array('["DEPT","FY","AMOUNT","sum","x"]', false),
            array('["","FY","AMOUNT","sum"]', false),
            array('["DEPT","FY","AMOUNT",""]', false),
            array('["DEPT",1,"AMOUNT","sum"]', false),
            array('[["DEPT","Engineering"]]', false),
            array('{"0":"DEPT","1":"","2":"","3":"sum"}', false),
            array('"DEPT"', false),
            array('not json', false),
            array('["' . str_repeat('F', 201) . '","","","sum"]', false),
        );
        $wrong = array();
        foreach ($cases as $c) { $got = journalValidChartKey($c[0]); if ($got !== $c[1]) $wrong[] = substr($c[0], 0, 40) . ' -> ' . var_export($got, true); }
        rec($out, 'S-cw-key', !$wrong, $wrong ? implode(' | ', $wrong) : 'the 3 well-formed chart keys pass, the 11 malformed ones are refused');
    }
    $addOk = strpos($src, "\$scope = (\$scopeIn === 'row' || \$scopeIn === 'pivot' || \$scopeIn === 'chart') ? \$scopeIn : 'report';") !== false
          && strpos($src, "if (\$scope === 'chart' && !journalValidChartKey(\$row_key)) {") !== false;
    rec($out, 'S-cw-add', $addOk, $addOk ? 'add takes scope chart and validates its key' : 'add does not take a chart scope');
    $repOk = strpos($src, "(\$prow['SCOPE'] === 'row' || \$prow['SCOPE'] === 'pivot' || \$prow['SCOPE'] === 'chart') ? \$prow['SCOPE'] : 'report';") !== false;
    rec($out, 'S-cw-reply', $repOk, $repOk ? 'a reply inherits a chart scope' : 'a reply to a chart note would land as a report note');
    $rnOk = strpos($src, "SCOPE IN ('row', 'pivot', 'chart') AND ROW_KEY IS NOT NULL") !== false
         && strpos($src, "if (\$r['SCOPE'] === 'chart') {") !== false
         && strpos($src, "'chart_counts' => utf8ize(\$ccounts), 'chart_notes' => utf8ize(\$cnotes)") !== false
         && strpos($src, "'chart_counts' => array(), 'chart_notes' => array()") !== false;
    rec($out, 'S-cw-rownotes', $rnOk, $rnOk ? 'row_notes answers chart notes apart (chart_counts / chart_notes), the missing-table answer too' : 'row_notes has no chart_counts / chart_notes');
    // the e-mails' line: the chart's title, else what its key shows
    $t = liftFn($src, 'journalRowRefText'); $c = liftFn($src, 'journalChartRefText'); $l = liftFn($src, 'journalRowRefLine');
    if ($t === null || $c === null || $l === null) {
        rec($out, 'S-cw-ref', false, 'no journalChartRefText() / journalRowRefText() / journalRowRefLine()');
    } else {
        eval($t); eval($c); eval($l);
        $kw = '["DEPT","FY","AMOUNT","sum"]';
        $got = array(
            journalRowRefText('chart', $kw, '{"Chart":"By department and year","Category":"DEPT"}'),
            journalRowRefText('chart', $kw, null),
            journalRowRefText('chart', '["DEPT","","","count"]', '{"Chart":""}'),
            journalRowRefText('chart', 'not a key', null),
            journalRowRefLine('chart', 'A <b>'),
        );
        $ok = $got[0] === 'By department and year' && $got[1] === 'AMOUNT (sum) by DEPT, split by FY' && $got[2] === 'Rows (count) by DEPT' && $got[3] === ''
           && strpos($got[4], '>On the chart <strong>A &lt;b&gt;</strong>') !== false;
        rec($out, 'S-cw-ref', $ok, $ok ? 'the title, else what the key shows; none for garbage; "On the chart", escaped' : json_encode($got));
    }
    echo json_encode(array('asserts' => $out));
    exit(0);
}
if ($mode === 'r3') {
    // Round 3 (2026-10-07): the mention / reply e-mails name the row.
    $sep = "\xE2\x90\x9F"; $dot = " \xC2\xB7 "; $ell = "\xE2\x80\xA6";
    $t = liftFn($src, 'journalRowRefText'); $l = liftFn($src, 'journalRowRefLine');
    if ($t === null || $l === null) {
        rec($out, 'S-row-ref', false, 'no journalRowRefText() in ' . basename($path));
        rec($out, 'S-row-line', false, 'no journalRowRefLine()');
    } else {
        eval($t); eval($l);
        $long = str_repeat('x', 100);
        $cases = array(
            array('row', '060101-Ofc' . $sep . '09-FEB-26', '{"DEPARTMENT":"060101-Ofc","LOG_DATE":"09-FEB-26","ABSTRACT":"A long abstract"}', 'DEPARTMENT: 060101-Ofc' . $dot . 'LOG_DATE: 09-FEB-26'),
            array('row', '060101-Ofc' . $sep . '09-FEB-26', null, '060101-Ofc' . $dot . '09-FEB-26'),
            array('pivot', '[["DEPT","X"],["FY","2026"]]', '{"Department":"X","Fiscal Year":"2026"}', 'Department: X' . $dot . 'Fiscal Year: 2026'),
            array('pivot', '[["DEPT","X"],["FY",""]]', null, 'DEPT: X' . $dot . 'FY: [Blank]'),
            array('report', '', null, ''),
            array('row', $long, null, str_repeat('x', 79) . $ell),
            array('row', 'K1' . $sep . 'K2', 'not json', 'K1' . $dot . 'K2'),
            array('row', 'K1', '{"A":{"x":1},"B":"y"}', 'B: y'),
            array('pivot', 'not a key', null, ''),
        );
        $bad = array();
        foreach ($cases as $i => $c) {
            $got = journalRowRefText($c[0], $c[1], $c[2]);
            if ($got !== $c[3]) $bad[] = 'case ' . ($i + 1) . ': ' . json_encode($got) . ' want ' . json_encode($c[3]);
        }
        rec($out, 'S-row-ref', !$bad, $bad ? implode(' | ', $bad) : 'the 9 cases (snapshot / key, table / pivot, caps, garbage) read right');
        $lp = journalRowRefLine('pivot', 'A <b>'); $lr = journalRowRefLine('row', 'x');
        // A 'pivot' line just names the fields ("On <fields>", round 5: a band shares the thread).
        $ok = strpos($lp, '>On <strong>') !== false && strpos($lp, 'A &lt;b&gt;') !== false && strpos($lp, '<b>') === false
           && strpos($lr, 'On the row') !== false && journalRowRefLine('report', 'x') === '' && journalRowRefLine('pivot', '') === '';
        rec($out, 'S-row-line', $ok, $ok ? 'pivot / row wording, escaped, empty for a report note or no text' : 'pivot: ' . $lp . ' | row: ' . $lr);
    }
    $need = array(
        "function journalSendMentionEmail(\$toUid, \$toName, \$authorUid, \$authorName, \$report, \$noteText, \$isAuthorized, \$rowLine = '') {",
        "mentioned you in a journal note on the report <strong>' . \$safeTitle . '</strong>:</p>'\n          . \$rowLine",
        "function journalSendReplyEmail(\$toUid, \$toName, \$authorUid, \$authorName, \$report, \$noteText, \$rowLine = '') {",
        "replied in a journal thread you are part of on the report <strong>' . \$safeTitle . '</strong>:</p>'\n          . \$rowLine",
        "            if (\$ref_snap === null && \$reply_root !== null) {",
        "SELECT ROW_SNAPSHOT FROM PENUMBRA_JOURNAL WHERE ID = :root AND REPORT_ID = :rid",
        // (Round P, 2026-10-09: a filed thread's row named by its key's value; the line only to a mention who may view)
        "\$row_line = journalRowRefLine(\$scope, journalRowRefText(\$scope, \$refKey[0], \$ref_snap));",
        "                    \$authorized,\n                    \$authorized ? \$row_line : ''",
        "journalSendReplyEmail(\$u, \$pName, \$currentUserKey, \$author_name, \$report, \$note_text, \$row_line);",
    );
    $miss = array();
    foreach ($need as $n) { if (strpos($src, $n) === false) $miss[] = substr(str_replace("\n", ' ', $n), 0, 60); }
    rec($out, 'S-mail-wiring', !$miss, $miss ? 'missing: ' . implode(' | ', $miss) : 'both e-mails take the line; add builds it (a reply reads its root\'s snapshot) and passes it');
    echo json_encode(array('asserts' => $out));
    exit(0);
}

// --- journalValidPivotKey(): lifted and run ------------------------------
$fn = null;
$a = strpos($src, 'function journalValidPivotKey(');
if ($a !== false) {
    $b = strpos($src, '{', $a);
    $depth = 0;
    for ($i = $b, $n = strlen($src); $i < $n; $i++) {
        if ($src[$i] === '{') $depth++;
        elseif ($src[$i] === '}') { $depth--; if ($depth === 0) { $fn = substr($src, $a, $i - $a + 1); break; } }
    }
}
$cases = array(
    array('[["DEPT","Engineering"]]', true),
    array('[["DEPT","Engineering"],["FY","FY2026"]]', true),
    array('[["AWARD_DATE:fy","2026"],["DEPT",""]]', true),
    array('[]', false),
    array('{"0":["DEPT","x"]}', false),
    array('[["DEPT"]]', false),
    array('[["DEPT","x","y"]]', false),
    array('[["","x"]]', false),
    array('[[1,"x"]]', false),
    array('[["DEPT",2026]]', false),
    array('"DEPT"', false),
    array('not json', false),
    array('[' . implode(',', array_fill(0, 9, '["F","v"]')) . ']', false),
    array('[["' . str_repeat('F', 201) . '","v"]]', false),
);
if ($fn === null) {
    rec($out, 'S-key-valid', false, 'no journalValidPivotKey() in ' . basename($path));
    rec($out, 'S-key-shape', false, 'no journalValidPivotKey()');
} else {
    eval($fn);
    $goodOk = true; $badOk = true; $wrong = array();
    foreach ($cases as $c) {
        $got = journalValidPivotKey($c[0]);
        if ($got !== $c[1]) { $wrong[] = substr($c[0], 0, 40) . ' -> ' . var_export($got, true); if ($c[1]) $goodOk = false; else $badOk = false; }
    }
    rec($out, 'S-key-valid', $goodOk, $goodOk ? 'the 3 well-formed keys pass' : implode(' | ', $wrong));
    rec($out, 'S-key-shape', $badOk, $badOk ? 'the 11 malformed keys are refused' : implode(' | ', $wrong));
}

// --- the add / reply / row_notes code paths -------------------------------
// (round 11 adds 'chart' to the scope lines: either form reads as taking a pivot scope)
$addOk = (strpos($src, "\$scope = (\$scopeIn === 'row' || \$scopeIn === 'pivot') ? \$scopeIn : 'report';") !== false
          || strpos($src, "\$scope = (\$scopeIn === 'row' || \$scopeIn === 'pivot' || \$scopeIn === 'chart') ? \$scopeIn : 'report';") !== false)
      && strpos($src, "if (\$scope === 'pivot' && !journalValidPivotKey(\$row_key)) {") !== false
      && strpos($src, "'ROW_KEY'     => (\$scope !== 'report' ? \$row_key : null),") !== false;
rec($out, 'S-add-scope', $addOk, $addOk ? 'add takes scope pivot, validates its key, stores ROW_KEY' : 'add does not take a pivot scope');
$replyOk = strpos($src, "\$scope        = (\$prow['SCOPE'] === 'row' || \$prow['SCOPE'] === 'pivot') ? \$prow['SCOPE'] : 'report';") !== false
        || strpos($src, "\$scope        = (\$prow['SCOPE'] === 'row' || \$prow['SCOPE'] === 'pivot' || \$prow['SCOPE'] === 'chart') ? \$prow['SCOPE'] : 'report';") !== false;
rec($out, 'S-reply-scope', $replyOk, $replyOk ? 'a reply inherits a pivot scope' : 'a reply to a pivot note would land as a report note');
$rnOk = (strpos($src, "SCOPE IN ('row', 'pivot') AND ROW_KEY IS NOT NULL") !== false || strpos($src, "SCOPE IN ('row', 'pivot', 'chart') AND ROW_KEY IS NOT NULL") !== false)
     && strpos($src, "'pivot_counts' => utf8ize(\$pcounts), 'pivot_notes' => utf8ize(\$pnotes)") !== false
     && strpos($src, "if (\$r['SCOPE'] === 'pivot') {") !== false
     && strpos($src, "\$pnotes[\$rk][] = \$r;\n                continue;") !== false;
rec($out, 'S-rownotes-pivot', $rnOk, $rnOk ? 'row_notes answers pivot notes apart from table-row notes' : 'row_notes has no pivot_counts / pivot_notes');
echo json_encode(array('asserts' => $out));
