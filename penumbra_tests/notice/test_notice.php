<?php
/**
 * FAILURE-NOTICE RECEIPT SUITE (2026-10-03).
 *
 * The Failures card on the health hub says who each scheduled task's failure
 * email went to. Three pieces make that true, and this suite drives all three
 * from the SHIPPED files (lifted by the tokenizer, never copied):
 *
 *   A. schedule_runner.php - log_penumbra_scheduler_audit() sends the notice
 *      BEFORE it writes the audit row and writes the receipt into SOURCE_DATA
 *      ({"notice":{"state","to","bcc"}}): sent / failed / dup / off / error.
 *      mail() and execClobInsert() are stubs that record the call ORDER.
 *      NOTHING IS SENT: the lifted text has @mail( patched to a recorder and
 *      the suite refuses to run if a real mail( survives.
 *   B. penumbra_health.php - penumbra_failure_notice() reads the receipt back
 *      (and resolves an old row's settings into an unconfirmed 'addressed').
 *      The runner's own SOURCE_DATA from A is fed through a JSON_VALUE stand-in
 *      so the writer and the reader are proven to agree on the field names.
 *   C. penumbra_failure_notice_cols() asks Oracle for those exact paths, and
 *      both readers splice it: the health card and the metrics Errors tab
 *      (analytics_all.php, 2026-10-03 second round).
 *   F. the report Activity feed appends the same line (analytics_shared.php).
 *   E. penumbra_failure_notice_text() - the Errors tab's one-line form: who
 *      for an admin, a recipient COUNT for anyone else.
 *   D. health.php - a key-only JSON caller gets the notice's state but not the
 *      addresses.
 *
 *   php -n test_notice.php --app=<dir> [--control] [--mutant=1..5]
 *     --mutant=1  the receipt is never merged into SOURCE_DATA -> the 12 A
 *                 receipt assertions (round trip included) go RED
 *     --mutant=2  the JSON guard forgets 'to' -> exactly the D address check RED
 *     --mutant=3  the pre-2026-10-03 shape: the notice is sent AFTER the
 *                 insert and returns nothing -> the order assertion and the
 *                 receipt assertions RED (12), the row itself still written
 *     --mutant=4  the shared text names addresses for everyone -> the 3
 *                 non-admin E checks and the 2 non-admin F checks RED (5)
 *     --mutant=5  the feed always names addresses -> the two non-admin F
 *                 checks RED
 *   --app needs schedule_runner.php, penumbra_health.php, health.php,
 *   penumbra_email_shell.php, analytics_all.php and analytics_shared.php.
 */
error_reporting(E_ALL);
set_error_handler(function ($no, $str, $file, $line) { throw new ErrorException($str, 0, $no, $file, $line); });

$opt = array('app' => '', 'control' => false, 'mutant' => 0);
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--app=') === 0) $opt['app'] = rtrim(substr($a, 6), '/\\');
    elseif ($a === '--control') $opt['control'] = true;
    elseif (strpos($a, '--mutant=') === 0) $opt['mutant'] = (int)substr($a, 9);
}
if ($opt['app'] === '') { fwrite(STDERR, "--app=<dir> is required\n"); exit(2); }
$APP = $opt['app'];

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got !== null ? ' (got: ' . (is_string($got) ? $got : json_encode($got)) . ')' : '') . "\n"; }
}
function section($s) { echo "\n== $s\n"; }

function lift($src, $names) {
    $t = token_get_all($src); $n = count($t); $out = ''; $found = array();
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && ((is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) || (!is_array($t[$j]) && $t[$j] === '&'))) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;
        $fname = $t[$j][1];
        if (!in_array($fname, $names, true) || in_array($fname, $found, true)) continue;
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
    if ($missing) { fwrite(STDERR, "MISSING from source: " . implode(', ', $missing) . "\n"); exit(2); }
    return $out;
}
/** str_replace that insists its anchor is there exactly once. */
function patch_once($hay, $from, $to, $label) {
    $c = substr_count($hay, $from);
    if ($c !== 1) { fwrite(STDERR, "patch '$label' anchor matched $c times\n"); exit(2); }
    return str_replace($from, $to, $hay);
}

