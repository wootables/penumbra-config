<?php
/**
 * penumbra_tests/sftpkey - the SFTP/SCP private key of a Drop-a-File task is a
 * protected secret like the drop password and the S3 keys (2026-10-16).
 *
 *   php -n -d extension_dir=<php>/ext -d extension=openssl test_sftpkey.php --app=<dir> [--control] [--mutant=<name>]
 *
 * --app is the tree under test: a stage, or the live webroot after the deploy.
 * REAL code throughout, lifted by the tokenizer out of the files (never included:
 * manage_schedule.php answers a request, schedule_runner.php talks to Oracle and
 * sends email) - except plugins/file_transport.php, which only declares and is
 * require'd from a scratch copy so its SFTP/SCP entry points run for real up to
 * the point where they would dial a host.
 *
 *   C  the shared crypto helpers (db_connection.php) and their interop with
 *      encrypt_scheduler_password (manage) / decrypt_scheduler_password (runner)
 *   N  the normaliser that encrypts a plaintext key inside a task's options
 *   P  penumbra_sched_apply_sftp_key: the save decision (new key, blank keeps,
 *      a kept plaintext key is migrated, remove, old client posting it inside options)
 *   R  scheduler_read_sftp_key: the runner's reader (none / encrypted / legacy / damaged)
 *   T  the transport reads ONLY the runner-decrypted key; a stored key that was
 *      not decrypted is refused before anything is dialled
 *   L  the list strips the key and sends has_drop_sftp_key (static)
 *   A  get_audit_data.php masks drop_sftp_key on both sides like the password
 *   E  the runner's DROP_FILE block hands the decrypted key to the transport (static)
 *   J  main.js: the key left the options JSON, is posted on its own, blank keeps,
 *      the notice and its Remove link (static); I index.php markup (static)
 *   H  the Scheduler help no longer says the key is stored unencrypted
 *   M  the migration CLI: CLI guard, its pure classify / report-line functions,
 *      never prints a key (static)
 *
 * --control adds one deliberately false assertion (the harness can fail).
 * --mutant=<name> breaks ONE decision in memory before lifting, and the named
 * checks must go red (run.ps1 -Mutants runs all four with exact counts):
 *   plainsave   the save stores the posted key as it is      (P1 P6 P7 P8 P10 red = 5)
 *   rawkey      the transport reads the stored key           (T2 T4 T6 red = 3)
 *   nostrip     the list keeps the key in the payload        (L1 red = 1)
 *   nodecrypt   the runner's reader returns the stored value (R2 R4 red = 2)
 *
 * Tail must read "PASS: N   FAIL: 0" then "RESULT: GREEN".
 */
