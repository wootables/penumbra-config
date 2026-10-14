<?php
/**
 * NOTICE / MAINTENANCE SCOPE SUITE (2026-10-11).
 *
 * system_notice.php gained an "Applies to" dropdown per half: All Reports (the
 * original site-wide behaviour), By connection(s), By tag(s), By report(s).
 * The rules pinned here, from the SHIPPED files:
 *
 *   A. the original fail-safe rules still hold (missing / corrupt / expired /
 *      zero-until = OFF; admins never blocked) and a pre-scope state file
 *      reads as scope 'all'.
 *   B. penumbra_notice_scope_clean(): unknown type -> all, trims, dedups (tags
 *      case-insensitively), lower-cases connections, caps the list.
 *   C. penumbra_notice_scope_matches(): per type; null context = only 'all';
 *      a scoped half with NO values matches nothing (fails open).
 *   D. the two gates: the early file-only gate fires for 'all' only; the
 *      per-report gate fires for a matching scoped window only; never admins.
 *   E. penumbra_active_notice($ctx): a scoped notice shows on its reports only.
 *   F. save(): explicit scope is stored; a maintenance write that does not
 *      MENTION scope keeps the live window's scope (a watchdog write must never
 *      widen three closed reports into a site-wide lockout).
 *   G. the real watchdog mon_sync_notice() (lifted from penumbra_monitor.php)
 *      round-trips a scoped window unchanged.
 *   H. penumbra_notice_conns_for_tables() over the app's allow-lists.
 *   I. system_notice.php's pnb_notice_posted_scope() reads only the chosen
 *      type's ticks.
 *   J. wiring pins in index.php / query.php / penumbra_admin_chrome.php /
 *      system_notice.php.
 *
 *   php -n -d extension_dir=ext -d extension=php_mbstring.dll test_noticescope.php --app=<dir> [--control] [--mutant=N]
 *     --mutant=1  the early gate ignores scope (any window locks the whole app)
 *     --mutant=2  save() forgets the live scope when none is passed (watchdog widens)
 *     --mutant=3  a scoped half with no values matches everything
 *     --mutant=4  tags compared case-sensitively
 *     --mutant=5  posted scope reads every list, not just the chosen type's
 * No database, no mail; the state file is a temp file.
 */
error_reporting(E_ALL);
set_error_handler(function ($no, $str, $file, $line) { if (!(error_reporting() & $no)) return false; throw new ErrorException($str, 0, $no, $file, $line); });   // @-silenced reads stay silent

$opt = array('app' => '', 'control' => false, 'mutant' => 0);
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--app=') === 0) $opt['app'] = rtrim(substr($a, 6), '/\\');
    elseif ($a === '--control') $opt['control'] = true;
    elseif (strpos($a, '--mutant=') === 0) $opt['mutant'] = (int)substr($a, 9);
}
if ($opt['app'] === '') { fwrite(STDERR, "--app=<dir> is required\n"); exit(2); }
if (!function_exists('mb_substr')) { fwrite(STDERR, "mbstring is not loaded (see run.ps1)\n"); exit(2); }
$APP = $opt['app'];
$M = $opt['mutant'];

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $got = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "  ok   $label\n"; }
    else { $FAIL++; echo "  FAIL $label" . ($got !== null ? ' (got: ' . (is_string($got) ? $got : json_encode($got)) . ')' : '') . "\n"; }
}
function section($s) { echo "\n== $s\n"; }
function patch_once($src, $from, $to, $why) {
    $n = substr_count($src, $from);
    if ($n !== 1) { fwrite(STDERR, "$why: anchor matched $n times\n"); exit(2); }
    return str_replace($from, $to, $src);
}
function lift($src, $names) {
    $t = token_get_all($src); $n = count($t); $out = ''; $found = array();
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($t[$j]) && $t[$j][0] === T_WHITESPACE) $j++;
        if ($j >= $n || !is_array($t[$j]) || $t[$j][0] !== T_STRING) continue;
        if (!in_array($t[$j][1], $names, true) || in_array($t[$j][1], $found, true)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $tok = $t[$k];
            if (is_array($tok)) {
                if ($tok[0] === T_CURLY_OPEN || $tok[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; $started = true; }
                $buf .= $tok[1];
            } else {
                if ($tok === '{') { $depth++; $started = true; } elseif ($tok === '}') { $depth--; }
                $buf .= $tok;
            }
            if ($started && $depth === 0) break;
        }
        $out .= $buf . "\n"; $found[] = $t[$j][1];
    }
    $miss = array_diff($names, $found);
    if ($miss) { fwrite(STDERR, 'lift: not found: ' . implode(', ', $miss) . "\n"); exit(2); }
    return $out;
}

