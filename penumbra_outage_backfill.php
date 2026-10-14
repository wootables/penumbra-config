<?php
/**
 * penumbra_outage_backfill.php - seed the outage ledger from penumbra_monitor.log.
 *
 * WHY THIS EXISTS AT ALL. The ledger is written forward by the watchdog, which
 * means on the day it ships the outage history is empty - and an empty history
 * is indistinguishable from a healthy week. The one thing that proves the new
 * card is telling the truth is that it shows the nightly HR maintenance window
 * the admin has been getting emails about all along. That evidence already
 * exists: the watchdog has appended one fixed-format line every five minutes
 * since 2026-08-18. This reads those lines back into episodes.
 *
 * ONE-SHOT, AND IT SAYS SO. Refuses to run over an existing ledger without
 * --force, because re-running it would replay old episodes on top of live ones.
 *
 *   php.exe penumbra_outage_backfill.php --dry-run     parse and report, write nothing
 *   php.exe penumbra_outage_backfill.php               seed the ledger
 *   php.exe penumbra_outage_backfill.php --force       overwrite an existing ledger
 *
 * PARSING PROSE IS THE COMPROMISE HERE, and it is confined to this file on
 * purpose - nothing on a render path ever does it. Two shapes are recognised:
 *     [2026-08-23 23:08:01] ok | scheduler=online (46s ago) | smtp=ok | dbs=5
 *     [2026-08-23 23:13:02] DEGRADED: database hr down | scheduler=... | SENDING (...)
 * Anything else (notice:, alert emailed to, ...) is skipped rather than guessed
 * at. A line that does not parse must never be read as a healthy tick: that
 * would invent a recovery and close an episode early.
 */

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$argvRaw = isset($argv) ? $argv : array();
$DRY     = in_array('--dry-run', $argvRaw, true);
$FORCE   = in_array('--force', $argvRaw, true);

// Defaults are the box's own paths - this is meant to run ON the server. The
// overrides exist so the parse can be rehearsed from a workstation over UNC,
// where a bare C:\ would silently mean the WORKSTATION's C: drive and the
// script would either fail loudly (as it did) or, worse, read the wrong file.
$APP     = 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$logFile = 'D:\\Utilities\\PHP_8.2-p\\logs\\penumbra_monitor.log';
$ledgerOverride = null;
foreach ($argvRaw as $a) {
    if (strpos($a, '--app=')    === 0) $APP            = rtrim(substr($a, 6),  '\\/');
    if (strpos($a, '--log=')    === 0) $logFile        = substr($a, 6);
    if (strpos($a, '--ledger=') === 0) $ledgerOverride = substr($a, 9);
}

/* THE CONFIG IS OPTIONAL, ON PURPOSE. This is a pure file-to-file transform:
   it reads a log and writes a JSON ledger, and it touches no database. The
   config is wanted only for the two path overrides (outage_ledger_file,
   health_cache_file), and both have working literal defaults. Requiring
   db_connection.php unconditionally would mean this script could not run
   without the sealed credential key - which is right for the app and absurd
   for a log parser, and it is also what stopped the parse being rehearsed
   from a workstation. So: try, and carry on with defaults if it will not
   load. Anything that actually needed a connection would fail loudly later. */
$config = array();
try {
    @require_once $APP . DIRECTORY_SEPARATOR . 'db_connection.php';
} catch (Exception $e) {
    fwrite(STDERR, "note: config not loaded (" . $e->getMessage() . ") - using default paths\n");
    if (!is_array($config)) $config = array();
} catch (Error $e) {
    fwrite(STDERR, "note: config not loaded (" . $e->getMessage() . ") - using default paths\n");
    if (!is_array($config)) $config = array();
}
if (!is_array($config)) $config = array();
require_once $APP . DIRECTORY_SEPARATOR . 'penumbra_health.php';
if ($ledgerOverride !== null) { $config['outage_ledger_file'] = $ledgerOverride; }

// A DRY RUN MUST NOT TOUCH THE REAL LEDGER. penumbra_outage_record() is the
// shipped writer and writing is what it does - it has no preview mode, and it
// should not grow one for this. So the dry run redirects the ledger PATH to a
// scratch file instead, which also keeps the rehearsal honest: it exercises the
// same code, writing the same way, just somewhere harmless.
$realLedger = penumbra_outage_ledger_file(is_array($config) ? $config : array());
if ($DRY) {
    $config['outage_ledger_file'] = sys_get_temp_dir() . DIRECTORY_SEPARATOR
                                  . 'pnb_outage_dryrun_' . getmypid() . '.json';
}
$ledgerFile = penumbra_outage_ledger_file(is_array($config) ? $config : array());

echo "log:    $logFile\n";
echo "ledger: $ledgerFile" . ($DRY ? "   (DRY RUN - the real one at $realLedger is untouched)" : '') . "\n\n";