$o = getopt('', array('app:', 'control', 'mutant:'));
if (empty($o['app'])) { fwrite(STDERR, "usage: --app=<dir> [--control] [--mutant=plainsave|rawkey|nostrip|nodecrypt]\n"); echo "RESULT: RED\n"; exit(2); }
$APP = rtrim(str_replace('\\', '/', $o['app']), '/');
$CONTROL = isset($o['control']);
$MUTANT = isset($o['mutant']) ? $o['mutant'] : '';

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $info = '') {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($info !== '' ? "   [$info]" : '') . "\n"; }
}
function rd($rel) {
    global $APP;
    $s = @file_get_contents("$APP/$rel");
    if ($s === false) { echo "FATAL: cannot read $APP/$rel\n"; echo "RESULT: RED\n"; exit(2); }
    return $s;
}
/** Lift one NAMED function's source (from `function` to its matching `}`), tokenizer-exact. */
function lift_function($src, $name) {
    $tokens = token_get_all($src);
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        if (!($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING && $tokens[$j][1] === $name)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $t = $tokens[$k]; $txt = is_array($t) ? $t[1] : $t;
            $buf .= $txt;
            if ($txt === '{' || (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES))) { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    return null;
}
function lift_or_die($src, $name, $file) {
    $c = lift_function($src, $name);
    if ($c === null) { echo "FATAL: could not lift $name() from $file\n"; echo "RESULT: RED\n"; exit(2); }
    eval($c);
}
/** Apply a mutant to one source text: the anchor must occur exactly once. */
function mutate(&$text, $from, $to, $what) {
    $n = substr_count($text, $from);
    if ($n !== 1) { echo "MUTANT NOT APPLICABLE ($what): anchor occurs $n times\n"; echo "RESULT: RED\n"; exit(3); }
    $text = str_replace($from, $to, $text);
    echo "mutant applied: $what\n";
}

if (!function_exists('openssl_encrypt')) { echo "FATAL: openssl is not loaded (run with -d extension_dir=<php>/ext -d extension=openssl)\n"; echo "RESULT: RED\n"; exit(2); }
if (!defined('SCHEDULER_SECRET_KEY')) define('SCHEDULER_SECRET_KEY', 'suite-secret-not-the-real-one-2026-10-16');
echo "app: $APP" . ($MUTANT !== '' ? "   mutant: $MUTANT" : '') . "\n";

// ------------------------------------------------------------------ sources
$srcDb      = rd('db_connection.php');
$srcManage  = rd('manage_schedule.php');
$srcRunner  = rd('schedule_runner.php');
$srcTrans   = rd('plugins/file_transport.php');
$srcAudit   = rd('get_audit_data.php');
$srcCli     = rd('encrypt_sftp_keys_cli.php');
$srcMain    = rd('js/main.js');
$srcIndex   = rd('index.php');
$srcHelp    = rd('help/topics/schedulerHelpLightbox.php');
// the runner is 1.7 MB: tokenize only the slice holding the secret readers
$rs = strpos($srcRunner, 'function decrypt_scheduler_password(');
$re = strpos($srcRunner, 'function safe_json_decode(');
if ($rs === false || $re === false || $re < $rs) { echo "FATAL: the runner's secret readers were not found\n"; echo "RESULT: RED\n"; exit(2); }
$runnerSlice = "<?php\n" . substr($srcRunner, $rs, $re - $rs);

if ($MUTANT === 'plainsave') {
    mutate($srcManage, "\$options['drop_sftp_key'] = encrypt_scheduler_password(\$posted_key);", "\$options['drop_sftp_key'] = \$posted_key;", 'the save stores the posted key as it is');
} elseif ($MUTANT === 'rawkey') {
    mutate($srcTrans, "\$plain = isset(\$options['_decrypted_sftp_key']) && is_string(\$options['_decrypted_sftp_key']) ? trim(\$options['_decrypted_sftp_key']) : '';",
                      "\$plain = isset(\$options['drop_sftp_key']) && is_string(\$options['drop_sftp_key']) ? trim(\$options['drop_sftp_key']) : '';", 'the transport reads the stored key');
} elseif ($MUTANT === 'nostrip') {
    mutate($srcManage, "            if (isset(\$opts['drop_sftp_key']) && !empty(\$opts['drop_sftp_key'])) {\n                \$opts['has_drop_sftp_key'] = true;\n                \$opts['drop_sftp_key'] = null;\n                \$opts_modified = true;\n            }\n", '', 'the list keeps the key in the payload');
} elseif ($MUTANT === 'nodecrypt') {
    mutate($runnerSlice, "\$plain = decrypt_scheduler_password(\$stored);", "\$plain = \$stored;", "the runner's reader returns the stored value");
} elseif ($MUTANT !== '') {
    echo "unknown mutant: $MUTANT\n"; echo "RESULT: RED\n"; exit(2);
}

// ------------------------------------------------------------------ lifts
foreach (array('penumbraSchedulerSecretIsStored', 'penumbraSchedulerSecretEncrypt', 'penumbraSchedulerSecretDecrypt', 'penumbraSchedulerEncryptPlainSftpKey') as $fn) lift_or_die($srcDb, $fn, 'db_connection.php');
foreach (array('encrypt_scheduler_password', 'penumbra_sched_apply_sftp_key') as $fn) lift_or_die($srcManage, $fn, 'manage_schedule.php');
foreach (array('decrypt_scheduler_password', 'scheduler_read_secret', 'scheduler_read_sftp_key') as $fn) lift_or_die($runnerSlice, $fn, 'schedule_runner.php');
lift_or_die($srcAudit, 'penumbraMaskSchedSecrets', 'get_audit_data.php');
foreach (array('encrypt_sftp_keys_state', 'encrypt_sftp_keys_line') as $fn) lift_or_die($srcCli, $fn, 'encrypt_sftp_keys_cli.php');
$tmpDir = rtrim(sys_get_temp_dir(), '/\\') . '/pnb_sftpkey_' . getmypid();
if (!is_dir($tmpDir)) mkdir($tmpDir, 0777, true);
file_put_contents("$tmpDir/file_transport.php", $srcTrans);
require "$tmpDir/file_transport.php";
ok(function_exists('transport_sftp') && function_exists('transport_scp') && function_exists('_penumbra_drop_sftp_key'), 'S0 every function under test lifted or required (db_connection, manage, runner slice, audit data, CLI, transport)');

// Fixtures: fake keys (headers real, bodies made up - nothing here is a key)
$BODY = str_repeat('FAKEKEYBODYTOKEN0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/', 12);
$PEM_RSA     = "-----BEGIN RSA PRIVATE KEY-----\n" . chunk_split($BODY, 64, "\n") . "-----END RSA PRIVATE KEY-----";
$PEM_OPENSSH = "-----BEGIN OPENSSH PRIVATE KEY-----\n" . chunk_split($BODY, 70, "\n") . "-----END OPENSSH PRIVATE KEY-----\n";
$PPK         = "PuTTY-User-Key-File-2: ssh-rsa\nEncryption: none\nComment: fake\nPublic-Lines: 2\n" . chunk_split($BODY, 64, "\n") . "Private-MAC: 0123456789abcdef";
$SECRET2     = 'another-scheduler-secret';

// ------------------------------------------------------------------ C crypto
echo "C. the shared crypto helpers and their interop\n";
$encShared = penumbraSchedulerSecretEncrypt($PEM_RSA, SCHEDULER_SECRET_KEY);
$encManage = encrypt_scheduler_password($PEM_RSA);
ok(is_string($encShared) && penumbraSchedulerSecretIsStored($encShared), 'C1 the shared encrypt yields the stored shape');
ok(is_string($encManage) && penumbraSchedulerSecretIsStored($encManage), 'C2 encrypt_scheduler_password (the password helper) yields the same stored shape');
ok(decrypt_scheduler_password($encShared) === $PEM_RSA, 'C3 the runner decrypts what the shared helper encrypted (same algorithm)');
ok(penumbraSchedulerSecretDecrypt($encManage, SCHEDULER_SECRET_KEY) === $PEM_RSA, 'C4 the shared decrypt reads what the password helper encrypted');
ok(decrypt_scheduler_password($encManage) === $PEM_RSA, 'C5 the runner reads the password helper\'s output (the pre-existing pair still agrees)');
ok(!penumbraSchedulerSecretIsStored($PEM_RSA) && !penumbraSchedulerSecretIsStored($PEM_OPENSSH) && !penumbraSchedulerSecretIsStored($PPK), 'C6 PEM (RSA, OpenSSH) and PuTTY texts are NOT in the stored shape');
ok(!penumbraSchedulerSecretIsStored('') && !penumbraSchedulerSecretIsStored(null) && !penumbraSchedulerSecretIsStored(array('x')) && !penumbraSchedulerSecretIsStored(base64_encode('no separator here')), 'C7 empty, null, array and base64 without the separator are not stored');
ok(penumbraSchedulerSecretDecrypt($encShared, $SECRET2) === false, 'C8 a stored value under another secret does not decrypt (false)');
ok(penumbraSchedulerSecretDecrypt($PEM_RSA, SCHEDULER_SECRET_KEY) === false && decrypt_scheduler_password($PEM_RSA) === false, 'C9 a plaintext handed to either decrypt is false, never garbage');
ok(penumbraSchedulerSecretEncrypt('', SCHEDULER_SECRET_KEY) === null && penumbraSchedulerSecretEncrypt(null, SCHEDULER_SECRET_KEY) === null, 'C10 nothing to encrypt is null');
$enc2 = penumbraSchedulerSecretEncrypt($PEM_RSA, SCHEDULER_SECRET_KEY);
ok($enc2 !== $encShared && penumbraSchedulerSecretDecrypt($enc2, SCHEDULER_SECRET_KEY) === $PEM_RSA, 'C11 a fresh IV every time: two encryptions differ, both read back');

// ------------------------------------------------------------------ N normaliser
echo "N. the normaliser (a plaintext key inside a task's options)\n";
list($n1, $c1) = penumbraSchedulerEncryptPlainSftpKey(array('drop_protocol' => 'sftp', 'drop_sftp_key' => $PEM_OPENSSH), SCHEDULER_SECRET_KEY);
ok($c1 === true && penumbraSchedulerSecretIsStored($n1['drop_sftp_key']) && penumbraSchedulerSecretDecrypt($n1['drop_sftp_key'], SCHEDULER_SECRET_KEY) === $PEM_OPENSSH && $n1['drop_protocol'] === 'sftp', 'N1 a plaintext key is replaced by its ciphertext (changed = true), the other options untouched');
list($n2, $c2) = penumbraSchedulerEncryptPlainSftpKey(array('drop_sftp_key' => $encShared), SCHEDULER_SECRET_KEY);
ok($c2 === false && $n2['drop_sftp_key'] === $encShared, 'N2 a stored key is left byte-identical (no re-encryption, changed = false)');
list($n3, $c3) = penumbraSchedulerEncryptPlainSftpKey(array('drop_protocol' => 'unc'), SCHEDULER_SECRET_KEY);
list($n4, $c4) = penumbraSchedulerEncryptPlainSftpKey(array('drop_sftp_key' => ''), SCHEDULER_SECRET_KEY);
list($n5, $c5) = penumbraSchedulerEncryptPlainSftpKey(array('drop_sftp_key' => "  \n "), SCHEDULER_SECRET_KEY);
ok($c3 === false && $n3 === array('drop_protocol' => 'unc') && $c4 === false && $n4 === array('drop_sftp_key' => '') && $c5 === false, 'N3 no key, an empty key and a whitespace key are untouched');
list($n6, $c6) = penumbraSchedulerEncryptPlainSftpKey(null, SCHEDULER_SECRET_KEY);
ok($c6 === false && $n6 === null, 'N4 a non-array passes through');

// ------------------------------------------------------------------ P the save decision
echo "P. penumbra_sched_apply_sftp_key: the save decision\n";
$base = array('drop_protocol' => 'sftp', 'drop_host' => 'gosparcs.oit.ncsu.edu', 'drop_format_csv' => true);
list($p1, $note1) = penumbra_sched_apply_sftp_key($base, $PEM_RSA, false, null);
ok($note1 === 'new' && isset($p1['drop_sftp_key']) && penumbraSchedulerSecretIsStored($p1['drop_sftp_key']) && decrypt_scheduler_password($p1['drop_sftp_key']) === $PEM_RSA,
   'P1 a pasted key on a new task is stored in the stored shape and the runner reads it back', isset($p1['drop_sftp_key']) ? 'stored=' . (penumbraSchedulerSecretIsStored($p1['drop_sftp_key']) ? 'shape' : 'NOT shape') : 'no key');
ok($p1['drop_protocol'] === 'sftp' && $p1['drop_host'] === 'gosparcs.oit.ncsu.edu' && $p1['drop_format_csv'] === true, 'P2 the other options ride through untouched');
$stored = array('drop_protocol' => 'sftp', 'drop_sftp_key' => $encShared, 'drop_password' => 'cipher-not-under-test');
list($p3, $note3) = penumbra_sched_apply_sftp_key($base, '', false, $stored);
ok($note3 === 'kept' && $p3['drop_sftp_key'] === $encShared, 'P3 a blank field on an existing task keeps the stored key byte-identical');
$legacy = array('drop_protocol' => 'sftp', 'drop_sftp_key' => $PEM_OPENSSH);
list($p4, $note4) = penumbra_sched_apply_sftp_key($base, '', false, $legacy);
ok($note4 === 'migrated' && penumbraSchedulerSecretIsStored($p4['drop_sftp_key']) && decrypt_scheduler_password($p4['drop_sftp_key']) === $PEM_OPENSSH, 'P4 a blank field over a key stored as pasted (saved before the change) encrypts it on this save - migration on save');
list($p5, $note5) = penumbra_sched_apply_sftp_key($base, '', false, null);
ok($note5 === 'none' && !array_key_exists('drop_sftp_key', $p5), 'P5 a new task with a blank field stores no key at all');
list($p6, $note6) = penumbra_sched_apply_sftp_key($base, $PEM_RSA, true, $stored);
ok($note6 === 'new' && penumbraSchedulerSecretIsStored($p6['drop_sftp_key']) && decrypt_scheduler_password($p6['drop_sftp_key']) === $PEM_RSA, 'P6 remove + a pasted key: the pasted key wins and is encrypted');
$oldClient = $base; $oldClient['drop_sftp_key'] = $PEM_RSA;   // an older main.js still posts the textarea inside options
list($p7, $note7) = penumbra_sched_apply_sftp_key($oldClient, '', false, null);
ok($note7 === 'new' && penumbraSchedulerSecretIsStored($p7['drop_sftp_key']) && decrypt_scheduler_password($p7['drop_sftp_key']) === $PEM_RSA, 'P7 an older client posting the key inside options: consumed and encrypted');
list($p8, $note8) = penumbra_sched_apply_sftp_key($base, "\n  " . $PEM_RSA . "  \n", false, null);
ok($note8 === 'new' && decrypt_scheduler_password($p8['drop_sftp_key']) === $PEM_RSA, 'P8 surrounding whitespace is trimmed before encrypting (what the old client-side trim did)');
list($p9, $note9) = penumbra_sched_apply_sftp_key($base, '', true, $stored);
ok($note9 === 'removed' && !array_key_exists('drop_sftp_key', $p9), 'P9 remove with a blank field drops the stored key');
$all = json_encode(array($p1, $p3, $p4, $p6, $p7, $p8));
ok(strpos($all, 'FAKEKEYBODYTOKEN') === false, 'P10 no stored options carry the key as pasted (the body token is in none of them)');
$oldClient2 = $base; $oldClient2['drop_sftp_key'] = '';
list($p11, $note11) = penumbra_sched_apply_sftp_key($oldClient2, '', false, $stored);
ok($note11 === 'kept' && $p11['drop_sftp_key'] === $encShared, 'P11 an older client posting an empty key inside options keeps the stored one');
list($p12, $note12) = penumbra_sched_apply_sftp_key($base, '', false, array('drop_protocol' => 'sftp'));
ok($note12 === 'none' && !array_key_exists('drop_sftp_key', $p12), 'P12 an existing task without a key stays without one');

// ------------------------------------------------------------------ R the runner's reader
echo "R. scheduler_read_sftp_key: the runner's reader\n";
ok(scheduler_read_sftp_key(array('drop_protocol' => 'sftp')) === array(null, null, false) && scheduler_read_sftp_key(array('drop_sftp_key' => '')) === array(null, null, false), 'R1 no key stored: null / null / not legacy');
list($rk, $rerr, $rleg) = scheduler_read_sftp_key(array('drop_sftp_key' => $encShared));
ok($rk === $PEM_RSA && $rerr === null && $rleg === false, 'R2 a stored key decrypts to the pasted text, not legacy', 'got ' . ($rk === $encShared ? 'the STORED value' : ($rk === $PEM_RSA ? 'the key' : var_export($rk === null, true))));
list($rk3, $rerr3, $rleg3) = scheduler_read_sftp_key(array('drop_sftp_key' => $PPK));
ok($rk3 === $PPK && $rerr3 === null && $rleg3 === true, 'R3 a key still stored as pasted is handed back as it is and flagged legacy (the runner notes it)');
list($rk4, $rerr4, $rleg4) = scheduler_read_sftp_key(array('drop_sftp_key' => penumbraSchedulerSecretEncrypt($PEM_RSA, $SECRET2)));
ok($rk4 === null && is_string($rerr4) && strpos($rerr4, 'SSH private key') !== false && $rleg4 === false, 'R4 a stored value under another secret: no key, an error naming the SSH private key');
ok(scheduler_read_sftp_key(array('drop_sftp_key' => array('x'))) === array(null, null, false) && scheduler_read_sftp_key('not-an-array') === array(null, null, false), 'R5 a non-string value or non-array options: nothing');
list($rs1, $rse1) = scheduler_read_secret(array('drop_password' => $encShared), 'drop_password', 'file drop password');
ok($rs1 === $PEM_RSA && $rse1 === null, 'R6 scheduler_read_secret (the password reader) is unchanged');

// ------------------------------------------------------------------ T the transport
echo "T. the transport reads only the runner-decrypted key\n";
$guard = 'was not decrypted for this run';
$noKey = array('drop_host' => '127.0.0.1', 'drop_port' => 1, 'drop_username' => 'u', '_decrypted_password' => 'p');
$r1 = transport_sftp('data', '/x/a.csv', $noKey);
ok(is_array($r1) && $r1['success'] === false && strpos($r1['message'], $guard) === false, 'T1 no key at all: the guard does not fire (the call goes on to the library / host step)', isset($r1['message']) ? $r1['message'] : '');
$storedOnly = $noKey; $storedOnly['drop_sftp_key'] = $encShared;
$r2 = transport_sftp('data', '/x/a.csv', $storedOnly);
ok(is_array($r2) && $r2['success'] === false && strpos($r2['message'], $guard) !== false, 'T2 SFTP: a stored key that was not decrypted is refused before anything is dialled', isset($r2['message']) ? $r2['message'] : '');
$decrypted = $storedOnly; $decrypted['_decrypted_sftp_key'] = $PEM_RSA;
$r3 = transport_sftp('data', '/x/a.csv', $decrypted);
ok(is_array($r3) && strpos($r3['message'], $guard) === false, 'T3 SFTP: with the runner-decrypted key present the guard stands down', isset($r3['message']) ? $r3['message'] : '');
$r4 = transport_scp('data', '/x/a.csv', $storedOnly);
ok(is_array($r4) && $r4['success'] === false && strpos($r4['message'], $guard) !== false, 'T4 SCP: the same refusal', isset($r4['message']) ? $r4['message'] : '');
$r5 = transport_scp('data', '/x/a.csv', $decrypted);
ok(is_array($r5) && strpos($r5['message'], $guard) === false, 'T5 SCP: stands down with the decrypted key');
ok(_penumbra_drop_sftp_key(array('_decrypted_sftp_key' => " $PEM_RSA\n")) === $PEM_RSA && _penumbra_drop_sftp_key(array()) === '' && _penumbra_drop_sftp_key(array('drop_sftp_key' => 'x')) === false && _penumbra_drop_sftp_key(array('drop_sftp_key' => '', '_decrypted_sftp_key' => '')) === '', 'T6 the resolver: decrypted key (trimmed) / nothing / stored-undecrypted = false / both empty = nothing');
ok(preg_match('/PublicKeyLoader::load\(\s*\$options\[/', $srcTrans) === 0, 'T7 (static) the key loader is never handed a raw option');
ok(preg_match('/\$options\[\'_decrypted_password\'\]/', $srcTrans) === 1 || preg_match_all('/_decrypted_password/', $srcTrans) >= 3, 'T8 (static) password auth still reads the runner-decrypted password');

// ------------------------------------------------------------------ L the list
echo "L. the task list\n";
ok(strpos($srcManage, "if (isset(\$opts['drop_sftp_key']) && !empty(\$opts['drop_sftp_key'])) {\n                \$opts['has_drop_sftp_key'] = true;\n                \$opts['drop_sftp_key'] = null;\n                \$opts_modified = true;\n            }") !== false, 'L1 (static) the list nulls drop_sftp_key and sends has_drop_sftp_key, the password\'s pattern');
ok(strpos($srcManage, "list(\$options, \$sftp_key_note) = penumbra_sched_apply_sftp_key(") !== false && strpos($srcManage, "isset(\$_POST['drop_sftp_key']) ? \$_POST['drop_sftp_key'] : ''") !== false, 'L2 (static) the save path hands the drop_sftp_key POST field to the decision');
ok(strpos($srcManage, "'drop_s3_secret_key', 'drop_sftp_key') as \$mask_key)") !== false, 'L3 (static) the draft-test audit masks drop_sftp_key with the password');
ok(substr_count($srcManage, "penumbraSchedulerEncryptPlainSftpKey(\$s_opts, SCHEDULER_SECRET_KEY)") === 1 && substr_count($srcManage, "penumbraSchedulerEncryptPlainSftpKey(\$before_row['OPTIONS'], SCHEDULER_SECRET_KEY)") === 1, 'L4 (static) a restore and the BEFORE snapshot of a save run the normaliser');
ok(strpos($srcManage, "\$sftp_key_note === 'migrated'") !== false, 'L5 (static) the update audit row carries a message when a stored plaintext key was encrypted');
ok(preg_match('/\$options\[\'drop_sftp_key\'\]\s*=\s*\$_POST/', $srcManage) === 0, 'L6 (static) nothing stores the POST field as it is');

// ------------------------------------------------------------------ A audit masking
echo "A. get_audit_data.php masking\n";
$snapEnc = array('ID' => 1, 'OPTIONS' => array('drop_sftp_key' => $encShared, 'drop_password' => $encShared, 'drop_host' => 'h'));
$m1 = penumbraMaskSchedSecrets($snapEnc);
ok($m1['OPTIONS']['drop_sftp_key'] === '(encrypted)' && $m1['OPTIONS']['drop_password'] === '(encrypted)' && $m1['OPTIONS']['drop_host'] === 'h', 'A1 a stored key is collapsed to (encrypted) like the password; other options untouched');
$snapOld = array('ID' => 1, 'options' => array('drop_sftp_key' => $PEM_RSA));
$m2 = penumbraMaskSchedSecrets($snapOld);
ok(strpos(json_encode($m2), 'FAKEKEYBODYTOKEN') === false && is_string($m2['options']['drop_sftp_key']) && $m2['options']['drop_sftp_key'] !== '(encrypted)', 'A2 a snapshot from before the change (key as pasted) ships a marker, never the key, and not the (encrypted) marker');
$m3 = penumbraMaskSchedSecrets(array('OPTIONS' => array('drop_sftp_key' => '', 'drop_protocol' => 'unc')));
ok($m3['OPTIONS']['drop_sftp_key'] === '' && penumbraMaskSchedSecrets('scalar') === 'scalar', 'A3 an empty value and a non-array snapshot pass through');

// ------------------------------------------------------------------ E the runner's DROP_FILE block
echo "E. the runner hands the key to the transport\n";
ok(strpos($srcRunner, "list(\$pnbKeyPlain, \$pnbKeyErr, \$pnbKeyLegacy) = scheduler_read_sftp_key(\$options);") !== false && strpos($srcRunner, "\$options['_decrypted_sftp_key'] = \$pnbKeyPlain;") !== false, 'E1 (static) the DROP_FILE block decrypts into _decrypted_sftp_key through the reader');
ok(strpos($srcRunner, "still stores its SSH private key as pasted (unencrypted)") !== false && strpos($srcRunner, "\$pnbDropSecretErr = \$pnbKeyErr;") !== false, 'E2 (static) a legacy key is noted in the log and an unreadable one stops the task like a bad password');
ok(substr_count($srcRunner, "\r\n") > 0 && preg_match('/(?<!\r)\n/', $srcRunner) === 0, 'E3 (static) the runner is still pure CRLF (no lone LF introduced)');

// ------------------------------------------------------------------ J main.js / I index.php
echo "J. main.js and index.php\n";
ok(preg_match('/optionsObj\.drop_sftp_key\s*=/', $srcMain) === 0, 'J1 the key is no longer written into the options JSON');
ok(preg_match('/options\.drop_sftp_key\b/', $srcMain) === 0 && strpos($srcMain, "\$('#schedDropSftpKey').val('');") !== false, 'J2 the form reload never fills the textarea from the list (blank; the list has no key anyway)');
ok(strpos($srcMain, "drop_sftp_key: taskType === 'DROP_FILE' ? (\$('#schedDropSftpKey').val().trim() || '') : '',") !== false, 'J3 the key is posted as its own field, trimmed, DROP_FILE only');
ok(strpos($srcMain, "drop_sftp_key_remove: (taskType === 'DROP_FILE' && _schedDropSftpKeyRemove) ? 'true' : 'false',") !== false, 'J4 the remove flag is posted');
ok(strpos($srcMain, "if (options.has_drop_sftp_key) {\r\n                    \$('#schedDropSftpKeyNotice').show();") !== false, 'J5 has_drop_sftp_key shows the Key saved notice');
ok(strpos($srcMain, "(\$('#schedDropSftpKeyNotice').is(':visible') && !\$('#schedDropSftpKey').val().trim())") !== false, 'J6 preserve_drop_secrets counts a visible key notice with a blank textarea');
ok(strpos($srcMain, "\$(document).on('click', '#schedDropSftpKeyRemove'") !== false && strpos($srcMain, "var _schedDropSftpKeyRemove = false;") !== false && strpos($srcMain, "#schedDropSftpKeyNotice').hide();") !== false, 'J7 the Remove link handler, its flag and the reset exist');
ok(substr_count($srcMain, "\x00") === 2 && preg_match('/(?<!\r)\n/', $srcMain) === 0, 'J8 main.js keeps its two NUL bytes and pure CRLF');
ok(strpos($srcIndex, 'id="schedDropSftpKeyNotice"') !== false && strpos($srcIndex, 'Key saved. Leave blank to keep. <a href="#" id="schedDropSftpKeyRemove">Remove the saved key</a>') !== false && strpos($srcIndex, 'id="schedDropSftpKeyRemoved"') !== false, 'I1 index.php carries the notice, the Remove link and the removed-state text under the Private Key textarea');
ok(strpos($srcIndex, 'id="schedDropSftpKey" rows="3"') !== false, 'I2 the textarea itself is unchanged');

// ------------------------------------------------------------------ H help
echo "H. the Scheduler help\n";
ok(stripos($srcHelp, 'private key is not encrypted') === false && stripos($srcHelp, 'stored unencrypted') === false, 'H1 the topic no longer says the key is stored unencrypted');
ok(strpos($srcHelp, 'the SFTP/SCP <strong>private key</strong> are encrypted with <strong>AES-256-CBC</strong>') !== false, 'H2 the Credentials paragraph names the private key among the encrypted secrets');
ok(strpos($srcHelp, 'Password, S3 keys or SSH private key (all AES-256 encrypted)') !== false, 'H3 the "Which to use" Credentials cell agrees');
ok(strpos($srcHelp, '"Key saved. Leave blank to keep."') !== false && strpos($srcHelp, 'Remove the saved key') !== false, 'H4 the notice and the Remove link are described');
ok(strpos($srcHelp, "if (!defined('PNB_HELP_V2')) { http_response_code(404); exit; }") !== false && substr_count($srcHelp, 'class="help-topic"') === 1, 'H5 the fragment keeps its guard and its one topic div');
ok(strpos($srcHelp, "\xE2\x80\x94") === false, 'H6 no em-dash in the topic');

// ------------------------------------------------------------------ M the CLI
echo "M. encrypt_sftp_keys_cli.php\n";
$cliCode = php_strip_whitespace("$APP/encrypt_sftp_keys_cli.php");
ok(preg_match('/^<\?php\s+if \(PHP_SAPI !== \'cli\'\)/', $cliCode) === 1, 'M1 the CLI guard is the first statement');
ok(encrypt_sftp_keys_state(array('drop_sftp_key' => $encShared)) === 'encrypted' && encrypt_sftp_keys_state(array('drop_sftp_key' => $PEM_RSA)) === 'plaintext' && encrypt_sftp_keys_state(array('drop_sftp_key' => '')) === 'none' && encrypt_sftp_keys_state(array()) === 'none' && encrypt_sftp_keys_state(null) === 'none', 'M2 classify: encrypted / plaintext / none');
$line = encrypt_sftp_keys_line(42, 'my-report', 'plaintext', strlen($PEM_RSA), "Daily feed\x00\x01 to partner");
ok(strpos($line, 'FAKEKEYBODYTOKEN') === false && strpos($line, '42') !== false && strpos($line, 'plaintext') !== false && strpos($line, (string)strlen($PEM_RSA)) !== false && strpos($line, "\x00") === false, 'M3 a report line names the task, state and size, never the key; control characters are stripped from the subject');
ok(preg_match('/out\([^\n]*drop_sftp_key/', $srcCli) === 0 && preg_match('/echo[^\n]*\$(o|opts|options|row|back|newOpts)\[/', $srcCli) === 0, 'M4 (static) nothing in the CLI prints an option value');
ok(strpos($srcCli, 'FOR UPDATE') !== false && strpos($srcCli, 'penumbraSchedulerEncryptPlainSftpKey(') !== false && substr_count($srcCli, 'penumbraSchedulerSecretDecrypt(') >= 2 && strpos($srcCli, "logPenumbraAudit(") !== false, 'M5 (static) row lock, the shared normaliser, a round-trip check before and after the write, and an audit row');
ok(strpos($srcCli, "require_once __DIR__ . '/db_connection.php';") !== false && strpos($srcCli, "define('SCHEDULER_SECRET_KEY'") !== false, 'M6 (static) it loads the app\'s connection and the same scheduler secret as the save path');
$helpOut = array(); $helpRc = 1;
$phpBin = PHP_BINARY;
$cwdBefore = getcwd();
chdir($tmpDir);   // cmd.exe refuses a UNC working directory and says so on stderr
@exec('"' . $phpBin . '" -n ' . escapeshellarg("$APP/encrypt_sftp_keys_cli.php") . ' --help 2>&1', $helpOut, $helpRc);
chdir($cwdBefore);
ok($helpRc === 0 && strpos(implode("\n", $helpOut), '--commit') !== false, 'M7 --help runs without the database (exit 0) and names --commit', 'rc=' . $helpRc);

// ------------------------------------------------------------------ D shared file
echo "D. db_connection.php\n";
ok(strpos($srcDb, "if (!function_exists('penumbraSchedulerSecretIsStored')) {") !== false, 'D1 the helpers are guarded like the other shared scheduler helpers');
ok(preg_match('/(?<!\r)\n/', $srcDb) === 1 || substr_count($srcDb, "\r\n") === 0, 'D2 db_connection.php stays LF-only');

if ($CONTROL) ok(false, 'CONTROL: a deliberately false assertion (the harness can fail)');

@unlink("$tmpDir/file_transport.php"); @rmdir($tmpDir);
echo "PASS: $PASS   FAIL: $FAIL\n";
echo ($FAIL === 0 && $PASS > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