// ---------------------------------------------------------------------------
// Stubs for what the lifted runner code reaches for
$GLOBALS['seq'] = array(); $GLOBALS['rows'] = array(); $GLOBALS['logs'] = array();
$GLOBALS['mail_mode'] = 'true';   // 'true' | 'false' | 'throw'
$currentUserKey = 'SCHEDULER';
function log_scheduler($m) { $GLOBALS['logs'][] = $m; }
function pnb_fake_mail($to, $subject, $body, $headers) {
    $GLOBALS['seq'][] = 'mail';
    $GLOBALS['last_mail'] = array('to' => $to, 'headers' => $headers);
    if ($GLOBALS['mail_mode'] === 'throw') { throw new TypeError('simulated builder failure'); }
    return $GLOBALS['mail_mode'] === 'true';
}
function execClobInsert($conn, $table, $cols, $clobCols, $extra) {
    $GLOBALS['seq'][] = 'insert';
    $GLOBALS['rows'][] = $cols;
    return true;
}
function penumbraUnityEmail($p) {
    $p = strtolower(trim((string)$p));
    if ($p === '' || preg_match('/[\s",<>\[\]]/', $p)) return '';
    if (strpos($p, '@') === false) $p .= '@ncsu.edu';
    return $p;
}
function send_scheduler_success_email($r, $m, $c) { $GLOBALS['seq'][] = 'success_mail'; }

require $APP . DIRECTORY_SEPARATOR . 'penumbra_email_shell.php';

$runnerSrc = file_get_contents($APP . DIRECTORY_SEPARATOR . 'schedule_runner.php');
$runner = lift($runnerSrc, array('_audit_scrub_for_json', 'log_penumbra_scheduler_audit', '_sfe_get', '_sfe_h',
                                 '_sfe_kv_row', '_sfe_resolve_recipients', 'send_scheduler_failure_email'));
$runner = patch_once($runner, '@mail($to, $subject, $body, $headers)', 'pnb_fake_mail($to, $subject, $body, $headers)', 'mail');
$runner = patch_once($runner, 'quoted_printable_encode($html)', '$html', 'qp');
if ($opt['mutant'] === 1) {
    $runner = patch_once($runner, "\$source['notice'] = \$notice;", '/* MUTANT 1 */', 'mutant1');
}
if ($opt['mutant'] === 3) {
    // Move the send back below the insert: blank the top call, re-issue it after.
    $runner = patch_once($runner, '$notice = send_scheduler_failure_email($report_id, $action, $message, $context);', '$notice = null; $pnbLate = true;', 'mutant3a');
    $runner = patch_once($runner, '    // (The failure notice is sent at the TOP of this function now - see SEND RECEIPT.)',
        '    if (!empty($pnbLate)) { try { send_scheduler_failure_email($report_id, $action, $message, $context); } catch (Throwable $x) { } }', 'mutant3b');
}
if (preg_match('/(?<![A-Za-z_])@?mail\(\$to/', $runner)) { fwrite(STDERR, "SAFETY: a real mail() call survived patching - aborting.\n"); exit(2); }
eval('?>' . "<?php\n" . $runner);

$healthSrc = file_get_contents($APP . DIRECTORY_SEPARATOR . 'penumbra_health.php');
eval("?><?php\n" . lift($healthSrc, array('penumbra_failure_notice')));

/** One audit call; returns array(SOURCE_DATA decoded, call sequence). */
function run_audit($action, $ctx, $mode = 'true', $msg = 'ORA-00942: table or view does not exist') {
    $GLOBALS['seq'] = array(); $GLOBALS['rows'] = array(); $GLOBALS['mail_mode'] = $mode;
    log_penumbra_scheduler_audit(null, 42, $action, $msg, $ctx);
    $row = end($GLOBALS['rows']);
    $sd = $row ? json_decode($row['SOURCE_DATA'], true) : null;
    return array($sd, $GLOBALS['seq']);
}
/** What JSON_VALUE hands back for each path: a scalar as a string, true/false as 'true'/'false', else null. */
function jv($sd, $path) {
    $v = $sd;
    foreach (explode('.', $path) as $p) { if (!is_array($v) || !array_key_exists($p, $v)) return null; $v = $v[$p]; }
    if (is_bool($v)) return $v ? 'true' : 'false';
    if (is_array($v) || $v === null) return null;
    return (string)$v;
}
function as_row($sd) {
    return array('N_STATE' => jv($sd, 'notice.state'), 'N_TO' => jv($sd, 'notice.to'), 'N_BCC' => jv($sd, 'notice.bcc'),
                 'N_ON' => jv($sd, 'notify_failure_enabled'), 'N_SPEC' => jv($sd, 'notify_failure_recipients'), 'N_OWNER' => jv($sd, 'owner'));
}
$base = array('task_type' => 'EMAIL', 'subject' => 'Awards by Unit', 'short_id' => 'awdunit', 'cron' => '0 6 * * 1-5',
              'owner' => 'jdoe', 'notify_failure_enabled' => true, 'notify_failure_recipients' => 'me');

