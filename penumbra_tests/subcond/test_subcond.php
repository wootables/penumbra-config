<?php
/**
 * subcond - "Allow only on custom condition" for report subscriptions (2026-09-23).
 *
 *   php -n test_subcond.php <path-to-penumbra_subscribe_condition.php> [<app dir>]
 *
 * Drives the ONE evaluator (penumbra_subscribe_condition.php, which requires the app's
 * penumbra_search.php + penumbra_directory.php beside it) against a hand-written fake
 * connection: the parser gate, tag membership, matching on directory records, the
 * error-REPORTING lookup, the fail-closed join gate and the fail-SAFE send-time filter,
 * the directory scan - then text pins on the four consumers in the app folder.
 * Tail must read "PASS: N   FAIL: 0" then "RESULT: GREEN".
 */
$lib = isset($argv[1]) ? $argv[1] : '';
$app = (isset($argv[2]) && $argv[2] !== '') ? rtrim($argv[2], '/' . DIRECTORY_SEPARATOR) : dirname($lib);
if (!is_file($lib)) { echo "library not found: $lib\n"; echo "RESULT: RED\n"; return; }
$_SERVER['SCRIPT_FILENAME'] = __FILE__;   // the libraries refuse direct web access by comparing basenames
ini_set('error_log', sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'penumbra_subcond_errlog_' . getmypid() . '.txt');
require $lib;

$PASS = 0; $FAIL = 0;
function ok($cond, $label) { global $PASS, $FAIL; if ($cond) { $PASS++; echo "  ok   $label\n"; } else { $FAIL++; echo "  FAIL $label\n"; } }
function eq($got, $want, $label) {
    global $PASS, $FAIL;
    if ($got === $want) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label\n       want: " . var_export($want, true) . "\n       got:  " . var_export($got, true) . "\n"; }
}

/* ------------------------------------------------------------ the fake DB */
class FakeStmt {
    public $sql; public $binds = array(); private $rows; private $i = 0; private $conn;
    public function __construct($conn, $sql, $rows) { $this->conn = $conn; $this->sql = $sql; $this->rows = $rows; }
    public function bindValue($k, $v, $t = null) { $this->binds[$k] = $v; return true; }
    public function execute($p = null) { if ($this->conn->throwOnExecute) throw new Exception('ORA-00000 fake'); return true; }
    public function fetch($mode = null) { return isset($this->rows[$this->i]) ? $this->rows[$this->i++] : false; }
}
class FakeConn {
    public $statements = array(); public $queue = array(); public $throwOnExecute = false;
    public function prepare($sql) { $rows = count($this->queue) ? array_shift($this->queue) : array(); $st = new FakeStmt($this, $sql, $rows); $this->statements[] = $st; return $st; }
}
function vrow($over = array()) {   // one PENUMBRA_PEOPLE_V row
    return array_merge(array(
        'EMPLID' => '000123456', 'UNITY_ID' => 'jdoe', 'FIRST_NAME' => 'Jane', 'LAST_NAME' => 'Doe', 'PREFERRED_NAME' => 'Jane Doe',
        'EMAIL' => 'jdoe@ncsu.edu', 'SUPERVISOR_EMAIL' => 'boss@ncsu.edu', 'OUC' => '140201', 'DEPT_NAME' => 'Chemical & Biomolecular Engr',
        'ACTIVE' => '1', 'JOB_TITLE' => 'Professor', 'EMPL_CLASS' => 'ENF', 'PI_ELIGIBLE' => '1',
        'JOBCODE' => 'UP02', 'EMPL_STATUS' => 'A', 'TAGS' => '|CALS_PREAWARD|OSP_LEADS|',
    ), $over);
}
$A = vrow();
$B = vrow(array('EMPLID' => '000999888', 'UNITY_ID' => 'bsmith', 'FIRST_NAME' => 'Bo', 'LAST_NAME' => 'Smith', 'EMAIL' => 'bsmith@ncsu.edu',
                'OUC' => '060401', 'DEPT_NAME' => 'Physics', 'EMPL_CLASS' => 'SPA', 'PI_ELIGIBLE' => '0', 'JOBCODE' => 'C46114', 'TAGS' => null));
