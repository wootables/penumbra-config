<?php
// penumbra_tests\secfixes\test.php <dir holding db_connection.php, ai_assist.php, audit_ack.php>
//
// The two small security fixes of 2026-10-01, no database and no web server:
//  1. The AI Assist rate limiter (penumbraAiRateCheck in db_connection.php), lifted by its
//     markers and run against a temp dir with an injected clock: N calls a rolling minute
//     per user, the N+1th refused with the seconds until the oldest call drops out, the
//     window sliding, users counted apart, 0 = off, an unwritable dir failing OPEN, a user
//     key with unsafe characters sanitised, a corrupt stamp file tolerated.
//  2. ai_assist.php calls the limiter BEFORE it reads the request body and answers a
//     refusal with 429 + Retry-After (static: the file's text in order).
//  3. audit_ack.php calls penumbraCsrfGuard() before anything else runs (static), as every
//     other writing endpoint does.
// Prints "N assertions, F failed" and exits 1 on a failure. The pre-fix files are the
// positive control: no limiter to lift (FATAL), no guard in audit_ack.php.
$APP = isset($argv[1]) ? rtrim($argv[1], '\\/') : '';
foreach (array('db_connection.php', 'ai_assist.php', 'audit_ack.php') as $need) {
    if ($APP === '' || !is_file($APP . '/' . $need)) { fwrite(STDERR, "usage: php test.php <dir holding $need>\n"); exit(2); }
}
$pass = 0; $fail = 0; $lines = array();
function ok($name, $cond, $detail = '') {
    global $pass, $fail, $lines;
    if ($cond) { $pass++; $lines[] = "  PASS  $name"; }
    else { $fail++; $lines[] = "  FAIL  $name" . ($detail !== '' ? "\n        $detail" : ''); }
}
function rd($p) { return str_replace("\r\n", "\n", file_get_contents($p)); }

