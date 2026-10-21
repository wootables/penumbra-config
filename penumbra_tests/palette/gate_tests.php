<?php
// gate_tests.php - the REPORT DISCOVERY GATE of get_server_reports.php (palette round 5, 2026-10-20;
// the standing rule: memory no_report_directory_for_users.md). The endpoint runs on include, so the
// three functions are lifted out of the file's text by name and evaluated with stubs; the checks
// read the SQL they build (no Oracle here).
//   php -n gate_tests.php --file <get_server_reports.php>      prints G1..G8 and GATE: GREEN | RED
$o = getopt('', array('file:', 'gate:'));
if (empty($o['file'])) { fwrite(STDERR, "usage: --file <get_server_reports.php> [--gate <penumbra_discovery.php>]\n"); exit(2); }
$src = file_get_contents($o['file']);
if ($src === false) { fwrite(STDERR, "cannot read\n"); exit(2); }

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
// the stubs the lifted code reaches for (db_connection.php's)
function penumbraSystemShortIds() { return array('__HOME__', '__HEALTH__'); }
function penumbraShortIdSqlList($ids) { return implode(',', array_map(function ($x) { return "'" . $x . "'"; }, $ids)); }
$userGrants = array(); $oracleConn = null;
$_SERVER['HTTP_SHIB_MAIL'] = 'Viewer.One@ncsu.edu';

$fails = array(); $n = 0;
function chk($id, $ok, $note) { global $fails, $n; $n++; printf("  %s  %-4s %s\n", $ok ? 'PASS' : 'FAIL', $id, $note); if (!$ok) $fails[] = $id; }

// (round 13) the gate lives in penumbra_discovery.php when --gate names a non-empty file; else it is lifted from the endpoint (live before the move)
$gateFile = (!empty($o['gate']) && is_file($o['gate']) && trim((string)file_get_contents($o['gate'])) !== '') ? $o['gate'] : null;
if ($gateFile) { require $gateFile; }
$gate = $gateFile ? (function_exists('penumbraReportDiscoveryAllowed') ? ('// the gate from ' . basename($gateFile)) : null) : lift($src, 'penumbraReportDiscoveryAllowed');
$known = lift($src, 'penumbraKnownReportsSql');
$text = lift($src, 'penumbraReportTextMatchSql');
$auth = lift($src, 'buildAuthFilter');
chk('G1', $gate && $known && $text && $auth, 'the gate, the known-set and text-match helpers and buildAuthFilter are in the file');
if (!($gate && $known && $text && $auth)) { echo "GATE: RED\n"; exit(1); }
eval($gate . "\n" . $known . "\n" . $text . "\n" . $auth);

chk('G2', penumbraReportDiscoveryAllowed(true) === true && penumbraReportDiscoveryAllowed(false) === false, 'the gate: admins may discover, non-admins may not');

// an admin's listing: the can-open set alone (no known-set cut)
$a = buildAuthFilter(true, 'admin1', 'x');
chk('G3', strpos($a['sql'], 'PENUMBRA_AUDIT') === false && strpos($a['sql'], 'kn_owner') === false, 'admin listing filter carries no known-set cut');

// a non-admin who can OPEN reports (public / shared / granted) but never visited them: the listing is ALSO cut
// to owned / opened / received - the known clause is ANDed after the can-open group, never ORed into it
$u = buildAuthFilter(false, 'vone', 'q');
$sql = $u['sql'];
$canOpenEnd = strpos($sql, "r.AUTHORIZED LIKE :auth_endq");
$knownAt = strpos($sql, " AND (r.OWNER_ID = :kn_ownerq");
chk('G4', $canOpenEnd !== false && $knownAt !== false && $knownAt > $canOpenEnd
    && substr_count($sql, ' AND (r.OWNER_ID = :kn_ownerq') === 1 && strpos($sql, ')', $canOpenEnd) < $knownAt,
    'non-admin: the known-set clause is ANDed after the can-open group (a never-visited openable report is out)');
chk('G5', strpos($sql, "PENUMBRA_AUDIT ka WHERE ka.REPORT_ID = r.ID AND ka.USER_ID = :kn_userq AND ka.ACTION = 'OPEN'") !== false
    && strpos($sql, "PENUMBRA_SCHEDULED_TASKS kt WHERE kt.REPORT_ID = r.SHORT_ID") !== false
    && strpos($sql, "LOWER(kt.RECIPIENTS), :kn_mailq") !== false && strpos($sql, "LOWER(kt.OPTIONS), :kn_mailqq") !== false && strpos($sql, ":kn_uidqq") !== false,
    'non-admin: opened (an OPEN audit row of theirs) and received (a task naming their address or subscriber uid) count as known');
chk('G6', $u['binds'][':kn_ownerq'] === 'vone' && $u['binds'][':kn_userq'] === 'vone' && $u['binds'][':kn_mailq'] === 'viewer.one@ncsu.edu'
    && $u['binds'][':kn_mailqq'] === '"viewer.one@ncsu.edu"' && $u['binds'][':kn_uidqq'] === '"uid":"vone"',
    'the known-set binds: owner / user key, the Shibboleth mail (lower-cased), the quoted subscriber forms');

// the text surfaces: an admin's term reaches STATE_DATA, recipients, owner and access list; a non-admin's the id and title only
$ta = penumbraReportTextMatchSql(true, 'q', '%x%', 'x');
$tu = penumbraReportTextMatchSql(false, 'q', '%x%', 'x');
chk('G7', strpos($ta['sql'], 'STATE_DATA') !== false && strpos($ta['sql'], 'RECIPIENTS') !== false && strpos($ta['sql'], 'r.OWNER_ID') !== false && strpos($ta['sql'], 'r.AUTHORIZED') !== false
    && isset($ta['binds'][':qut1'], $ta['binds'][':qut2'], $ta['binds'][':qp3']),
    'admin: every text surface (id, title, owner, access list, STATE_DATA, task recipients)');
chk('G8', strpos($tu['sql'], 'STATE_DATA') === false && strpos($tu['sql'], 'RECIPIENTS') === false && strpos($tu['sql'], 'r.OWNER_ID') === false && strpos($tu['sql'], 'r.AUTHORIZED') === false
    && strpos($tu['sql'], 'r.SHORT_ID') !== false && strpos($tu['sql'], 'r.TITLE') !== false && count($tu['binds']) === 2,
    'non-admin: the term matches the short id and the title only (no SQL, recipients, owner or access-list text)');

// the modes use them (source level): search and quicksearch build their WHERE from the helper, the owner-by-name
// reach is behind the gate, and no mode keeps its own STATE_DATA / RECIPIENTS term match outside the helper
$helperUses = substr_count($src, "penumbraReportTextMatchSql(\$isAdmin, '");   // the call sites (the definition line has no quote)
$ownOwner = strpos($src, 'penumbraReportDiscoveryAllowed($isAdmin) ? penumbraPeopleUnityByName') !== false;
$strayMatch = substr_count($src, "DBMS_LOB.INSTR(UPPER(t.RECIPIENTS)");   // the helper's admin branch holds the one
chk('G9', $helperUses === 2 && $ownOwner && $strayMatch === 1, "search + quicksearch use the helper ($helperUses), the owner-name reach is gated, no stray recipient match ($strayMatch)");

echo ($fails ? 'GATE: RED ' . implode(' ', $fails) : 'GATE: GREEN') . "\n";
exit($fails ? 1 : 0);