$recA = penumbraSubCondPersonRow($A);
$recB = penumbraSubCondPersonRow($B);
function m($cond, $rec) { $p = penumbraSubCondParse($cond); return $p['error'] === '' && penumbraSubCondMatchRow($p['parsed'], $rec); }

// ---------------------------------------------------------------- 1. the parser gate
echo "1. parse + validate (only column conditions and AND / OR, on known columns)\n";
$p = penumbraSubCondParse('OUC2D = 14 AND PI_ELIGIBLE = 1');
eq($p['error'], '', 'a plain two-condition AND is usable');
eq(count($p['parsed']), 3, '...parsed as condition, AND, condition');
eq(penumbraSubCondValidate('{OUC2D} = 14'), '', 'the recipient-variable spelling {OUC2D} names the same column');
eq(penumbraSubCondValidate('ouc2d = 14'), '', 'column names are case-insensitive');
ok(strpos(penumbraSubCondValidate(''), 'empty') !== false, 'an empty condition is refused');
ok(strpos(penumbraSubCondValidate('FOO = 1'), '"FOO" is not one of the variables a condition can use') !== false, 'an unknown column is refused (the grammar would compare the literal FOO and match nobody)');
ok(strpos(penumbraSubCondValidate('engineering'), '"engineering" is not one of the variables a condition can use') !== false, 'a bare word is refused (the grammar would search EVERY column)');
ok(strpos(penumbraSubCondValidate('OUC2D = 14 AND'), 'ends with AND / OR') !== false, 'a trailing AND is refused');
ok(penumbraSubCondValidate('AND OUC2D = 14') !== '', 'a leading AND is refused');
ok(penumbraSubCondValidate('# = 5') !== '', 'the row-number column is not a person column');
ok(strpos(penumbraSubCondValidate(str_repeat('OUC = 1 OR ', 100) . 'OUC = 1'), '1,000') !== false, 'over 1,000 characters is refused');
ok(strpos(penumbraSubCondValidate('{NOPE} = 1'), '{NOPE} is not one of the variables') !== false, 'a braced unknown column is refused too (the parser accepts any {X})');

echo "1b. braces are the documented spelling (2026-09-23 night); bare names keep working\n";
eq(penumbraSubCondVariableList(), '{FNAME}, {LNAME}, {USERNAME}, {EMAIL}, {OUC}, {OUC2D}, {OUC4D}, {OUC6D}, {DEPT}, {EMPL_ID}, {EMPL_ID4}, '
    . '{JOBCODE}, {JOBCODE_PREFIX}, {EMPL_CLASS}, {EMPL_STATUS}, {PI_ELIGIBLE}, {TAGS}', 'errors list the variables the way the form writes them');
ok(strpos(penumbraSubCondValidate('FOO = 1'), ': {FNAME}, {LNAME},') !== false && strpos(penumbraSubCondValidate('FOO = 1'), '{PI_ELIGIBLE}, {TAGS}.') !== false,
    'an unknown-column error lists them in braces');
$p = penumbraSubCondParse('{ ouc2d } = 14 AND {PI_ELIGIBLE} = 1');
eq(array($p['error'], $p['parsed'][0]['column'], $p['parsed'][2]['column']), array('', 'OUC2D', 'PI_ELIGIBLE'),
    'spaces and case inside the braces are canonicalized (the search parser trims them too since the bracespace fix)');
eq(array_map(function ($c) { return penumbraSubCondColumnName($c); }, array('{OUC2D}', ' { ouc2d } ', '{"OUC2D"}', "{'OUC2D'}", 'ouc2d')),
    array('OUC2D', 'OUC2D', 'OUC2D', 'OUC2D', 'OUC2D'), 'penumbraSubCondColumnName: every spelling of one column');
