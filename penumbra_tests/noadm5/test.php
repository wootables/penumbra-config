<?php
// noadm5 suite (2026-10-02): the five &noadm / owner follow-ups. No database, no web server.
//   php test.php <app dir>   (dashboard.php, manage_journal.php, index.php, help_content.php,
//                             analytics_shared.php, js\penumbra_dashboard.js, js\penumbra_journal.js)
// G*  manage_journal.php's journalCallerCanView / journalCallerHoldsGrant /
//     journalReportJournalEnabled / journalTargetCanOpenJournal LIFTED by their markers and
//     run with stub helpers: the caller's report grant now views the journal; a target opens
//     the journal when it is on, or when they are an app admin, the owner or a grant editor.
// M*  the @mention and reply fan-out guards sit before their send calls.
// I1  index.php's $pnbJrnAccess carries the grant term.  D1 dashboard.php emits noadm.
// J1/J2 the dashboard script clamps the kiosk hop's can_edit and the home badge.
// H1/H2 the pagination help.  T1 the composer toast.  A1 the metrics scope (eng15) stays.
// Prints PASS/FAIL lines and "N assertions, M failed".
error_reporting(E_ALL);
$app = isset($argv[1]) ? rtrim($argv[1], "\\/") : '';
if ($app === '' || !is_dir($app)) { echo "FATAL: app dir missing\n"; exit(2); }
$pass = 0; $fail = 0;
function T($id, $name, $ok, $detail = '') {
    global $pass, $fail;
    if ($ok) { $pass++; echo "PASS $id $name\n"; }
    else { $fail++; echo "FAIL $id $name" . ($detail !== '' ? " -- $detail" : '') . "\n"; }
}
function src($rel) {
    global $app;
    $p = $app . '/' . $rel;
    if (!is_file($p)) { echo "FATAL: missing $p\n"; exit(2); }
    return str_replace("\r\n", "\n", file_get_contents($p));
}
function lift($text, $start, $end) {
    $i = strpos($text, $start);
    if ($i === false) { echo "FATAL: lift start missing: $start\n"; exit(2); }
    $j = strpos($text, $end, $i + strlen($start));
    if ($j === false) { echo "FATAL: lift end missing: $end\n"; exit(2); }
    return substr($text, $i, $j - $i);
}

$journal = src('manage_journal.php');
$index   = src('index.php');
$dash    = src('dashboard.php');
$help    = src('help/topics/viewoptionsHelpLightbox.php');   // (2026-10-19) the v1 help is gone
$an      = src('analytics_shared.php');
$dashjs  = src('js/penumbra_dashboard.js');
$jrnjs   = src('js/penumbra_journal.js');

// ---- stubs for what the lifted functions call ---------------------------------------
$userGrants = array('reports' => array());
$config = array('user_grants' => array('gina' => array('reports' => array('rep1')), 'gary' => array('reports' => array('other'))));
$allowedUsers = array('root');
$GLOBALS['__clob'] = array(
    7 => '{"viewOptions":{"journalEnabled":true}}',
    8 => '{"viewOptions":{"journalEnabled":false},"x":1}',
    9 => '{"viewOptions": {"journalEnabled": true}}'
);
$GLOBALS['__clobReads'] = array();
function penumbraIsReportOwner($owner, $uid) { return strcasecmp(trim((string)$owner), trim((string)$uid)) === 0; }
function checkAuthorization($list, $uid, $ouc) {
    $items = array_map('trim', explode(',', strtolower((string)$list)));
    return in_array(strtolower((string)$uid), $items, true) || in_array('public', $items, true);
}
function penumbraNormalizeGrants($config, $uid) {
    $u = strtolower((string)$uid);
    return isset($config['user_grants'][$u]) ? $config['user_grants'][$u] : array('reports' => array());
}
function penumbraReportGrantMatches($grants, $sid) {
    return is_array($grants) && !empty($grants['reports']) && in_array($sid, $grants['reports'], true);
}
function readClobViaOci8($table, $col, $where, $val) {
    $GLOBALS['__clobReads'][] = $val;
    return isset($GLOBALS['__clob'][$val]) ? $GLOBALS['__clob'][$val] : '';
}

