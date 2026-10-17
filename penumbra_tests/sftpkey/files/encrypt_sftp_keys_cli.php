<?php
/**
 * encrypt_sftp_keys_cli.php - encrypt the SFTP/SCP private keys of Drop-a-File tasks at rest.
 * ============================================================================
 * ONE-OFF MIGRATION, CLI ONLY (2026-10-16). Until this date manage_schedule.php
 * stored a task's SSH private key (OPTIONS.drop_sftp_key) exactly as pasted,
 * while the drop password and the S3 keys were AES-256-CBC encrypted under the
 * scheduler secret. The save path now encrypts the key too, and a task is
 * migrated the next time somebody saves (or restores) it; this script does every
 * task at once so no plaintext key waits for a save. The runner keeps working
 * either way: a key still stored as pasted is used as it is and logged as a
 * Notice on every run until it is encrypted.
 *
 * Run (on the server; a workstation php has no oci8 and no config):
 *   \\oitras\d$\Utilities\PHP_8.2-p\php.exe encrypt_sftp_keys_cli.php             dry run: each task's key state
 *   ... --commit                                                               encrypt the plaintext ones
 *   ... --task=<id>                                                            one task only (with or without --commit)
 *   ... --help
 *
 * Per task, with --commit: the row is locked (SELECT ... FOR UPDATE), the key is
 * encrypted with the shared helper (penumbraSchedulerEncryptPlainSftpKey - the
 * save path's algorithm and secret), the ciphertext is decrypted and compared to
 * the original BEFORE the write and again on a read-back after it, then the row
 * is committed and one SCHEDULE_UPDATE audit row is written whose BEFORE/AFTER
 * snapshots carry the ciphertext on both sides (never the key) and whose message
 * says what happened. A task whose key changed under the lock is skipped and
 * reported. Nothing here ever prints a key, in any state.
 *
 * Exit code: 0 = every plaintext key is now encrypted (or none was / dry run),
 * 1 = at least one task failed or the database was unreachable, 2 = bad usage.
 *
 * The pure half (encrypt_sftp_keys_state, encrypt_sftp_keys_line) is lifted and
 * pinned by penumbra_tests\sftpkey; the rest is the I/O.
 */

// ---------------------------------------------------------------------------
// CLI guard. First thing, before any app code runs.
// ---------------------------------------------------------------------------
if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/plain', true, 403);
    echo "encrypt_sftp_keys_cli.php is a command-line tool and cannot be run over the web.\n";
    exit(1);
}

// ---------------------------------------------------------------------------
// Arguments (before db_connection.php, so --help works where the DB does not)
// ---------------------------------------------------------------------------
$opts = array('commit' => false, 'help' => false, 'task' => 0);
for ($i = 1; $i < $argc; $i++) {
    $a = $argv[$i];
    if ($a === '--commit') { $opts['commit'] = true; continue; }
    if ($a === '--help' || $a === '-h') { $opts['help'] = true; continue; }
    if (strpos($a, '--task=') === 0 && ctype_digit(substr($a, 7))) { $opts['task'] = (int)substr($a, 7); continue; }
    fwrite(STDERR, "Unknown argument: $a  (try --help)\n");
    exit(2);
}
if ($opts['help']) {
    echo "\nPenumbra: encrypt stored SFTP/SCP private keys (CLI only)\n";
    echo "---------------------------------------------------------\n";
    echo "Lists every Drop-a-File task that has a private key and whether it is stored\n";
    echo "encrypted or as pasted; with --commit the pasted ones are encrypted in place\n";
    echo "(row-locked, round trip checked before and after the write, one audit row each).\n\n";
    echo "  (no flag)       dry run: report only\n";
    echo "  --commit        encrypt every key that is still stored as pasted\n";
    echo "  --task=<id>     one task only\n";
    echo "  --help\n\n";
    exit(0);
}

// ---------------------------------------------------------------------------
// Pure half
// ---------------------------------------------------------------------------
/** 'none' | 'encrypted' | 'plaintext' - what a task's decoded options hold under drop_sftp_key. */
function encrypt_sftp_keys_state($options) {
    if (!is_array($options) || !isset($options['drop_sftp_key']) || !is_string($options['drop_sftp_key']) || trim($options['drop_sftp_key']) === '') {
        return 'none';
    }
    return penumbraSchedulerSecretIsStored($options['drop_sftp_key']) ? 'encrypted' : 'plaintext';
}

/** One report line for a task: its state and the stored value's size, never the value. */
function encrypt_sftp_keys_line($id, $short_id, $state, $bytes, $subject) {
    $subject = preg_replace('/[\x00-\x1F\x7F]+/', ' ', (string)$subject);
    return sprintf(" %-7s %-24s %-10s %9s  %s", $id, substr((string)$short_id, 0, 24), $state, ($bytes > 0 ? $bytes : '-'), substr($subject, 0, 48));
}