// ------------------------------------------------------------ load the module
$stateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_noticescope_' . getmypid() . '.json';
$config = array('notice_state_file' => $stateFile);
$modSrc = file_get_contents($APP . DIRECTORY_SEPARATOR . 'penumbra_notice.php');
if ($M === 1) $modSrc = patch_once($modSrc, "return !empty(\$st['maintenance']) && \$st['maintenance']['scope']['type'] === 'all';", "return !empty(\$st['maintenance']);", 'mutant1');
if ($M === 2) $modSrc = patch_once($modSrc, "\$mScope = \$cur['maintenance'] ? \$cur['maintenance']['scope'] : null;", "\$mScope = null;", 'mutant2');
if ($M === 3) $modSrc = patch_once($modSrc, "if (!is_array(\$ctx) || empty(\$scope['values'])) return false;", "if (!is_array(\$ctx)) return false; if (empty(\$scope['values'])) return true;", 'mutant3');
if ($M === 4) $modSrc = patch_once($modSrc, "foreach (\$scope['values'] as \$v) { \$want[mb_strtoupper(\$v, 'UTF-8')] = true; }", "foreach (\$scope['values'] as \$v) { \$want[\$v] = true; }", 'mutant4');
$modTmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pnb_noticescope_mod_' . getmypid() . '.php';
file_put_contents($modTmp, $modSrc);
require $modTmp;
register_shutdown_function(function () use ($modTmp, $stateFile) {
    foreach (array($modTmp, $stateFile, penumbra_monitor_ack_file()) as $f) { if (is_file($f)) @unlink($f); }
});

function put_state($notice, $maint) { global $stateFile; file_put_contents($stateFile, json_encode(array('notice' => $notice, 'maintenance' => $maint))); }
function raw_state() { global $stateFile; return json_decode(file_get_contents($stateFile), true); }
$future = time() + 3600;
$S = function ($type, $values) { return array('type' => $type, 'values' => $values); };
$ctxA = array('short_id' => 'awdpi', 'tags' => array('Research', 'OSP'), 'conns' => array('ieprd'));
$ctxB = array('short_id' => 'hrlist', 'tags' => array('HR'), 'conns' => array('hr'));

// ---------------------------------------------------------------------------
section('A. fail-safe rules unchanged; pre-scope file = all');
if (is_file($stateFile)) unlink($stateFile);
ok(penumbra_maintenance_blocks(false) === false, 'missing file: not blocking');
file_put_contents($stateFile, '{corrupt');
ok(penumbra_maintenance_blocks(false) === false, 'corrupt file: not blocking');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => time() - 5));
ok(penumbra_maintenance_blocks(false) === false, 'expired window: not blocking');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => 0));
ok(penumbra_maintenance_blocks(false) === false, 'zero until: not blocking');
put_state(array('message' => 'hello', 'level' => 'info', 'until' => 0), array('enabled' => true, 'message' => 'm', 'until' => $future));
ok(penumbra_maintenance_blocks(false) === true, 'pre-scope window (no scope key): blocks non-admins site-wide, as before');
ok(penumbra_maintenance_blocks(true) === false, 'admins never blocked');
$st = penumbra_notice_state();
ok($st['maintenance']['scope'] === array('type' => 'all', 'values' => array()), 'pre-scope window reads as scope all', $st['maintenance']['scope']);
ok($st['notice']['scope']['type'] === 'all', 'pre-scope notice reads as scope all');
ok(penumbra_active_notice() !== null && penumbra_active_notice($ctxA) !== null, 'pre-scope notice shows everywhere (home and reports)');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => $future, 'scope' => array('type' => 'bogus', 'values' => array('x'))));
ok(penumbra_maintenance_blocks(false) === true, 'an unknown scope type reads as all (the admin asked for a lockout)');

