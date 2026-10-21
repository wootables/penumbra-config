<?php
// palette round 12: render pieces of the admin chrome the harness mounts, from the chrome file UNDER TEST,
// with the app's own helpers resolved from the app folder (run with the app folder as the cwd).
//   php -n -f render_chrome.php -- --chrome <penumbra_admin_chrome.php under test> --what menu|bar --admin 1|0
// menu = penumbra_admin_tools_menu(true) (the card footer's menu + whatever it emits beside it)
// bar  = penumbra_admin_statusbar() (the chrome page's status bar: the card, its footer twin, the settings panel,
//        and since round 12 the quick actions stub tag), as an admin or a viewer
$o = getopt('', array('chrome:', 'what:', 'admin:'));
if (empty($o['chrome']) || empty($o['what'])) { fwrite(STDERR, "usage: --chrome FILE --what menu|bar --admin 1|0\n"); exit(2); }
$isAdmin = !empty($o['admin']) && $o['admin'] !== '0';
$currentUserKey = 'harness';
$_SERVER['HTTP_SHIB_GIVENNAME'] = 'Harness'; $_SERVER['HTTP_SHIB_SN'] = 'User'; $_SERVER['HTTP_SHIB_MAIL'] = 'harness@example.edu';
$_SERVER['REQUEST_METHOD'] = 'GET';
// php -n has no mbstring: the chrome's initials / labels use these four (ASCII fixtures here)
if (!function_exists('mb_substr')) { function mb_substr($s, $a, $b = null, $e = null) { return $b === null ? substr($s, $a) : substr($s, $a, $b); } }
if (!function_exists('mb_strlen')) { function mb_strlen($s, $e = null) { return strlen($s); } }
if (!function_exists('mb_strtoupper')) { function mb_strtoupper($s, $e = null) { return strtoupper($s); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $e = null) { return strtolower($s); } }
require $o['chrome'];
if ($o['what'] === 'menu') { penumbra_admin_tools_menu(true); }
elseif ($o['what'] === 'bar') { penumbra_admin_statusbar(); }
else { fwrite(STDERR, "unknown --what\n"); exit(2); }
