<?php
// schedkey suite (2026-10-03): the scheduler secret is honoured only from this server, and a
// stored task secret that cannot be read stops the task with the reason. No database, no web
// server.   php test.php <app dir>   (query.php, db_connection.php, schedule_runner.php,
// manage_schedule.php)
// P*  penumbraPeerIsLocal() LIFTED from db_connection.php by its markers, run over peers.
// S*  decrypt_scheduler_password() + scheduler_read_secret() lifted from schedule_runner.php
//     against values made by manage_schedule.php's own encrypt_scheduler_password().
// Q1/Q2 the two places the secret is accepted call the predicate; R1-R3 the runner's call
//     sites. Prints PASS/FAIL lines and "N assertions, M failed".
error_reporting(E_ALL);
$app = isset($argv[1]) ? rtrim($argv[1], "\\/") : '';
if ($app === '' || !is_dir($app)) { echo "FATAL: app dir missing\n"; exit(2); }
$pass = 0; $fail = 0;
$GLOBALS['__warnings'] = array();
set_error_handler(function ($no, $str) { $GLOBALS['__warnings'][] = $str; return true; });
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
function lift($text, $start, $end, $what) {
    $i = strpos($text, $start);
    if ($i === false) { echo "FATAL: nothing to lift ($what): start marker missing\n"; exit(2); }
    $j = strpos($text, $end, $i + strlen($start));
    if ($j === false) { echo "FATAL: nothing to lift ($what): end marker missing\n"; exit(2); }
    return substr($text, $i, $j - $i);
}
function between($text, $start, $end) {
    $i = strpos($text, $start);
    if ($i === false) return '';
    $j = strpos($text, $end, $i + strlen($start));
    return $j === false ? '' : substr($text, $i, $j - $i);
}

$query  = src('query.php');
$db     = src('db_connection.php');
$runner = src('schedule_runner.php');
$sched  = src('manage_schedule.php');

// ---------------------------------------------------------------- P: the peer rule
eval(lift($db, 'function penumbraPeerIsLocal(', '// -- end of the local-peer predicate --', 'penumbraPeerIsLocal'));
if (!function_exists('penumbraPeerIsLocal')) { echo "FATAL: penumbraPeerIsLocal not lifted\n"; exit(2); }
$own6 = 'fe80::37:ac0e:25e:2c51%4';   // what the IIS log shows for every scheduler call: peer == server address
$own4 = '152.1.26.180';
$P = function ($remote, $ownAddrs, $extra = array()) { return penumbraPeerIsLocal(array_merge(array('REMOTE_ADDR' => $remote), $extra), $ownAddrs); };

T('P1', 'loopback IPv4 is local', $P('127.0.0.1', array($own4)) === true);
T('P2', 'loopback IPv6 is local', $P('::1', array($own4)) === true);
T('P3', 'IPv4-mapped loopback is local', $P('::ffff:127.0.0.1', array($own4)) === true);
T('P4', 'the scheduler hairpin (peer = the server\'s own link-local address, zone id and all) is local', $P($own6, array($own6)) === true);
T('P5', 'a hairpin over the server\'s own IPv4 is local', $P($own4, array($own6, $own4)) === true);
T('P6', 'a www3 proxy node is NOT local (a signed-in session cannot use the secret)', $P('10.48.12.98', array($own6, $own4)) === false && $P('10.48.12.91', array($own6, $own4)) === false);
T('P7', 'another host on the same link (link-local, not this server\'s address) is NOT local', $P('fe80::dead:beef:1:2%4', array($own6, $own4)) === false);
T('P8', 'the own address may come from the interface list alone, without a zone id', $P($own6, array('fe80::37:ac0e:25e:2c51')) === true);
T('P9', 'nothing known about this machine\'s addresses: a link-local peer passes (the web.config rule\'s notion)', $P($own6, array()) === true);
T('P10', '...and a proxy node still does not', $P('10.48.12.98', array()) === false && $P('152.1.26.181', array()) === false);
T('P11', 'no peer address, or a string that is no address, is not local', $P('', array($own4)) === false && $P('localhost', array($own4)) === false && penumbraPeerIsLocal(array(), array($own4)) === false);
T('P12', 'one address in two spellings (case, zero compression, brackets) is one address', $P('FE80:0000:0000:0000:0037:AC0E:025E:2C51%4', array($own6)) === true && $P('[fe80::37:ac0e:25e:2c51]', array($own6)) === true);
T('P13', 'unreadable own-address entries are skipped, not matched', $P('10.48.12.98', array('', 'not-an-ip', $own4)) === false && $P($own4, array('', 'not-an-ip', $own4)) === true);
T('P14', 'gathered from the request (LOCAL_ADDR) when not injected', penumbraPeerIsLocal(array('REMOTE_ADDR' => $own6, 'LOCAL_ADDR' => $own6)) === true
    && penumbraPeerIsLocal(array('REMOTE_ADDR' => '10.48.12.98', 'LOCAL_ADDR' => $own4)) === false);