// ---------------------------------------------------------------------------
section('A. The runner writes a send receipt into the failure row');

list($sd, $seq) = run_audit('SCHEDULE_FAIL', array_merge($base, array('task_id' => 101)));
ok(is_array($sd) && $sd['message'] === 'ORA-00942: table or view does not exist', 'the audit row is still written, message first');
ok(isset($sd['notice']['state']) && $sd['notice']['state'] === 'sent', 'mail() true: state sent', $sd['notice'] ?? null);
ok(isset($sd['notice']['to']) && $sd['notice']['to'] === 'jdoe@ncsu.edu', '"me" recorded as the owner\'s address', $sd['notice'] ?? null);
ok(isset($sd['notice']['bcc']) && $sd['notice']['bcc'] === 'bplimon@ncsu.edu', 'the admin bcc is recorded', $sd['notice'] ?? null);
ok($seq === array('mail', 'insert'), 'the notice goes out BEFORE the row is written (so the row can carry it)', implode(',', $seq));
$rtA = penumbra_failure_notice('SCHEDULE_FAIL', as_row($sd));
ok($rtA !== null && $rtA['state'] === 'sent' && $rtA['to'] === 'jdoe@ncsu.edu' && $rtA['confirmed'] === true,
   'round trip: the health reader reads what the runner wrote', $rtA);

list($sd, $seq) = run_audit('SCHEDULE_RUN_FAIL', array_merge($base, array('task_id' => 101)));
ok(isset($sd['notice']['state']) && $sd['notice']['state'] === 'dup' && $seq === array('insert'), 'second failure row of the same run: dup, no second email', array($sd['notice'] ?? null, $seq));

list($sd, $seq) = run_audit('SCHEDULE_FAIL', array_merge($base, array('task_id' => 102)), 'false');
ok(isset($sd['notice']['state']) && $sd['notice']['state'] === 'failed' && $sd['notice']['to'] === 'jdoe@ncsu.edu', 'mail() false: state failed, with the address', $sd['notice'] ?? null);

list($sd, $seq) = run_audit('SCHEDULE_FAIL', array_merge($base, array('task_id' => 103, 'notify_failure_enabled' => false)));
ok(isset($sd['notice']['state']) && $sd['notice']['state'] === 'off' && !in_array('mail', $seq, true), 'owner turned it off: state off, nothing mailed', array($sd['notice'] ?? null, $seq));

list($sd, $seq) = run_audit('SCHEDULE_FAIL', array_merge($base, array('task_id' => 104)), 'throw');
ok(is_array($sd) && isset($sd['notice']['state']) && $sd['notice']['state'] === 'error', 'the builder throws an Error: the row is STILL written, state error', array($sd['notice'] ?? null, $seq));
ok(isset($sd['notice']['detail']) && strpos($sd['notice']['detail'], 'simulated builder failure') !== false, 'with the error text');

list($sd, $seq) = run_audit('SCHEDULE_NOAUTH', array_merge($base, array('task_id' => 105, 'owner' => 'pat', 'notify_failure_recipients' => 'a, me; B@X.org')));
ok(isset($sd['notice']['to']) && $sd['notice']['to'] === 'a@ncsu.edu, pat@ncsu.edu, b@x.org', 'NOAUTH: explicit list recorded as resolved', $sd['notice'] ?? null);

list($sd, $seq) = run_audit('SCHEDULE_FAIL', array_merge($base, array('task_id' => 106, 'notify_failure_recipients' => 'bplimon')));
ok(isset($sd['notice']['bcc']) && $sd['notice']['bcc'] === '' && $sd['notice']['to'] === 'bplimon@ncsu.edu', 'admin already in To: no bcc recorded', $sd['notice'] ?? null);

list($sd, $seq) = run_audit('SCHEDULE_RUN_OK', array_merge($base, array('task_id' => 107)), 'true', 'ok');
ok(is_array($sd) && !array_key_exists('notice', $sd), 'a success row carries no notice field');

list($sd, $seq) = run_audit('SCHEDULE_FAIL', array());
ok(isset($sd['notice']['state']) && $sd['notice']['state'] === 'sent' && $sd['notice']['to'] === 'bplimon@ncsu.edu', 'no context at all: falls back to the admin, recorded', $sd['notice'] ?? null);