// ---------------------------------------------------------------------------
// Everything past this point needs the database and the config outside the webroot.
// ---------------------------------------------------------------------------
require_once __DIR__ . '/db_connection.php';
$global_config = isset($config) ? $config : array();
if (!defined('SCHEDULER_SECRET_KEY')) {
    define('SCHEDULER_SECRET_KEY', isset($global_config['scheduler_secret_key']) ? $global_config['scheduler_secret_key'] : 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING');
}
// The audit logger (logPenumbraAudit) reads the request context; give the CLI an
// honest one: the Windows account at the shell as the user, this script as the URI.
$currentUserKey = 'CLI:' . (getenv('USERNAME') ? getenv('USERNAME') : 'unknown');
if (!isset($_SERVER['REQUEST_URI'])) $_SERVER['REQUEST_URI'] = '/encrypt_sftp_keys_cli.php';
if (!isset($_SERVER['HTTP_HOST']))   $_SERVER['HTTP_HOST']   = (string)gethostname();

function out($s = '') { echo $s . "\n"; }

/** PENUMBRA_SCHEDULED_TASKS.REPORT_ID holds the report's SHORT_ID (numeric on legacy rows). */
function encrypt_sftp_keys_report_num($conn, $ref) {
    $ref = trim((string)$ref);
    if ($ref === '') return null;
    $q = $conn->prepare("SELECT ID FROM NC_REPORTING.PENUMBRA_REPORTS WHERE TRIM(SHORT_ID) = :sid");
    $q->bindValue(':sid', $ref);
    $q->execute();
    $id = $q->fetchColumn();
    if ($id === false && ctype_digit($ref)) {
        $q2 = $conn->prepare("SELECT ID FROM NC_REPORTING.PENUMBRA_REPORTS WHERE ID = :nid");
        $q2->bindValue(':nid', (int)$ref, PDO::PARAM_INT);
        $q2->execute();
        $id = $q2->fetchColumn();
    }
    return ($id === false) ? null : (int)$id;
}

function encrypt_sftp_keys_clob($v) { return is_resource($v) ? stream_get_contents($v) : $v; }

/**
 * Encrypt one task's plaintext key in place. true = done (or already encrypted
 * when re-read under the lock), otherwise the reason as a string. Never echoes.
 */
function encrypt_sftp_keys_migrate($conn, $taskId) {
    $row = null; $newOpts = null;
    try {
        $conn->beginTransaction();
        $lock = $conn->prepare("SELECT ID, REPORT_ID, TASK_TYPE, RECIPIENTS, SUBJECT, CRON_EXPRESSION, OPTIONS, OWNER_ID, IS_ACTIVE,
                                       TO_CHAR(NEXT_RUN, 'YYYY-MM-DD HH24:MI:SS') AS NEXT_RUN,
                                       TO_CHAR(LAST_RUN, 'YYYY-MM-DD HH24:MI:SS') AS LAST_RUN,
                                       TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT
                                FROM NC_REPORTING.PENUMBRA_SCHEDULED_TASKS WHERE ID = :id FOR UPDATE");
        $lock->bindValue(':id', $taskId, PDO::PARAM_INT);
        $lock->execute();
        $row = $lock->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new Exception('the task row is gone');
        $row['OPTIONS']    = encrypt_sftp_keys_clob($row['OPTIONS']);
        $row['RECIPIENTS'] = encrypt_sftp_keys_clob($row['RECIPIENTS']);
        $o = json_decode((string)$row['OPTIONS'], true);
        $state = encrypt_sftp_keys_state($o);
        if ($state !== 'plaintext') {
            $conn->rollBack();
            return ($state === 'encrypted') ? true : 'the key disappeared from the row before it was locked';
        }
        $plain = $o['drop_sftp_key'];
        list($newOpts, $changed) = penumbraSchedulerEncryptPlainSftpKey($o, SCHEDULER_SECRET_KEY);
        if (!$changed) throw new Exception('the normaliser made no change');
        if (penumbraSchedulerSecretDecrypt($newOpts['drop_sftp_key'], SCHEDULER_SECRET_KEY) !== $plain) {
            throw new Exception('the ciphertext did not decrypt back to the original key before the write');
        }
        $newJson = json_encode($newOpts);
        if ($newJson === false) throw new Exception('the options did not re-encode as JSON');
        $upd = $conn->prepare("UPDATE NC_REPORTING.PENUMBRA_SCHEDULED_TASKS SET OPTIONS = :opts WHERE ID = :id");
        $upd->bindValue(':opts', $newJson);
        $upd->bindValue(':id', $taskId, PDO::PARAM_INT);
        $upd->execute();
        $chk = $conn->prepare("SELECT OPTIONS FROM NC_REPORTING.PENUMBRA_SCHEDULED_TASKS WHERE ID = :id");
        $chk->bindValue(':id', $taskId, PDO::PARAM_INT);
        $chk->execute();
        $backRow = $chk->fetch(PDO::FETCH_ASSOC);
        $back = $backRow ? json_decode((string)encrypt_sftp_keys_clob($backRow['OPTIONS']), true) : null;
        if (!is_array($back) || encrypt_sftp_keys_state($back) !== 'encrypted'
                || penumbraSchedulerSecretDecrypt($back['drop_sftp_key'], SCHEDULER_SECRET_KEY) !== $plain) {
            throw new Exception('the read-back did not decrypt to the original key; rolled back');
        }
        $conn->commit();
    } catch (Exception $e) {
        try { if ($conn->inTransaction()) $conn->rollBack(); } catch (Exception $e2) { /* nothing to undo */ }
        return $e->getMessage();
    }

    // Audit, outside the row lock: full before/after snapshots as the save path
    // writes them, with the CIPHERTEXT on both sides (a restore from the BEFORE
    // side keeps working; the key as pasted is in no audit row this writes).
    try {
        $snap = $row;
        $snap['OPTIONS'] = $newOpts;
        $msg = 'SSH private key encrypted at rest by encrypt_sftp_keys_cli.php (the task was saved before 2026-10-16, when the key was stored as pasted).';
        if (function_exists('logPenumbraAudit')) {
            logPenumbraAudit(encrypt_sftp_keys_report_num($conn, $row['REPORT_ID']), 'SCHEDULE_UPDATE', json_encode($snap), json_encode($snap), $msg);
        }
    } catch (Exception $e) {
        return 'encrypted and committed, but the audit row failed: ' . $e->getMessage();
    }
    return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
$DRY = !$opts['commit'];
$exit = 0;
try {
    $conn = getConnectionForTable('DUAL');
    if (!$conn) throw new Exception('Failed to connect to the database.');

    $sql = "SELECT ID, TRIM(REPORT_ID) AS SID, SUBJECT, OPTIONS
            FROM NC_REPORTING.PENUMBRA_SCHEDULED_TASKS
            WHERE TASK_TYPE = 'DROP_FILE' AND OPTIONS IS NOT NULL
              AND DBMS_LOB.INSTR(OPTIONS, '\"drop_sftp_key\"') > 0"
         . ($opts['task'] ? " AND ID = :tid" : "")
         . " ORDER BY ID";
    $st = $conn->prepare($sql);
    if ($opts['task']) $st->bindValue(':tid', $opts['task'], PDO::PARAM_INT);
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    out('');
    out('=====================================================================');
    out(' Drop-a-File SSH private keys at rest' . ($DRY ? '  [DRY RUN]' : '  [COMMIT]'));
    out('=====================================================================');
    out(sprintf(" %-7s %-24s %-10s %9s  %s", 'TASK', 'REPORT', 'STATE', 'BYTES', 'SUBJECT'));
    $counts = array('none' => 0, 'encrypted' => 0, 'plaintext' => 0, 'done' => 0, 'failed' => 0);
    foreach ($rows as $r) {
        $o = json_decode((string)encrypt_sftp_keys_clob($r['OPTIONS']), true);
        $state = encrypt_sftp_keys_state($o);
        $counts[$state]++;
        $bytes = ($state !== 'none') ? strlen($o['drop_sftp_key']) : 0;
        out(encrypt_sftp_keys_line($r['ID'], $r['SID'], $state, $bytes, $r['SUBJECT']));
        if ($state === 'plaintext' && !$DRY) {
            $res = encrypt_sftp_keys_migrate($conn, (int)$r['ID']);
            if ($res === true) { $counts['done']++; out('         -> encrypted, read back and audited'); }
            else { $counts['failed']++; $exit = 1; out('         -> FAILED: ' . $res); }
        }
    }
    out('');
    out(sprintf(' tasks with a key field: %d   encrypted: %d   stored as pasted: %d   without a key: %d',
        count($rows), $counts['encrypted'], $counts['plaintext'], $counts['none']));
    if ($DRY) {
        out($counts['plaintext'] > 0
            ? ' Dry run: nothing written. Re-run with --commit to encrypt the ' . $counts['plaintext'] . ' key(s) stored as pasted.'
            : ' Dry run: nothing to do - no key is stored as pasted.');
    } else {
        out(sprintf(' Encrypted now: %d   failed: %d', $counts['done'], $counts['failed']));
    }
    out('');
} catch (Exception $e) {
    fwrite(STDERR, 'ERROR: ' . $e->getMessage() . "\n");
    $exit = 1;
}
exit($exit);