// ---------------------------------------------------------------------------
section('B. scope_clean');
ok(penumbra_notice_scope_clean(null) === $S('all', array()), 'null -> all');
ok(penumbra_notice_scope_clean('conn') === $S('all', array()), 'a string -> all');
ok(penumbra_notice_scope_clean($S('CONN', array(' HR ', 'hr', 'Fin', ''))) === $S('conn', array('hr', 'fin')), 'conn: trimmed, lower-cased, deduped, blanks dropped',
   penumbra_notice_scope_clean($S('CONN', array(' HR ', 'hr', 'Fin', ''))));
ok(penumbra_notice_scope_clean($S('tag', array('Research', 'RESEARCH', 'osp'))) === $S('tag', array('Research', 'osp')), 'tag: case-insensitive dedup keeps the first spelling');
ok(penumbra_notice_scope_clean($S('report', array('abc', 'ABC', array('x'), 5))) === $S('report', array('abc', 'ABC', '5')), 'report: case-sensitive, non-scalars dropped');
$big = penumbra_notice_scope_clean($S('report', range(1, 1000)));
ok(count($big['values']) === PENUMBRA_NOTICE_SCOPE_MAX, 'capped at PENUMBRA_NOTICE_SCOPE_MAX', count($big['values']));
ok(penumbra_notice_scope_clean($S('all', array('x'))) === $S('all', array()), 'all carries no values');

// ---------------------------------------------------------------------------
section('C. scope_matches');
ok(penumbra_notice_scope_matches($S('all', array()), null) === true, 'all matches with no report');
ok(penumbra_notice_scope_matches($S('conn', array('ieprd')), null) === false, 'scoped never matches with no report (home / admin pages)');
ok(penumbra_notice_scope_matches($S('conn', array('ieprd')), $ctxA) === true, 'conn: a report on ieprd');
ok(penumbra_notice_scope_matches($S('conn', array('ieprd')), $ctxB) === false, 'conn: a report on hr is not covered');
ok(penumbra_notice_scope_matches($S('conn', array('HR', 'fin')), $ctxB) === true, 'conn: any of several, case-insensitive');
ok(penumbra_notice_scope_matches($S('tag', array('osp')), $ctxA) === true, 'tag: OSP matches osp');
ok(penumbra_notice_scope_matches($S('tag', array('Finance')), $ctxA) === false, 'tag: an untagged-with report is not covered');
ok(penumbra_notice_scope_matches($S('report', array('awdpi')), $ctxA) === true, 'report: by short id');
ok(penumbra_notice_scope_matches($S('report', array('awdpi')), $ctxB) === false, 'report: another id is not covered');
ok(penumbra_notice_scope_matches($S('report', array('AWDPI')), $ctxA) === false, 'report: short ids are exact');
ok(penumbra_notice_scope_matches($S('tag', array()), $ctxA) === false, 'a scoped half with NO values matches nothing (fails open)');
ok(penumbra_notice_scope_matches($S('conn', array('ieprd')), array('short_id' => 'x')) === false, 'a context missing the field matches nothing');

// ---------------------------------------------------------------------------
section('D. the two gates');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => $future, 'scope' => $S('conn', array('hr'))));
ok(penumbra_maintenance_blocks(false) === false, 'scoped window: the early gate lets everyone in');
ok(penumbra_maintenance_blocks_report(false, $ctxB) === true, 'scoped window: an hr report is refused');
ok(penumbra_maintenance_blocks_report(false, $ctxA) === false, 'scoped window: an ieprd report opens');
ok(penumbra_maintenance_blocks_report(true, $ctxB) === false, 'scoped window: admins are never refused');
ok(penumbra_maintenance_blocks_report(false, array('conns' => array('hr'))) === true, 'connection-only context (query.php ad-hoc check) is refused');
ok(penumbra_maintenance_scope_type() === 'conn', 'scope_type reports the live window');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => $future, 'scope' => $S('all', array())));
ok(penumbra_maintenance_blocks_report(false, $ctxB) === false, 'site-wide window: the per-report gate defers to the early gate (no double refusal)');
ok(penumbra_maintenance_blocks(false) === true, 'site-wide window: the early gate refuses');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => time() - 1, 'scope' => $S('conn', array('hr'))));
ok(penumbra_maintenance_blocks_report(false, $ctxB) === false, 'an EXPIRED scoped window refuses nothing');
ok(penumbra_maintenance_scope_type() === '', 'scope_type is empty when off');
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => $future, 'scope' => $S('tag', array())));
ok(penumbra_maintenance_blocks_report(false, $ctxA) === false && penumbra_maintenance_blocks(false) === false, 'a scoped window with no values blocks NOTHING anywhere');

