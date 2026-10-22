<?php
// bulkset suite - PHP half (2026-10-13).
//   php -n test_bulkset.php <bulk_settings_read.php> <save_server_state.php> <js/penumbra_repository.js> <index.php>
// Neither endpoint can be required (they read the request and open Oracle): their
// pure helpers are LIFTED and run, the rest are source pins on order and shape.
$rd = isset($argv[1]) ? $argv[1] : '';
$ss = isset($argv[2]) ? $argv[2] : '';
$rp = isset($argv[3]) ? $argv[3] : '';
$ix = isset($argv[4]) ? $argv[4] : '';
$pass = 0; $fail = 0;
function ok($c, $name) { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name\n"; } }
function lift($src, $fn) {
    if (!preg_match('/function ' . preg_quote($fn, '/') . '\(.*?\n\}/s', $src, $m)) return false;
    if (!function_exists($fn)) eval($m[0]);
    return true;
}

$r = is_file($rd) ? file_get_contents($rd) : '';
$s = is_file($ss) ? file_get_contents($ss) : '';
$j = is_file($rp) ? file_get_contents($rp) : '';
$i = is_file($ix) ? file_get_contents($ix) : '';
ok($r !== '' && $s !== '' && $j !== '' && $i !== '', 'R0 all four files read');

// ---------------- the read endpoint ----------------
ok(lift($r, 'pnbBulkIsEncrypted') && lift($r, 'pnbBulkTaskHasPassword'), 'R1 helpers lifted');
if (function_exists('pnbBulkIsEncrypted')) {
    ok(pnbBulkIsEncrypted('{"encrypted":true,"content":"PENUMBRA_GCM::x"}') === true, 'R2 the password wrapper reads as encrypted');
    ok(pnbBulkIsEncrypted('{"query":"select 1","encrypted":false}') === false, 'R3 encrypted:false is not');
    ok(pnbBulkIsEncrypted('{"query":"select 1"}') === false && pnbBulkIsEncrypted('') === false && pnbBulkIsEncrypted('not json') === false, 'R4 plain / empty / junk are not');
}
if (function_exists('pnbBulkTaskHasPassword')) {
    ok(pnbBulkTaskHasPassword('{"report_password":"ENC::abc"}') === true, 'R5 a task keeping the password');
    ok(pnbBulkTaskHasPassword('{"report_password":null}') === false, 'R6 report_password null (manage_schedule clears it that way) is no password');
    ok(pnbBulkTaskHasPassword('{"report_password":""}') === false && pnbBulkTaskHasPassword('{}') === false && pnbBulkTaskHasPassword('') === false, 'R7 empty / absent / no options');
}
$pGate = strpos($r, "if (!\$isAdmin) {");
$pQ = strpos($r, 'queryViaOci8(');
ok($pGate !== false && $pQ !== false && $pGate < $pQ, 'R8 admin gate before the first query');
ok(strpos($r, 'penumbraCsrfGuard();') !== false && strpos($r, 'penumbraCsrfGuard();') < $pGate, 'R9 CSRF guard first');
ok(strpos($r, 'count($ids) > 200') !== false, 'R10 at most 200 ids');
ok(strpos($r, "ctype_digit(\$v)") !== false && strpos($r, "implode(',', array_map('intval', \$ids))") !== false, 'R11 ids are integers before they reach the IN list');
// The conflict guard only works if the read hands back UPDATED_AT in the exact format the save compares against.
preg_match_all("/TO_CHAR\(UPDATED_AT, '([^']+)'\)/", $s, $sf);
preg_match_all("/TO_CHAR\(UPDATED_AT, '([^']+)'\)/", $r, $rf);
ok(!empty($rf[1]) && !empty($sf[1]) && count(array_unique(array_merge($rf[1], $sf[1]))) === 1, 'R12 UPDATED_AT format identical in read and save (' . implode(' | ', array_unique(array_merge($rf[1], $sf[1]))) . ')');
ok(strpos($r, "DBMS_LOB.SUBSTR(SNAP_DATA, 14, 1) = 'PENUMBRA_GCM::'") !== false, 'R13 encrypted snapshots counted by their ciphertext prefix');
ok(preg_match("/'scan'\s*=>\s*array\('snaps' => \\\$snapScanOk, 'tasks' => \\\$taskScanOk\)/", $r) === 1, 'R14 scan failures are reported (the dialog fails closed on them)');
// SQL text only (a string literal opening on a write verb) - the docblock may say "UPDATE row".
ok(strpos($r, 'execClob') === false && !preg_match('/["\']\s*(UPDATE\s+[\w.]+\s+SET|INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO)/i', $r), 'R15 the read endpoint writes nothing');

// ---------------- the save endpoint ----------------
if (preg_match('/\$bulk_batch = \(.*?;\n/s', $s, $m)) {
    $code = $m[0];
    $t = function ($isAdmin, $data) use ($code) { eval($code); return $bulk_batch; };
    ok($t(true, array('bulk_batch' => 'bs20261013101500-ab12')) === 'bs20261013101500-ab12', 'S1 an admin\'s batch id is recorded');
    ok($t(false, array('bulk_batch' => 'bs20261013101500-ab12')) === '', 'S2 ignored from a non-admin');
    ok($t(true, array('bulk_batch' => "x'; DROP")) === '' && $t(true, array('bulk_batch' => str_repeat('a', 41))) === '' && $t(true, array('bulk_batch' => array('x'))) === '', 'S3 only ^[A-Za-z0-9_-]{1,40}$');
    ok($t(true, array()) === '', 'S4 absent = no batch (every ordinary save)');
} else { ok(false, 'S1 $bulk_batch assignment found'); }
$pCreated = strpos($s, "\$after_json_obj['created_at'] = \$before_data['CREATED_AT'];");
$pOwner = strpos($s, "\$after_json_obj['owner_id'] = \$before_data['OWNER_ID'];");
$pSum = strpos($s, 'penumbraAuditChangeSummary($before_json_obj, $after_json_obj)');
ok($pOwner !== false && $pCreated < $pOwner && $pOwner < $pSum, 'S5 an overwrite\'s AFTER names the owner the row keeps, before the change summary');
ok(strpos($s, "if (\$bulk_batch !== '') { \$auditExtra['bulk_batch'] = \$bulk_batch; }") !== false, 'S6 batch id rides in the UPDATE row\'s SOURCE_DATA');
ok(strpos($s, '$auditExtra ? $auditExtra : null);') !== false && strpos($s, "array('changed' => \$chgSum['changed'])") !== false, 'S7 the change summary still rides there too');
ok(substr_count($s, '[$via]') === 2 && strpos($s, "\$label = '', \$via = 'Save As')") !== false, 'S8 tag audit rows name their path; an ordinary save still says [Save As]');
// The summary itself: with the owner kept, a theme-only bulk save by an admin is "1 other setting", not 2.
$db = @file_get_contents(dirname($ss) . DIRECTORY_SEPARATOR . 'db_connection.php');
if ($db === false || $db === '') { $db = @file_get_contents('\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\db_connection.php'); }
if ($db && lift($db, 'penumbraAuditChangeSummary')) {
    $b = array('report' => array('query' => 'q', 'theme' => 'a'), 'short_id' => 'x', 'title' => 't', 'authorized' => 'p', 'owner_id' => 'jdoe', 'tags' => array());
    $a = $b; $a['report']['theme'] = 'b';
    $sum = penumbraAuditChangeSummary($b, $a);
    ok($sum && $sum['message'] === 'Changed: 1 other setting', 'S9 owner kept: a theme change summarizes as one setting (' . ($sum ? $sum['message'] : 'null') . ')');
    $a2 = $a; $a2['owner_id'] = 'admin1';
    $sum2 = penumbraAuditChangeSummary($b, $a2);
    ok($sum2 && $sum2['message'] === 'Changed: 2 other settings', 'S10 (why S5 matters) the saver\'s id in AFTER would add a phantom owner change');
} else { ok(false, 'S9 penumbraAuditChangeSummary lifted from db_connection.php'); }

// ---------------- the repository + index.php ----------------
ok(strpos($j, 'id="srBulkSettings"') !== false, 'J1 the Manage bar has the Bulk settings button');
ok(preg_match("/\\\$\('#srBulkSettings'\)\.prop\('disabled', live === 0\)/", $j) === 1, 'J2 it enables on live reports, like Change owner');
ok(strpos($j, 'window.PENUMBRA_BULKSET_ASSETS') !== false && strpos($j, "window.PenumbraBulkSet.open(") !== false, 'J3 lazy loader + open');
ok(strpos($j, 'if (_srRetickAfterLoad) { retickAfterLoad(); }') !== false, 'J4 failed / skipped reports are ticked again after the refetch');
ok(strpos($j, "if (!manageOn()) { return; }\n        var targets = [];") !== false, 'J5 the click does nothing outside Management Mode');
// E2E 2026-10-13: a skipped report outside the default list stayed unticked - the refetch had dropped the search.
ok(strpos($j, '_srSearchAfterLoad = term.length >= 3 ? term : null;') !== false
   && strpos($j, "$('#reportFilterInput').val(_srTerm).trigger('keyup');") !== false
   && strpos($j, "renderReportRows(response.data, \$searchTbody, false, true);\n                                if (_srRetickAfterLoad) { retickAfterLoad(); }") !== false,   // skipSort since 2026-10-21 (searchrank)
   'J7 the post-run refetch runs the search again and its results are re-ticked');
ok(strpos($j, 'if (found < total) {') !== false && strpos($j, ' not in the list shown. Search for ') !== false,
   'J8 a failed / skipped report the list does not show is named as such, not silently left unticked');
$pIx = strpos($i, 'window.PENUMBRA_BULKSET_ASSETS');
$pIf = strrpos(substr($i, 0, $pIx === false ? 0 : $pIx), '<?php if ($isAdmin) { ?>');
ok($pIx !== false && $pIf !== false && $pIx - $pIf < 120, 'J6 index.php hands the module URL to admins only');

echo "PASS: $pass   FAIL: $fail\n";