T('P15', 'a routable address that is not this server\'s is not local', $P('152.1.26.181', array($own6, $own4)) === false && $P('8.8.8.8', array($own6, $own4)) === false);

// ---------------------------------------------------------------- S: stored secrets
define('SCHEDULER_SECRET_KEY', 'schedkey-suite-secret-not-a-real-one');
eval(lift($sched, 'function encrypt_scheduler_password(', '// --- CRON CALC ---', 'encrypt_scheduler_password'));
eval(lift($runner, 'function decrypt_scheduler_password(', 'function safe_json_decode(', 'decrypt + scheduler_read_secret'));
foreach (array('encrypt_scheduler_password', 'decrypt_scheduler_password', 'scheduler_read_secret') as $fn) {
    if (!function_exists($fn)) { echo "FATAL: $fn not lifted\n"; exit(2); }
}
$enc = encrypt_scheduler_password('hunter2 & more');
$r = scheduler_read_secret(array('drop_password' => $enc), 'drop_password', 'file drop password');
T('S1', 'a value the save path stored reads back', $r[0] === 'hunter2 & more' && $r[1] === null, var_export($r, true));

// Saved under a different secret: same stored shape, another key. CBC has no tag, so pick
// a key whose wrong-key decrypt fails padding (most do) - the helper cannot see the rest.
$other = null;
for ($k = 1; $k <= 20 && $other === null; $k++) {
    $iv = str_repeat(chr(64 + $k), 16);
    $ct = base64_encode(openssl_encrypt('hunter2 & more', 'aes-256-cbc', 'another-secret-' . $k, 0, $iv) . '::' . $iv);
    if (@openssl_decrypt(explode('::', base64_decode($ct), 2)[0], 'aes-256-cbc', SCHEDULER_SECRET_KEY, 0, $iv) === false) $other = $ct;
}
$GLOBALS['__warnings'] = array();
$r = scheduler_read_secret(array('drop_password' => $other), 'drop_password', 'file drop password');
T('S2', 'a value saved under a different secret: no plaintext, and a message naming the field', $other !== null && $r[0] === null && is_string($r[1])
    && strpos($r[1], 'file drop password') !== false && strpos($r[1], 'could not be read') !== false && strpos($r[1], 'Re-enter') !== false, var_export($r, true));

$bad = array('garbage!!', base64_encode('no separator here'), base64_encode('abc::short-iv'), 'AAAA');
$allErr = true; $detail = '';
foreach ($bad as $b) {
    $r = scheduler_read_secret(array('drop_s3_secret_key' => $b), 'drop_s3_secret_key', 'S3 secret key');
    if (!($r[0] === null && is_string($r[1]) && strpos($r[1], 'S3 secret key') !== false)) { $allErr = false; $detail .= ' [' . $b . ' -> ' . var_export($r, true) . ']'; }
}
T('S3', 'a damaged stored value (not base64, no separator, a short IV) is an error, never a value', $allErr, $detail);