// ---------------------------------------------------------------------------
section('B. penumbra_failure_notice() reads a row');
ok(penumbra_failure_notice('EXPORT', array('N_STATE' => 'sent')) === null, 'non-scheduler action: null (no notice line)');
ok(penumbra_failure_notice('SCHEDULED_SEND', array()) === null, 'SCHEDULED_SEND (the email TASK itself) is not a notice action');
$n = penumbra_failure_notice('SCHEDULE_FAIL', array('N_STATE' => 'FAILED', 'N_TO' => ' a@b.c ', 'N_BCC' => null));
ok($n['state'] === 'failed' && $n['to'] === 'a@b.c' && $n['bcc'] === '' && $n['confirmed'] === true, 'a receipt passes through, normalised', $n);
$n = penumbra_failure_notice('SCHEDULE_FAIL', array('N_ON' => 'false', 'N_SPEC' => 'me', 'N_OWNER' => 'jdoe'));
ok($n['state'] === 'off' && $n['confirmed'] === false, 'old row, notice off: off, unconfirmed', $n);
$n = penumbra_failure_notice('SCHEDULE_RUN_FAIL', array('N_ON' => 'true', 'N_SPEC' => null, 'N_OWNER' => 'jdoe'));
ok($n['state'] === 'addressed' && $n['to'] === 'jdoe@ncsu.edu' && $n['confirmed'] === false, 'old row, blank spec: addressed to the owner, unconfirmed', $n);
$n = penumbra_failure_notice('SCHEDULE_NOAUTH', array('N_SPEC' => 'Me; X@Y.org, bob <me>', 'N_OWNER' => 'JDoe'));
ok($n['to'] === 'jdoe@ncsu.edu, x@y.org, bob@ncsu.edu', 'old row: me / full address / bare id resolved and de-duped', $n);
$n = penumbra_failure_notice('SCHEDULE_FAIL', array());
ok($n['state'] === 'addressed' && $n['to'] === 'admin (fallback)', 'old row with no context: the admin fallback', $n);

// ---------------------------------------------------------------------------
section('C. the readers ask Oracle for the paths the runner writes');
$colsSrc = lift($healthSrc, array('penumbra_failure_notice_cols', 'penumbra_failure_notice_text'));
if ($opt['mutant'] === 4) { $colsSrc = patch_once($colsSrc, 'if ($withAddresses) {', 'if (true) {', 'mutant4'); }
eval("?><?php\n" . $colsSrc);
$cols = penumbra_failure_notice_cols('a');
foreach (array('notice.state' => 'N_STATE', 'notice.to' => 'N_TO', 'notice.bcc' => 'N_BCC', 'notify_failure_enabled' => 'N_ON',
               'notify_failure_recipients' => 'N_SPEC', 'owner' => 'N_OWNER') as $path => $alias) {
    ok(strpos($cols, "JSON_VALUE(a.SOURCE_DATA, '\$.$path') AS $alias") !== false, "the column list selects \$.$path AS $alias (a literal \$ reaches Oracle)");
}
ok(strpos(penumbra_failure_notice_cols(''), 'JSON_VALUE(SOURCE_DATA,') !== false, 'no alias: bare SOURCE_DATA');
ok(strpos(penumbra_failure_notice_cols("a) x; --"), 'JSON_VALUE(ax.SOURCE_DATA,') !== false, 'the alias is reduced to an identifier');
$fn = lift($healthSrc, array('penumbra_recent_failures'));
ok(strpos($fn, "\" . penumbra_failure_notice_cols('a') . \"") !== false, 'the health card splices the shared column list');
ok(strpos($fn, "'notice'  => penumbra_failure_notice(\$r['ACTION'], \$r)") !== false, 'each row gets its notice');
$all = file_get_contents($APP . DIRECTORY_SEPARATOR . 'analytics_all.php');
ok(preg_match('/AS SD,\s*"\s*\.\s*penumbra_failure_notice_cols\(\'a\'\)\s*\.\s*"\s*FROM PENUMBRA_AUDIT a\s*LEFT JOIN PENUMBRA_REPORTS r ON a\.REPORT_ID = r\.ID\s*WHERE \$errorCondSqlA/', $all) === 1, 'the metrics Errors query splices it too');
ok(strpos($all, "require_once 'penumbra_health.php';") !== false, 'and loads the reader');
ok(strpos($all, "\$errNoticeAddrs = !empty(\$isAdmin) && empty(\$noadm);") !== false, 'addresses only for an admin, never under &noadm');
ok(strpos($all, "penumbra_failure_notice_text(penumbra_failure_notice(isset(\$r['ACTION']) ? \$r['ACTION'] : '', \$r), \$errNoticeAddrs)") !== false, 'each Errors row formats its notice with that gate');
ok(strpos($all, "echo (\$e['msg'] !== '' ? ' · ' : '') . htmlspecialchars(\$e['notice']);") !== false, 'the Detail cell appends it, escaped');

