<?php
/**
 * test_delivery.php - the www3 delivery check, in isolation.
 *
 * WHAT HAPPENED. On 2026-09-12 every response over about 27KB from oitras to
 * the www3 reverse proxies (10.48.12.91 / .98) stalled and was aborted by
 * Windows after ~20s of unanswered retransmits - IIS sc-win32-status 121.
 * index.php (100-120KB) never finished arriving; the 22KB health page did,
 * and reported everything healthy, because every check it ran was made FROM
 * the server and nothing on the server was wrong. penumbra_delivery_health()
 * exists so that surface can answer "are pages reaching users?" as well.
 *
 * Runs against the REAL block extracted from penumbra_health.php (never a
 * copy) with the REAL penumbra_logs.php helpers it calls. Fixtures are
 * synthetic u_ex*.log files in a scratch directory; the live log directory
 * is only ever read, and only as a final smoke test.
 *
 *   php.exe -n -d date.timezone=America/New_York test_delivery.php
 *          --src=<penumbra_health.php> --logs=<penumbra_logs.php> [--live=<iis dir>]
 *          [--control] [--mutant]
 *
 * --control runs a deliberately false assertion, which MUST report FAIL.
 * --mutant  changes the stall code the block counts (121 -> 999) before the
 *           block is loaded; the stall assertions MUST then fail. A harness
 *           whose assertions cannot be made to fail by breaking the code under
 *           test is not testing that code.
 */

$SRC = 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_health.php';
$LOGS = 'C:\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\penumbra_logs.php';
$LIVE = '';
foreach ($argv as $a) {
    if (strpos($a, '--src=') === 0)  $SRC  = substr($a, 6);
    if (strpos($a, '--logs=') === 0) $LOGS = substr($a, 7);
    if (strpos($a, '--live=') === 0) $LIVE = substr($a, 7);
}
$CONTROL = in_array('--control', $argv, true);
$MUTANT  = in_array('--mutant', $argv, true);

$TMP = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_delivery_test_' . getmypid();
@mkdir($TMP, 0777, true);

// ---- extract the DELIVERY block from the live file ---------------------------
$src = file_get_contents($SRC);
if ($src === false) { fwrite(STDERR, "cannot read $SRC\n"); exit(2); }
$start = strpos($src, '/* =====================================================================' . "\n" . ' * DELIVERY');
$end   = strpos($src, '/* =====================================================================' . "\n" . ' * OUTAGE HISTORY');
if ($start === false || $end === false || $end <= $start) {
    fwrite(STDERR, "could not locate the DELIVERY block in $SRC\n"); exit(2);
}
$block = substr($src, $start, $end - $start);
// The classifier lives in the OUTAGE block; lift just that function.
if (!preg_match('/\nfunction penumbra_outage_classify\(.*?\n\}\n/s', $src, $cm)) {
    fwrite(STDERR, "could not locate penumbra_outage_classify in $SRC\n"); exit(2);
}
$classify = $cm[0];

if ($MUTANT) {
    $mut = str_replace('return array(121);', 'return array(999);', $block, $n);
    if ($n !== 1) { fwrite(STDERR, "mutant anchor not found exactly once ($n)\n"); exit(2); }
    $block = $mut;
    echo "MUTANT: stall code changed 121 -> 999; the stall assertions below MUST fail\n";
}

require $LOGS;   // penumbra_tail_file(), penumbra_log_w3c_fields()
$harness = $TMP . DIRECTORY_SEPARATOR . 'harness.php';
file_put_contents($harness, "<?php\n" . $block . "\n" . $classify . "\n");
require $harness;

// ---- tiny assert -------------------------------------------------------------
$PASS = 0; $FAIL = 0;
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got === null ? '' : ('  (got: ' . json_encode($got) . ')')) . "\n"; }
}
function group($t) { echo "\n== $t ==\n"; }

