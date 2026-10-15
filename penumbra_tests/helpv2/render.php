<?php
/**
 * render.php - render the Help Center body or TOC offline, as a given user.
 *
 *   php -n render.php --app=<dir> --what=body|toc [--admin] [--writer] [--gate] [--v2=0|1]
 *
 * The harness/ directory goes first on the include path, so help_content.php's
 * `require_once 'db_connection.php'` lands on the stub there (no Oracle, no
 * Shibboleth). --admin / --writer set the stub's $isAdmin / writer answer, --gate
 * defines PNB_HELP_GATE, --v2 forces the switch (PNB_HELP_V2_FORCE) so the same
 * stage can be rendered both ways. Output = the page, nothing else.
 */
$o = getopt('', array('app:', 'what:', 'admin', 'writer', 'gate', 'v2:'));
if (empty($o['app']) || empty($o['what'])) { fwrite(STDERR, "usage: --app=<dir> --what=body|toc [--admin] [--writer] [--gate] [--v2=0|1]\n"); exit(2); }
$app = rtrim(str_replace('\\', '/', $o['app']), '/');
define('PNB_TEST_IS_ADMIN', isset($o['admin']));
define('PNB_TEST_IS_WRITER', isset($o['writer']) || isset($o['admin']));
if (isset($o['gate'])) define('PNB_HELP_GATE', true);
if (isset($o['v2']))   define('PNB_HELP_V2_FORCE', $o['v2'] === '1');
set_include_path(__DIR__ . '/harness' . PATH_SEPARATOR . get_include_path());
chdir($app);
// index.php has $isAdmin / $userGrants / $currentUserKey in scope long before it renders
// the TOC; the stub provides the same for both render paths here.
require_once 'db_connection.php';
if ($o['what'] === 'toc') {
    require $app . '/help_manifest.php';
    if (!function_exists('penumbra_render_help_toc')) { fwrite(STDERR, "penumbra_render_help_toc() missing\n"); exit(3); }
    penumbra_render_help_toc();
} else {
    require $app . '/help_content.php';
}
