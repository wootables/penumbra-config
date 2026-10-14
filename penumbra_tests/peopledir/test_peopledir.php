<?php
/**
 * peopledir - pins the people-directory resolvers in penumbra_directory.php
 * (the six readers that moved from COI_CHECK_COMPLIANCE to PENUMBRA_PEOPLE on
 * 2026-09-23): what SQL each one sends, what it binds, how it shapes a row, how
 * it batches, and the one rule that must never regress - SUPERVISOR_EMAIL is
 * another person's address and is never matched as the person's own.
 *
 *   php -n test_peopledir.php <path-to-penumbra_directory.php>
 *
 * The database is a hand-written fake (FakeConn/FakeStmt below) that records
 * every prepared statement and its binds and hands back canned rows. Requires
 * the SHIPPED file straight from the app (or a stage) folder - never a copy.
 * Tail must read "PASS: N   FAIL: 0" then "RESULT: GREEN".
 */
$lib = isset($argv[1]) ? $argv[1] : '';
// The app folder for section 9's wiring pins (a mutant run hands a temp copy as $lib).
$app = (isset($argv[2]) && $argv[2] !== '') ? rtrim($argv[2], '/' . DIRECTORY_SEPARATOR) : dirname($lib);
if (!is_file($lib)) { echo "library not found: $lib\n"; echo "RESULT: RED\n"; return; }
$_SERVER['SCRIPT_FILENAME'] = __FILE__;   // the library refuses direct web access by comparing basenames
// The resolvers error_log() a database failure; under php -n that is stderr, which
// PowerShell 5.1 turns into a terminating error. Park it in a temp file instead.
ini_set('error_log', sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'penumbra_peopledir_errlog_' . getmypid() . '.txt');
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
    public function last() { return end($this->statements); }
}
function person($over = array()) {
    return array_merge(array(
        'EMPLID' => '000123456', 'UNITY_ID' => 'jdoe', 'FIRST_NAME' => 'Jane', 'LAST_NAME' => 'Doe', 'PREFERRED_NAME' => 'Jane Doe',
        'EMAIL' => 'jdoe@ncsu.edu', 'SUPERVISOR_EMAIL' => 'boss@ncsu.edu', 'OUC' => '140201', 'DEPT_NAME' => 'Chemical & Biomolecular Engr',
        'ACTIVE' => '1', 'JOB_TITLE' => 'Professor', 'EMPL_CLASS' => 'EFX', 'PI_ELIGIBLE' => '1',
        'JOBCODE' => '3456', 'EMPL_STATUS' => 'A',
    ), $over);
}
function sqlOneLine($s) { return preg_replace('/\s+/', ' ', $s); }
/** Named functions lifted out of a source file by the tokenizer (the runner is never require'd). */
function liftFns($src, $names) {
    $t = token_get_all($src); $n = count($t); $out = ''; $found = array();
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && ((is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) || (!is_array($t[$j]) && $t[$j] === '&'))) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;
        $fname = $t[$j][1];
        if (!in_array($fname, $names, true)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) {
                if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; $started = true; }
                $buf .= $tok[1];
            } else {
                if ($tok === '{') { $depth++; $started = true; } elseif ($tok === '}') { $depth--; }
                $buf .= $tok;
            }
            if ($started && $depth === 0) break;
        }
        $out .= "if (!function_exists('$fname')) {\n$buf\n}\n";
        $found[] = $fname;
    }
    $missing = array_diff($names, $found);
    if ($missing) { echo "  FAIL lift: missing from source: " . implode(', ', $missing) . "\n"; $GLOBALS['FAIL']++; }
    return $out;
}

// ------------------------------------------------------------- 1. shaping
echo "1. penumbraPeopleRowToDetails\n";
$d = penumbraPeopleRowToDetails(person());
eq(array($d['found'], $d['empl_id'], $d['ouc'], $d['ouc2d'], $d['ouc4d'], $d['ouc6d'], $d['dept'], $d['fname'], $d['lname']),
   array(true, '000123456', '140201', '14', '1402', '140201', 'Chemical & Biomolecular Engr', 'Jane', 'Doe'), 'the eight legacy keys keep their meaning');
eq(array($d['unity'], $d['email'], $d['supervisor_email'], $d['active'], $d['title'], $d['empl_class'], $d['pi_eligible'], $d['pname']),
   array('jdoe', 'jdoe@ncsu.edu', 'boss@ncsu.edu', 1, 'Professor', 'EFX', 1, 'Jane Doe'), 'the new keys');