// ---- fixtures ------------------------------------------------------------------
$FIELDS = '#Fields: date time s-ip cs-method cs-uri-stem cs-uri-query s-port cs-username c-ip cs(User-Agent) cs(Referer) sc-status sc-substatus sc-win32-status sc-bytes cs-bytes time-taken';
/** One IIS row in this box's field order. */
function row($ts, $ip, $uri, $status, $w32, $bytes, $ms) {
    return gmdate('Y-m-d H:i:s', $ts) . ' 152.1.26.180 GET ' . $uri . ' - 443 - ' . $ip
         . ' Mozilla/5.0+(test) https://www3.acs.ncsu.edu/ ' . $status . ' 0 ' . $w32 . ' ' . $bytes . ' 5000 ' . $ms;
}
/** Write a u_ex file for the UTC day of $ts with the given rows (chronological). */
function w3c($dir, $ts, $rows, $fields = null) {
    global $FIELDS;
    $f = $dir . DIRECTORY_SEPARATOR . 'u_ex' . gmdate('ymd', $ts) . '.log';
    $head = "#Software: Microsoft Internet Information Services 10.0\n#Version: 1.0\n#Date: "
          . gmdate('Y-m-d H:i:s', $ts) . "\n" . ($fields === null ? $FIELDS : $fields) . "\n";
    file_put_contents($f, $head . implode("\n", $rows) . "\n");
    return $f;
}
function clean($dir) { foreach ((array)@glob($dir . DIRECTORY_SEPARATOR . 'u_ex*.log') as $f) @unlink($f); }
function fresh_dir($name) {
    global $TMP;
    $d = $TMP . DIRECTORY_SEPARATOR . $name;
    @mkdir($d, 0777, true);
    clean($d);
    return $d;
}
$P1 = '10.48.12.91'; $P2 = '10.48.12.98';
$CFG = array('trusted_proxy_ips' => array($P1, $P2, '127.0.0.1', '::1'));
function check($dir, $now, $extra = array()) {
    global $CFG;
    $cfg = $CFG;
    $cfg['delivery'] = array_merge(array('iis_log_dir' => $dir), $extra);
    return penumbra_delivery_health($cfg, array('now' => $now));
}
$NOW = gmmktime(15, 30, 0, 9, 12, 2026);   // 15:30 UTC, a Saturday, mid-file

// ===============================================================================
group('proxies: who is judged');
ok(penumbra_delivery_proxies($CFG) === array($P1, $P2), 'trusted_proxy_ips minus the loopbacks', penumbra_delivery_proxies($CFG));
ok(penumbra_delivery_proxies(array()) === array('10.48.12.91', '10.48.12.98'), 'no config at all -> the two known proxies');
ok(penumbra_delivery_proxies(array('delivery' => array('proxy_ips' => array('1.2.3.4')))) === array('1.2.3.4'), 'delivery.proxy_ips overrides');
ok(penumbra_delivery_proxies(array('trusted_proxy_ips' => array('fe80::1', '::1'))) === array('10.48.12.91', '10.48.12.98'), 'a list of nothing but loopbacks falls back rather than judging nobody');

group('timestamps and files');
ok(penumbra_delivery_ts('2026-09-12', '23:15:33') === gmmktime(23, 15, 33, 9, 12, 2026), 'IIS date+time parse as UTC');
ok(penumbra_delivery_ts('2026-13-12', '23:15:33') === 0 && penumbra_delivery_ts('', '') === 0 && penumbra_delivery_ts('#Fields:', 'date') === 0, 'malformed -> 0, never a warning');
$ff = penumbra_delivery_log_files('C:\\x', gmmktime(23, 50, 0, 9, 12, 2026), gmmktime(0, 5, 0, 9, 13, 2026));
ok(count($ff) === 2 && basename($ff[0]) === 'u_ex260912.log' && basename($ff[1]) === 'u_ex260913.log', 'a window across midnight UTC names two files, oldest first', $ff);
$ff = penumbra_delivery_log_files('C:\\x\\', $NOW - 900, $NOW);
ok(count($ff) === 1 && basename($ff[0]) === 'u_ex260912.log', 'inside one UTC day: one file', $ff);
$dm = penumbra_delivery_default_fields();
ok($dm['c-ip'] === 8 && $dm['sc-win32-status'] === 13 && $dm['sc-bytes'] === 14 && $dm['time-taken'] === 16, 'fallback field map matches this box');

group('unknown: no log to read says nothing');
$d = fresh_dir('empty');
$r = check($d, $NOW);
ok($r['status'] === 'unknown', 'no file -> unknown', $r['status']);
ok(strpos($r['detail'], 'not readable') !== false && strpos($r['detail'], 'u_ex260912.log') !== false, 'detail names the missing file', $r['detail']);
ok($r['samples'] === 0 && $r['failures'] === array(), 'and reports nothing');
$r = check($TMP . DIRECTORY_SEPARATOR . 'does_not_exist', $NOW);
ok($r['status'] === 'unknown', 'missing directory -> unknown, no exception');

