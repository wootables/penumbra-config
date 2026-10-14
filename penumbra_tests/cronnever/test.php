<?php
// cronnever (2026-10-11): a cron that never comes round (31 February) must not run hourly.
//   php -n test.php <manage_schedule.php> <schedule_runner.php>
// Lifts the cron functions out of the candidate files (never includes them: DB + mail)
// and checks: the calc says never (false), a save / enable refuses it with its own
// message, the runner puts one off a YEAR; real schedules are unchanged.
$pass = 0; $fail = 0;
function ok($c, $n, $i = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $n\n"; } else { $fail++; echo "  FAIL  $n   $i\n"; } }
$ms = str_replace("\r\n", "\n", (string)@file_get_contents($argv[1]));
$sr = str_replace("\r\n", "\n", (string)@file_get_contents($argv[2]));
function lift($src, $name) { return preg_match('/^function ' . preg_quote($name, '/') . '\(.*?\n\}/sm', $src, $m) ? $m[0] : null; }
foreach (array('get_next_run_date_calc', 'check_cron_part_calc', 'cron_never_comes_round') as $fn) { $c = lift($ms, $fn); if ($c) eval($c); }
foreach (array('get_next_run_date', 'check_cron_part') as $fn) { $c = lift($sr, $fn); if ($c) eval($c); }
date_default_timezone_set('America/New_York');
ok(function_exists('get_next_run_date_calc') && function_exists('get_next_run_date'), 'S0 the cron functions lifted');
ok(get_next_run_date_calc('0 0 31 2 *') === false, 'C1 31 February: never (false), not "+1 hour"', var_export(get_next_run_date_calc('0 0 31 2 *'), true));
ok(get_next_run_date_calc('0 0 30 2 *') === false && get_next_run_date_calc('0 0 31 4,6,9,11 *') === false, 'C2 30 Feb / 31 of a 30-day month: never');
$y = get_next_run_date_calc('0 3 1 1 *');
ok(is_string($y) && substr($y, 5, 11) === '01-01 03:00', 'C3 a real yearly schedule still comes round', var_export($y, true));
$m = get_next_run_date_calc('* * * * *');
ok(is_string($m) && strtotime($m) - time() <= 120, 'C4 every minute: the next minute', var_export($m, true));
ok(get_next_run_date_calc('bad cron') === false, 'C5 malformed: false, as before');
ok(function_exists('cron_never_comes_round') && cron_never_comes_round('0 0 31 2 *') === true && cron_never_comes_round('bad cron') === false && cron_never_comes_round('0 3 1 1 *') === false,
   'C6 never-comes-round told apart from malformed');
ok(strpos($ms, "? 'This schedule never runs: no date in the next year matches it") !== false, 'M1 a save of one is refused with its own message');
ok(strpos($ms, "if (\$next_run === false) {\n                    // (cronnever)") !== false && strpos($ms, "'Cannot enable: this schedule never runs") !== false, 'M2 an enable of one is refused');
ok(strpos($ms, "if (!\$next_run && \$test_once) {\n            \$cron = '* * * * *';") !== false, 'M3 a Test Run of one still runs (the placeholder cron path is intact)');
ok(get_next_run_date('0 0 31 2 *') === false, 'R1 the runner\'s twin says never too');
ok(strpos($sr, "? '+1 year' : '+1 hour'));") !== false, 'R2 the runner puts a never-schedule off a YEAR after a run, not an hour');
echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