section('E. penumbra_failure_notice_text(): one line for a table cell');
$sent = array('state' => 'sent', 'to' => 'jdoe@ncsu.edu, b@x.org', 'bcc' => 'bplimon@ncsu.edu', 'confirmed' => true);
ok(penumbra_failure_notice_text($sent, true) === 'Notice emailed to jdoe@ncsu.edu, b@x.org + admin bcc', 'admin: who, plus the bcc', penumbra_failure_notice_text($sent, true));
ok(penumbra_failure_notice_text($sent, false) === 'Notice emailed to 2 recipients', 'anyone else: how many, never who', penumbra_failure_notice_text($sent, false));
ok(strpos(penumbra_failure_notice_text(array('state' => 'failed', 'to' => 'jdoe@ncsu.edu', 'bcc' => ''), false), '@') === false, 'a failed send hides the address from non-admins too');
ok(penumbra_failure_notice_text(array('state' => 'failed', 'to' => 'a@b.c', 'bcc' => ''), true) === 'Notice NOT sent: the mail relay refused it (to a@b.c)', 'failed, admin');
ok(penumbra_failure_notice_text(array('state' => 'addressed', 'to' => 'jdoe@ncsu.edu', 'bcc' => ''), false) === 'Notice addressed to 1 recipient (no send receipt)', 'old row: singular count, no receipt');
ok(penumbra_failure_notice_text(array('state' => 'dup'), true) === 'Notice: already sent for this run', 'dup');
ok(penumbra_failure_notice_text(array('state' => 'off'), true) === 'Notice: off for this task', 'off');
ok(penumbra_failure_notice_text(array('state' => 'error'), true) === 'Notice NOT sent: building the email failed', 'error');
ok(penumbra_failure_notice_text(null, true) === '', 'no notice: empty');
ok(strpos(implode(' ', array(penumbra_failure_notice_text($sent, true), penumbra_failure_notice_text(array('state' => 'dup'), true))), "\xE2\x80\x94") === false, 'no em-dash in the copy');

section('F. the report Activity feed (analytics_shared.php) ends a failure row with its notice');
if (!function_exists('mb_strlen'))  { function mb_strlen($s) { return (int)preg_match_all('/./us', (string)$s); } }
if (!function_exists('mb_substr'))  { function mb_substr($s, $a, $n = null) { preg_match_all('/./us', $s, $m); return implode('', array_slice($m[0], $a, $n)); } }
$shSrc = file_get_contents($APP . DIRECTORY_SEPARATOR . 'analytics_shared.php');
$feedSrc = lift($shSrc, array('penumbra_an_report_feed', 'penumbra_an_feed_family'))
         . lift(file_get_contents($APP . DIRECTORY_SEPARATOR . 'db_connection.php'), array('penumbraErrorActions', 'penumbraClientErrorIsBenign', 'penumbraBenignClientErrorPattern'));
if ($opt['mutant'] === 5) { $feedSrc = patch_once($feedSrc, '$noticeAddrs);', 'true);', 'mutant5'); }
eval("?><?php\n" . $feedSrc);
$feedSql = '';
$feedRun = function ($sql, $binds) use (&$feedSql) {
    $feedSql = $sql;
    return array(
        array('TS' => '2026-10-03 14:00:00', 'USER_ID' => 'SCHEDULER', 'ACTION' => 'SCHEDULE_FAIL', 'SD' => '{"message":"ORA-00942"}', 'AF' => null, 'BF' => null, 'BLEN' => null, 'ALEN' => null,
              'N_STATE' => 'sent', 'N_TO' => 'jdoe@ncsu.edu, b@x.org', 'N_BCC' => 'bplimon@ncsu.edu', 'N_ON' => 'true', 'N_SPEC' => 'me, b@x.org', 'N_OWNER' => 'jdoe'),
        array('TS' => '2026-10-03 13:00:00', 'USER_ID' => 'jdoe', 'ACTION' => 'OPEN', 'SD' => '{"ip_address":"10.0.0.1"}', 'AF' => null, 'BF' => null, 'BLEN' => null, 'ALEN' => null,
              'N_STATE' => null, 'N_TO' => null, 'N_BCC' => null, 'N_ON' => null, 'N_SPEC' => null, 'N_OWNER' => null),
    );
};
$fa = penumbra_an_report_feed($feedRun, 42, '', array(), 50, 'test', true);
ok(strpos($feedSql, "JSON_VALUE(SOURCE_DATA, '\$.notice.state') AS N_STATE") !== false && preg_match('/AS SD,\s*JSON_VALUE/', $feedSql) === 1 && preg_match('/AS N_OWNER,\s*TO_CHAR\(SUBSTR\("AFTER"/', $feedSql) === 1,
   'the feed query splices the shared columns between SD and AF', substr($feedSql, 0, 500));
