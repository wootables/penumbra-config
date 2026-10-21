<?php
// dash_gate_tests.php - the DASHBOARD DISCOVERY GATE of manage_dashboard.php (palette round 13, 2026-10-20;
// the standing rule: memory no_report_directory_for_users.md). The endpoint runs on include, so the list's
// helpers are lifted out of the file's text by name and evaluated with the gate file; the checks run them
// over fixture rows (no Oracle here).
//   php -n dash_gate_tests.php --file <manage_dashboard.php> --gate <penumbra_discovery.php>   prints D1..D7 and DGATE: GREEN | RED
$o = getopt('', array('file:', 'gate:'));
if (empty($o['file']) || empty($o['gate'])) { fwrite(STDERR, "usage: --file <manage_dashboard.php> --gate <penumbra_discovery.php>\n"); exit(2); }
$src = file_get_contents($o['file']); $gsrc = file_get_contents($o['gate']);
if ($src === false || $gsrc === false) { fwrite(STDERR, "cannot read\n"); exit(2); }

function lift($src, $name) {
    $at = strpos($src, "\nfunction $name(");
    if ($at === false) return null;
    $i = strpos($src, '{', $at); $depth = 0; $n = strlen($src);
    for ($j = $i; $j < $n; $j++) {
        $c = $src[$j];
        if ($c === '{') $depth++;
        else if ($c === '}') { $depth--; if ($depth === 0) return substr($src, $at + 1, $j - $at); }
    }
    return null;
}
$fails = array(); $n = 0;
function chk($id, $ok, $note) { global $fails, $n; $n++; printf("  %s  %-4s %s\n", $ok ? 'PASS' : 'FAIL', $id, $note); if (!$ok) $fails[] = $id; }

require $o['gate'];   // the two gates, as the app has them
$parse = lift($src, 'dashOpenedSidsFromRows');
$vis = lift($src, 'dashListVisible');
chk('D1', function_exists('penumbraDashboardDiscoveryAllowed') && function_exists('penumbraReportDiscoveryAllowed') && $parse && $vis
    && strpos($src, "require_once 'penumbra_discovery.php';") !== false,
    'the gate file defines both gates; manage_dashboard.php requires it and carries the parser and the list rule');
if (!($parse && $vis)) { echo "DGATE: RED\n"; exit(1); }
eval($parse . "\n" . $vis);

chk('D2', penumbraDashboardDiscoveryAllowed(true) === true && penumbraDashboardDiscoveryAllowed(false) === false
    && penumbraReportDiscoveryAllowed(false) === false,
    'the gate: admins may discover dashboards, non-admins may not (the reports gate says the same)');

// the audit rows as the query returns them: "AFTER" JSON substringed to text; junk and other users' rows never reach here
$opened = dashOpenedSidsFromRows(array(array('AD' => '{"dash":"dshA","by":"vone"}'), array('AD' => '{"dash":" dshA ","by":"vone"}'), array('AD' => 'not json'), array('AD' => '{"by":"vone"}')));
chk('D3', $opened === array('dshA' => true), 'the opened set: the dash ids out of the DASH_OPEN rows\' JSON, trimmed, junk ignored');

// fixtures: A (owned by ownerx, opened by vone), B (owned by vone), C (viewable, never opened)
$A = array('SHORT_ID' => 'dshA', 'OWNER_ID' => 'ownerx', 'AUTHORIZED' => 'vone');
$B = array('SHORT_ID' => 'dshB', 'OWNER_ID' => 'vone', 'AUTHORIZED' => '');
$C = array('SHORT_ID' => 'dshC', 'OWNER_ID' => 'other', 'AUTHORIZED' => 'vone');
chk('D4', dashListVisible($A, true, 'admin1', array()) && dashListVisible($B, true, 'admin1', array()) && dashListVisible($C, true, 'admin1', array()),
    'an admin lists every dashboard');
chk('D5', dashListVisible($A, false, 'vone', $opened) && dashListVisible($B, false, 'vone', $opened) && !dashListVisible($C, false, 'vone', $opened),
    'a non-admin lists the one they opened and the one they own, not the viewable one they never opened');
chk('D6', !dashListVisible($A, false, 'vtwo', array()) && !dashListVisible($C, false, 'vtwo', array()),
    'another non-admin with no history lists neither');

// the list action uses the rule, after can-view, with the opened set read only under the gate (source level)
$listAt = strpos($src, "if (\$action === 'list') {");
$tail = $listAt !== false ? substr($src, $listAt, 2000) : '';
chk('D7', $listAt !== false
    && strpos($tail, "\$opened = penumbraDashboardDiscoveryAllowed(\$isAdmin) ? array() : dashOpenedByUser(\$oracleConn, \$currentUserKey);") !== false
    && strpos($tail, "if (!dashCanView(") !== false && strpos($tail, "if (!dashListVisible(\$row, \$isAdmin, \$currentUserKey, \$opened)) { continue; }") !== false
    && strpos($tail, "if (!dashCanView(") < strpos($tail, "if (!dashListVisible(")
    && strpos($src, "WHERE ACTION = 'DASH_OPEN' AND USER_ID = :u") !== false && strpos($src, 'DBMS_LOB.SUBSTR(\\"AFTER\\", 4000, 1) AS AD') !== false,
    'the list action: the opened set from the DASH_OPEN rows (only under the gate), the list rule after can-view');

echo ($fails ? 'DGATE: RED ' . implode(' ', $fails) : 'DGATE: GREEN') . "\n";
exit($fails ? 1 : 0);