// "{OUC2D} 14" is the Search Filter's implicit contains since 2026-09-23 night (the browser's
// reading; penumbra_search.php used to make it two global terms) - so it is a usable condition.
$p = penumbraSubCondParse('{OUC2D} 14');
eq(array($p['error'], $p['parsed'][0]['column'], $p['parsed'][0]['op']), array('', 'OUC2D', 'contains'), '"{OUC2D} 14" = OUC2D contains 14 (the browser\'s {COLUMN} VALUE)');
ok(strpos(penumbraSubCondValidate('OUC2D'), '{OUC2D} needs a comparison after it') !== false, 'a variable with nothing after it gets a hint, not "is not one of the variables"');

// ---------------------------------------------------------------- 2. tags
echo "2. TAGS: = means has the tag, != means does not\n";
$p = penumbraSubCondParse('TAGS = cals_preaward');
eq(array($p['parsed'][0]['op'], $p['parsed'][0]['value']), array('contains', '|CALS_PREAWARD|'), '= becomes an exact-membership test on the |A|B| list');
$p = penumbraSubCondParse('TAGS != CALS_PREAWARD');
eq(array($p['parsed'][0]['op'], $p['parsed'][0]['value']), array('!/', '\|CALS_PREAWARD\|'), '!= becomes a negated membership test');
$p = penumbraSubCondParse('TAGS = /PRE/');
eq($p['parsed'][0]['value'], '/PRE/', 'a regex keeps the engine\'s own meaning');
$p = penumbraSubCondParse('{ tags } != cals_preaward');
eq(array($p['parsed'][0]['column'], $p['parsed'][0]['op'], $p['parsed'][0]['value']), array('TAGS', '!/', '\|CALS_PREAWARD\|'), 'the braced (and spaced) {TAGS} gets the same membership rewrite');

// ---------------------------------------------------------------- 3. matching
echo "3. matching directory records (A: OUC 140201, PI 1, ENF, UP02, tags CALS_PREAWARD+OSP_LEADS; B: 060401, PI 0, SPA, C46114, no tags)\n";
eq(array(m('OUC2D = 14 AND PI_ELIGIBLE = 1', $recA), m('OUC2D = 14 AND PI_ELIGIBLE = 1', $recB)), array(true, false), 'AND');
eq(array(m('OUC2D = 14 OR EMPL_CLASS = SPA', $recA), m('OUC2D = 14 OR EMPL_CLASS = SPA', $recB)), array(true, true), 'OR');
// ENF OR (14 AND PI=0) is true for A; the left-to-right reading ((ENF OR 14) AND PI=0) would be false.
eq(m('EMPL_CLASS = ENF OR OUC2D = 14 AND PI_ELIGIBLE = 0', $recA), true, 'AND binds before OR (what the help promises)');
eq(array(m('EMPL_CLASS = /^(EFX|ENF)$/', $recA), m('EMPL_CLASS = /^(EFX|ENF)$/', $recB)), array(true, false), 'a regex for one-of-several values (the help\'s example)');
eq(array(m('TAGS = CALS_PREAWARD', $recA), m('TAGS = CALS_PREAWARD', $recB)), array(true, false), 'TAGS = X: has the tag');
eq(m('TAGS = CALS', $recA), false, 'TAGS = CALS does not match CALS_PREAWARD (membership, not substring)');
eq(array(m('TAGS != CALS_PREAWARD', $recA), m('TAGS != CALS_PREAWARD', $recB)), array(false, true), 'TAGS != X: does not have it (no tags at all counts)');
eq(array(m('JOBCODE_PREFIX != UP', $recA), m('JOBCODE_PREFIX != UP', $recB)), array(false, true), 'JOBCODE_PREFIX, derived like the recipient variable');
eq(array(m('{PI_ELIGIBLE} = 0', $recA), m('{PI_ELIGIBLE} = 0', $recB)), array(false, true), 'braced spelling evaluates the same column');
eq(array(m('{ OUC2D } = 14 AND {pi_eligible} = 1', $recA), m('{ OUC2D } = 14 AND {pi_eligible} = 1', $recB)), array(true, false), 'spaced / lower-case braces evaluate the same columns');
eq(array(m('{TAGS} = CALS_PREAWARD OR {TAGS} = OSP_LEADS', $recA), m('{TAGS} = CALS_PREAWARD OR {TAGS} = OSP_LEADS', $recB)), array(true, false), 'the help\'s braced tag example');
eq(array(m('{EMPL_STATUS} = A AND {JOBCODE_PREFIX} != UP', $recA), m('{EMPL_STATUS} = A AND {JOBCODE_PREFIX} != UP', $recB)), array(false, true), 'the help\'s third example');
eq(m('EMPL_ID4 = 3456', $recA), true, 'EMPL_ID4 is the last four of the employee id');
eq(m('DEPT = "Chemical & Biomolecular Engr"', $recA), true, 'a quoted value with spaces');
eq(m('USERNAME = jdoe', $recA), true, 'USERNAME is the Unity ID');