ok(isset($fa[0]['meta']) && $fa[0]['meta'] === 'ORA-00942 · Notice emailed to jdoe@ncsu.edu, b@x.org + admin bcc', 'admin: the failure row ends with who', $fa[0]['meta'] ?? null);
ok(isset($fa[1]['meta']) && $fa[1]['meta'] === '10.0.0.1', 'a row that sends no notice is unchanged', $fa[1]['meta'] ?? null);
$fo = penumbra_an_report_feed($feedRun, 42, '', array(), 50, 'test', false);
ok(isset($fo[0]['meta']) && $fo[0]['meta'] === 'ORA-00942 · Notice emailed to 2 recipients' && strpos($fo[0]['meta'], '@') === false, 'owner/editor: a count, never who', $fo[0]['meta'] ?? null);
$fd = penumbra_an_report_feed($feedRun, 42, '', array(), 50, 'test');
ok(isset($fd[0]['meta']) && strpos($fd[0]['meta'], '@') === false, 'the parameter defaults to no addresses', $fd[0]['meta'] ?? null);
ok(strpos($all, '$anFeedFetch, $anRepLog, $errNoticeAddrs);') !== false, 'analytics_all.php hands the feed the same admin gate as the Errors tab');
ok(strpos($all, "require_once 'penumbra_health.php';") < strpos($all, 'penumbra_an_report_feed($run'), 'and loads the reader BEFORE the feed runs (else the feed silently skips it)');

// ---------------------------------------------------------------------------
section('D. health.php JSON: a key-only caller sees the state, not the addresses');
$page = file_get_contents($APP . DIRECTORY_SEPARATOR . 'health.php');
$from = "    if (empty(\$isAdmin) && !empty(\$snap['components']['recent_failures']['rows'])) {";
if (substr_count($page, $from) !== 1) { fwrite(STDERR, "guard anchor matched " . substr_count($page, $from) . " times\n"); exit(2); }
$a = strpos($page, $from); $b = strpos($page, "    echo json_encode(\$snap", $a);
$guard = substr($page, $a, $b - $a);
if ($opt['mutant'] === 2) { $guard = patch_once($guard, "['notice']['to'],", "['notice']['zz'],", 'mutant2'); }
$runGuard = function ($isAdmin, $snap) use ($guard) { eval($guard); return $snap; };
$mk = function () { return array('components' => array('recent_failures' => array('rows' => array(
    array('action' => 'SCHEDULE_FAIL', 'notice' => array('state' => 'sent', 'to' => 'jdoe@ncsu.edu', 'bcc' => 'bplimon@ncsu.edu', 'confirmed' => true)),
    array('action' => 'EXPORT', 'notice' => null))))); };
$s = $runGuard(false, $mk()); $r0 = $s['components']['recent_failures']['rows'][0]['notice'];
ok(!array_key_exists('to', $r0), 'key-only: the To addresses are dropped', $r0);
ok(!array_key_exists('bcc', $r0), 'key-only: the bcc is dropped', $r0);
ok($r0['state'] === 'sent', 'key-only: the state survives', $r0);
ok($s['components']['recent_failures']['rows'][1]['notice'] === null, 'a row with no notice is left alone');
$s = $runGuard(true, $mk());
ok($s['components']['recent_failures']['rows'][0]['notice']['to'] === 'jdoe@ncsu.edu', 'admin session: addresses kept');
$s = $runGuard(false, array('components' => array()));
ok($s === array('components' => array()), 'no detail block (the monitor\'s plain poll): untouched');

if ($opt['control']) { section('control'); ok(false, 'control: a deliberately false assertion (must FAIL)'); }

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL ? 1 : 0);