$r1 = scheduler_read_secret(array(), 'drop_password', 'x');
$r2 = scheduler_read_secret(array('drop_password' => ''), 'drop_password', 'x');
$r3 = scheduler_read_secret(array('drop_password' => null), 'drop_password', 'x');
$r4 = scheduler_read_secret(null, 'drop_password', 'x');
T('S4', 'a field that is not set is neither a value nor an error', $r1 === array(null, null) && $r2 === array(null, null) && $r3 === array(null, null) && $r4 === array(null, null));

$GLOBALS['__warnings'] = array();
$d1 = decrypt_scheduler_password(''); $d2 = decrypt_scheduler_password(null);
$d3 = decrypt_scheduler_password('garbage!!'); $d4 = decrypt_scheduler_password(base64_encode('no separator here')); $d5 = decrypt_scheduler_password(base64_encode('abc::short-iv'));
T('S5', 'decrypt answers null for nothing stored and false for a damaged value, without a PHP warning', $d1 === null && $d2 === null && $d3 === false && $d4 === false && $d5 === false
    && count($GLOBALS['__warnings']) === 0, 'warnings: ' . implode(' | ', $GLOBALS['__warnings']));
T('S6', 'decrypt still reads what encrypt wrote (the stored shape is unchanged)', decrypt_scheduler_password($enc) === 'hunter2 & more'
    && preg_match('/^[A-Za-z0-9+\/=]+$/', $enc) === 1 && strpos(base64_decode($enc), '::') !== false);

// ---------------------------------------------------------------- Q: where the secret is accepted
$qb = between($query, '// If the Scheduler sends the matching API key', '// No identity at all (expired Shibboleth session');
$iLocal = strpos($qb, 'if (penumbraPeerIsLocal()) {'); $iAdmin = strpos($qb, '$isAdmin = true;'); $iElse = strpos($qb, '} else {'); $iLog = strpos($qb, 'error_log("PENUMBRA SCHEDULER-KEY:');
T('Q1', 'query.php elevates to admin only inside the local-peer check, and logs a valid key from anywhere else',
    $iLocal !== false && $iAdmin !== false && $iElse !== false && $iLog !== false && $iLocal < $iAdmin && $iAdmin < $iElse && $iElse < $iLog
    && substr_count($query, "\$currentUserKey = 'SCHEDULER';") === 1 && substr_count($qb, '$isAdmin = true;') === 1);
$cb = between($db, '// (c) server-to-server', '// (a) same-origin custom header (primary defense).');
T('Q2', 'the CSRF guard\'s scheduler bypass requires the local peer too', strpos($cb, "hash_equals((string)\$config['scheduler_secret_key'], (string)\$_POST['scheduler_key'])") !== false
    && strpos($cb, '&& penumbraPeerIsLocal()) {') !== false);
T('Q3', 'no other file accepts the key', substr_count($query, "\$_POST['scheduler_key']") === 3 && substr_count($db, "\$_POST['scheduler_key']") === 3
    && strpos($sched, "\$_POST['scheduler_key']") === false);

// ---------------------------------------------------------------- D: the file-drop block, RUN
// The block between its markers is lifted and run inside a one-pass loop (its own
// `continue` needs one), with the runner's two logging calls stubbed.
$GLOBALS['__audits'] = array(); $GLOBALS['__slog'] = array();
function log_scheduler($m) { $GLOBALS['__slog'][] = $m; }
function log_penumbra_scheduler_audit($conn, $rid, $action, $msg, $ctx = null) { $GLOBALS['__audits'][] = array($rid, $action, $msg); }
$dropCode = lift($runner, '                $pnbDropSecretErr = null;', '                log_scheduler("Executing DROP_FILE task -- protocol=', 'the file-drop secret block');
$runDrop = function ($options) use ($dropCode) {
    $GLOBALS['__audits'] = array(); $GLOBALS['__slog'] = array();
    $taskId = 77; $conn = null; $task = array('REPORT_ID' => 'rep1'); $taskContext = array(); $reached = false;
    eval('foreach (array(1) as $__once) { ' . $dropCode . ' $reached = true; }');
    return array('reached' => $reached, 'options' => $options, 'audits' => $GLOBALS['__audits'], 'log' => $GLOBALS['__slog']);
};
$okPw = encrypt_scheduler_password('sftp-pass'); $okAk = encrypt_scheduler_password('AKIAEXAMPLE'); $okSk = encrypt_scheduler_password('s3-secret-value');
$d = $runDrop(array('drop_password' => $okPw, 'drop_s3_access_key' => $okAk, 'drop_s3_secret_key' => $okSk));
T('D1', 'three readable secrets: the task goes on with the plaintexts in its runtime keys, nothing audited', $d['reached'] === true && count($d['audits']) === 0
    && isset($d['options']['_decrypted_password']) && $d['options']['_decrypted_password'] === 'sftp-pass'
    && $d['options']['_decrypted_s3_access_key'] === 'AKIAEXAMPLE' && $d['options']['_decrypted_s3_secret_key'] === 's3-secret-value');