// ---------------------------------------------------------------- 4. the record
echo "4. the person record (the recipient variables' shaping, plus TAGS)\n";
eq(array_keys($recA), penumbraSubCondColumns(), 'its keys are exactly the condition columns');
eq(array($recA['OUC2D'], $recA['OUC4D'], $recA['JOBCODE_PREFIX'], $recA['PI_ELIGIBLE'], $recB['PI_ELIGIBLE'], $recB['TAGS']),
   array('14', '1402', 'UP', '1', '0', ''), 'derived columns, PI_ELIGIBLE as text, no tags = empty');
eq(penumbraSubCondPersonRow(vrow(array('TAGS' => ' |fin| ')))['TAGS'], '|FIN|', 'TAGS trimmed and upper-cased');

// ---------------------------------------------------------------- 5. subscriber keys
echo "5. subscriber entry -> Unity ID\n";
eq(array(penumbraSubCondEntryKey(array('uid' => 'JDoe', 'email' => 'x@y.org')), penumbraSubCondEntryKey(array('email' => 'bsmith@ncsu.edu')),
         penumbraSubCondEntryKey(array('email' => 'pat@example.com')), penumbraSubCondEntryKey('nope')),
   array('jdoe', 'bsmith', '', ''), 'uid first, then a campus address, never an external one');

// ---------------------------------------------------------------- 6. the lookup
echo "6. penumbraSubCondLoadPeople: the view with TAGS, and it REPORTS failure\n";
$c = new FakeConn(); $c->queue[] = array($A, vrow(array('ACTIVE' => '0', 'OUC' => '999999')), $B);
$l = penumbraSubCondLoadPeople($c, array('JDoe', 'bsmith', 'bad id', ''));
$sql = preg_replace('/\s+/', ' ', $c->statements[0]->sql);
ok(strpos($sql, ', TAGS FROM PENUMBRA_PEOPLE_V WHERE UNITY_ID IN (:u0,:u1) OR EMAIL IN (:m0,:m1) ORDER BY ACTIVE DESC, LAST_SEEN DESC') !== false, 'one query on the view, UNITY_ID or unity@ncsu.edu, active + freshest first');
eq($c->statements[0]->binds, array(':u0' => 'jdoe', ':m0' => 'jdoe@ncsu.edu', ':u1' => 'bsmith', ':m1' => 'bsmith@ncsu.edu'), 'binds (ids lower-cased; a malformed id is never bound)');
eq(array($l['ok'], array_keys($l['people']), $l['people']['jdoe']['OUC']), array(true, array('jdoe', 'bsmith'), '140201'), 'the first row per person wins');
$c = new FakeConn(); $ids = array(); for ($i = 0; $i < 401; $i++) $ids[] = 'u' . $i;
penumbraSubCondLoadPeople($c, $ids);
eq(count($c->statements), 2, '401 ids -> two queries (400 per IN list)');
$c = new FakeConn(); $c->throwOnExecute = true;
eq(penumbraSubCondLoadPeople($c, array('jdoe'))['ok'], false, 'a failed query -> ok false (never "nobody found")');
eq(penumbraSubCondLoadPeople(null, array('jdoe'))['ok'], false, 'no connection -> ok false');