// ---- lift the gate and the helpers (contiguous since 2026-10-02) ----------------------
$code = lift($journal, 'function journalCallerCanView(', "/**\n * May a TARGET user (a mentioned person, not the caller) view this report?");
eval($code);
foreach (array('journalCallerCanView', 'journalCallerHoldsGrant', 'journalReportJournalEnabled', 'journalTargetCanOpenJournal') as $fn) {
    if (!function_exists($fn)) { echo "FATAL: $fn not lifted\n"; exit(2); }
}

$R = array('ID' => 7, 'SHORT_ID' => 'rep1', 'OWNER_ID' => 'owen', 'AUTHORIZED' => 'alice, bob');
$ROff = array('ID' => 8, 'SHORT_ID' => 'rep1', 'OWNER_ID' => 'owen', 'AUTHORIZED' => 'alice, bob');
$RSp = array('ID' => 9, 'SHORT_ID' => 'rep9', 'OWNER_ID' => 'owen', 'AUTHORIZED' => '');

// G: the caller's gate
T('G1', 'caller: an admin views the journal', journalCallerCanView($R, 'zed', '', true) === true);
T('G2', 'caller: the owner views it', journalCallerCanView($R, 'owen', '', false) === true);
$userGrants = array('reports' => array('rep1'));
T('G3', 'caller: a report-grant holder NOT on the access list views it (the new term)', journalCallerCanView($R, 'gina', '', false) === true);
$userGrants = array('reports' => array('other'));
T('G4', 'caller: a grant on another report does not', journalCallerCanView($R, 'gary', '', false) === false);
$userGrants = array('reports' => array());
T('G5', 'caller: the access list still views it', journalCallerCanView($R, 'alice', '', false) === true);
T('G6', 'caller: nobody else', journalCallerCanView($R, 'nobody', '', false) === false);
T('G6b', 'caller: no report, no access', journalCallerCanView(null, 'owen', '', true) === false);
$userGrants = 'not-an-array';
T('G6c', 'caller: a malformed grants global is no grant', journalCallerCanView($R, 'gina', '', false) === false);
$userGrants = array('reports' => array());

// G: can the TARGET open the journal the e-mail links to?
T('G7', 'target: journal ON - any viewer opens it', journalTargetCanOpenJournal($R, 'nobody') === true);
T('G7b', 'target: journal ON spelled with a space - the other seed form', journalTargetCanOpenJournal($RSp, 'nobody') === true);
T('G8', 'target: journal OFF - a plain viewer cannot (no e-mail)', journalTargetCanOpenJournal($ROff, 'nobody') === false);
T('G8b', 'target: journal OFF - someone on the access list cannot either (the peek is editors\' only)', journalTargetCanOpenJournal($ROff, 'alice') === false);
T('G9', 'target: journal OFF - the owner has the peek', journalTargetCanOpenJournal($ROff, 'owen') === true);
T('G10', 'target: journal OFF - an app admin has the peek', journalTargetCanOpenJournal($ROff, 'root') === true);
T('G11', 'target: journal OFF - a report-grant editor has the peek', journalTargetCanOpenJournal($ROff, 'gina') === true);
T('G11b', 'target: journal OFF - a grant on another report does not', journalTargetCanOpenJournal($ROff, 'gary') === false);
T('G12', 'target: an empty id opens nothing', journalTargetCanOpenJournal($ROff, '') === false);
journalTargetCanOpenJournal($ROff, 'x1'); journalTargetCanOpenJournal($ROff, 'x2');
$reads8 = count(array_filter($GLOBALS['__clobReads'], function ($v) { return $v === 8; }));
T('G13', 'the journal flag is read from the CLOB once per report per request', $reads8 === 1, "reads of id 8: $reads8");

