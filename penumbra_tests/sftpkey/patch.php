<?php
/**
 * sftpkey/patch.php - the "SFTP/SCP private key at rest" change as data (2026-10-16).
 *
 *   php -n patch.php --from=<tree with the current files> --to=<stage tree>
 *
 * Copies every touched file from --from into --to and applies each edit as an
 * EXACT-MATCH replacement: an anchor that does not occur exactly once is a hard
 * failure (nothing is written for that file), so the same script re-applies the
 * change to a fresh copy of live at deploy time and tells you when live moved
 * under an anchor. Line endings are honoured per file (schedule_runner.php and
 * js/main.js are CRLF; the rest LF) and nothing else about the bytes changes.
 * Also copies the whole help/ tree (the helpv2 lint needs every fragment) and
 * drops the switch markers from the copy, and installs the new CLI from files/.
 *
 * WHAT THE CHANGE IS
 *   db_connection.php      shared helpers: stored-shape test, encrypt/decrypt (the
 *                          save path's algorithm), and the normaliser that encrypts a
 *                          plaintext drop_sftp_key in a task's options
 *   manage_schedule.php    list: the key is stripped and has_drop_sftp_key sent;
 *                          save: the key is its own POST field, encrypted with the
 *                          password's helper (penumbra_sched_apply_sftp_key: blank
 *                          keeps, a kept plaintext key is encrypted = migration on
 *                          save, remove drops); the BEFORE audit snapshot and a
 *                          restore from an audit snapshot never carry a plaintext key;
 *                          the draft-test audit masks it like the password
 *   schedule_runner.php    scheduler_read_sftp_key(): decrypts into _decrypted_sftp_key
 *                          (a key still stored as pasted is used and noted)
 *   plugins/file_transport.php  SFTP/SCP read ONLY _decrypted_sftp_key; a stored key
 *                          that was not decrypted is refused before dialling
 *   get_audit_data.php     masks drop_sftp_key on both sides like the password
 *   index.php / js/main.js the "Key saved. Leave blank to keep." notice with a
 *                          "Remove the saved key" link; the key leaves the options JSON
 *   help/topics/schedulerHelpLightbox.php  the Credentials paragraph and cell
 *   README.md              a tests entry, a landmine, an open item
 *   encrypt_sftp_keys_cli.php (NEW)  one-off migration of every stored plaintext key
 */
$o = getopt('', array('from:', 'to:'));
if (empty($o['from']) || empty($o['to'])) { fwrite(STDERR, "usage: php -n patch.php --from=<dir> --to=<dir>\n"); exit(2); }
$FROM = rtrim(str_replace('\\', '/', $o['from']), '/');
$TO   = rtrim(str_replace('\\', '/', $o['to']), '/');
$FILES_DIR = str_replace('\\', '/', __DIR__) . '/files';

$edits = array();
function edit($file, $anchor, $replacement) { global $edits; $edits[$file][] = array($anchor, $replacement); }