group('quiet: traffic that says nothing about delivery');
$d = fresh_dir('quiet');
w3c($d, $NOW, array(
    row($NOW - 600, $P1, '/sponsor_migration/penumbra/health.php', 200, 0, 22443, 226),   // under the size floor
    row($NOW - 500, $P1, '/sponsor_migration/penumbra/img/wolf.png', 200, 0, 648, 3),
    row($NOW - 400, '136.226.3.10', '/sor/query.php', 200, 0, 605415, 321),               // large, but not a proxy
    row($NOW - 300, '136.226.3.10', '/sor/query.php', 200, 121, 605415, 20000),           // a stall, but not a proxy
));
$r = check($d, $NOW);
ok($r['status'] === 'quiet', 'small proxy responses + big direct ones -> quiet', $r['status']);
ok($r['samples'] === 0 && $r['ok'] === 0 && $r['stalled'] === 0, 'none of them counted');
ok($r['log_lag_secs'] === 300, 'log lag = age of the newest row read, whoever it was for', $r['log_lag_secs']);
ok(strpos($r['detail'], '25KB') !== false && strpos($r['detail'], '15 min') !== false, 'detail states the floor and the window', $r['detail']);

group('ok: large responses completing');
$d = fresh_dir('ok');
w3c($d, $NOW, array(
    row($NOW - 800, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 700, $P2, '/sponsor_migration/penumbra/js/main.js', 200, 0, 1412000, 900),
    row($NOW - 100, $P1, '/sponsor_migration/penumbra/query.php', 200, 0, 66993, 1714),
));
$r = check($d, $NOW);
ok($r['status'] === 'ok', 'three delivered, nothing stalled -> ok', $r['status']);
ok($r['ok'] === 3 && $r['samples'] === 3 && $r['largest_ok_bytes'] === 1412000, 'counts and the largest', $r);
ok($r['last_ok_at'] === date('c', $NOW - 100) && $r['last_fail_at'] === null, 'last_ok_at is the newest completion');
ok(count($r['files']) === 1 && $r['files'][0] === 'u_ex260912.log', 'the file it read');
ok(!$r['window_truncated'], 'the whole window was read');