// M: the send paths carry the guard, before their send calls
$m1 = strpos($journal, 'if (!journalTargetCanOpenJournal($report, $uid)) {');
$s1 = strpos($journal, '$emailed = journalSendMentionEmail(');
T('M1', 'the @mention loop skips a target who could not open the journal, before the send', $m1 !== false && $s1 !== false && $m1 < $s1
    && strpos(substr($journal, $m1, $s1 - $m1), "'skipped' => 'journal_off'") !== false);
$m2 = strpos($journal, 'if (!journalTargetCanOpenJournal($report, $u)) {');
$s2 = strpos($journal, '$emailed = journalSendReplyEmail($u');
T('M2', 'the reply fan-out skips a participant who could not open it, before the send', $m2 !== false && $s2 !== false && $m2 < $s2
    && strpos(substr($journal, $m2, $s2 - $m2), "'skipped' => 'journal_off'") !== false);

// I1: index.php's copy of the gate carries the grant term inside the $pnbJrnAccess statement
$ia = strpos($index, '$pnbJrnAccess = $isAdmin');
$ib = $ia !== false ? strpos($index, ';', $ia) : false;
$stmt = ($ia !== false && $ib !== false) ? substr($index, $ia, $ib - $ia) : '';
T('I1', 'index.php: $pnbJrnAccess carries the report-grant term (term for term with the API)',
    strpos($stmt, "penumbraReportGrantMatches(\$userGrants, \$loadedShortId)") !== false && strpos($stmt, 'checkAuthorization($authorized_list') !== false, substr($stmt, 0, 160));

// D1 / J1 / J2: the dashboard under &noadm
$dv = strpos($dash, 'const penumbra_dash_vars = {');
$dvEnd = $dv !== false ? strpos($dash, '};', $dv) : false;
$vars = ($dv !== false && $dvEnd !== false) ? substr($dash, $dv, $dvEnd - $dv) : '';
T('D1', 'dashboard.php: penumbra_dash_vars carries noadm', strpos($vars, 'noadm: <?php echo json_encode((bool)$noadm); ?>,') !== false);
T('J1', 'the kiosk hop clamps the fetched can_edit with noadm', strpos($dashjs, 'V.canEdit = !!r.can_edit && !penumbra_dash_vars.noadm;') !== false);
T('J2', 'the home list badge is clamped with noadm', strpos($dashjs, "((d.can_edit && !penumbra_dash_vars.noadm) ? '<span class=\"dash-home-badge\">editable</span>' : '')") !== false);

// H: the pagination help
// (the box is the filter box since penumbra_tests\filterword, 2026-10-19: either word passes here, that suite pins it)
T('H1', 'help: the navigator sits in the bar above the table', (strpos($help, 'appear in the bar above the table, beside the search box.') !== false || strpos($help, 'appear in the bar above the table, beside the filter box.') !== false) && strpos($help, 'appear below the table.') === false);
T('H2', 'help: the arrows read << < > >>', strpos($help, '<strong>First</strong> (&lt;&lt;), <strong>Previous</strong> (&lt;), <strong>Next</strong> (&gt;), <strong>Last</strong> (&gt;&gt;)') !== false
    && strpos($help, '(&laquo;)') === false && strpos($help, '(&rsaquo;)') === false);

// T1: the composer toast
T('T1', 'the composer toast counts the skipped notifications and says why', strpos($jrnjs, "r.skipped === 'journal_off'") !== false && strpos($jrnjs, 'if (offj) msg +=') !== false
    && strpos($jrnjs, "(unauth || offj) ? 'warn' : 'success'") !== false);

// A1: (a) stays closed by eng15
T('A1', 'metrics scope: the person-level tier needs $editorRolesOn (eng15, 2026-10-02)', strpos($an, "\$editorRolesOn && (\$out['is_owner'] || \$out['is_editor'])") !== false);

echo ($pass + $fail) . " assertions, $fail failed\n";
exit($fail ? 1 : 0);