// =============================================================================
// db_connection.php - the shared helpers
// =============================================================================
edit('db_connection.php', <<<'ANCHOR'
if (!function_exists('penumbraDropDestinationError')) {
ANCHOR
, <<<'REPL'
if (!function_exists('penumbraSchedulerSecretIsStored')) {
    /**
     * Scheduled-task secrets at rest (2026-10-16). manage_schedule.php encrypts a
     * task's password and S3 keys with AES-256-CBC under the scheduler secret
     * (encrypt_scheduler_password) and schedule_runner.php reads them back
     * (decrypt_scheduler_password). The SFTP/SCP private key (drop_sftp_key)
     * joined them on 2026-10-16: until then it was stored as pasted inside the
     * options JSON, returned to the browser by every task list and loaded raw by
     * the transport. These helpers are the shared half: the stored SHAPE (base64
     * of "<base64 ciphertext>::<16-byte IV>"), the same encrypt / decrypt as the
     * two scripts (here so the one-off migration CLI, encrypt_sftp_keys_cli.php,
     * runs the real algorithm), and the normaliser every writer runs over a
     * task's options so a plaintext key never reaches the table again: the save
     * path (a key kept from the stored row), a restore from an audit snapshot,
     * the BEFORE audit snapshot of a save, and the CLI. Pinned by
     * penumbra_tests\sftpkey.
     */
    function penumbraSchedulerSecretIsStored($value) {
        if (!is_string($value) || $value === '') return false;
        $raw = base64_decode($value, true);
        if ($raw === false || strpos($raw, '::') === false) return false;
        list($data, $iv) = explode('::', $raw, 2);
        return strlen($iv) === 16 && $data !== '' && base64_decode($data, true) !== false;
    }
    /** The save path's algorithm (encrypt_scheduler_password). null for an empty value. */
    function penumbraSchedulerSecretEncrypt($plaintext, $secret) {
        if (!is_string($plaintext) || $plaintext === '') return null;
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', (string)$secret, 0, $iv);
        if ($encrypted === false) return null;
        return base64_encode($encrypted . '::' . $iv);
    }
    /** false when the value is not in the stored shape or does not decrypt under $secret. */
    function penumbraSchedulerSecretDecrypt($stored, $secret) {
        if (!penumbraSchedulerSecretIsStored($stored)) return false;
        list($data, $iv) = explode('::', base64_decode($stored, true), 2);
        return openssl_decrypt($data, 'aes-256-cbc', (string)$secret, 0, $iv);
    }
    /**
     * Encrypt a plaintext drop_sftp_key inside a task's options. Returns
     * array($options, $changed): $changed is true when a key stored as pasted was
     * replaced by its ciphertext; a stored (encrypted) key, an empty one and a
     * task without one come back untouched. Throws rather than hand back the
     * plaintext when openssl refuses - the caller must not store it.
     */
    function penumbraSchedulerEncryptPlainSftpKey($options, $secret) {
        if (!is_array($options) || !isset($options['drop_sftp_key']) || !is_string($options['drop_sftp_key'])) return array($options, false);
        $key = $options['drop_sftp_key'];
        if (trim($key) === '' || penumbraSchedulerSecretIsStored($key)) return array($options, false);
        $enc = penumbraSchedulerSecretEncrypt($key, $secret);
        if ($enc === null) throw new Exception('Could not encrypt the SSH private key.');
        $options['drop_sftp_key'] = $enc;
        return array($options, true);
    }
}

if (!function_exists('penumbraDropDestinationError')) {
REPL
);

// =============================================================================
// manage_schedule.php
// =============================================================================
// (1) the pure save decision, next to the helper it uses
edit('manage_schedule.php', <<<'ANCHOR'
function encrypt_scheduler_password($plaintext) {
    if (empty($plaintext)) return null;
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
    $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', SCHEDULER_SECRET_KEY, 0, $iv);
    return base64_encode($encrypted . '::' . $iv);
}
ANCHOR
, <<<'REPL'
function encrypt_scheduler_password($plaintext) {
    if (empty($plaintext)) return null;
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
    $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', SCHEDULER_SECRET_KEY, 0, $iv);
    return base64_encode($encrypted . '::' . $iv);
}

/**
 * The SSH private key of a Drop-a-File task on save (2026-10-16). Pure, pinned
 * by penumbra_tests\sftpkey. Returns array($options, $note).
 *   $options        the task's options as posted; a drop_sftp_key INSIDE them is an
 *                   older main.js's copy of the textarea and is consumed here, so the
 *                   stored options never carry the key as pasted
 *   $posted_key     the drop_sftp_key POST field ('' = the textarea was left blank)
 *   $remove         the form's "Remove the saved key" link was used
 *   $existing_opts  the stored row's options when the task already exists, else null
 * A pasted key is encrypted with the password's helper ('new'); a blank field
 * keeps the stored key ('kept'), encrypting it first when it is still the
 * plaintext an older save wrote ('migrated'); remove drops it ('removed');
 * nothing stored and nothing pasted stores none ('none').
 */
function penumbra_sched_apply_sftp_key($options, $posted_key, $remove, $existing_opts) {
    if (!is_array($options)) $options = array();
    $posted_key = is_string($posted_key) ? trim($posted_key) : '';
    if ($posted_key === '' && isset($options['drop_sftp_key']) && is_string($options['drop_sftp_key'])
            && trim($options['drop_sftp_key']) !== '' && !penumbraSchedulerSecretIsStored($options['drop_sftp_key'])) {
        $posted_key = trim($options['drop_sftp_key']);
    }
    unset($options['drop_sftp_key']);
    if ($posted_key !== '') {
        $options['drop_sftp_key'] = encrypt_scheduler_password($posted_key);
        return array($options, 'new');
    }
    if ($remove) return array($options, 'removed');
    if (is_array($existing_opts) && isset($existing_opts['drop_sftp_key']) && is_string($existing_opts['drop_sftp_key'])
            && trim($existing_opts['drop_sftp_key']) !== '') {
        $options['drop_sftp_key'] = $existing_opts['drop_sftp_key'];
        list($options, $migrated) = penumbraSchedulerEncryptPlainSftpKey($options, SCHEDULER_SECRET_KEY);
        return array($options, $migrated ? 'migrated' : 'kept');
    }
    return array($options, 'none');
}
REPL
);

// (2) list: strip the key, send the flag
edit('manage_schedule.php', <<<'ANCHOR'
            if (isset($opts['drop_s3_secret_key']) && !empty($opts['drop_s3_secret_key'])) {
                $opts['has_drop_s3_secret_key'] = true;
                $opts['drop_s3_secret_key'] = null;
                $opts_modified = true;
            }
ANCHOR
, <<<'REPL'
            if (isset($opts['drop_s3_secret_key']) && !empty($opts['drop_s3_secret_key'])) {
                $opts['has_drop_s3_secret_key'] = true;
                $opts['drop_s3_secret_key'] = null;
                $opts_modified = true;
            }
            // The SSH private key (drop_sftp_key) is a secret like the password
            // (2026-10-16): the form gets a "Key saved" flag, never the key - not
            // even one saved before that date, which is still plaintext until its
            // task is re-saved or encrypt_sftp_keys_cli.php runs.
            if (isset($opts['drop_sftp_key']) && !empty($opts['drop_sftp_key'])) {
                $opts['has_drop_sftp_key'] = true;
                $opts['drop_sftp_key'] = null;
                $opts_modified = true;
            }
REPL
);

// (3) save: the key is its own POST field
edit('manage_schedule.php', <<<'ANCHOR'
        // drop_s3_secret_key
        if (isset($_POST['drop_s3_secret_key']) && !empty($_POST['drop_s3_secret_key'])) {
            $options['drop_s3_secret_key'] = encrypt_scheduler_password($_POST['drop_s3_secret_key']);
        } else if ($preserve_drop && $drop_existing_opts && isset($drop_existing_opts['drop_s3_secret_key'])) {
            $options['drop_s3_secret_key'] = $drop_existing_opts['drop_s3_secret_key'];
        }
ANCHOR
, <<<'REPL'
        // drop_s3_secret_key
        if (isset($_POST['drop_s3_secret_key']) && !empty($_POST['drop_s3_secret_key'])) {
            $options['drop_s3_secret_key'] = encrypt_scheduler_password($_POST['drop_s3_secret_key']);
        } else if ($preserve_drop && $drop_existing_opts && isset($drop_existing_opts['drop_s3_secret_key'])) {
            $options['drop_s3_secret_key'] = $drop_existing_opts['drop_s3_secret_key'];
        }

        // drop_sftp_key - the SSH private key (2026-10-16). It used to ride inside
        // the options JSON as pasted: stored in plaintext, returned by every task
        // list, re-posted by the form. Now it is its own POST field, encrypted with
        // the password's helper, and a blank field keeps the stored key whatever
        // preserve_drop_secrets says (a key saved before this date is plaintext and
        // is encrypted on this save). The decision is penumbra_sched_apply_sftp_key()
        // (pinned by penumbra_tests\sftpkey); only the DB read happens here.
        $sftp_key_note = null;
        if ($task_type === 'DROP_FILE') {
            $sftp_existing_opts = $drop_existing_opts;
            if ($id && $sftp_existing_opts === null) {
                if (isset($existing_opts) && is_array($existing_opts)) {
                    $sftp_existing_opts = $existing_opts;
                } else {
                    $fetch3 = $conn->prepare("SELECT OPTIONS FROM NC_REPORTING.PENUMBRA_SCHEDULED_TASKS WHERE ID = :id");
                    $fetch3->bindValue(':id', $id);
                    $fetch3->execute();
                    $existing3 = $fetch3->fetch(PDO::FETCH_ASSOC);
                    if ($existing3) {
                        $existing_opts_str3 = is_resource($existing3['OPTIONS']) ? stream_get_contents($existing3['OPTIONS']) : $existing3['OPTIONS'];
                        $sftp_existing_opts = json_decode($existing_opts_str3, true);
                        $existing_opts = $sftp_existing_opts;
                    }
                }
            }
            list($options, $sftp_key_note) = penumbra_sched_apply_sftp_key(
                $options,
                isset($_POST['drop_sftp_key']) ? $_POST['drop_sftp_key'] : '',
                isset($_POST['drop_sftp_key_remove']) && $_POST['drop_sftp_key_remove'] == 'true',
                $id ? $sftp_existing_opts : null
            );
        } else {
            unset($options['drop_sftp_key']);
        }
REPL
);

// (4) the BEFORE snapshot of an update never carries a plaintext key
edit('manage_schedule.php', <<<'ANCHOR'
                $before_row['OPTIONS'] = json_decode($before_row['OPTIONS'], true);
            }
            $before_json = json_encode($before_row);
ANCHOR
, <<<'REPL'
                $before_row['OPTIONS'] = json_decode($before_row['OPTIONS'], true);
                // A key saved before 2026-10-16 is plaintext in the row: the audit
                // snapshot carries its ciphertext instead (restorable, never readable).
                list($before_row['OPTIONS']) = penumbraSchedulerEncryptPlainSftpKey($before_row['OPTIONS'], SCHEDULER_SECRET_KEY);
            }
            $before_json = json_encode($before_row);
REPL
);