// ---- 1. the limiter, lifted from db_connection.php
$db = rd($APP . '/db_connection.php');
$s = strpos($db, "if (!function_exists('penumbraAiRateCheck')) {");
$e = strpos($db, '// -- end of the AI Assist rate limit --');
if ($s === false || $e === false) { echo "FATAL: the rate limiter's markers are not in db_connection.php (pre-fix file?)\n"; echo "1 assertions, 1 failed\n"; exit(1); }
// The limiter leans on penumbra_inflight_dir() for its default dir; a stub keeps the
// lift self-contained (the tests pass their own dir anyway).
if (!function_exists('penumbra_inflight_dir')) { function penumbra_inflight_dir($config) { return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_secfixes_default'; } }
eval(substr($db, $s, $e - $s));
ok('the limiter lifted (penumbraAiRateCheck present)', function_exists('penumbraAiRateCheck'));

$tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_secfixes_' . getmypid();
if (is_dir($tmp)) { foreach (glob($tmp . DIRECTORY_SEPARATOR . '*') as $g) { @unlink($g); } } else { @mkdir($tmp, 0777, true); }
$cfg = array('ai_assist_per_minute' => 3, 'ai_assist_rate_dir' => $tmp);
$calls = array();
for ($i = 0; $i < 3; $i++) { $calls[] = penumbraAiRateCheck('ada', $cfg, 1000 + $i); }
ok('three calls in a minute pass, counted 1, 2, 3', $calls[0]['ok'] && $calls[1]['ok'] && $calls[2]['ok'] && $calls[0]['count'] === 1 && $calls[2]['count'] === 3 && $calls[2]['limit'] === 3, json_encode($calls));
$r4 = penumbraAiRateCheck('ada', $cfg, 1003);
ok('the fourth is refused, naming how long until the oldest drops out (57 s)', $r4['ok'] === false && $r4['count'] === 3 && $r4['retry'] === 57, json_encode($r4));
$r5 = penumbraAiRateCheck('ada', $cfg, 1030);
ok('... still refused half a minute later (retry 30 s), and the refusal is not counted', $r5['ok'] === false && $r5['count'] === 3 && $r5['retry'] === 30, json_encode($r5));
$r6 = penumbraAiRateCheck('ada', $cfg, 1060);
ok('at 60 s the oldest call has dropped out and the next passes (count 3 again)', $r6['ok'] === true && $r6['count'] === 3, json_encode($r6));
$r7 = penumbraAiRateCheck('ada', $cfg, 1060);
ok('... and the one after that is refused again (the window slid, it did not reset)', $r7['ok'] === false && $r7['retry'] === 1, json_encode($r7));
$rb = penumbraAiRateCheck('bob', $cfg, 1003);
ok('another user is counted apart', $rb['ok'] === true && $rb['count'] === 1, json_encode($rb));
$r0 = penumbraAiRateCheck('ada', array('ai_assist_per_minute' => 0, 'ai_assist_rate_dir' => $tmp), 1003);
ok('0 turns the limit off', $r0['ok'] === true && $r0['limit'] === 0, json_encode($r0));
// The default dir persists between runs and the clock here never moves, so this
// call uses a user of its own and removes its stamp file afterwards.
$dUser = 'default_' . getmypid();
$dFile = penumbra_inflight_dir(array()) . DIRECTORY_SEPARATOR . 'ai_rate' . DIRECTORY_SEPARATOR . $dUser . '.ai';
@unlink($dFile);
$rd = penumbraAiRateCheck($dUser, array('ai_assist_per_minute' => 3), 1003);
ok('the default dir sits under the in-flight dir', is_dir(penumbra_inflight_dir(array()) . DIRECTORY_SEPARATOR . 'ai_rate') && is_file($dFile) && $rd['ok'] === true && $rd['count'] === 1, json_encode($rd));
@unlink($dFile);
$blocker = $tmp . DIRECTORY_SEPARATOR . 'notadir';
file_put_contents($blocker, 'x');
$rx = penumbraAiRateCheck('ada', array('ai_assist_per_minute' => 1, 'ai_assist_rate_dir' => $blocker), 1003);
$rx2 = penumbraAiRateCheck('ada', array('ai_assist_per_minute' => 1, 'ai_assist_rate_dir' => $blocker), 1003);
ok('a dir that cannot be made fails OPEN (two calls at limit 1 both pass)', $rx['ok'] === true && $rx2['ok'] === true, json_encode(array($rx, $rx2)));
$ru = penumbraAiRateCheck('a/b:c*?', $cfg, 1003);
ok('a user key with unsafe characters is sanitised into a file name and counted', $ru['ok'] === true && $ru['count'] === 1 && is_file($tmp . DIRECTORY_SEPARATOR . 'a_b_c__.ai'), json_encode(array($ru, glob($tmp . DIRECTORY_SEPARATOR . '*'))));
file_put_contents($tmp . DIRECTORY_SEPARATOR . 'cy.ai', "garbage\n12x\n\n999999999999\n");
$rc = penumbraAiRateCheck('cy', $cfg, 1003);
ok('a corrupt stamp file is tolerated (nothing counted from it, the call passes as the first)', $rc['ok'] === true && $rc['count'] === 1, json_encode($rc));
$rl = penumbraAiRateCheck('ada', array('ai_assist_per_minute' => -5, 'ai_assist_rate_dir' => $tmp), 1003);
ok('a negative limit reads as off', $rl['ok'] === true && $rl['limit'] === 0, json_encode($rl));
foreach (glob($tmp . DIRECTORY_SEPARATOR . '*') as $g) { @unlink($g); } @rmdir($tmp);

// ---- 2. ai_assist.php: the limiter runs before the body is read, and refuses with 429
$ai = rd($APP . '/ai_assist.php');
$pCall = strpos($ai, 'penumbraAiRateCheck($currentUserKey');
$pBody = strpos($ai, "file_get_contents('php://input')");
$pAuth = strpos($ai, 'penumbraAiAssistAllowed($isAdmin, $userGrants, $currentUserKey)');
ok('ai_assist.php calls the limiter', $pCall !== false, 'no call');
ok('... after the authorization check and before the body is read', $pCall !== false && $pAuth !== false && $pBody !== false && $pAuth < $pCall && $pCall < $pBody, json_encode(array($pAuth, $pCall, $pBody)));
$refuse = $pCall !== false ? substr($ai, $pCall, 900) : '';
ok('... and a refusal is 429 with Retry-After and a message', strpos($refuse, 'http_response_code(429)') !== false && strpos($refuse, "header('Retry-After: '") !== false && strpos($refuse, "'message' => 'AI Assist takes up to '") !== false, substr($refuse, 0, 200));
ok('... gated on the check\'s answer', preg_match('/if \(!\$aiRate\[\'ok\'\]\) \{/', $refuse) === 1, '');

// ---- 3. audit_ack.php: the CSRF guard runs first
$ack = rd($APP . '/audit_ack.php');
$pGuard = strpos($ack, 'penumbraCsrfGuard();');
$pFirst = strpos($ack, '$short_id = isset($_POST');
$pPrep = strpos($ack, '->prepare(');
ok('audit_ack.php calls penumbraCsrfGuard()', $pGuard !== false, 'no guard (pre-fix file?)');
ok('... before the request is read and before any statement runs', $pGuard !== false && $pFirst !== false && $pPrep !== false && $pGuard < $pFirst && $pGuard < $pPrep, json_encode(array($pGuard, $pFirst, $pPrep)));

echo implode("\n", $lines), "\n";
echo ($pass + $fail), " assertions, ", $fail, " failed\n";
exit($fail ? 1 : 0);
