<?php
/**
 * penumbra_tests/dropdest - the DROP_FILE destination allow-list.
 *
 * Guards the 2026-09-04 fix: a scheduled DROP_FILE task could name ANY
 * destination - a UNC/local path the Task Scheduler identity can write (the
 * plugin does mkdir + file_put_contents), any host:port for sftp/scp/ftp, any
 * URL as an S3 endpoint. Now penumbraDropDestinationError() (db_connection.php)
 * refuses anything not under a configured root / not a configured host, at
 * save time (manage_schedule.php) and at run time (schedule_runner.php), and
 * transport_unc() re-checks the RESOLVED directory so a junction under a
 * permitted root cannot redirect the write.
 *
 * Two things under test, both REAL code:
 *   1. The validator pair, lifted from the live db_connection.php by tokenizer.
 *   2. transport_unc() from the live plugins/file_transport.php (require'd - it
 *      is function definitions only), exercised against a scratch directory:
 *      a write under the root lands, a sibling directory is refused, a '..'
 *      escape is refused after mkdir resolves it, and no roots = refused.
 *
 *   php.exe -n test_dropdest.php [--control]
 *
 * --control adds one deliberately false assertion, which MUST report FAIL.
 * A TARGETED MUTANT always runs: the path-segment boundary in the prefix
 * check is broken, and the "\\s\share2 is not under \\s\share" case must
 * then wrongly PASS - proving that assertion can fail.
 *
 * EXPECTED TAIL: "PASS 52   FAIL 0". A smaller pass count is a failure too.
 */
$CONTROL = in_array('--control', $argv, true);
$pass = 0; $fail = 0;
function ok($cond, $label) {
    global $pass, $fail;
    if ($cond) { $pass++; } else { $fail++; echo "    FAIL  $label\n"; }
}

$APP_UNC = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP_LOC = 'C:/inetpub/wwwroot/sponsor_migration/penumbra';
$APP = is_file($APP_UNC . '\\db_connection.php') ? $APP_UNC : $APP_LOC;
$SRC = @file_get_contents($APP . '/db_connection.php');
if ($SRC === false) { fwrite(STDERR, "FATAL: cannot read db_connection.php\n"); exit(2); }