// ---------------------------------------------------------------------------
put_state(null, array('enabled' => true, 'message' => '', 'until' => $future, 'scope' => $S('report', array('x'))));
ok(penumbra_active_maintenance()['message'] === 'This report is temporarily unavailable for scheduled maintenance.', 'scoped window, no message: the default names the report, not the app', penumbra_active_maintenance()['message']);
put_state(null, array('enabled' => true, 'message' => '', 'until' => $future));
ok(penumbra_active_maintenance()['message'] === 'Penumbra is temporarily unavailable for scheduled maintenance.', 'site-wide window, no message: the app default unchanged');

// ---------------------------------------------------------------------------
section('E. active_notice per report');
put_state(array('message' => 'osp only', 'level' => 'warn', 'until' => 0, 'scope' => $S('tag', array('OSP'))), null);
ok(penumbra_active_notice() === null, 'scoped notice: not on the home screen / admin pages');
ok(penumbra_active_notice($ctxA) !== null, 'scoped notice: on a report carrying the tag');
ok(penumbra_active_notice($ctxB) === null, 'scoped notice: not on another report');
$n1 = penumbra_active_notice($ctxA);
put_state(array('message' => 'osp only', 'level' => 'warn', 'until' => 0, 'scope' => $S('tag', array('OSP', 'HR'))), null);
ok(penumbra_active_notice($ctxA)['id'] === $n1['id'], 'widening the scope keeps the dismissal id (same text)');

// ---------------------------------------------------------------------------
section('F. save()');
if (is_file($stateFile)) unlink($stateFile);
ok(penumbra_notice_save(array('notice' => array('message' => 'n', 'level' => 'info', 'until' => 0, 'set_by' => 'a', 'scope' => $S('report', array('awdpi'))),
                              'maintenance' => array('enabled' => true, 'message' => 'm', 'until' => $future, 'set_by' => 'a', 'scope' => $S('conn', array('HR'))))), 'save with scopes');
$r = raw_state();
ok($r['notice']['scope'] === $S('report', array('awdpi')), 'notice scope stored', $r['notice']['scope']);
ok($r['maintenance']['scope'] === $S('conn', array('hr')), 'maintenance scope stored (cleaned)', $r['maintenance']['scope']);
// a write that does not mention scope (the watchdog shape) keeps it
penumbra_notice_save(array('notice' => null, 'maintenance' => array('enabled' => true, 'message' => 'm', 'until' => $future, 'set_by' => 'a')));
$r = raw_state();
ok($r['maintenance']['scope'] === $S('conn', array('hr')), 'maintenance write WITHOUT a scope key keeps the live scope', $r['maintenance']['scope']);
ok(penumbra_maintenance_blocks(false) === false, '... so it does NOT become a site-wide lockout');
// explicit all widens on purpose
penumbra_notice_save(array('maintenance' => array('enabled' => true, 'message' => 'm', 'until' => $future, 'set_by' => 'a', 'scope' => $S('all', array()))));
ok(penumbra_maintenance_blocks(false) === true, 'an explicit scope all is honoured');
// no live window + no scope key = all (a fresh pre-scope caller)
put_state(null, null);
penumbra_notice_save(array('maintenance' => array('enabled' => true, 'message' => 'm', 'until' => $future, 'set_by' => 'a')));
ok(raw_state()['maintenance']['scope']['type'] === 'all', 'no live window and no scope key: all (the old behaviour)');
// notice without a scope key = all (the watchdog's own banner)
put_state(array('message' => 'x', 'level' => 'info', 'until' => 0, 'scope' => $S('tag', array('OSP'))), null);
penumbra_notice_save(array('notice' => array('message' => 'watchdog', 'level' => 'warn', 'until' => 0, 'set_by' => 'monitor')));
ok(raw_state()['notice']['scope']['type'] === 'all', 'a notice written without a scope key is site-wide');
penumbra_notice_save(array('notice' => null, 'maintenance' => null));
ok(raw_state() === array('notice' => null, 'maintenance' => null), 'clearing both leaves the empty shape');