group('the window edge');
$d = fresh_dir('window');
w3c($d, $NOW, array(
    row($NOW - 1200, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),   // 20 min ago: outside
    row($NOW - 899,  $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),     // 14:59 ago: inside
    row($NOW - 10,   $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
));
$r = check($d, $NOW);
ok($r['status'] === 'ok' && $r['stalled'] === 0 && $r['ok'] === 2, 'a stall 20 minutes ago is outside a 15-minute window', $r);
$r = check($d, $NOW, array('window_mins' => 30));
ok($r['status'] === 'degraded' && $r['stalled'] === 1 && $r['ok'] === 2, 'widen the window to 30 and it is inside', array($r['status'], $r['stalled'], $r['ok']));
w3c($d, $NOW, array(row($NOW + 120, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204)));
$r = check($d, $NOW);
ok($r['stalled'] === 0 && $r['status'] === 'quiet', 'a row from the future (clock skew) is ignored', $r['status']);

group('down: stalls, nothing completing');
$d = fresh_dir('down');
w3c($d, $NOW, array(
    row($NOW - 700, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($NOW - 690, $P1, '/sponsor_migration/penumbra/health.php', 200, 0, 22443, 226),   // small: neither ok nor fail
    row($NOW - 400, $P2, '/sponsor_migration/penumbra/index.php', 200, 121, 27066, 19554),
    row($NOW - 400, $P2, '/sponsor_migration/penumbra/js/main.js', 200, 995, 0, 19824),    // 0 bytes: not a large drop
    row($NOW - 60,  $P2, '/sponsor_migration/penumbra/calendar.php', 200, 121, 27520, 20474),
));
$r = check($d, $NOW);
ok($r['status'] === 'down', 'three stalls and no completion -> down', $r['status']);
ok($r['stalled'] === 3 && $r['ok'] === 0 && $r['dropped'] === 0 && $r['samples'] === 3, 'counted exactly the stalls', $r);
ok(count($r['failures']) === 3 && $r['failures'][0]['ts'] === $NOW - 60 && $r['failures'][2]['ts'] === $NOW - 700, 'failures newest first');
$f0 = $r['failures'][0];
ok($f0['kind'] === 'stall' && $f0['proxy'] === $P2 && $f0['uri'] === '/sponsor_migration/penumbra/calendar.php'
   && $f0['win32'] === 121 && $f0['bytes'] === 27520 && $f0['ms'] === 20474 && $f0['status'] === 200, 'a failure row carries what an operator needs', $f0);
ok(strpos($r['detail'], '3 of 3') !== false && strpos($r['detail'], 'none completed') !== false, 'detail: "3 of 3 ... none completed"', $r['detail']);
ok($r['last_fail_at'] === date('c', $NOW - 60) && $r['last_ok_at'] === null, 'last_fail_at newest stall');

group('a stall is a stall at any size');
$d = fresh_dir('smallstall');
w3c($d, $NOW, array(row($NOW - 60, $P1, '/sponsor_migration/penumbra/index.php', 500, 121, 690, 20001)));
$r = check($d, $NOW);
ok($r['status'] === 'down' && $r['stalled'] === 1, '121 on a 690-byte response still counts (the send timed out)', $r['status']);

group('the real 2026-09-12 lines, 23:01-23:16 UTC');
$T = gmmktime(23, 16, 0, 9, 12, 2026);
$d = fresh_dir('real');
$real = array(
    '2026-09-12 22:59:01 152.1.26.180 GET /sponsor_migration/penumbra/index.php - 443 - 10.48.12.91 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 121 92270 7125 20204',
    '2026-09-12 22:59:11 152.1.26.180 GET /sponsor_migration/penumbra/health.php - 443 - 10.48.12.91 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 0 22443 7100 226',
    '2026-09-12 22:59:18 152.1.26.180 GET /sponsor_migration/penumbra/index.php - 443 - 10.48.12.91 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 121 92262 7158 19549',
    '2026-09-12 23:00:16 152.1.26.180 GET /sponsor_migration/penumbra/js/main.js v=1789094775 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 64 275283 5056 19093',
    '2026-09-12 23:00:16 152.1.26.180 GET /sponsor_migration/penumbra/index.php - 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 121 27066 5191 19554',
    '2026-09-12 23:06:13 152.1.26.180 GET /sponsor_migration/penumbra/index.php - 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 121 92268 5191 19546',
    '2026-09-12 23:06:13 152.1.26.180 GET /sponsor_migration/penumbra/js/main.js v=1789094775 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 995 0 5056 19824',
    '2026-09-12 23:13:05 152.1.26.180 GET /sponsor_migration/penumbra/js/jquery-3.7.1.min.js - 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) - 200 0 0 32342 5000 65',
    '2026-09-12 23:14:12 152.1.26.180 GET /sponsor_migration/penumbra/calendar.php - 443 - 10.48.12.91 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 121 27520 7158 20474',
    '2026-09-12 23:15:33 152.1.26.180 GET /sponsor_migration/penumbra/js/main.js v=1789094775 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 64 136573 5056 19103',
    '2026-09-12 23:15:33 152.1.26.180 GET /sponsor_migration/penumbra/index.php - 443 - 10.48.12.98 Mozilla/5.0+(Windows+NT+10.0;+Win64;+x64) https://www3.acs.ncsu.edu/ 200 0 121 27066 5191 19543',
);
w3c($d, $T, $real);
$r = check($d, $T);
ok($r['status'] === 'down', 'the afternoon it happened reads DOWN', $r['status']);
ok($r['stalled'] === 3 && $r['ok'] === 1 && $r['dropped'] === 1, '3 stalls (23:06, 23:14, 23:15), the 32KB jquery delivered, one main.js cut off', array($r['stalled'], $r['ok'], $r['dropped']));
ok(strpos($r['detail'], '3 of 4') !== false, 'detail: 3 of 4 large responses stalled', $r['detail']);
ok(count($r['failures']) === 4 && $r['failures'][0]['uri'] === '/sponsor_migration/penumbra/index.php' && $r['failures'][0]['win32'] === 121, 'the newest failure is the 23:15:33 index.php stall');
$r = check($d, gmmktime(23, 13, 30, 9, 12, 2026));
ok($r['status'] === 'degraded' && $r['stalled'] === 4 && $r['ok'] === 1, 'thirty seconds after the jquery success: four stalls behind it, but the latest large response completed -> DEGRADED', array($r['status'], $r['stalled'], $r['ok']));
$r = check($d, gmmktime(23, 0, 30, 9, 12, 2026), array('window_mins' => 2));
ok($r['status'] === 'down' && $r['stalled'] === 3 && $r['dropped'] === 1 && $r['ok'] === 0, 'the first two minutes: 3 stalls, one 275KB main.js drop, nothing through', $r);

group('degraded: intermittent');
$d = fresh_dir('degraded');
w3c($d, $NOW, array(
    row($NOW - 800, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 700, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($NOW - 600, $P2, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 500, $P2, '/sponsor_migration/penumbra/query.php', 200, 0, 66993, 1714),
    row($NOW - 400, $P1, '/sponsor_migration/penumbra/js/main.js', 200, 0, 1412000, 900),
    row($NOW - 300, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
));
$r = check($d, $NOW);
ok($r['status'] === 'degraded', 'one stall against five completions -> degraded', $r['status']);
ok(strpos($r['detail'], '1 stalled') !== false && strpos($r['detail'], '5 delivered') !== false && strpos($r['detail'], 'intermittent') !== false, 'detail says so', $r['detail']);

group('recovering: stalls then completions');
$d = fresh_dir('recovering');
w3c($d, $NOW, array(
    row($NOW - 800, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($NOW - 700, $P2, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($NOW - 200, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 100, $P2, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
));
$r = check($d, $NOW);
ok($r['status'] === 'degraded', 'two stalls, then two completions: the latest evidence is good -> degraded, not down', $r['status']);
w3c($d, $NOW, array(
    row($NOW - 800, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 700, $P2, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 200, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($NOW - 100, $P2, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
));
$r = check($d, $NOW);
ok($r['status'] === 'down', 'the mirror image - two completions then two stalls -> down', $r['status']);

group('drops: a closed tab looks the same, so drops alone only warn');
$d = fresh_dir('drops');
w3c($d, $NOW, array(
    row($NOW - 700, $P1, '/sponsor_migration/penumbra/js/main.js', 200, 64, 275283, 19093),
    row($NOW - 500, $P2, '/sponsor_migration/penumbra/js/main.js', 200, 995, 136573, 19103),
    row($NOW - 300, $P1, '/sponsor_migration/penumbra/index.php', 200, 1236, 40000, 9092),
));
$r = check($d, $NOW);
ok($r['status'] === 'degraded' && $r['dropped'] === 3, 'three drops and nothing completing -> degraded', array($r['status'], $r['dropped']));
ok($r['failures'][0]['kind'] === 'drop' && count($r['failures']) === 3, 'listed as drops');
ok(strpos($r['detail'], 'cut off') !== false, 'detail: cut off', $r['detail']);
w3c($d, $NOW, array(
    row($NOW - 700, $P1, '/sponsor_migration/penumbra/js/main.js', 200, 64, 275283, 19093),
    row($NOW - 300, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
    row($NOW - 200, $P1, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399),
));
$r = check($d, $NOW);
ok($r['status'] === 'ok' && $r['dropped'] === 1 && $r['ok'] === 2, 'one drop beside two completions -> ok', array($r['status'], $r['dropped'], $r['ok']));
ok(strpos($r['detail'], 'closed tab') !== false, 'but the drop is mentioned', $r['detail']);
w3c($d, $NOW, array(
    row($NOW - 700, $P1, '/sponsor_migration/penumbra/js/main.js', 200, 64, 275283, 19093),
    row($NOW - 300, $P1, '/sponsor_migration/penumbra/index.php', 200, 64, 102664, 399),
));
$r = check($d, $NOW);
ok($r['status'] === 'quiet' && $r['dropped'] === 2, 'two drops and nothing else -> inconclusive (quiet)', array($r['status'], $r['dropped']));
ok(strpos($r['detail'], 'inconclusive') !== false, 'detail says inconclusive', $r['detail']);

group('a custom #Fields order is honoured');
$d = fresh_dir('fields');
$alt = '#Fields: date time c-ip sc-win32-status sc-bytes cs-uri-stem sc-status time-taken';
$rows = array(
    gmdate('Y-m-d H:i:s', $NOW - 300) . ' ' . $P1 . ' 121 92270 /sponsor_migration/penumbra/index.php 200 20204',
    gmdate('Y-m-d H:i:s', $NOW - 200) . ' ' . $P2 . ' 0 102664 /sponsor_migration/penumbra/index.php 200 399',
);
w3c($d, $NOW, $rows, $alt);
$r = check($d, $NOW);
ok($r['stalled'] === 1 && $r['ok'] === 1 && $r['status'] === 'degraded', 'columns found by NAME, not position', $r);
ok($r['failures'][0]['uri'] === '/sponsor_migration/penumbra/index.php' && $r['failures'][0]['ms'] === 20204, 'and the optional columns too', $r['failures'][0]);
// No #Fields at all: fall back to the box's known order. Its own directory,
// because penumbra_log_w3c_fields() memoises the map per PATH for the life of
// the process (one request in production; this whole run here).
$d = fresh_dir('nofields');
$f = $d . DIRECTORY_SEPARATOR . 'u_ex260912.log';
file_put_contents($f, "#Software: test\n" . row($NOW - 100, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204) . "\n");
$r = check($d, $NOW);
ok($r['stalled'] === 1 && $r['status'] === 'down', 'no #Fields directive -> the default map', $r['status']);

group('midnight UTC: the window spans two files');
$d = fresh_dir('midnight');
$M = gmmktime(0, 5, 0, 9, 13, 2026);   // 00:05 UTC Sunday = 20:05 EDT Saturday
w3c($d, $M - 600, array(   // Saturday's file
    row($M - 900, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($M - 500, $P2, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
));
w3c($d, $M, array(        // Sunday's file
    row($M - 200, $P1, '/sponsor_migration/penumbra/index.php', 200, 121, 92270, 20204),
    row($M - 100, $P1, '/sponsor_migration/penumbra/health.php', 200, 0, 22443, 226),
));
$r = check($d, $M);
ok($r['stalled'] === 3 && $r['status'] === 'down', 'stalls on both sides of midnight are counted', $r);
ok($r['files'] === array('u_ex260913.log', 'u_ex260912.log'), 'both files read, newest first', $r['files']);
@unlink($d . DIRECTORY_SEPARATOR . 'u_ex260913.log');
$r = check($d, $M);
ok($r['stalled'] === 2 && $r['status'] === 'down' && $r['files'] === array('u_ex260912.log'), 'today\'s file not created yet (quiet night) -> yesterday\'s still read', $r['files']);

group('a bigger window than the tail: counts are a floor and say so');
$d = fresh_dir('trunc');
$rows = array();
for ($i = 5400; $i >= 1; $i--) {   // 5,400 rows inside the window, ~1.1MB: past both ceilings
    $rows[] = row($NOW - $i, ($i % 2) ? $P1 : $P2, '/sponsor_migration/penumbra/index.php', 200, 0, 102664, 399);
}
w3c($d, $NOW, $rows);
$r = check($d, $NOW, array('window_mins' => 120));
ok($r['window_truncated'] === true, 'window_truncated set', $r['window_truncated']);
ok($r['ok'] > 4000 && $r['ok'] < 5400 && $r['status'] === 'ok', 'what was read is still judged', $r['ok']);
ok($r['ms'] < 2000, 'and it stays cheap (' . $r['ms'] . 'ms for the 1MB tail)', $r['ms']);

group('classification: a stable identity for the ledger and the flap detector');
$c = penumbra_outage_classify('www3 delivery down');
ok($c['key'] === 'delivery' && $c['kind'] === 'delivery' && $c['component'] === 'www3 delivery', 'www3 delivery down -> delivery/www3 delivery', $c);
ok(penumbra_outage_classify('www3 delivery degraded (3 stalled against 5 delivered)')['key'] === 'delivery', 'the degraded wording keys the same');
ok(penumbra_outage_classify('database hr down')['key'] === 'db:hr' && penumbra_outage_classify('smtp down')['key'] === 'smtp', 'the existing identities are untouched');

if ($LIVE !== '') {
    group('live smoke: the real log directory, read only');
    $t0 = microtime(true);
    $cfg = $CFG; $cfg['delivery'] = array('iis_log_dir' => $LIVE);
    $r = penumbra_delivery_health($cfg);
    $ms = (int)round((microtime(true) - $t0) * 1000);
    ok(in_array($r['status'], array('ok', 'degraded', 'down', 'quiet', 'unknown'), true), 'a known verdict: ' . $r['status'] . ' - ' . $r['detail'], $r['status']);
    ok(is_int($r['samples']) && is_array($r['failures']), 'well-formed');
    ok($r['status'] === 'unknown' || count($r['files']) >= 1, 'named the file(s) it read: ' . implode(', ', $r['files']));
    ok($ms < 15000, 'over the share in ' . $ms . 'ms (on the box this is a few ms)', $ms);
}

// ===============================================================================
if ($CONTROL) {
    group('CONTROL (must FAIL - proves the harness can report failure)');
    ok(1 === 2, 'deliberate false assertion');
}

// ---- cleanup -------------------------------------------------------------------
foreach ((array)@glob($TMP . DIRECTORY_SEPARATOR . '*') as $p) {
    if (is_dir($p)) { clean($p); @rmdir($p); } else { @unlink($p); }
}
@rmdir($TMP);

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL === 0 ? 0 : 1);