// ---------------------------------------------------------------- 7. the join gate
echo "7. penumbraSubCondPersonMatches (index.php chip, manage_subscription.php): fails CLOSED\n";
$c = new FakeConn(); $c->queue[] = array($A);
ok(penumbraSubCondPersonMatches($c, 'PI_ELIGIBLE = 1', 'jdoe'), 'a matching person may subscribe');
$c = new FakeConn(); $c->queue[] = array($B);
ok(!penumbraSubCondPersonMatches($c, 'PI_ELIGIBLE = 1', 'bsmith'), 'a non-matching person may not');
$c = new FakeConn(); $c->queue[] = array();
ok(!penumbraSubCondPersonMatches($c, 'PI_ELIGIBLE != 1', 'ghost'), 'no directory record -> no (even for a negative condition)');
$c = new FakeConn(); $c->throwOnExecute = true;
ok(!penumbraSubCondPersonMatches($c, 'PI_ELIGIBLE = 1', 'jdoe'), 'a failed lookup -> no');
$c = new FakeConn();
ok(!penumbraSubCondPersonMatches($c, 'FOO = 1', 'jdoe') && count($c->statements) === 0, 'an unusable condition -> no, without touching the database');
$c = new FakeConn(); $c->queue[] = array($A); $memo = array();
penumbraSubCondPersonMatches($c, 'PI_ELIGIBLE = 1', 'jdoe', $memo);
$second = penumbraSubCondPersonMatches($c, 'EMPL_CLASS = SPA', 'jdoe', $memo);
eq(array(count($c->statements), $second), array(1, false), 'the memo: a second condition for the same viewer costs no query');

// ---------------------------------------------------------------- 8. the send-time filter
echo "8. penumbraSubCondFilterEntries (the runner): fails SAFE\n";
$subs = array(array('uid' => 'jdoe', 'email' => 'jdoe@ncsu.edu'), array('uid' => 'bsmith', 'email' => 'bsmith@ncsu.edu'),
              array('uid' => 'ghost', 'email' => 'ghost@ncsu.edu'), array('email' => 'pat@example.com'));
$c = new FakeConn(); $c->queue[] = array($A, $B);
$f = penumbraSubCondFilterEntries($c, 'PI_ELIGIBLE = 1', $subs);
eq(array($f['checked'], count($f['allowed']), array_map(function ($e) { return $e['email']; }, $f['dropped'])),
   array(true, 1, array('bsmith@ncsu.edu', 'ghost@ncsu.edu', 'pat@example.com')), 'match stays; non-match, no record and no campus id are dropped');
// ONE subscriber, so the "returned nobody" guard below cannot mask this one.
$c = new FakeConn(); $c->throwOnExecute = true;
$f = penumbraSubCondFilterEntries($c, 'PI_ELIGIBLE = 1', array($subs[0]));
eq(array($f['checked'], count($f['allowed']), $f['dropped']), array(false, 1, array()), 'the directory could not be read -> nobody dropped');
$c = new FakeConn();
$f = penumbraSubCondFilterEntries($c, 'FOO = 1', $subs);
eq(array($f['checked'], count($f['dropped']), count($c->statements)), array(false, 0, 0), 'an unusable condition -> nobody dropped, no query');
$c = new FakeConn(); $c->queue[] = array();
$f = penumbraSubCondFilterEntries($c, 'PI_ELIGIBLE = 1', array_slice($subs, 0, 2));
eq(array($f['checked'], count($f['dropped'])), array(false, 0), 'the directory returned NOBODY for two subscribers -> treated as broken, nobody dropped');
$c = new FakeConn(); $c->queue[] = array();
$f = penumbraSubCondFilterEntries($c, 'PI_ELIGIBLE = 1', array($subs[2]));
eq(array($f['checked'], count($f['dropped'])), array(true, 1), 'ONE subscriber with no record is a real non-match -> dropped');