// ---------------------------------------------------------------------------
section('G. the real watchdog keeps a scoped window scoped');
$MONITOR = 'D:\\Utilities\\PHP_8.2-p\\penumbra_monitor.php';
if (!is_file($MONITOR)) { $MONITOR = '\\\\oitras\\d$\\Utilities\\PHP_8.2-p\\penumbra_monitor.php'; }
eval(lift(file_get_contents($MONITOR), array('mon_sync_notice')));
penumbra_monitor_ack_clear();
put_state(null, array('enabled' => true, 'message' => 'm', 'until' => $future, 'set_by' => 'bplimon', 'scope' => $S('report', array('hrlist'))));
mon_sync_notice(true, array('database hr down'));
$r = raw_state();
ok($r['notice'] !== null && $r['notice']['set_by'] === 'monitor', 'watchdog posted its banner');
ok($r['maintenance']['scope'] === $S('report', array('hrlist')), 'the scoped window kept its scope through the watchdog write', $r['maintenance']['scope']);
ok(penumbra_maintenance_blocks(false) === false, 'and the app is still open (no widening)');
mon_sync_notice(false, array());
ok(raw_state()['maintenance']['scope'] === $S('report', array('hrlist')), 'the recovery write keeps it too');
penumbra_monitor_ack_clear();

// ---------------------------------------------------------------------------
section('H. connections for a report\'s tables');
$oracleTableNames = array('AWARDS', 'DUAL'); $pinsTableNames = array('PINS_X'); $infoEdTableNames = array('IE_Y');
$hrTableNames = array('PS_JOB', 'SHARED_T'); $finTableNames = array('SHARED_T');
ok(penumbra_notice_conns_for_tables(array('awards', ' ps_job ')) === array('ieprd', 'hr'), 'maps each table to its connection', penumbra_notice_conns_for_tables(array('awards', ' ps_job ')));
ok(penumbra_notice_conns_for_tables(array('SHARED_T')) === array('hr', 'fin'), 'a table on two lists names both');
ok(penumbra_notice_conns_for_tables(array('NOPE')) === array(), 'an unknown table names none');
ok(penumbra_notice_conns_for_tables('AWARDS') === array(), 'a non-array names none');

// ---------------------------------------------------------------------------
section('I. system_notice.php reads only the chosen list');
$sn = file_get_contents($APP . DIRECTORY_SEPARATOR . 'system_notice.php');
$fn = lift($sn, array('pnb_notice_posted_scope'));
if ($M === 5) $fn = patch_once($fn, "\$vals = (isset(\$_POST[\$key]) && is_array(\$_POST[\$key])) ? \$_POST[\$key] : array();",
    "\$vals = array(); foreach (array('conn','tag','report') as \$tt) { if (isset(\$_POST[\$prefix . '_scope_' . \$tt])) \$vals = array_merge(\$vals, \$_POST[\$prefix . '_scope_' . \$tt]); }", 'mutant5');
eval($fn);
$_POST = array('maint_scope' => 'tag', 'maint_scope_tag' => array('OSP'), 'maint_scope_conn' => array('hr'), 'maint_scope_report' => array('x'));
ok(pnb_notice_posted_scope('maint') === $S('tag', array('OSP')), 'ticks left in hidden lists do not leak', pnb_notice_posted_scope('maint'));
$_POST = array('maint_scope' => 'all', 'maint_scope_tag' => array('OSP'));
ok(pnb_notice_posted_scope('maint') === $S('all', array()), 'All Reports ignores every list');
$_POST = array('notice_scope' => 'evil');
ok(pnb_notice_posted_scope('notice') === $S('all', array()), 'an unknown posted type -> all');
$_POST = array('notice_scope' => 'conn');
ok(pnb_notice_posted_scope('notice') === $S('conn', array()), 'a scoped type with nothing ticked comes back empty (the screen refuses it)');
$_POST = array();
ok(strpos($sn, "\$mScope['type'] !== 'all' && !\$mScope['values']") !== false && strpos($sn, "\$nScope['type'] !== 'all' && !\$nScope['values']") !== false,
   'both saves refuse a scoped type with no picks');
