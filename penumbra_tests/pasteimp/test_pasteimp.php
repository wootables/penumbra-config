<?php
// pasteimp suite - PHP half (2026-10-09). manage_imports.php's append / append_undo.
//   php -n test_pasteimp.php <manage_imports.php>
// The pure helpers (pnbImportColumns, pnbImportAppendRows, pnbImportUndoRows) are
// LIFTED from the file under test and run; the actions are checked by source
// (order: behind the admin gate; refusals before the write; the write in place).
$f = isset($argv[1]) ? $argv[1] : '';
$pass = 0; $fail = 0;
function ok($c, $name) { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name\n"; } }
$s = is_file($f) ? file_get_contents($f) : '';
ok($s !== '', 'S0 file read');

$lifted = 0;
foreach (array('pnbImportColumns', 'pnbImportAppendRows', 'pnbImportUndoRows') as $fn) {
    if (preg_match('/function ' . $fn . '\(.*?\n\}/s', $s, $m)) { eval($m[0]); $lifted++; }
}
ok($lifted === 3, 'S1 the three helpers found and lifted');
if ($lifted === 3) {
    $ex = array(array('ID' => '1', 'NAME' => 'Ada', 'X' => 'a'), array('ID' => '2', 'NAME' => 'Bob', 'X' => 'b'));
    // same columns, other case and order
    $r = pnbImportAppendRows($ex, array(array('name' => 'Cy', 'id' => '3', 'x' => 'c')), false);
    ok($r['ok'] && count($r['rows']) === 3 && $r['rows'][2] === array('ID' => '3', 'NAME' => 'Cy', 'X' => 'c') && $r['added'] === 1 && $r['missing'] === array(),
       'A1 matched by name, ignoring case and order; stored under the import\'s own keys, in its order');
    // a column the paste lacks
    $r = pnbImportAppendRows($ex, array(array('ID' => '3', 'NAME' => 'Cy')), false);
    ok($r['ok'] && $r['rows'][2]['X'] === '' && $r['missing'] === array('X'), 'A2 a column the paste lacks is blank on the new rows, and named');
    // a column only the paste has
    $r = pnbImportAppendRows($ex, array(array('ID' => '3', 'NAME' => 'Cy', 'X' => 'c', 'NEW' => 'n')), false);
    ok(!$r['ok'] && $r['error'] === 'new_columns' && $r['new_columns'] === array('NEW'), 'A3 a new column is refused without add_columns, and named');
    $r = pnbImportAppendRows($ex, array(array('ID' => '3', 'NAME' => 'Cy', 'X' => 'c', 'new' => 'n')), true);
    ok($r['ok'] && $r['rows'][0]['NEW'] === '' && $r['rows'][1]['NEW'] === '' && $r['rows'][2]['NEW'] === 'n' && $r['new_columns'] === array('NEW'),
       'A4 with add_columns every existing row gets it blank (upper-cased name)');
    $r = pnbImportAppendRows($ex, array(array('#' => '9', '' => 'z', 'ID' => '3', 'NAME' => 'Cy', 'X' => 4)), false);
    ok($r['ok'] && !array_key_exists('#', $r['rows'][2]) && $r['rows'][2]['X'] === '4', 'A5 the "#" and a blank heading never import; values are stored as text');
    ok(pnbImportAppendRows($ex, array('not a row'), false)['error'] === 'not_rows' && pnbImportAppendRows($ex, array(), false)['error'] === 'no_rows', 'A6 junk and an empty paste are refused');
    $r = pnbImportAppendRows(array(), array(array('A' => '1')), false);
    ok(!$r['ok'] && $r['error'] === 'new_columns', 'A7 an empty import has no columns: everything is new (asks first)');
    // the round trip: undo puts the import back exactly
    $r = pnbImportAppendRows($ex, array(array('ID' => '3', 'NAME' => 'Cy', 'X' => 'c', 'NEW' => 'n'), array('ID' => '4')), true);
    $back = pnbImportUndoRows($r['rows'], count($ex), $r['new_columns']);
    ok($back === $ex, 'U1 undo after an append (new columns too) returns the import exactly as it was');
    $r = pnbImportAppendRows($ex, array(array('ID' => '3', 'NAME' => 'Cy', 'X' => 'c')), false);
    ok(pnbImportUndoRows($r['rows'], count($ex), array()) === $ex, 'U2 ... and without new columns');
    ok(pnbImportColumns(array(array('A' => 1, 'B' => 2), array('B' => 3, 'C' => 4))) === array('A', 'B', 'C'), 'C1 an import\'s columns: every key, first appearance first');
}

// --- the actions (source) -----------------------------------------------------
$pGate = strpos($s, "if (!\$isAdmin && \$impScope === null) {");   // (impgrant: admin OR an imports grant)
$pApp  = strpos($s, "if (\$action === 'append') {");
$pUndo = strpos($s, "if (\$action === 'append_undo') {");
ok($pGate !== false && $pApp !== false && $pUndo !== false && $pGate < $pApp && $pGate < $pUndo, 'G1 append and append_undo sit behind the gate (admin or an imports grant)');
$app = $pApp !== false ? substr($s, $pApp, $pUndo - $pApp) : '';
$und = $pUndo !== false ? substr($s, $pUndo, 4500) : '';   // (impgrant grew the action: by ID too)
$w = strpos($app, 'execClobUpdate(');
ok(strpos($app, 'WHERE USER_ID = :p_userid AND IMPORT_NAME = :iname') !== false, 'P1 only YOUR import (USER_ID + name)');
ok(($f1 = strpos($app, 'pnbImportFolderBacked(')) !== false && $w !== false && $f1 < $w && strpos($app, "'folder' => true") !== false, 'P2 an import the imports/ folder refreshes is refused, before the write');
ok(($c1 = strpos($app, '$after > $MAX_ROWS_PER_IMPORT')) !== false && $c1 < $w, 'P3 the row cap is checked after the merge, before the write');
ok(strpos($app, "'ID = :w_id'") !== false && strpos($app, 'DELETE FROM PENUMBRA_IMPORTS') === false, 'P4 written IN PLACE (the import keeps its ID, so linked reports keep it)');
ok(strpos($app, "'IMPORT_APPEND'") !== false && strpos($und, "'IMPORT_APPEND_UNDO'") !== false, 'P5 both audited');
ok(strpos($app, "'token' =>") !== false && strpos($app, "TO_CHAR(LAST_USED, 'YYYY-MM-DD HH24:MI:SS.FF6')") !== false, 'P6 the append answers an undo token (LAST_USED to the microsecond)');
$w2 = strpos($und, 'execClobUpdate(');
ok(($t1 = strpos($und, "(string)\$meta[0]['TOK'] !== \$token")) !== false && strpos($und, "(int)\$meta[0]['ROW_COUNT'] !== \$afterCount") !== false && $w2 !== false && $t1 < $w2,
   'P7 undo only while the import is exactly as the append left it (row count + token), checked before the write');
ok(strpos($und, "TO_CHAR(LAST_USED, 'YYYY-MM-DD HH24:MI:SS.FF6') AS TOK") !== false, 'P8 the same token format on both sides');
ok(strpos($s, ':uid') === false, 'P9 no :uid bind (ORA-01745)');

echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