ok(!array_key_exists('email_alias', $d), "no 'email_alias' key: HR EMAIL_ADDR is the supervisor's address, not an alias");
eq(array($d['jobcode'], $d['jobcode_prefix'], $d['empl_status']), array('3456', '34', 'A'), 'the 2026-09-23 keys: job code, its first two characters, employee status');
$d = penumbraPeopleRowToDetails(person(array('JOBCODE' => '', 'EMPL_STATUS' => '')));
eq(array($d['jobcode'], $d['jobcode_prefix'], $d['empl_status']), array('', '', ''), 'no job code: all three empty strings, never a warning');
ok(strpos(penumbraPeopleColumns(), 'JOBCODE') !== false && strpos(penumbraPeopleColumns(), 'EMPL_STATUS') !== false, 'the column list reads JOBCODE and EMPL_STATUS (what the new variables come from)');
// Every active appointment (2026-09-23 night): OUCS_ALL from the sync, the primary OUC first.
$d = penumbraPeopleRowToDetails(person(array('OUCS_ALL' => '061401|140201')));
eq(array($d['oucs_all'], $d['oucs'], $d['oucs2d'], $d['oucs4d'], $d['oucs6d']), array('061401|140201', '140201|061401', '14|06', '1402|0614', '140201|061401'), 'oucs: the primary OUC first, then the other appointments; the 2/4-digit lists are distinct prefixes in the same order');
$d = penumbraPeopleRowToDetails(person(array('OUCS_ALL' => '140201|140305|141001')));
eq(array($d['oucs'], $d['oucs2d'], $d['oucs4d']), array('140201|140305|141001', '14', '1402|1403|1410'), 'three appointments in one college: one college, three divisions');
$d = penumbraPeopleRowToDetails(person(array('OUCS_ALL' => '')));
eq(array($d['oucs'], $d['oucs2d'], $d['oucs4d'], $d['oucs6d']), array('140201', '14', '1402', '140201'), 'no active appointment (OUCS_ALL empty): the primary OUC is the one entry, never an empty list');
$d = penumbraPeopleRowToDetails(person(array('OUCS_ALL' => ' 061401 | |140201 ', 'OUC' => '')));
eq(array($d['ouc'], $d['oucs'], $d['oucs2d']), array('', '061401|140201', '06|14'), 'no primary OUC: the list stands on its own, blanks and padding dropped');
$d = penumbraPeopleRowToDetails(null);
eq(array($d['oucs'], $d['oucs2d'], $d['oucs4d'], $d['oucs6d'], $d['oucs_all']), array('', '', '', '', ''), 'no row: every list key is an empty string');
ok(strpos(penumbraPeopleColumns(), 'OUCS_ALL') !== false, 'the column list reads OUCS_ALL');
$d = penumbraPeopleRowToDetails(person(array('SOURCE' => 'MANUAL', 'KIND' => 'group')));
eq(array($d['source'], $d['kind']), array('MANUAL', 'group'), 'a hand-registered account says so: source MANUAL, kind group (2026-09-25)');
eq(array(penumbraPeopleRowToDetails(person())['source'], penumbraPeopleRowToDetails(person())['kind']), array('HR', 'person'), 'an HR row without the columns reads HR / person (the defaults)');
ok(strpos(penumbraPeopleColumns(), 'SOURCE, KIND') !== false, 'the column list reads SOURCE and KIND');
$d = penumbraPeopleRowToDetails(person(array('UNITY_ID' => 'JDOE', 'EMAIL' => 'JDoe@NCSU.EDU', 'ACTIVE' => '0', 'PI_ELIGIBLE' => '0', 'OUC' => '06')));
eq(array($d['unity'], $d['email'], $d['active'], $d['pi_eligible'], $d['ouc2d'], $d['ouc4d']), array('jdoe', 'jdoe@ncsu.edu', 0, 0, '06', '06'), 'ids lower-cased, flags numeric, a short OUC does not overflow its slices');
$d = penumbraPeopleRowToDetails(null);
eq(array($d['found'], $d['ouc'], $d['dept'], $d['fname'], $d['empl_id']), array(false, '', '', '', ''), 'no row = found false and empty strings (what the runner substitutes into {OUC}/{DEPT})');
eq(penumbraPeopleUnityKey(penumbraPeopleRowToDetails(person(array('UNITY_ID' => '')))), 'jdoe', 'a person without a Unity ID is keyed by the email local part');
eq(penumbraPeopleUnityKey(penumbraPeopleRowToDetails(person(array('UNITY_ID' => '', 'EMAIL' => '')))), '', 'no id at all: empty key (the caller skips it)');

// ------------------------------------------------------- 2. lookup by email
echo "2. penumbraPeopleLookupByEmail\n";
$c = new FakeConn(); $c->queue[] = array(person());
$d = penumbraPeopleLookupByEmail($c, '  JDoe@NCSU.edu ');
$st = $c->last();
eq($d['found'], true, 'found');
eq($st->binds, array(':e1' => 'jdoe@ncsu.edu', ':u' => 'jdoe'), 'binds the lower-cased address AND its local part as a Unity ID');
ok(strpos($st->sql, 'WHERE EMAIL = :e1 OR UNITY_ID = :u') !== false, 'matches EMAIL or UNITY_ID');
ok(strpos($st->sql, 'SUPERVISOR_EMAIL =') === false && strpos($st->sql, 'SUPERVISOR_EMAIL LIKE') === false, 'NEVER matches the supervisor address as the person');
ok(strpos($st->sql, 'ORDER BY ACTIVE DESC, LAST_SEEN DESC FETCH FIRST 1 ROWS ONLY') !== false, 'one row: active first, then freshest');
ok(strpos($st->sql, 'LOWER(') === false && strpos($st->sql, 'SUBSTR(') === false, 'no function wraps a column in the WHERE (the indexes stay usable)');
$c = new FakeConn(); $c->queue[] = array();
eq(penumbraPeopleLookupByEmail($c, 'nobody@example.org')['found'], false, 'unknown address: found false, no exception');
$c = new FakeConn();
eq(count($c->statements) + (penumbraPeopleLookupByEmail($c, 'not-an-email')['found'] ? 1 : 0), 0, 'a value without @ never reaches the database');
eq(penumbraPeopleLookupByEmail(null, 'x@y')['found'], false, 'no connection: found false');
$c = new FakeConn(); $c->throwOnExecute = true; $c->queue[] = array(person());
eq(penumbraPeopleLookupByEmail($c, 'jdoe@ncsu.edu')['found'], false, 'a database error reads as not found (never throws into the runner)');