if (!$DRY && is_file($ledgerFile) && !$FORCE) {
    $cur = penumbra_outage_ledger_read(is_array($config) ? $config : array());
    fwrite(STDERR, "REFUSING: a ledger already exists (" . count($cur['episodes']) . " episodes, "
         . count($cur['open']) . " open).\nRe-running would replay history on top of live records. "
         . "Use --force if that is really what you want.\n");
    exit(2);
}

$fh = @fopen($logFile, 'r');
if (!$fh) { fwrite(STDERR, "cannot read $logFile\n"); exit(2); }

/* START FROM EMPTY - and this has to be an explicit delete, not an assumption.
   The replay does its work by calling penumbra_outage_record(), which reads the
   ledger off disk on every tick; building a fresh array here would be ignored.
   The first --force run proved it: the watchdog had already written one live
   tick, observing_since stuck at that moment instead of 2026-08-18, and every
   availability figure came out as '-' because the observed window was zero
   seconds long. Removing the file is what actually resets the state machine. */
@unlink($ledgerFile);

$lines = 0; $ticks = 0; $skipped = 0; $opened = 0; $closed = 0;

while (($line = fgets($fh)) !== false) {
    $lines++;
    $line = rtrim($line, "\r\n");
    if ($line === '') continue;

    // [YYYY-mm-dd HH:MM:SS] <verdict> | ...
    if (!preg_match('/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*(.*)$/', $line, $m)) { $skipped++; continue; }
    $ts   = strtotime($m[1]);
    $rest = $m[2];

    // A tick is identified by the pipe-delimited readings the verdict carries.
    // Bookkeeping lines ("notice: posted", "alert emailed to ...") have none and
    // are skipped - treating one as a healthy tick would forge a recovery.
    if (strpos($rest, '| smtp=') === false) { $skipped++; continue; }

    $verdict = trim(explode('|', $rest, 2)[0]);

    $problems = array();
    if (stripos($verdict, 'DEGRADED:') === 0) {
        foreach (explode(';', substr($verdict, 9)) as $p) {
            $p = trim($p);
            if ($p !== '') $problems[] = $p;
        }
    } elseif ($verdict !== 'ok') {
        $skipped++; continue;      // unrecognised verdict: skip, never assume healthy
    }

    $ticks++;
    // Replay through the SHIPPED state machine rather than a second copy of it.
    // The whole point is that backfilled episodes and live ones are identical.
    $r = penumbra_outage_record($problems, $ts, is_array($config) ? $config : array());
    $opened += count($r['opened']);
    $closed += count($r['closed']);
}
fclose($fh);

// Stamp where this history came from. An operator looking at a 6-day-old
// observing_since on a ledger that shipped today should be able to find out why
// it predates the feature, without having to ask anyone.
$L = penumbra_outage_ledger_read(is_array($config) ? $config : array());
$L['backfilled_from'] = basename($logFile);
$L['backfilled_at']   = date('c');
penumbra_outage_ledger_write($L, is_array($config) ? $config : array());
$L = penumbra_outage_ledger_read(is_array($config) ? $config : array());

echo "lines read:      $lines\n";
echo "ticks replayed:  $ticks\n";
echo "lines skipped:   $skipped  (bookkeeping / unparseable)\n";
echo "episodes opened: $opened\n";
echo "episodes closed: $closed\n";
echo "still open:      " . count($L['open']) . "\n";
echo "observing since: " . ($L['observing_since'] ? date('Y-m-d H:i', $L['observing_since']) : '-') . "\n";
echo "last tick:       " . ($L['last_tick_at'] ? date('Y-m-d H:i', $L['last_tick_at']) : '-') . "\n\n";

$h = penumbra_outage_history(array('hours' => 24 * 30, 'limit' => 200), is_array($config) ? $config : array());
echo "--- by component (30 days) ---\n";
foreach ($h['by_component'] as $k => $v) {
    printf("  %-12s %2d episodes  %6s down  %s%%\n", $v['component'], $v['episodes'],
        round($v['downtime'] / 60) . 'm', $v['availability'] === null ? '-' : $v['availability']);
}
echo "\n--- recurring patterns ---\n";
if (!$h['patterns']) { echo "  (none)\n"; }
foreach ($h['patterns'] as $p) {
    printf("  %-8s around %s on %d days, typically %dm\n",
        $p['component'], $p['typical_start'], $p['days'], round($p['median_duration'] / 60));
}
echo "\n--- most recent episodes ---\n";
foreach (array_slice($h['episodes'], 0, 12) as $ep) {
    printf("  %s  %-10s %5dm  %s\n", date('Y-m-d H:i', $ep['started_at']), $ep['component'],
        round($ep['duration_max'] / 60), $ep['problem']);
}

if ($DRY) {
    @unlink($ledgerFile);
    echo "\n--dry-run: scratch ledger removed. $realLedger was never opened.\n";
} else {
    echo "\nledger written: $ledgerFile\n";
}
exit(0);
