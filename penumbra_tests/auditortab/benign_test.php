<?php
// php -n benign_test.php <log_client_error.php> [<db_connection.php>]
// Since 2026-09-25 evening the collector calls the SHARED rule in db_connection.php
// (penumbraClientErrorIsBenign), so that is lifted too when present.
$src = file_get_contents($argv[1]);
if (!preg_match('/function penumbra_client_error_is_benign\(.*?\n\}\n/s', $src, $m)) { echo "LIFT FAILED\n"; exit(1); }
if (isset($argv[2]) && is_file($argv[2])) {
    $db = file_get_contents($argv[2]);
    foreach (array('penumbraBenignClientErrorPattern', 'penumbraClientErrorIsBenign') as $fn) {
        if (preg_match('/^function ' . $fn . '\(.*?^\}\n/ms', $db, $fm)) eval('?>' . "<?php\n" . $fm[0]);
    }
}
eval('?>' . "<?php\n" . $m[0]);
$cases = array(
  array('unhandledrejection', 'Transition was skipped', true),
  array('unhandledrejection', 'Transition was aborted because of invalid state. ViewTransition opt-in disabled', true),
  array('unhandledrejection', 'Skipped ViewTransition due to another transition starting', true),
  array('unhandledrejection', '  transition was SKIPPED', true),
  array('error', 'Transition was skipped', false),
  array('unhandledrejection', 'The user aborted a request.', false),
  array('unhandledrejection', 'Cannot read properties of undefined (reading \'transition\')', false),
  array('unhandledrejection', 'Failed to fetch', false),
  array('resource', 'Transition was skipped', false),
);
$fail = 0;
foreach ($cases as $c) { $got = penumbra_client_error_is_benign($c[0], $c[1]); $ok = ($got === $c[2]); if (!$ok) $fail++; printf("%s  %-18s %-80s => %s\n", $ok ? 'PASS' : 'FAIL', $c[0], $c[1], var_export($got, true)); }
echo $fail ? "RESULT: RED ($fail)\n" : "RESULT: GREEN\n";