// ------------------------------------------------------- 3. lookup by unity
echo "3. penumbraPeopleLookupByUnity\n";
$c = new FakeConn();
$c->queue[] = array(person(array('UNITY_ID' => 'jdoe', 'ACTIVE' => '1')), person(array('UNITY_ID' => 'jdoe', 'ACTIVE' => '0', 'OUC' => '999999')), person(array('UNITY_ID' => '', 'EMAIL' => 'nouid@ncsu.edu', 'EMPLID' => '2')));
$m = penumbraPeopleLookupByUnity($c, array(' JDoe ', 'nouid', 'jdoe', '', 'bad id!'));
$st = $c->last();
eq(array_keys($m), array('jdoe', 'nouid'), 'keyed by lower-cased Unity ID; a row without one is keyed by its email local part');
eq($m['jdoe']['ouc'], '140201', 'when two rows share an id the first (active) one wins');
eq($st->binds[':u0'], 'jdoe', 'ids trimmed, lower-cased and de-duplicated before binding');
eq($st->binds[':m0'], 'jdoe@ncsu.edu', 'each id is also tried as unity@ncsu.edu on EMAIL');
ok(!isset($st->binds[':u2']), "an unsafe id ('bad id!') and an empty one are dropped");
ok(strpos($st->sql, 'UNITY_ID IN (:u0,:u1) OR EMAIL IN (:m0,:m1)') !== false, 'one IN list per side');
ok(preg_match('/SUPERVISOR_EMAIL\s*(=|LIKE|IN)\b/', $st->sql) === 0, 'the supervisor address is selected but never a match key');
$c = new FakeConn(); $ids = array(); for ($i = 0; $i < 450; $i++) $ids[] = 'u' . $i;
penumbraPeopleLookupByUnity($c, $ids);
eq(count($c->statements), 2, '450 ids -> two statements (400 per chunk; two binds per id stay under the 1000 cap)');
eq(penumbraPeopleLookupByUnity($c, array()), array(), 'no ids: no query');

// ------------------------------------------------------ 4. search (picker)
echo "4. penumbraPeopleSearch\n";
$c = new FakeConn(); $c->queue[] = array(person());
$r = penumbraPeopleSearch($c, ' jane   Doe ', 15);
$st = $c->last();
eq(count($r), 1, 'rows come back as details');
eq($st->binds, array(':k0' => '%JANE%', ':p0' => 'jane%', ':t0' => 'JANE%', ':k1' => '%DOE%', ':p1' => 'doe%', ':t1' => 'DOE%'), 'per keyword: a contains bind for names (upper), a prefix bind for ids (lower) and a prefix bind for tags (upper, 2026-09-25)');
ok(strpos($st->sql, 'EXISTS (SELECT 1 FROM PENUMBRA_PEOPLE_TAGS T WHERE T.EMPLID = PENUMBRA_PEOPLE.EMPLID AND T.TAG LIKE :t0)') !== false, 'a keyword also matches a tag prefix, so PREAWARD finds every tagged account whatever its name says');
ok(substr_count($st->sql, ') AND (') === 1, 'keywords are AND-ed (both must match)');
ok(strpos($st->sql, 'UPPER(FIRST_NAME) LIKE :k0 OR UPPER(LAST_NAME) LIKE :k0 OR UPPER(PREFERRED_NAME) LIKE :k0 OR EMAIL LIKE :p0 OR UNITY_ID LIKE :p0') !== false, 'names by contains, email and Unity ID by prefix');
ok(preg_match('/SUPERVISOR_EMAIL\s*(=|LIKE|IN)\b/', $st->sql) === 0, 'the picker never matches on the supervisor address');
ok(strpos($st->sql, 'ORDER BY ACTIVE DESC, LAST_NAME, FIRST_NAME FETCH FIRST 15 ROWS ONLY') !== false, 'active people first, then by name, capped');
$c = new FakeConn();
eq(penumbraPeopleSearch($c, '   ', 15), array(), 'blank term: nothing, no query');
eq(count($c->statements), 0, '...really no query');
$c = new FakeConn(); $c->queue[] = array();
penumbraPeopleSearch($c, 'x', 9999);
ok(strpos($c->last()->sql, 'FETCH FIRST 200 ROWS ONLY') !== false, 'the limit is clamped to 200');

// ------------------------------------------------------- 5. owner by name
echo "5. penumbraPeopleUnityByName\n";
$c = new FakeConn(); $c->queue[] = array(array('UNITY_ID' => 'JDOE'), array('UNITY_ID' => 'jdoe'), array('UNITY_ID' => ' '));
eq(penumbraPeopleUnityByName($c, 'Doe', 50), array('jdoe'), 'lower-cased, de-duplicated, blanks dropped');
$st = $c->last();
eq($st->binds, array(':n1' => '%Doe%', ':n2' => '%Doe%'), 'contains match on the term');
ok(strpos($st->sql, "UPPER(FIRST_NAME || ' ' || LAST_NAME) LIKE UPPER(:n1)") !== false && strpos($st->sql, "UPPER(PREFERRED_NAME || ' ' || LAST_NAME) LIKE UPPER(:n2)") !== false, 'matches "First Last" and "Preferred Last"');
ok(strpos($st->sql, 'UNITY_ID IS NOT NULL') !== false, 'only people with a Unity ID (OWNER_ID is a Unity ID)');
eq(penumbraPeopleUnityByName($c, '', 50), array(), 'empty term: nothing');

// ------------------------------------------------- 6. departments under OUC
echo "6. penumbraPeopleDepartmentsUnder\n";
$c = new FakeConn(); $c->queue[] = array(array('OUC' => '140201', 'DEPT_NAME' => 'Chem Engr', 'CNT' => '119'), array('OUC' => '140101', 'DEPT_NAME' => 'Engr Dean', 'CNT' => '40'));
$r = penumbraPeopleDepartmentsUnder($c, '14', 50);
eq($r, array(array('ouc' => '140201', 'dept' => 'Chem Engr', 'people' => 119), array('ouc' => '140101', 'dept' => 'Engr Dean', 'people' => 40)), 'rows shaped as ouc/dept/people, in the order Oracle gave (most people first)');
$st = $c->last();
eq($st->binds, array(':pfx' => '14%'), 'prefix bind');
ok(strpos($st->sql, "WHERE OUC LIKE :pfx AND ACTIVE = 1 AND KIND = 'person' GROUP BY OUC, DEPT_NAME") !== false, 'active PEOPLE only (never a hand-registered account), grouped by department');
foreach (array('1', '1234567', '14x', '') as $badP) { eq(penumbraPeopleDepartmentsUnder($c, $badP, 50), array(), "'$badP' is not a 2/4/6-digit prefix: nothing"); }