// (5) the update's audit row says when a stored key was encrypted on this save
edit('manage_schedule.php', <<<'ANCHOR'
            if (function_exists('logPenumbraAudit')) {
                logPenumbraAudit($numeric_report_id, $audit_action, $before_json, $after_json);
            }
            touch_report_updated_at($conn, $numeric_report_id);

        } else {
ANCHOR
, <<<'REPL'
            if (function_exists('logPenumbraAudit')) {
                logPenumbraAudit($numeric_report_id, $audit_action, $before_json, $after_json,
                    ($sftp_key_note === 'migrated') ? 'SSH private key: the key this task stored as pasted was encrypted on this save (2026-10-16 change).' : null);
            }
            touch_report_updated_at($conn, $numeric_report_id);

        } else {
REPL
);

// (6) a draft test's audit masks the key like the password
edit('manage_schedule.php', <<<'ANCHOR'
                    foreach (array('report_password', 'drop_password', 'drop_s3_access_key', 'drop_s3_secret_key') as $mask_key) {
ANCHOR
, <<<'REPL'
                    foreach (array('report_password', 'drop_password', 'drop_s3_access_key', 'drop_s3_secret_key', 'drop_sftp_key') as $mask_key) {
REPL
);

// (7) a restore from an older snapshot writes the key back encrypted
edit('manage_schedule.php', <<<'ANCHOR'
        unset($s_opts['collision_info']);   // derived at list time, never persisted
ANCHOR
, <<<'REPL'
        unset($s_opts['collision_info']);   // derived at list time, never persisted
        // An older snapshot may carry the SSH private key as pasted (plaintext,
        // before 2026-10-16): it goes back encrypted, as a save would store it.
        list($s_opts) = penumbraSchedulerEncryptPlainSftpKey($s_opts, SCHEDULER_SECRET_KEY);
REPL
);

// =============================================================================
// schedule_runner.php (CRLF)
// =============================================================================
edit('schedule_runner.php', <<<'ANCHOR'
    return array($plain, null);
}
function safe_json_decode($jsonString) {
ANCHOR
, <<<'REPL'
    return array($plain, null);
}
/**
 * The SFTP/SCP private key (drop_sftp_key), encrypted at rest since 2026-10-16
 * (manage_schedule.php encrypts it like the password). A key saved before that
 * is still the pasted plaintext until its task is re-saved or
 * encrypt_sftp_keys_cli.php runs: it is used as it is, flagged so the caller can
 * say so in the log. Returns array($plaintext, $error, $legacy_plaintext):
 * null / null / false when no key is stored, the key when it reads, and null
 * with a message when a stored (encrypted) value does not decrypt.
 */
function scheduler_read_sftp_key($options) {
    if (!is_array($options) || !isset($options['drop_sftp_key']) || !is_string($options['drop_sftp_key']) || trim($options['drop_sftp_key']) === '') {
        return array(null, null, false);
    }
    $stored = $options['drop_sftp_key'];
    if (!penumbraSchedulerSecretIsStored($stored)) {
        return array($stored, null, true);
    }
    $plain = decrypt_scheduler_password($stored);
    if ($plain === false || $plain === null || $plain === '') {
        return array(null, "The task's stored SSH private key could not be read: it was saved under a different scheduler secret, or the stored value is damaged. Paste the key into the task again and save.", false);
    }
    return array($plain, null, false);
}
function safe_json_decode($jsonString) {
REPL
);

edit('schedule_runner.php', <<<'ANCHOR'
                    if ($pnbPlain !== null) $options[$pnbTo[0]] = $pnbPlain;
                }
                if ($pnbDropSecretErr !== null) {
ANCHOR
, <<<'REPL'
                    if ($pnbPlain !== null) $options[$pnbTo[0]] = $pnbPlain;
                }
                // The SSH private key (2026-10-16): decrypted into _decrypted_sftp_key,
                // the only key the transport reads; a key still stored as pasted
                // (saved before the change) is used as it is and noted.
                if ($pnbDropSecretErr === null) {
                    list($pnbKeyPlain, $pnbKeyErr, $pnbKeyLegacy) = scheduler_read_sftp_key($options);
                    if ($pnbKeyErr !== null) {
                        $pnbDropSecretErr = $pnbKeyErr;
                    } else if ($pnbKeyPlain !== null) {
                        $options['_decrypted_sftp_key'] = $pnbKeyPlain;
                        if ($pnbKeyLegacy) log_scheduler("  Notice: task #$taskId still stores its SSH private key as pasted (unencrypted) - re-save the task or run encrypt_sftp_keys_cli.php to encrypt it.");
                    }
                }
                if ($pnbDropSecretErr !== null) {
REPL
);

// =============================================================================
// plugins/file_transport.php
// =============================================================================
edit('plugins/file_transport.php', <<<'ANCHOR'
    require_once $autoload;
    return class_exists('phpseclib3\\Net\\SFTP');
}
ANCHOR
, <<<'REPL'
    require_once $autoload;
    return class_exists('phpseclib3\\Net\\SFTP');
}

// The SFTP/SCP private key for this run (2026-10-16). schedule_runner.php
// decrypts the stored drop_sftp_key into _decrypted_sftp_key
// (scheduler_read_sftp_key); the stored value is ciphertext at rest, like the
// password, and is never loaded here. '' = no key (password auth). false = a key
// is stored but was not decrypted for this run (a caller skipped the runner's
// step): refused rather than signing in with the wrong thing.
function _penumbra_drop_sftp_key($options) {
    $plain = isset($options['_decrypted_sftp_key']) && is_string($options['_decrypted_sftp_key']) ? trim($options['_decrypted_sftp_key']) : '';
    if ($plain !== '') return $plain;
    if (isset($options['drop_sftp_key']) && is_string($options['drop_sftp_key']) && trim($options['drop_sftp_key']) !== '') return false;
    return '';
}
REPL
);