// ---------------------------------------------------------------- 9. the scan
echo "9. penumbraSubCondScanDirectory (the editor's preview)\n";
$c = new FakeConn(); $c->queue[] = array($A, $B, vrow(array('UNITY_ID' => 'cc', 'FIRST_NAME' => 'Cy', 'LAST_NAME' => 'Cole', 'EMAIL' => 'cc@ncsu.edu')));
$p = penumbraSubCondParse('OUC2D = 14');
$s = penumbraSubCondScanDirectory($c, $p['parsed'], 1);
ok(strpos(preg_replace('/\s+/', ' ', $c->statements[0]->sql), ', TAGS FROM PENUMBRA_PEOPLE_V WHERE ACTIVE = 1 ORDER BY LAST_NAME, FIRST_NAME') !== false, 'active people, alphabetical');
eq(array($s['ok'], $s['active'], $s['matches'], $s['samples']), array(true, 3, 2, array('Jane Doe')), 'counts every active row, matches, samples capped');
$c = new FakeConn(); $c->throwOnExecute = true;
eq(penumbraSubCondScanDirectory($c, $p['parsed'])['ok'], false, 'a failed scan says so');

// ---------------------------------------------------------------- 10. wiring
echo "10. the four consumers (text pins)\n";
$files = array('index.php', 'manage_subscription.php', 'manage_schedule.php', 'schedule_runner.php', 'js/main.js', 'help_content.php');
$missing = array();
foreach ($files as $f) { if (!is_file($app . DIRECTORY_SEPARATOR . $f)) $missing[] = $f; }
if ($missing) {
    echo "  (skipped: " . implode(', ', $missing) . " not in the app folder - pass it as the second argument)\n";
} else {
    $src = array();
    foreach ($files as $f) { $src[$f] = file_get_contents($app . DIRECTORY_SEPARATOR . $f); }
    $ix = $src['index.php'];
    ok(strpos($ix, "if (\$pnbSubCond !== '' && !\$pnbSubMine && !\$pnbSubIsTyped) {") !== false
        && strpos($ix, "if (!penumbraSubCondPersonMatches(\$oracleConn, \$pnbSubCond, \$pnbSubUid, \$pnbSubCondMemo)) continue;") !== false,
        'index.php: the chip skips a conditioned schedule for a non-matching viewer who does not already receive it');
    $ms = $src['manage_subscription.php'];
    $gate = strpos($ms, "if (\$subCond !== '' && \$action === 'subscribe' && !\$staleSuppressed && !\$isTyped) {");
    ok($gate !== false && $gate > strpos($ms, "This schedule is currently disabled") && strpos($ms, "!penumbraSubCondPersonMatches(\$conn, \$subCond, \$myUid)") !== false,
        'manage_subscription.php: subscribe (only) is refused for a non-match, after the disabled-schedule gate');
    $sc = $src['manage_schedule.php'];
    ok(strpos($sc, "'subscriptions_enabled', 'subscriptions_notify', 'subscriptions_condition', 'changes_only'") !== false, 'manage_schedule.php: the key is pruned from non-EMAIL tasks');
    ok(strpos($sc, "\$sub_cond_err = penumbraSubCondValidate(\$sub_cond);") !== false, 'manage_schedule.php: save refuses an unusable condition');
    ok(strpos($sc, "if (\$action === 'sub_condition_check') {") !== false && strpos($sc, "penumbraSubCondFilterEntries(\$conn, \$sc_cond, \$sc_subs)") !== false,
        'manage_schedule.php: the preview action uses the same send-time filter');
    $r = $src['schedule_runner.php'];
    $acc = strpos($r, "\$subAccess = _sr_filter_subscribers_by_access(");
    $cnd = strpos($r, "\$subCondRes = penumbraSubCondFilterEntries(\$conn, \$subCondExpr, \$subEntriesToMerge);");
    ok(strpos($r, "require_once dirname(__FILE__) . '/penumbra_subscribe_condition.php';") !== false, 'runner: requires the library');
    ok($acc !== false && $cnd !== false && $cnd > $acc && $cnd < strpos($r, "\$subExisting = array();", $acc), 'runner: the condition prune runs after the access prune, before the merge');
    ok(strpos($r, "'via' => 'auto_condition_unmet'") !== false && strpos($r, "; nobody removed.\");") !== false, 'runner: audited as its own reason; an unchecked run removes nobody');
    $mj = $src['js/main.js'];
    ok(strpos($mj, "subscriptions_condition: \$('#schedSubsCondEnable').is(':checked') ? String(\$('#schedSubsCondExpr').val() || '').trim() : ''") !== false, 'main.js: the save payload carries the condition only when the option is on');
    ok(strpos($mj, "if (taskType === 'EMAIL' && !_schedSubsCondSaveGuard(showError)) return;") !== false && strpos($mj, "action: 'sub_condition_check'") !== false, 'main.js: the save guard and the live check');
    // The card's ONE "?" sits after the Subscriptions label and opens the whole Subscriptions help
    // (2026-09-23 night: it used to sit after "Allow only on custom condition").
    $hp = $src['help_content.php'];
    ok(strpos($ix, '<label style="padding-top: 6px;">Subscriptions: <span class="tab-help-icon" data-target="#schedulerHelpLightbox" data-jump-to="schedHelp-subscriptions"') !== false
        && strpos($hp, '<h4 id="schedHelp-subscriptions">Subscriptions (self-service recipients)</h4>') !== false,
        'help: the Subscriptions label\'s "?" lands on the Subscriptions section');
    $opt = strpos($ix, '<span id="schedSubsCondOpt"');
    $optEnd = ($opt === false) ? false : strpos($ix, '</span>', strpos($ix, '</label>', $opt));
    ok($opt !== false && $optEnd !== false && strpos(substr($ix, $opt, $optEnd - $opt), 'tab-help-icon') === false
        && strpos($ix, 'data-jump-to="schedHelp-subsCondition"') === false && strpos($hp, '<li id="schedHelp-subsCondition">') !== false,
        'the condition option carries no "?" of its own (its section is still a jump target from the chart)');
    ok(strpos($ix, 'title="Only people whose employee-directory record matches the condition see the Subscribe option for this schedule.') !== false
        && strpos($ix, 'matches a condition can subscribe') === false, 'the option\'s tooltip says who SEES the Subscribe option (not "can subscribe")');
    ok(strpos($ix, 'placeholder="e.g. {OUC2D} = 14 AND {PI_ELIGIBLE} = 1   or   {TAGS} = CALS_PREAWARD"') !== false, 'the input\'s placeholder uses braces');
    ok(strpos($mj, '<code>{OUC2D} = 14 AND {PI_ELIGIBLE} = 1</code> or <code>{TAGS} = CALS_PREAWARD</code>') !== false, 'main.js: the empty-condition prompt uses braces');
    $li = strpos($hp, '<li id="schedHelp-subsCondition">');
    $liText = ($li === false) ? '' : substr($hp, $li, strpos($hp, '</li>', $li) - $li);
    ok(strpos($liText, 'Examples: <code>{OUC2D} = 14 AND {PI_ELIGIBLE} = 1</code> &middot; <code>{TAGS} = CALS_PREAWARD OR {TAGS} = OSP_LEADS</code> &middot; <code>{EMPL_STATUS} = A AND {JOBCODE_PREFIX} != UP</code>.') !== false
        && strpos($liText, 'The braces are optional (<code>OUC2D = 14</code> reads the same)') !== false
        && preg_match_all('/<code>[A-Z_0-9]+ (=|!=)/', $liText) === 1,
        'help: braced examples (the suite matches each one above); the ONE bare example is the "braces are optional" note');
    ok(strpos($hp, 'Subscriptions custom condition</a> uses them too (plus <code>{TAGS}</code>') !== false, 'help: the Recipient Variables chart intro lists the subscription condition');
}

echo "\nPASS: $PASS   FAIL: $FAIL\n";
echo 'RESULT: ' . ($FAIL === 0 ? 'GREEN' : 'RED') . "\n";