/** Lift one NAMED function's source (from `function` to its matching `}`). */
function lift_function($src, $name) {
    $tokens = token_get_all($src);
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        if ($j < $n && !is_array($tokens[$j]) && $tokens[$j] === '&') {
            $j++;
            while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        }
        if (!($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING && $tokens[$j][1] === $name)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $t = $tokens[$k]; $txt = is_array($t) ? $t[1] : $t;
            $buf .= $txt;
            if ($txt === '{') { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    return null;
}

$bufNorm = lift_function($SRC, 'penumbraNormalizeDropPath');
$bufChk  = lift_function($SRC, 'penumbraDropDestinationError');
if ($bufNorm === null || $bufChk === null) { fwrite(STDERR, "FATAL: could not lift the validator pair\n"); exit(2); }
eval($bufNorm);
eval($bufChk);
ok(function_exists('penumbraNormalizeDropPath') && function_exists('penumbraDropDestinationError'),
   'validator pair lifted from the live db_connection.php and defined');

// ---------------------------------------------------------------------------
echo "penumbraNormalizeDropPath\n";
$N = 'penumbraNormalizeDropPath';
ok($N('\\\\srv\\share\\folder')       === '\\\\srv\\share\\folder', 'UNC path normalises to itself, lower-cased');
ok($N('//srv/share/folder/')          === '\\\\srv\\share\\folder', 'forward slashes + trailing slash normalise');
ok($N('\\\\SRV\\Share\\\\Folder\\\\') === '\\\\srv\\share\\folder', 'case + doubled separators normalise');
ok($N('D:\\drops\\x')                 === 'd:\\drops\\x',           'local drive path normalises');
ok($N('d:/drops/x/')                  === 'd:\\drops\\x',           'local drive with forward slashes normalises');
ok($N('\\\\srv\\share')               === '\\\\srv\\share',         'bare \\\\server\\share is acceptable (a root)');
ok($N('\\\\srv')                      === null, 'a server with no share is rejected');
ok($N('D:')                           === null, 'a bare drive is rejected');
ok($N('D:\\')                         === null, 'a bare drive root is rejected');
ok($N('drops\\x')                     === null, 'a relative path is rejected');
ok($N('\\\\?\\D:\\drops')             === null, 'the \\\\?\\ device prefix is rejected');
ok($N('\\\\.\\PhysicalDrive0')        === null, 'the \\\\.\\ device prefix is rejected');
ok($N('\\\\srv\\share\\..\\other')    === null, 'a .. segment is rejected');
ok($N('D:\\drops\\.\\x')              === null, 'a . segment is rejected');
ok($N('D:\\drops\\x:stream')          === null, 'an alternate data stream colon is rejected');
ok($N("D:\\drops\\x\x00y")            === null, 'a control character is rejected');
ok($N('')                             === null, 'empty is rejected');
ok($N(null)                           === null, 'non-string is rejected');

// ---------------------------------------------------------------------------
echo "penumbraDropDestinationError\n";
$E = 'penumbraDropDestinationError';
$roots = array('\\\\srv\\share\\drops', 'D:\\penumbra_drops');
$hosts = array('gosparcs.oit.ncsu.edu', 'S3.us-east-1.amazonaws.com');
ok($E('unc', array('drop_path' => '\\\\srv\\share\\drops'), $roots, array()) === null,          'unc: the root itself is allowed');
ok($E('unc', array('drop_path' => '\\\\SRV\\Share\\drops\\sub\\deeper\\'), $roots, array()) === null, 'unc: below a root, mixed case, trailing slash');
ok($E('unc', array('drop_path' => '//srv/share/drops/sub'), $roots, array()) === null,         'unc: forward-slash form below a root');
ok($E('unc', array('drop_path' => 'D:\\penumbra_drops\\today'), $roots, array()) === null,     'unc: local drive root');
ok($E('unc', array('drop_path' => '\\\\srv\\share\\drops2'), $roots, array()) !== null,         'unc: \\\\srv\\share\\drops2 is NOT under \\\\srv\\share\\drops (segment boundary)');
ok($E('unc', array('drop_path' => 'D:\\penumbra_dropsX'), $roots, array()) !== null,           'unc: D:\\penumbra_dropsX is NOT under D:\\penumbra_drops');
ok($E('unc', array('drop_path' => '\\\\srv\\share'), $roots, array()) !== null,                 'unc: the share above the root is refused');
ok($E('unc', array('drop_path' => '\\\\other\\share\\drops'), $roots, array()) !== null,        'unc: another server is refused');
ok($E('unc', array('drop_path' => '\\\\srv\\share\\drops\\..\\secret'), $roots, array()) !== null, 'unc: a .. escape is refused');
ok($E('unc', array('drop_path' => 'D:\\penumbra_drops\\x:ads'), $roots, array()) !== null,      'unc: an alternate data stream is refused');
ok($E('unc', array('drop_path' => '\\\\oitras.oit.ncsu.edu\\d$'), $roots, array()) !== null,    'unc: the historical d$ admin-share root is refused');
ok($E('unc', array('drop_path' => '\\\\srv\\share\\drops'), array(), array()) !== null,         'unc: EMPTY roots refuse everything (deny by default)');
ok($E('unc', array(), $roots, array()) !== null,                                                 'unc: a missing path is refused');
ok($E('',    array('drop_path' => '\\\\srv\\share\\drops'), $roots, array()) === null,          'unc: an empty protocol defaults to unc like the runner');
ok($E('sftp', array('drop_host' => 'GOSPARCS.oit.ncsu.edu'), array(), $hosts) === null,         'sftp: listed host, case-insensitive');
ok($E('scp',  array('drop_host' => 'gosparcs.oit.ncsu.edu'), array(), $hosts) === null,         'scp: listed host');
ok($E('ftp',  array('drop_host' => 'evil.example.net'), array(), $hosts) !== null,              'ftp: unlisted host refused');
ok($E('sftp', array('drop_host' => 'gosparcs.oit.ncsu.edu'), array(), array()) !== null,        'sftp: EMPTY hosts refuse everything');
ok($E('sftp', array('drop_host' => ''), array(), $hosts) !== null,                              'sftp: missing host refused');
ok($E('sftp', array('drop_host' => 'gosparcs.oit.ncsu.edu/../x'), array(), $hosts) !== null,    'sftp: a host that is not a plain name is refused');
ok($E('s3',   array('drop_s3_endpoint' => 'https://s3.us-east-1.amazonaws.com'), array(), $hosts) === null, 's3: listed endpoint host');
ok($E('s3',   array('drop_s3_region' => 'us-east-1'), array(), $hosts) === null,               's3: the AWS default endpoint for the region counts');
ok($E('s3',   array('drop_s3_endpoint' => 'https://minio.internal:9000'), array(), $hosts) !== null, 's3: unlisted endpoint host refused');
ok($E('s3',   array('drop_s3_endpoint' => 'https://s3.us-east-1.amazonaws.com@evil.example.net/'), array(), $hosts) !== null, 's3: user-info trick (allowed-host@evil) refused');
ok($E('s3',   array('drop_s3_endpoint' => 'gopher://s3.us-east-1.amazonaws.com'), array(), $hosts) !== null, 's3: a non-http scheme is refused');
ok($E('smb',  array('drop_path' => '\\\\srv\\share\\drops'), $roots, $hosts) !== null,          'an unknown protocol is refused');

// ---------------------------------------------------------------------------
echo "transport_unc (live plugin, scratch directory)\n";
require $APP . '/plugins/file_transport.php';
ok(function_exists('transport_unc'), 'plugin required (function definitions only)');
$scratch = rtrim(sys_get_temp_dir(), '\\/') . '\\pnb_dropdest_' . getmypid();
$root = $scratch . '\\root';
@mkdir($root, 0777, true);
@mkdir($scratch . '\\other', 0777, true);
$rootOpts = array('_allowed_roots' => array(strtoupper($scratch) . '/ROOT/'));   // deliberately mangled: case, slashes, trailing slash

$r = transport_unc('a,b', $root . '\\sub\\a.csv', $rootOpts);
ok(!empty($r['success']) && is_file($root . '\\sub\\a.csv'), 'a write under the root lands (root given in mangled form): ' . $r['message']);
$r = transport_unc('a,b', $scratch . '\\other\\b.csv', $rootOpts);
ok(empty($r['success']) && !is_file($scratch . '\\other\\b.csv'), 'a sibling directory outside the root is refused, nothing written: ' . $r['message']);
$r = transport_unc('a,b', $root . '\\..\\other\\c.csv', $rootOpts);
ok(empty($r['success']) && !is_file($scratch . '\\other\\c.csv'), 'a .. escape is refused after mkdir resolves it, nothing written: ' . $r['message']);
$r = transport_unc('a,b', $root . '\\d.csv', array());
ok(empty($r['success']) && !is_file($root . '\\d.csv'), 'no _allowed_roots supplied = refused (fail closed): ' . $r['message']);

// tidy
foreach (array($root . '\\sub\\a.csv') as $f) { @unlink($f); }
@rmdir($root . '\\sub'); @rmdir($root); @rmdir($scratch . '\\other'); @rmdir($scratch);

// ---------------------------------------------------------------------------
echo "MUTANT (segment boundary broken - \\\\srv\\share\\drops2 must wrongly PASS)\n";
$mut = str_replace('penumbraDropDestinationError', 'penumbraDropDestinationError_mut', $bufChk);
$mut = str_replace("strpos(\$n, \$root . '\\\\') === 0", "strpos(\$n, \$root) === 0", $mut);
ok(strpos($mut, "strpos(\$n, \$root) === 0") !== false, 'mutant: the boundary check was actually rewritten');
eval($mut);
ok(function_exists('penumbraDropDestinationError_mut')
   && penumbraDropDestinationError_mut('unc', array('drop_path' => '\\\\srv\\share\\drops2'), $roots, array()) === null,
   'mutant wrongly allows \\\\srv\\share\\drops2, so the boundary assertion above can fail');

if ($CONTROL) {
    echo "Control (must FAIL)\n";
    ok(false, 'control: a deliberately false assertion');
}

echo "\nPASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
