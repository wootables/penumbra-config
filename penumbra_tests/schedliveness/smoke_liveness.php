<?php
/* Integration smoke: run the NEW liveness function against the REAL live
 * scheduler log directory, with the REAL penumbra_logs.php doing the path
 * resolution. Proves the two halves fit together outside the unit harness. */

$APP  = isset($argv[1]) ? $argv[1] : '\\\\oitras\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$SRC  = isset($argv[2]) ? $argv[2] : ($APP . '\\penumbra_health.php');

require_once $APP . '\\penumbra_logs.php';

if (!defined('PENUMBRA_RUNNER_LOG_STALE_SECS')) define('PENUMBRA_RUNNER_LOG_STALE_SECS', 330);

// Lift the real function out of the file under test - never a copy.
$src   = file_get_contents($SRC);
$start = strpos($src, 'function penumbra_runner_log_liveness(');
$end   = strpos($src, '/**' . "\n" . ' * The heartbeat did not answer.');
if ($start === false || $end === false) { fwrite(STDERR, "extract failed\n"); exit(2); }
eval(substr($src, $start, $end - $start));

// The live log directory, named explicitly (dirname(__FILE__) would otherwise
// resolve against wherever penumbra_logs.php was copied).
$cfg = array('scheduler_log_dir' => $APP . '\\log');

$srcs = penumbra_log_sources($cfg);
echo "resolved scheduler log : " . (isset($srcs['scheduler']['path']) ? $srcs['scheduler']['path'] : '(none)') . "\n";

$r = penumbra_runner_log_liveness($cfg);
echo "alive                  : " . var_export($r['alive'], true) . "\n";
echo "age_secs               : " . var_export($r['age_secs'], true) . "\n";
echo "detail                 : " . $r['detail'] . "\n";

$verdict = ($r['alive'] === true)
    ? "OK - the runner is detected ALIVE from disk alone, no database in the path"
    : ($r['alive'] === false ? "runner log is STALE" : "could not read the runner log");
echo "\n$verdict\n";