// ---------------------------------------------------- 7. people in OUCs
echo "7. penumbraPeopleInOucs\n";
$c = new FakeConn(); $c->queue[] = array(array('UNITY_ID' => 'ADOE', 'FIRST_NAME' => 'Al', 'LAST_NAME' => 'Doe'), array('UNITY_ID' => 'adoe', 'FIRST_NAME' => 'Al', 'LAST_NAME' => 'Doe'), array('UNITY_ID' => 'bdoe', 'FIRST_NAME' => ' Bo ', 'LAST_NAME' => 'Doe'));
$m = penumbraPeopleInOucs($c, array('14', '1402', 'xx', '14'), 500);
eq($m, array('adoe' => 'Al Doe', 'bdoe' => 'Bo Doe'), 'unity => "First Last", lower-cased, de-duplicated, trimmed');
$st = $c->last();
eq($st->binds, array(':o0' => '14%', ':o1' => '1402%'), 'one prefix bind per valid OUC, invalid ones dropped');
ok(strpos($st->sql, "WHERE ACTIVE = 1 AND KIND = 'person' AND UNITY_ID IS NOT NULL AND (OUC LIKE :o0 OR OUC LIKE :o1)") !== false, 'active PEOPLE with a Unity ID in any of the OUCs (a group account in the OUC is not mailed as a person)');
ok(strpos($st->sql, 'FETCH FIRST 500 ROWS ONLY') !== false, 'capped');
$c = new FakeConn();
eq(penumbraPeopleInOucs($c, array('xx'), 500), array(), 'no valid prefix: nothing, no query');
eq(count($c->statements), 0, '...really no query');

// ------------------------------------------- 8. analytics department map
echo "8. penumbraLookupDepartments (analytics map shape)\n";
$c = new FakeConn(); $c->queue[] = array(person(), person(array('UNITY_ID' => 'noouc', 'OUC' => '', 'DEPT_NAME' => '')), person(array('UNITY_ID' => 'onlyname', 'OUC' => '', 'DEPT_NAME' => 'Somewhere')));
$m = penumbraLookupDepartments($c, array('jdoe', 'noouc', 'onlyname'));
eq($m['jdoe'], array('raw' => '140201-Chemical & Biomolecular Engr', 'ouc' => '140201', 'dept' => 'Chemical & Biomolecular Engr'), "the map keeps its raw/ouc/dept shape; raw is rebuilt as 'OUC-Name'");
ok(!isset($m['noouc']), 'a person with neither OUC nor department is left out, as before');
eq($m['onlyname'], array('raw' => 'Somewhere', 'ouc' => '', 'dept' => 'Somewhere'), 'a department without a code keeps just the name');
eq(penumbraDepartmentLabel($m['jdoe']), 'Chemical & Biomolecular Engr', 'the legacy label helper still yields the bare name from the new map');

// --------------------------------------------------------------- 9. wiring
echo "9. recipient-variable wiring across the app (text pins for the 2026-09-23 HR variables)\n";
$five  = array('{JOBCODE}', '{JOBCODE_PREFIX}', '{EMPL_CLASS}', '{EMPL_STATUS}', '{PI_ELIGIBLE}',
               '{OUCS}', '{OUCS2D}', '{OUCS4D}', '{OUCS6D}');   // + the multi-valued four (2026-09-23 night)
