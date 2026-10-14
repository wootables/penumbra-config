<?php
/**
 * Renders send_scheduler_failure_email()'s HTML offline, so a refactor of the
 * shared email shell can be proven byte-identical instead of hoped to be.
 *
 * Technique borrowed from the snippet parity harness: the function is text
 * -extracted from the live schedule_runner.php, two calls are patched out
 * (quoted_printable_encode -> capture, @mail -> a no-op), and the result is
 * driven with fixed contexts covering every framing branch.
 *
 * NOTHING IS SENT. The mail() call is patched away before the file is included;
 * render.sh/ps1 rebuilds extracted.php each run so it always tests what is live.
 *
 *   php.exe render.php <outdir>
 */

$outDir = isset($argv[1]) ? $argv[1] : dirname(__FILE__) . DIRECTORY_SEPARATOR . 'out';
if (!is_dir($outDir)) { mkdir($outDir, 0777, true); }

// ---- stubs for the runner internals the function reaches for -----------------
$GLOBALS['pnb_html'] = '';
function pnb_capture_html($html) { $GLOBALS['pnb_html'] = $html; return quoted_printable_encode($html); }
function pnb_fake_mail($to, $subject, $body, $headers) { $GLOBALS['pnb_subject'] = $subject; return true; }
function log_scheduler($m) { /* silent */ }
function penumbraUnityEmail($p) {
    $p = trim((string)$p);
    if ($p === '') return '';
    if (strpos($p, '@') !== false) return $p;
    return $p . '@ncsu.edu';
}

require '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra/penumbra_email_shell.php';
require dirname(__FILE__) . DIRECTORY_SEPARATOR . 'extracted.php';

// ---- fixed cases, one per framing branch -------------------------------------
$cases = array(
    'plain_fail' => array(
        'report_id' => 42, 'action' => 'SCHEDULE_FAIL',
        'message'   => "ORA-00942: table or view does not exist\nat offset 30",
        'context'   => array('task_id' => 441, 'task_type' => 'EMAIL', 'subject' => 'Awards by Unit',
                             'short_id' => 'awdunit', 'cron' => '0 6 * * 1-5', 'owner' => 'bplimon',
                             'recipients' => 'Bruce Limon <bplimon@ncsu.edu>;'),
    ),
    'noauth' => array(
        'report_id' => 43, 'action' => 'SCHEDULE_NOAUTH',
        'message'   => 'Security Violation: Report is private and recipient x@y.edu is not authorized.',
        'context'   => array('task_id' => 284, 'task_type' => 'EMAIL', 'subject' => 'BME Personnel',
                             'short_id' => 'bmeperm', 'cron' => '0 6 * * *', 'owner' => 'mrgrady',
                             'recipients' => 'a@ncsu.edu'),
    ),
    'transient_test' => array(
        'report_id' => 44, 'action' => 'SCHEDULE_FAIL',
        'message'   => 'Prompt Error: unknown token {FOO}',
        'context'   => array('task_id' => 900, 'task_type' => 'SNAPSHOT', 'subject' => 'Draft test',
                             'short_id' => 'drafty', 'cron' => '* * * * *', 'owner' => 'bplimon',
                             'transient_test' => true),
    ),
    'missing_report' => array(
        'report_id' => 45, 'action' => 'SCHEDULE_FAIL',
        'message'   => "Report 'gonezo' not found.",
        'context'   => array('task_id' => 777, 'task_type' => 'DROP_FILE', 'subject' => 'Orphan task',
                             'short_id' => 'gonezo', 'cron' => '0 3 * * *', 'owner' => 'bplimon',
                             'report_missing' => true, 'auto_deactivated' => true),
    ),
    'db_dump' => array(
        'report_id' => 46, 'action' => 'SCHEDULE_FAIL',
        'message'   => 'SQLSTATE[22003] numeric value out of range',
        'context'   => array('task_id' => 542, 'task_type' => 'DB_DUMP', 'subject' => 'PDUMP_IACUC_FEED',
                             'short_id' => 'iacucred', 'cron' => '0 4 * * 1-5', 'owner' => 'bplimon',
                             'db_dump' => array('destination' => 'PDUMP_IACUC_FEED', 'row_count' => 1284,
                                                'inserts' => array('successful' => 1200, 'failed' => 84),
                                                'reload_mode' => 'truncate', 'error_file' => 'dump.php:88',
                                                'last_statement' => 'INSERT INTO PDUMP_IACUC_FEED VALUES (...)',
                                                'duration_ms' => 4821)),
    ),
);

$n = 0;
foreach ($cases as $name => $c) {
    $GLOBALS['pnb_html'] = '';
    send_scheduler_failure_email($c['report_id'], $c['action'], $c['message'], $c['context']);
    $html = $GLOBALS['pnb_html'];
    // The "When" row is date('Y-m-d H:i:s T') - genuinely time-varying, so it is
    // normalised here rather than allowed to produce a false diff.
    $html = preg_replace('/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]{2,5}/', '<WHEN>', $html);
    file_put_contents($outDir . DIRECTORY_SEPARATOR . $name . '.html', $html);
    echo str_pad($name, 18) . strlen($html) . " bytes\n";
    $n++;
}
echo "rendered $n cases to $outDir\n";