edit('plugins/file_transport.php', <<<'ANCHOR'
    if (!_load_phpseclib3()) {
        return array('success' => false, 'message' => 'SFTP unavailable: phpseclib 3.x is not installed under plugins/lib/.');
    }
ANCHOR
, <<<'REPL'
    // The private key arrives decrypted from the runner (2026-10-16); resolved
    // before anything is dialled so a stored-but-undecrypted key is refused here.
    $sftpKey = _penumbra_drop_sftp_key($options);
    if ($sftpKey === false) {
        return array('success' => false, 'message' => 'SFTP: the task stores a private key but it was not decrypted for this run (schedule_runner.php reads it with scheduler_read_sftp_key()).');
    }

    if (!_load_phpseclib3()) {
        return array('success' => false, 'message' => 'SFTP unavailable: phpseclib 3.x is not installed under plugins/lib/.');
    }
REPL
);

edit('plugins/file_transport.php', <<<'ANCHOR'
        // Auth: key-based or password
        if (!empty($options['drop_sftp_key'])) {
            $key = \phpseclib3\Crypt\PublicKeyLoader::load($options['drop_sftp_key']);
            if (!$sftp->login($username, $key)) {
ANCHOR
, <<<'REPL'
        // Auth: key-based (the runner-decrypted key) or password
        if ($sftpKey !== '') {
            $key = \phpseclib3\Crypt\PublicKeyLoader::load($sftpKey);
            if (!$sftp->login($username, $key)) {
REPL
);

edit('plugins/file_transport.php', <<<'ANCHOR'
    if (!_load_phpseclib3()) {
        return array('success' => false, 'message' => 'SCP unavailable: phpseclib 3.x is not installed under plugins/lib/.');
    }
ANCHOR
, <<<'REPL'
    // The private key arrives decrypted from the runner (2026-10-16); see SFTP.
    $sftpKey = _penumbra_drop_sftp_key($options);
    if ($sftpKey === false) {
        return array('success' => false, 'message' => 'SCP: the task stores a private key but it was not decrypted for this run (schedule_runner.php reads it with scheduler_read_sftp_key()).');
    }

    if (!_load_phpseclib3()) {
        return array('success' => false, 'message' => 'SCP unavailable: phpseclib 3.x is not installed under plugins/lib/.');
    }
REPL
);

edit('plugins/file_transport.php', <<<'ANCHOR'
        // Auth: key-based or password
        if (!empty($options['drop_sftp_key'])) {
            $key = \phpseclib3\Crypt\PublicKeyLoader::load($options['drop_sftp_key']);
            if (!$ssh->login($username, $key)) {
ANCHOR
, <<<'REPL'
        // Auth: key-based (the runner-decrypted key) or password
        if ($sftpKey !== '') {
            $key = \phpseclib3\Crypt\PublicKeyLoader::load($sftpKey);
            if (!$ssh->login($username, $key)) {
REPL
);

// =============================================================================
// get_audit_data.php
// =============================================================================
edit('get_audit_data.php', <<<'ANCHOR'
            foreach (array('report_password', 'drop_password', 'drop_s3_access_key', 'drop_s3_secret_key') as $sk) {
                if (!empty($snap[$ok][$sk])) $snap[$ok][$sk] = '(encrypted)';
            }
ANCHOR
, <<<'REPL'
            // drop_sftp_key joined the encrypted set on 2026-10-16; a snapshot
            // from before carries that key as pasted - still never shipped, and
            // the marker says so, so a migration row reads as a real change.
            foreach (array('report_password', 'drop_password', 'drop_s3_access_key', 'drop_s3_secret_key', 'drop_sftp_key') as $sk) {
                if (empty($snap[$ok][$sk])) continue;
                $snap[$ok][$sk] = (function_exists('penumbraSchedulerSecretIsStored') && !penumbraSchedulerSecretIsStored($snap[$ok][$sk]))
                    ? '(stored unencrypted, not shown)' : '(encrypted)';
            }
REPL
);

// =============================================================================
// index.php - the notice under the Private Key textarea
// =============================================================================
edit('index.php', <<<'ANCHOR'
                    style="width: 100%; padding: 4px 6px; font-size: 10px; font-family: monospace; border: 1px solid var(--border-color, #ccc); border-radius: 3px; resize: vertical;"></textarea>
                <small style="font-size: 9px; opacity: 0.7;">If provided, key auth is used instead of password.</small>
ANCHOR
, <<<'REPL'
                    style="width: 100%; padding: 4px 6px; font-size: 10px; font-family: monospace; border: 1px solid var(--border-color, #ccc); border-radius: 3px; resize: vertical;"></textarea>
                <div id="schedDropSftpKeyNotice" style="display:none; font-size:9px; margin-top: 1px;"><span id="schedDropSftpKeyKept">Key saved. Leave blank to keep. <a href="#" id="schedDropSftpKeyRemove">Remove the saved key</a></span><span id="schedDropSftpKeyRemoved" style="display:none;">The saved key is removed when you save; paste a key here to keep key authentication.</span></div>
                <small style="font-size: 9px; opacity: 0.7;">If provided, key auth is used instead of password.</small>
REPL
);

// =============================================================================
// js/main.js (CRLF, two NUL bytes elsewhere in the file - never normalised)
// =============================================================================
edit('js/main.js', <<<'ANCHOR'
                $('#schedDropSftpKey').val(options.drop_sftp_key || '');
ANCHOR
, <<<'REPL'
                // The private key is a stored secret (2026-10-16): the list sends a
                // has_drop_sftp_key flag, never the key. Blank keeps it; the notice's
                // "Remove the saved key" link drops it on save.
                $('#schedDropSftpKey').val('');
                _schedDropSftpKeyRemove = false;
                $('#schedDropSftpKeyKept').show();
                $('#schedDropSftpKeyRemoved').hide();
REPL
);

edit('js/main.js', <<<'ANCHOR'
                if (options.has_drop_s3_secret_key) {
                    $('#schedDropS3SecretKeyNotice').show();
                }
ANCHOR
, <<<'REPL'
                if (options.has_drop_s3_secret_key) {
                    $('#schedDropS3SecretKeyNotice').show();
                }
                if (options.has_drop_sftp_key) {
                    $('#schedDropSftpKeyNotice').show();
                }
REPL
);

edit('js/main.js', <<<'ANCHOR'
            $('#schedDropPasswordNotice, #schedDropS3AccessKeyNotice, #schedDropS3SecretKeyNotice').hide();
ANCHOR
, <<<'REPL'
            $('#schedDropPasswordNotice, #schedDropS3AccessKeyNotice, #schedDropS3SecretKeyNotice, #schedDropSftpKeyNotice').hide();
            _schedDropSftpKeyRemove = false;
REPL
);

edit('js/main.js', <<<'ANCHOR'
    var _schedDropTplHeaderTouched = false;
ANCHOR
, <<<'REPL'
    var _schedDropTplHeaderTouched = false;
    // The Private Key notice's "Remove the saved key" link was used on this edit
    // (2026-10-16): the save posts drop_sftp_key_remove and the stored key is
    // dropped (password auth from then on). Pasting a key cancels the removal.
    var _schedDropSftpKeyRemove = false;
    $(document).on('click', '#schedDropSftpKeyRemove', function (e) {
        e.preventDefault();
        _schedDropSftpKeyRemove = true;
        $('#schedDropSftpKeyKept').hide();
        $('#schedDropSftpKeyRemoved').show();
        $('#schedDropSftpKey').trigger('focus');
    });
    $(document).on('input', '#schedDropSftpKey', function () {
        if (_schedDropSftpKeyRemove && $(this).val().trim() !== '') {
            _schedDropSftpKeyRemove = false;
            $('#schedDropSftpKeyRemoved').hide();
            $('#schedDropSftpKeyKept').show();
        }
    });
REPL
);

edit('js/main.js', <<<'ANCHOR'
            optionsObj.drop_sftp_key         = $('#schedDropSftpKey').val().trim();
ANCHOR
, <<<'REPL'
            // drop_sftp_key is posted as its own field (the payload below), never
            // inside options (2026-10-16): the server encrypts it like the password.
REPL
);

edit('js/main.js', <<<'ANCHOR'
            drop_s3_secret_key: taskType === 'DROP_FILE' ? ($('#schedDropS3SecretKey').val() || '') : '',
ANCHOR
, <<<'REPL'
            drop_s3_secret_key: taskType === 'DROP_FILE' ? ($('#schedDropS3SecretKey').val() || '') : '',
            // The SSH private key (2026-10-16): its own field, encrypted server-side like
            // the password; blank keeps the stored key, the remove flag drops it.
            drop_sftp_key: taskType === 'DROP_FILE' ? ($('#schedDropSftpKey').val().trim() || '') : '',
            drop_sftp_key_remove: (taskType === 'DROP_FILE' && _schedDropSftpKeyRemove) ? 'true' : 'false',
REPL
);

edit('js/main.js', <<<'ANCHOR'
                ($('#schedDropS3SecretKeyNotice').is(':visible') && !$('#schedDropS3SecretKey').val())
                ? 'true' : 'false') : 'false'
ANCHOR
, <<<'REPL'
                ($('#schedDropS3SecretKeyNotice').is(':visible') && !$('#schedDropS3SecretKey').val()) ||
                ($('#schedDropSftpKeyNotice').is(':visible') && !$('#schedDropSftpKey').val().trim())
                ? 'true' : 'false') : 'false'
REPL
);

// =============================================================================
// help/topics/schedulerHelpLightbox.php
// =============================================================================
edit('help/topics/schedulerHelpLightbox.php', <<<'ANCHOR'
        <p style="font-size: 11px; margin: 0 0 8px;">Passwords and S3 access/secret keys are encrypted with <strong>AES-256-CBC</strong> before being stored in the database; they are decrypted only at runtime inside the scheduler process and are never sent to the browser after the initial save. The SFTP/SCP <strong>private key is not encrypted</strong>: it is stored as pasted in the task's options and loaded back into the form when the task is edited, so use a key made for this task alone, or a password.</p>
        <p style="font-size: 11px; margin: 0 0 8px;">When editing an existing task, encrypted fields show a <em>"Password saved. Leave blank to keep."</em> notice. Entering a new value overwrites the stored credential; leaving it blank preserves the existing one. This works independently for each secret field; you can change the SFTP password without re-entering the S3 keys, for example.</p>
ANCHOR
, <<<'REPL'
        <p style="font-size: 11px; margin: 0 0 8px;">Passwords, S3 access/secret keys and the SFTP/SCP <strong>private key</strong> are encrypted with <strong>AES-256-CBC</strong> before being stored in the database; they are decrypted only at runtime inside the scheduler process and are never sent to the browser after the initial save. A private key saved before 2026-10-16 was stored as pasted; it is encrypted the next time its task is saved (an administrator can also encrypt every stored key at once with <code>encrypt_sftp_keys_cli.php</code>).</p>
        <p style="font-size: 11px; margin: 0 0 8px;">When editing an existing task, encrypted fields show a <em>"Password saved. Leave blank to keep."</em> or <em>"Key saved. Leave blank to keep."</em> notice. Entering a new value overwrites the stored credential; leaving it blank preserves the existing one, independently for each field. While a private key is stored it is used instead of the password: <em>Remove the saved key</em> under its notice drops it on the next save.</p>
REPL
);

edit('help/topics/schedulerHelpLightbox.php', <<<'ANCHOR'
Password or S3 keys (AES-256 encrypted); SSH private key (stored unencrypted)</td></tr>
ANCHOR
, <<<'REPL'
Password, S3 keys or SSH private key (all AES-256 encrypted)</td></tr>
REPL
);

// =============================================================================
// README.md - a tests entry (section 3), a landmine (section 5), an open item (6)
// =============================================================================
edit('README.md', <<<'ANCHOR'
& \\oitras\d$\Utilities\PHP_8.2-p\php.exe -n \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\cronnever\test.php \\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra\manage_schedule.php \\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra\schedule_runner.php
ANCHOR
, <<<'REPL'
& \\oitras\d$\Utilities\PHP_8.2-p\php.exe -n \\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\cronnever\test.php \\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra\manage_schedule.php \\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra\schedule_runner.php
# SFTP/SCP private key at rest (2026-10-16, "sftpkey") - see section 5. A Drop-a-File task's SSH
# private key is encrypted like the password (manage_schedule.php, its own POST field; blank keeps
# the stored key, "Remove the saved key" drops it), stripped from the task list (has_drop_sftp_key),
# decrypted only by the runner (scheduler_read_sftp_key) into the one option the transport reads,
# masked in the Auditor; a key saved before is encrypted on its next save, by a restore, or at once by
# encrypt_sftp_keys_cli.php (dry run by default, --commit to write; every task audited). The suite
# lifts the real functions out of the files (never includes the runner) and requires the transport;
# -Mutants runs four (a plaintext save, a transport reading the stored key, a list that leaks it, a
# reader that does not decrypt), each must go red with its exact count. -App <stage> tests a stage;
# patch.php re-applies the change to a fresh copy of live.
$d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sftpkey'
& ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
REPL
);

edit('README.md', <<<'ANCHOR'
Things that are non-obvious and have already caused real incidents.
ANCHOR
, <<<'REPL'
Things that are non-obvious and have already caused real incidents.
- **A Drop-a-File task's SSH private key was stored as pasted (found by the help audit 2026-10-15,
  fixed 2026-10-16, suite `sftpkey`).** `drop_sftp_key` rode inside the options JSON: plaintext in
  `PENUMBRA_SCHEDULED_TASKS.OPTIONS`, returned to the browser by every task list (and so re-posted by
  the form), loaded raw by `plugins/file_transport.php`, and copied as pasted into the BEFORE/AFTER
  snapshots of every SCHEDULE_* audit row - while `drop_password` and the S3 keys were AES-256-CBC
  encrypted and stripped. Now it is a secret like the password: its own POST field, encrypted by
  `encrypt_scheduler_password()`, a `has_drop_sftp_key` flag instead of the value, decrypted only by
  the runner (`scheduler_read_sftp_key()` into `_decrypted_sftp_key`, the ONLY key the transport
  reads - a stored key the caller did not decrypt is refused before dialling), masked by
  `get_audit_data.php`. Shared helpers in `db_connection.php` (`penumbraSchedulerSecret*`,
  `penumbraSchedulerEncryptPlainSftpKey`). TRAPS: (1) a key saved before the change is still
  plaintext until its task is re-saved, restored or `encrypt_sftp_keys_cli.php --commit` runs - the
  runner uses it as it is and logs a Notice per run; (2) blank now KEEPS the stored key, so switching
  from key to password auth needs the notice's "Remove the saved key" link (a stored key wins over the
  password in the transport); (3) deploy the runner and the transport together, right after a cycle's
  "Run Complete": an old runner mid-cycle lazy-loading the new transport would have its key refused
  for that one drop.
REPL
);

edit('README.md', <<<'ANCHOR'
## 6. Known open items
ANCHOR
, <<<'REPL'
## 6. Known open items
- **Audit rows written before 2026-10-16 carry Drop-a-File SSH private keys as pasted** in the
  BEFORE/AFTER snapshots of SCHEDULE_NEW / UPDATE / ENABLE / DISABLE / DELETE rows of tasks that had
  one (found with the key fix, suite `sftpkey`). `get_audit_data.php` masks them on the way to the
  browser ("(stored unencrypted, not shown)"), the rows themselves are untouched: rewriting history
  is a decision (a scrub would encrypt the key inside each old snapshot the way the normaliser does,
  so restores keep working), not taken.
REPL
);

// =============================================================================
// apply
// =============================================================================
function rcopy($src, $dst) {
    if (is_dir($src)) {
        if (!is_dir($dst)) mkdir($dst, 0777, true);
        foreach (scandir($src) as $e) { if ($e === '.' || $e === '..') continue; rcopy("$src/$e", "$dst/$e"); }
        return;
    }
    if (!is_dir(dirname($dst))) mkdir(dirname($dst), 0777, true);
    if (!copy($src, $dst)) { fwrite(STDERR, "copy failed: $src -> $dst\n"); exit(2); }
    touch($dst, filemtime($src));
}

$failed = 0; $hit = 0;
// the whole help tree first (the lint wants every fragment), minus the switch markers
rcopy("$FROM/help", "$TO/help");
foreach (array('v2.on', 'v2.off', 'gate.on', 'ask.off', 'ask.writer', 'ask.admin') as $m) { if (is_file("$TO/help/$m")) unlink("$TO/help/$m"); }

foreach ($edits as $file => $list) {
    $src = "$FROM/$file";
    $text = @file_get_contents($src);
    if ($text === false) { echo "FAIL  $file: cannot read $src\n"; $failed++; continue; }
    $eol = (strpos($text, "\r\n") !== false) ? "\r\n" : "\n";
    $out = $text; $ok = true;
    foreach ($list as $i => $pair) {
        list($anchor, $repl) = $pair;
        if ($eol === "\r\n") { $anchor = str_replace("\n", "\r\n", $anchor); $repl = str_replace("\n", "\r\n", $repl); }
        $n = substr_count($out, $anchor);
        if ($n !== 1) { echo "FAIL  $file edit #" . ($i + 1) . ": anchor occurs $n times (need exactly 1)\n"; $ok = false; continue; }
        $out = str_replace($anchor, $repl, $out);
        $hit++;
    }
    if (!$ok) { $failed++; continue; }
    // byte-style invariants: no new lone LF in a CRLF file, NUL count unchanged
    $loneBefore = preg_match_all('/(?<!\r)\n/', $text); $loneAfter = preg_match_all('/(?<!\r)\n/', $out);
    if ($eol === "\r\n" && $loneAfter !== $loneBefore) { echo "FAIL  $file: lone LF count changed ($loneBefore -> $loneAfter)\n"; $failed++; continue; }
    if (substr_count($text, "\x00") !== substr_count($out, "\x00")) { echo "FAIL  $file: NUL count changed\n"; $failed++; continue; }
    $dst = "$TO/$file";
    if (!is_dir(dirname($dst))) mkdir(dirname($dst), 0777, true);
    if (file_put_contents($dst, $out) === false) { echo "FAIL  $file: cannot write $dst\n"; $failed++; continue; }
    echo "ok    $file: " . count($list) . " edit(s), " . ($eol === "\r\n" ? 'CRLF' : 'LF') . ", " . strlen($text) . " -> " . strlen($out) . " bytes\n";
}

// the new CLI
$cli = "$FILES_DIR/encrypt_sftp_keys_cli.php";
if (!is_file($cli)) { echo "FAIL  files/encrypt_sftp_keys_cli.php missing beside patch.php\n"; $failed++; }
else { rcopy($cli, "$TO/encrypt_sftp_keys_cli.php"); echo "ok    encrypt_sftp_keys_cli.php installed (new file)\n"; }

echo "anchors hit: $hit   files failed: $failed\n";
echo ($failed === 0) ? "PATCH: OK\n" : "PATCH: FAILED\n";
exit($failed === 0 ? 0 : 1);