$wired = array(
    'schedule_runner.php' => 'runner', 'penumbra_search.php' => 'filter engine', 'manage_schedule.php' => 'save gate',
    'js/main.js' => 'scheduler UI', 'js/search_builder.js' => 'builder token list', 'index.php' => 'form "?" icons', 'help_content.php' => 'help',
    'get_email_recipients.php' => 'picker endpoint',
);
$missing = array();
foreach ($wired as $f => $what) { if (!is_file($app . DIRECTORY_SEPARATOR . $f)) $missing[] = $f; }
if ($missing) {
    echo "  (skipped: " . implode(', ', $missing) . " not beside the library - pass the app folder as the second argument)\n";
} else {
    $src = array();
    foreach ($wired as $f => $what) { $src[$f] = file_get_contents($app . DIRECTORY_SEPARATOR . $f); }
    foreach ($wired as $f => $what) {
        if ($f === 'get_email_recipients.php' || $f === 'manage_schedule.php') continue;   // keys / a regex, not brace tokens (checked below)
        if ($f === 'index.php') continue;   // lists no tokens since 2026-09-23 pm: its "?" icons open the help chart (checked below)
        $gone = array();
        foreach ($five as $t) { if (strpos($src[$f], $t) === false) $gone[] = $t; }
        eq($gone, array(), "$what ($f) names all nine 2026-09-23 tokens");
    }
    // The scheduler form stopped LISTING the variables under Subject Line / Body Preamble
    // (2026-09-23 pm): a "?" after each label opens the Recipient Variables chart in the
    // scheduler help, so that chart is now the one list a new variable must reach - and the
    // recipient pill hover, which the Recipients placeholder now advertises, must show them all.
    $all = array('{FNAME}', '{LNAME}', '{USERNAME}', '{EMAIL}', '{OUC}', '{OUC2D}', '{OUC4D}', '{OUC6D}', '{DEPT}',
                 '{EMPL_ID}', '{EMPL_ID4}', '{JOBCODE}', '{JOBCODE_PREFIX}', '{EMPL_CLASS}', '{EMPL_STATUS}', '{PI_ELIGIBLE}',
                 '{OUCS}', '{OUCS2D}', '{OUCS4D}', '{OUCS6D}');
    $ix = $src['index.php'];
    eq(substr_count($ix, 'data-target="#schedulerPromptHelpLightbox" data-jump-to="schedDyn-recipientVars"'), 2, 'form: Subject Line and Body Preamble each carry a "?" that opens the Recipient Variables chart');
    ok(strpos($ix, '<code>{PI_ELIGIBLE}</code>') === false, 'form: the inline token lists under the two fields are gone');
    ok(strpos($ix, 'Hover a recipient pill to see all their recipient variables') !== false, 'form: the Recipients placeholder points at the pill hover');
    $h = $src['help_content.php'];
    $tStart = strpos($h, '<div id="schedulerPromptHelpLightbox"');
    // The topic ends where the NEXT topic starts - searched from past this topic's own opening tag.
    $tEnd = ($tStart === false) ? false : strpos($h, 'class="help-topic"', strpos($h, '>', $tStart));
    $topic = ($tStart === false) ? '' : substr($h, $tStart, ($tEnd === false ? strlen($h) : $tEnd) - $tStart);
    $aPos = strpos($topic, 'id="schedDyn-recipientVars"');
    ok($aPos !== false, 'help: the anchor the "?" icons jump to sits inside the topic they open (a missing one lands on the topic top, silently)');
    $chart = '';
    if ($aPos !== false) { $tb = strpos($topic, '</table>', $aPos); $chart = substr($topic, $aPos, ($tb === false ? strlen($topic) : $tb) - $aPos); }
    $gone = array();
    foreach ($all as $t) { if (!preg_match('~<td[^>]*><code>' . preg_quote($t, '~') . '</code></td><td[^>]*>[^<]+</td><td[^>]*>[^<]+</td>~', $chart)) $gone[] = $t; }
    eq($gone, array(), 'help: the chart has a row with a description and an example for every recipient variable');
    // ONE chart (2026-09-23 evening): the Scheduler "Variables" and Search Filter help kept their own
    // hand-written tables and drifted (the Search Filter copy had no examples). They now hold a
    // [data-pnb-rv-chart] placeholder that main.js fills with a copy of this chart at load.
    ok(strpos($chart, 'id="pnbRecipientVarsChart"') !== false, 'help: the Dynamic Values chart is THE source table (#pnbRecipientVarsChart)');
    $topicOf = function ($id) use ($h) {
        $s = strpos($h, '<div id="' . $id . '"');
        if ($s === false) return '';
        $e = strpos($h, 'class="help-topic"', strpos($h, '>', $s));
        return substr($h, $s, ($e === false ? strlen($h) : $e) - $s);
    };
    $ph = array();
    foreach (array('schedulerHelpLightbox', 'searchFilterHelpLightbox') as $tid) $ph[$tid] = substr_count($topicOf($tid), 'data-pnb-rv-chart');
    eq($ph, array('schedulerHelpLightbox' => 1, 'searchFilterHelpLightbox' => 1), 'help: the Scheduler Variables and Search Filter sections each hold one placeholder for the chart copy');
    eq(substr_count($h, '<code>{JOBCODE_PREFIX}</code></td>'), 1, 'help: no hand-written variable table left outside the chart (the copies drifted apart once)');
    eq(substr_count($chart, '<tr class="pnb-rv-nonrecip">'), 2, 'help: {ROW_COUNT} and {SEND_*} are marked not-per-recipient, so the copies leave them out');
    $mj = $src['js/main.js'];
    ok(preg_match('~\$\(\'#helpContentContainer\'\)\.html\(html\);\s*_pnbFillRecipientVarCharts\(\$\(\'#helpContentContainer\'\)\);~', $mj) === 1
        && strpos($mj, "\$copy.removeAttr('id').find('.pnb-rv-nonrecip').remove();") !== false, 'main.js: the placeholders are filled the moment help loads, without the not-per-recipient rows');
    ok(strpos($mj, "$('#schedSubjectLabel').text(") === false && substr_count($mj, "$('#schedSubjectLabelText').text(") === 3, 'main.js: the per-type relabel writes the text span, never the whole label (that would wipe the "?")');
    ok(substr_count($mj, "$('#schedSubjectVarsHelp').show();") === 1 && substr_count($mj, "$('#schedSubjectVarsHelp').hide();") === 2, 'main.js: the subject "?" shows for Email tasks only (hidden under Snapshot Name and Label)');
    $vl = preg_match('~var varList = \[(.*?)\];~s', $mj, $vm) ? $vm[1] : '';
    $gone = array();
    foreach ($all as $t) { if (strpos($vl, "['" . $t . "'") === false) $gone[] = $t; }
    eq($gone, array(), 'main.js: the recipient pill hover lists every recipient variable');
    // Detection regexes: JOBCODE_PREFIX must precede JOBCODE (the EMPL_ID4 / EMPL_ID trap again).
    foreach (array('schedule_runner.php', 'manage_schedule.php', 'js/main.js') as $f) {
        preg_match_all('/EMPL_ID4\|EMPL_ID\|([A-Z_|]+)\)/', $src[$f], $mm);
        $okOrder = count($mm[1]) > 0;
        foreach ($mm[1] as $alts) { if (strpos($alts, 'JOBCODE_PREFIX|JOBCODE|') !== 0) $okOrder = false; }
        ok($okOrder, "$f: every detection regex lists JOBCODE_PREFIX before JOBCODE, after EMPL_ID (" . count($mm[1]) . ' found)');
    }
    eq(substr_count($src['js/main.js'], 'JOBCODE_PREFIX|JOBCODE|EMPL_CLASS|EMPL_STATUS|PI_ELIGIBLE)'), 3, 'main.js: all three client regexes extended (per-recipient detection, the me() guard, the condition validator)');
    // The multi-valued family (2026-09-23 night) sits ahead of the single OUC tokens, longest first, in every detection regex.
    foreach (array('schedule_runner.php', 'manage_schedule.php', 'js/main.js') as $f) {
        eq(substr_count($src[$f], 'EMAIL|OUCS2D|OUCS4D|OUCS6D|OUCS|OUC2D|OUC4D|OUC6D|DEPT|OUC|EMPL_ID4'), preg_match_all('/EMPL_ID4\|EMPL_ID\|[A-Z_|]+\)/', $src[$f]), "$f: every detection regex lists OUCS2D/OUCS4D/OUCS6D/OUCS ahead of OUC2D/OUC4D/OUC6D/OUC");
    }
    // The custom skip condition (2026-09-23): resolved per recipient, and a per-recipient trigger on its own.
    $r = $src['schedule_runner.php'];
    ok(strpos($r, "penumbra_pr_has_recipient_token((string)\$options['custom_condition_expr'])") !== false, 'runner: a recipient variable in the custom skip condition is detected ($condHasRecipVars)');
    ok(strpos($r, '!$filterHasRecipVars && !$condHasRecipVars && isset($options[\'skip_custom_condition\'])') !== false, 'runner: the broadcast evaluation stands down when the condition needs a recipient');
    ok(strpos($r, 'if (!$usesPerRecipientVars && $condHasRecipVars) {') !== false, 'runner: such a condition promotes the task to individual sends');
    ok(strpos($r, 'evaluate_custom_condition(_sr_substitute_recipient_vars_sql($customCondExpr, $r), $prCondFlatData') !== false, 'runner: the per-recipient query path resolves the condition for the recipient first');
    ok(strpos($r, 'evaluate_custom_condition(_sr_substitute_recipient_vars_sql($prfCondExpr, $r), $prfFlatData') !== false, 'runner: the per-recipient filter path too');
    ok(strpos($r, '$prsCondExpr = _sr_substitute_recipient_vars_sql(trim((string)$options[\'custom_condition_expr\']), $r);') !== false && strpos($r, 'evaluate_custom_condition($prsCondExpr, $snippetFlatData, $snippetColumns') !== false, 'runner: the shared-data path evaluates the resolved condition per recipient against the shared rows');
    // Tested NORMALIZED since 2026-09-23 late ("{ PI_ELIGIBLE }" = "{PI_ELIGIBLE}", like the runner; the bracespace suite owns that).
    ok(strpos($src['js/main.js'], "re.test(_pnbCanonBraceTokens($('#schedCustomConditionExpr').val() || ''))") !== false, 'main.js: the form counts a condition with a variable as a per-recipient trigger');
    ok(strpos($src['js/main.js'], 'if (!hasFunction) hasFunction = /') !== false, 'main.js: the condition validator accepts a recipient variable in place of a snippet function');
    $r = $src['schedule_runner.php'];
    eq(substr_count($r, "'{JOBCODE_PREFIX}'"), substr_count($r, "'{EMPL_ID4}'"), 'runner: every {EMPL_ID4} site (maps and token lists) carries {JOBCODE_PREFIX} too - no map left behind');
    eq(substr_count($r, "'JOBCODE_PREFIX' =>"), substr_count($r, "'EMPL_ID4' =>"), 'runner: the SQL substitution map carries the new keys');
    ok(strpos($r, "substr(\$s, \$i, 32)") !== false, 'runner: the SQL probe window is 32 characters ({JOBCODE_PREFIX} is exactly 16, the old window)');
    ok(substr_count($r, "isset(\$r['jobcode_prefix'])") >= 3, 'runner: the personalization closure and both filter-indicator maps read jobcode_prefix from the recipient row');
    ok(strpos($r, "'jobcode_prefix' => isset(\$coiDetails['jobcode_prefix'])") !== false, 'runner: the recipient row is assembled with the new keys from the directory details');
    ok(strpos($src['penumbra_search.php'], "'{JOBCODE_PREFIX}' => isset(\$recipientVars['jobcode_prefix'])") !== false, 'filter engine: its own map (php_apply_search_filter) carries the new keys');
    // The {OUCS} family (2026-09-23 night): one renderer per engine, every site wired.
    eq(substr_count($r, "'{PI_ELIGIBLE}', '{OUCS}', '{OUCS2D}', '{OUCS4D}', '{OUCS6D}')"), 4, 'runner: all four token lists (query, filter, per-recipient, personalization) end with the four multi-valued tokens');
    eq(substr_count($r, ') + penumbraRecipientListFilterMap($'), 3, 'runner: the filter map and both filter-indicator display maps render them as regex groups through the ONE shared map');
    ok(strpos($r, "'OUCS2D' => isset(\$recipientVars['oucs2d'])") !== false && strpos($r, "if (array_key_exists(\$key, \$listMap)) return array(strlen(\$m[0]), \$listMap[\$key], 'list');") !== false, 'runner: the SQL substitution map carries the four as LIST tokens');
    ok(strpos($r, "\$out .= penumbraRecipientListSqlIn(\$hit[1]);") !== false && strpos($r, "if (!\$inString && isset(\$hit[2]) && \$hit[2] === 'list') {") !== false, 'runner: the shared SQL engine renders a list token outside a literal as an IN-list, inside one as the bare list');
    ok(strpos($r, "'oucs2d'         => isset(\$coiDetails['oucs2d'])") !== false && strpos($r, "isset(\$r['oucs2d']) ? \$r['oucs2d'] : ''") !== false, 'runner: the recipient row and the personalization closure carry the lists (prose gets the plain list)');
    ok(strpos($src['penumbra_search.php'], ') + penumbraRecipientListFilterMap($recipientVars);') !== false, 'filter engine: php_apply_search_filter renders them as regex groups through the same shared map');
    ok(strpos($src['get_email_recipients.php'], "'oucs2d'") !== false && strpos($src['get_email_recipients.php'], "'oucs4d'") !== false && strpos($src['get_email_recipients.php'], "'oucs'") !== false, 'the picker endpoint sends the lists to the capsule (the hover previews the plain list)');
    $gone = array();
    foreach (array("'jobcode'", "'jobcode_prefix'", "'empl_class'", "'empl_status'", "'pi_eligible'") as $k) { if (strpos($src['get_email_recipients.php'], $k) === false) $gone[] = $k; }
    eq($gone, array(), 'the picker endpoint sends all five to the capsule (what the hover tooltip previews)');
    // Functional: the runner's OWN engines, lifted by the tokenizer (never require'd - the
    // runner opens Oracle and sends mail on include), resolve the new tokens like the old.
    $lifted = liftFns($r, array('_sr_sql_token_sub', '_sr_sql_token_sub_bare', '_sr_substitute_recipient_vars_sql', '_cf_resolve_filter_recipient_vars'))
            // penumbraCanonicalBraceTokens: _cf_resolve_filter_recipient_vars normalizes "{ DEPT }" to
            // "{DEPT}" before substituting since 2026-09-23 late (the runner loads penumbra_search.php
            // at line 48, so the lift must carry the helper too). Its callback existed only until the
            // helper dropped its quote/regex protection (2026-09-23 night) - lifted when present.
            . liftFns($src['penumbra_search.php'], array_merge(array('_sr_empl_id4', 'penumbraCanonicalBraceTokens'),
                                                          strpos($src['penumbra_search.php'], 'function _search_canon_brace_callback(') !== false ? array('_search_canon_brace_callback') : array(),
                                                          array(
                                                          // the three list renderers (2026-09-23 night) and the condition tester that consumes a rendered regex
                                                          'penumbraRecipientListRegex', 'penumbraRecipientListSqlIn', 'penumbraRecipientListFilterMap',
                                                          'php_test_search_condition', '_search_get_cell_value', '_search_is_numeric_str', '_search_num_in_range_list', '_sr_resolve_keyword_date'),
                                                          // php_test_search_condition's value helpers since 2026-09-24 (accounting
                                                          // negatives, strict browser dates) - lifted when present.
                                                          array_values(array_filter(array('_search_parse_num', '_search_parse_date', '_search_date_floor'),
                                                              function ($fn) use ($src) { return strpos($src['penumbra_search.php'], 'function ' . $fn . '(') !== false; }))));
    $tmpf = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_peopledir_lift_' . getmypid() . '.php';
    file_put_contents($tmpf, "<?php\n" . $lifted);
    require $tmpf; @unlink($tmpf);
    $rv = array('fname' => 'Jane', 'lname' => 'Doe', 'username' => 'jdoe', 'email' => 'jdoe@ncsu.edu', 'ouc' => '140201', 'ouc2d' => '14',
                'ouc4d' => '1402', 'ouc6d' => '140201', 'dept' => 'Chem', 'empl_id' => '000123456',
                'jobcode' => 'UP02', 'jobcode_prefix' => 'UP', 'empl_class' => 'ENF', 'empl_status' => 'A', 'pi_eligible' => 1);
    eq(_sr_substitute_recipient_vars_sql("SELECT 1 FROM T WHERE JC = {JOBCODE} AND JP = {JOBCODE_PREFIX} AND EC = {EMPL_CLASS} AND ES = {EMPL_STATUS} AND PI = {PI_ELIGIBLE} AND E4 = {EMPL_ID4}", $rv),
       "SELECT 1 FROM T WHERE JC = 'UP02' AND JP = 'UP' AND EC = 'ENF' AND ES = 'A' AND PI = '1' AND E4 = '3456'", 'runner SQL engine: the five new tokens resolve, quoted, beside {EMPL_ID4}');
    eq(_sr_substitute_recipient_vars_sql("WHERE JP = '{jobcode_prefix}'", $rv), "WHERE JP = 'UP'", 'runner SQL engine: a token already inside a literal is filled in place, case-insensitive');
    eq(_cf_resolve_filter_recipient_vars('EMPL_CLASS = {EMPL_CLASS} AND PI = {pi_eligible} AND JP = {JOBCODE_PREFIX}', $rv), 'EMPL_CLASS = ENF AND PI = 1 AND JP = UP', 'runner filter map: resolves, case-insensitive, unquoted as the old tokens are');
    $rv0 = array('fname' => 'X', 'lname' => 'Y', 'username' => 'x', 'email' => 'x@example.org');   // a recipient the directory does not know
    eq(_sr_substitute_recipient_vars_sql("WHERE A = {JOBCODE} AND B = {PI_ELIGIBLE}", $rv0), "WHERE A = '' AND B = ''", 'unknown recipient: the new tokens resolve to empty strings, exactly like the old ones');
    eq(_sr_substitute_recipient_vars_sql("{PI_ELIGIBLE} = 0", $rv), "'1' = 0", 'a condition-shaped expression resolves the way the evaluator wants it: the value as a quoted literal');
    eq(_sr_substitute_recipient_vars_sql("{EMPL_STATUS} != 'A'", $rv), "'A' != 'A'", '...and beside an existing literal (the evaluator compares two strings)');
    // The multi-valued {OUCS} family (2026-09-23 night), rendered per engine.
    $rv['oucs'] = '140201|061401'; $rv['oucs2d'] = '14|06'; $rv['oucs4d'] = '1402|0614'; $rv['oucs6d'] = '140201|061401';
    eq(_sr_substitute_recipient_vars_sql("WHERE SUBSTR(LEAD_UNIT, 1, 2) IN {OUCS2D} AND U IN {OUCS} AND V = {OUC2D}", $rv), "WHERE SUBSTR(LEAD_UNIT, 1, 2) IN ('14','06') AND U IN ('140201','061401') AND V = '14'", 'runner SQL engine: a multi-valued token outside a literal is an IN-list of quoted values, beside a single-valued one');
    eq(_sr_substitute_recipient_vars_sql("WHERE INSTR('|{OUCS}|', '|061401|') > 0 AND W IN {oucs6d}", $rv), "WHERE INSTR('|140201|061401|', '|061401|') > 0 AND W IN ('140201','061401')", 'runner SQL engine: inside a literal the bare list is spliced; {OUCS6D} is the same list, case-insensitive');
    eq(_sr_substitute_recipient_vars_sql("WHERE U IN {OUCS2D}", $rv0), "WHERE U IN (NULL)", 'unknown recipient: an IN-list nothing is in, never an empty IN ()');
    eq(_cf_resolve_filter_recipient_vars('LEAD_UNIT = /^{OUCS2D}/ AND X = {OUC2D}', $rv), 'LEAD_UNIT = /^(14|06)/ AND X = 14', 'runner filter map: the list becomes a regex GROUP, so the documented /^{OUC2D}/ form works unchanged with the S');
    eq(_cf_resolve_filter_recipient_vars('LEAD_UNIT = /^{oucs}$/ AND D = /^{OUCS4D}/', $rv), 'LEAD_UNIT = /^(140201|061401)$/ AND D = /^(1402|0614)/', 'exact-match and division forms, case-insensitive');
    eq(_cf_resolve_filter_recipient_vars('LEAD_UNIT = /^{OUCS2D}/', $rv0), 'LEAD_UNIT = /^(?!)/', 'unknown recipient: a group that matches NOTHING (an open /^/ would send every row to a stranger)');
    eq(array(php_test_search_condition('=', '/^(14|06)/', '061401'), php_test_search_condition('=', '/^(14|06)/', '221401'), php_test_search_condition('=', '/^(?!)/', '061401'), php_test_search_condition('=', '/^(?!)/', '')),
       array(true, false, false, false), "filter engine: the rendered group matches a second appointment's unit, not a unit merely containing the digits, and the empty group matches nothing");
    eq(penumbraRecipientListFilterMap(array('oucs' => '140201|061401', 'oucs2d' => '14|06', 'oucs4d' => '1402|0614')), array('{OUCS2D}' => '(14|06)', '{OUCS4D}' => '(1402|0614)', '{OUCS6D}' => '(140201|061401)', '{OUCS}' => '(140201|061401)'), 'the shared map: four groups, {OUCS6D} falling back to oucs when a row carries no oucs6d');
    eq(penumbraRecipientListRegex('a.b|c+'), '(a\.b|c\+)', 'values are regex-quoted, so a value can never widen the pattern');
    // A campus-wide account (2026-09-25): its unit list is '*', which must mean EVERY unit, never a literal star.
    eq(array(penumbraRecipientListRegex('*'), penumbraRecipientListRegex('11|*'), penumbraRecipientListRegex(' * ')), array('(.*)', '(.*)', '(.*)'), 'a star anywhere in the list renders as a group that matches everything');
    eq(_cf_resolve_filter_recipient_vars('LEAD_UNIT = /^{OUCS2D}/', array('oucs2d' => '*', 'oucs' => '*')), 'LEAD_UNIT = /^(.*)/', 'so a campus-wide group recipient gets every row of a unit-filtered task');
    ok(php_test_search_condition('=', '/^(.*)/', '061401') && php_test_search_condition('=', '/^(.*)/', ''), 'and the filter engine passes every row, blanks included');

    // ------------------------------------------------------- 10. scheduler form
    echo "10. scheduler form: the Recipients alert icon and the Configure button (2026-09-23 evening)\n";
    $ix = $src['index.php']; $mj = $src['js/main.js'];
    ok(preg_match('~<label>Recipients: <span id="schedRecipAlert" class="sched-recip-alert" role="button" tabindex="0"~', $ix) === 1, 'form: the alert icon is a focusable span inside the Recipients label (a <button> is labelable, so the label would forward every click to it)');
    ok(strpos($ix, 'schedExternalWarning') === false && strpos($mj, 'schedExternalWarning') === false, 'form: the old one-message warning box is gone from the markup and the script');
    ok(strpos($mj, 'if (!penumbraSchedulerRecipientOk(raw)) { invalid.push(raw); return; }') !== false, 'alerts: an invalid address is judged by the save check itself (penumbraSchedulerRecipientOk), so the icon and the save cannot disagree');
    ok(strpos($mj, "if (raw.toLowerCase().indexOf('ncsu.edu') === -1) {") !== false && strpos($src['schedule_runner.php'], "stripos(trim(\$r), 'ncsu.edu') === false") !== false, "alerts: 'outside ncsu.edu' is the runner's own test for the live-link note (contains ncsu.edu), on both sides");
    ok(strpos($mj, "if (external.length && \$('#schedIncludeLink').is(':checked')) {") !== false, 'alerts: the external-recipients note appears only with Include Live Link on (it is about the link text)');
    ok(strpos($mj, "window._pnbAll('#schedRecipAlertCard').length && typeof window._schedRecipAlertEscape === 'function'") !== false, 'Escape: the primary handler closes an open alert card first (step A0.74), in both windows');
    ok(strpos($ix, 'id="addNewTaskBtn" title="Configure a new event of the selected type">&#10010;&nbsp;Configure</button>') !== false
        && strpos($ix, 'click <strong>Configure</strong>') !== false && strpos($ix, '&nbsp;Add</button>') === false, 'rail: the new-event button reads "+ Configure", and the empty state says so');
}

echo "\nPASS: $PASS   FAIL: $FAIL\n";
echo 'RESULT: ' . ($FAIL === 0 ? 'GREEN' : 'RED') . "\n";