ok(substr_count($sn, "'scope'   => \$state['notice']['scope']") === 1 && substr_count($sn, "'scope'   => \$state['maintenance']['scope']") === 1,
   'acting on one half re-saves the other WITH its scope');
ok(substr_count($sn, "pnb_scope_picker('notice'") === 1 && substr_count($sn, "pnb_scope_picker('maint'") === 1, 'a separate dropdown on each card');
ok(strpos($sn, "label.nm-pick-item[hidden] { display: none; }") !== false, 'the filter really hides rows (display:flex would beat [hidden])');
foreach (array('All Reports', 'By connection(s)', 'By tag(s)', 'By report(s)') as $lbl) {
    ok(strpos($sn, "'" . $lbl . "'") !== false, "dropdown offers \"$lbl\"");
}

// ---------------------------------------------------------------------------
section('J. wiring');
$ix = file_get_contents($APP . DIRECTORY_SEPARATOR . 'index.php');
$pRead = strpos($ix, "\$preloaded_state_json = readClobViaOci8('PENUMBRA_REPORTS', 'STATE_DATA', 'TRIM(SHORT_ID)', \$report_id_lookup);");
$pGate = strpos($ix, 'if (penumbra_maintenance_blocks_report($isAdmin, $pnbScopeCtx)) {');
$pAuth = strpos($ix, 'if ($canEditLoadedReport || $pnbViewByRole || checkAuthorization($authorized_list, $currentUserKey, $user_ouc)) {');
ok($pRead !== false && $pGate !== false && $pAuth !== false && $pAuth < $pRead && $pRead < $pGate, 'index.php: the scoped gate runs inside the authorized branch, after the state read');
ok(substr_count($ix, 'pnb_index_maintenance_exit(true);') === 1 && substr_count($ix, 'pnb_index_maintenance_exit(false);') === 1, 'index.php: one page, scoped and site-wide callers');
ok(strpos($ix, "if (penumbra_maintenance_blocks(\$isAdmin)) {\n    pnb_index_maintenance_exit(false);") !== false, 'index.php: the early gate still runs before any report lookup');
ok(strpos($ix, '$pnbNotice = penumbra_active_notice($pnbScopeCtx);') !== false, 'index.php: the banner reads the loaded report\'s context');
ok(strpos($ix, "'tags'     => \$preloaded_report_tags,") !== false && strpos($ix, 'penumbra_notice_conns_for_tables(penumbraExtractReportTables($preloaded_state_json))') !== false, 'index.php: context = tags + connections of the report tables');
$q = file_get_contents($APP . DIRECTORY_SEPARATOR . 'query.php');
$qRep = strpos($q, "'conns'    => penumbra_notice_conns_for_tables(\$reportTables)))) {");
$qScope = strpos($q, 'penumbraApplySqlScope($userGrants, $reportTables);');
ok($qRep !== false && $qScope !== false && $qRep < $qScope, 'query.php: the report check runs BEFORE the table lists are narrowed');
ok(strpos($q, "if (!\$isAdmin && penumbra_maintenance_scope_type() === 'conn') {") !== false && substr_count($q, 'pnb_query_scoped_maintenance_exit();') === 2, 'query.php: a second check on the resolved connection');
ok(strpos($q, "'error_code' => 'maintenance',") !== false && substr_count($q, "'error_code' => 'maintenance'") === 2, 'query.php: the scoped refusal has the same error_code main.js already handles');
$qEarly = strpos($q, "if (penumbra_maintenance_blocks(\$isAdmin)) {");
$qConn = strpos($q, "if (!\$isAdmin && penumbra_maintenance_scope_type() === 'conn') {");
$qExec = strpos($q, '// --- END: NEW LAZY LOADING LOGIC ---');
ok($qEarly !== false && $qConn < $qExec, 'query.php: the connection check sits before execution');
$ch = file_get_contents($APP . DIRECTORY_SEPARATOR . 'penumbra_admin_chrome.php');
ok(strpos($ch, "penumbra_notice_scope_label(\$maint['scope'])") !== false, 'admin pages: the maintenance bar names the scope');

if ($opt['control']) { section('control'); ok(false, 'control: a deliberately false assertion (must FAIL)'); }

echo "\nSUMMARY  pass=$PASS  fail=$FAIL\n";
exit($FAIL ? 1 : 0);