$d = $runDrop(array('drop_password' => $other));
T('D2', 'an unreadable drop password: the task stops there, one SCHEDULE_FAIL names the field, no runtime key is set', $d['reached'] === false && count($d['audits']) === 1
    && $d['audits'][0][1] === 'SCHEDULE_FAIL' && strpos($d['audits'][0][2], 'file drop password') !== false && $d['audits'][0][0] === 'rep1'
    && !array_key_exists('_decrypted_password', $d['options']) && count($d['log']) === 1 && strpos($d['log'][0], 'task #77') !== false, var_export($d['audits'], true));
$d = $runDrop(array('drop_s3_access_key' => $okAk, 'drop_s3_secret_key' => 'garbage!!'));
T('D3', 'a readable access key and a damaged secret key: stopped, and the message names the S3 secret key', $d['reached'] === false && count($d['audits']) === 1
    && strpos($d['audits'][0][2], 'S3 secret key') !== false && !array_key_exists('_decrypted_s3_secret_key', $d['options']), var_export($d['audits'], true));
$d = $runDrop(array('drop_protocol' => 'unc'));
T('D4', 'no stored secret at all (a folder drop): the task goes on, no runtime key, nothing audited', $d['reached'] === true && count($d['audits']) === 0
    && !array_key_exists('_decrypted_password', $d['options']) && !array_key_exists('_decrypted_s3_access_key', $d['options']));

// ---------------------------------------------------------------- R: the runner's call sites
T('R1', 'an encrypted report whose stored password did not read says so (false), not "no password provided"',
    strpos($runner, "if (!\$password) return array('error' => (\$password === false") !== false
    && strpos($runner, "Report is encrypted and the task's stored password could not be read") !== false
    && strpos($runner, '"Report is encrypted but no password provided."') !== false);
$dropBlock = between($runner, '// Pre-decrypt sensitive fields into temporary runtime keys (never persisted)', 'log_scheduler("Executing DROP_FILE task -- protocol=');
T('R2', 'the file-drop secrets go through scheduler_read_secret and an unreadable one fails the task before any connection',
    strpos($dropBlock, 'scheduler_read_secret($options, $pnbField, $pnbTo[1])') !== false
    && strpos($dropBlock, "'SCHEDULE_FAIL', \$pnbDropSecretErr, \$taskContext);") !== false
    && preg_match('/SCHEDULE_FAIL.*\n\s*continue;/', $dropBlock) === 1
    && strpos($dropBlock, "'drop_password'") !== false && strpos($dropBlock, "'drop_s3_access_key'") !== false && strpos($dropBlock, "'drop_s3_secret_key'") !== false);
T('R3', 'no call site hands a transport the raw decrypt result any more', strpos($runner, "\$options['_decrypted_password'] = decrypt_scheduler_password(") === false
    && strpos($runner, "\$options['_decrypted_s3_secret_key'] = decrypt_scheduler_password(") === false);

echo ($pass + $fail) . " assertions, $fail failed\n";
exit($fail ? 1 : 0);
