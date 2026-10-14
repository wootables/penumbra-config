<?php
/**
 * penumbra_tests/railvh - home "For you" rail: an updated row's "history" link.
 *
 * Guards the 2026-10-14 change, commit 07b4ab8 (the build before it = a00dcd7 = 07b4ab8^):
 *   index.php  - the recents query carries OWNER_ID; each "changed since you
 *                last looked" row gets an 'edit' flag (admin / owner / report-or-
 *                tag grant, never under &noadm); the rail renders the "history"
 *                link for flagged rows only, with data-vh-report-id / -title and
 *                no new-tab arrow, and raises $pnl_vh_rail so the Version History
 *                dialog markup ships on the home screen too
 *                ($canEditLoadedReport || $pnl_vh_rail).
 *   landing.js - a plain click on that link opens the dialog in place through
 *                window.Penumbra.openVersionHistory(null, sid, title); a
 *                modifier or middle click, a missing dialog, a missing bridge or
 *                a missing id fall through to the href (?id=&vh=1, new tab).
 *
 *   php.exe -n test_railvh.php [--app=<dir>] [--control] [--no-old] [--no-edge]
 *
 * PHP side: the 4b loop and the rail block are string-lifted from index.php and
 * eval'd with fixtures; penumbraIsReportOwner / penumbraWildcardMatch /
 * penumbraReportGrantMatches are the REAL functions, lifted from
 * db_connection.php by tokenizer (it cannot be require'd; a stage dir without it
 * falls back to the live copy); penumbraReportTagsOf is a fixture stub.
 * JS side: headless Edge --dump-dom on a file:// harness under C:\Temp (short
 * path) that loads landing.js, builds the rail markup, dispatches synthetic
 * clicks and records defaultPrevented + the bridge call. A capture control
 * (CTRL_OK page) proves the dump reaches PHP before anything is judged.
 *
 * ALWAYS RUN: the OLD build (git a00dcd7, via _oldver) must FAIL the new checks
 * (--no-old skips it), and TARGETED MUTANTS of the file under test must each be
 * caught (every anchor must hit exactly once). --control adds one deliberately
 * false assertion (must FAIL).
 *
 * EXPECTED TAIL: "PASS 91   FAIL 0" after "(8 headless Edge runs)" (fewer passes is a failure too;
 * about 40 s, nearly all of it Edge start-ups).
 */
$CONTROL = in_array('--control', $argv, true);
$NO_OLD  = in_array('--no-old', $argv, true);
$NO_EDGE = in_array('--no-edge', $argv, true);
$LIVE = '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra';
$APP = $LIVE;
foreach ($argv as $a) { if (strpos($a, '--app=') === 0) $APP = substr($a, 6); }
$OLD_REV = 'a00dcd7';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
require_once __DIR__ . '\\..\\_oldver\\oldver.php';

$pass = 0; $fail = 0; $failed = array();
function ok($cond, $label) {
    global $pass, $fail, $failed;
    if ($cond) { $pass++; } else { $fail++; $failed[] = $label; echo "    FAIL  $label\n"; }
}
/** A file under --app, else the live copy (a stage dir holds only the edited files). */
function pick($rel) {
    global $APP, $LIVE;
    foreach (array($APP, $LIVE) as $base) {
        $p = rtrim($base, '/\\') . '/' . $rel;
        if (is_file($p)) return $p;
    }
    fwrite(STDERR, "FATAL: cannot find $rel under $APP or $LIVE\n"); exit(2);
}
function slurp($p) {
    $s = @file_get_contents($p);
    if ($s === false) { fwrite(STDERR, "FATAL: cannot read $p\n"); exit(2); }
    return $s;
}

/** Lift one NAMED function's source (from `function` to its matching `}`). */
function lift_function($src, $name) {
    $tokens = token_get_all($src);
    $n = count($tokens);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
        if (!($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING && $tokens[$j][1] === $name)) continue;
        $depth = 0; $started = false; $buf = '';
        for ($k = $i; $k < $n; $k++) {
            $t = $tokens[$k]; $txt = is_array($t) ? $t[1] : $t;
            $buf .= $txt;
            if ($txt === '{' || (is_array($t) && $t[0] === T_CURLY_OPEN)) { $depth++; $started = true; }
            elseif ($txt === '}') { $depth--; if ($started && $depth === 0) return $buf; }
        }
    }
    return null;
}

// ---- the REAL access helpers, lifted from db_connection.php ----------------
$DB = slurp(pick('db_connection.php'));
foreach (array('penumbraIsReportOwner', 'penumbraWildcardMatch', 'penumbraReportGrantMatches') as $fn) {
    $buf = lift_function($DB, $fn);
    if ($buf === null) { fwrite(STDERR, "FATAL: could not lift $fn()\n"); exit(2); }
    eval($buf);
}
$TEST_TAGS = array();
/** Fixture stand-in for the tag map (penumbraReportGrantMatches's tag side). */
function penumbraReportTagsOf($shortId) {
    global $TEST_TAGS;
    $sid = trim((string)$shortId);
    return isset($TEST_TAGS[$sid]) ? $TEST_TAGS[$sid] : array();
}
ok(penumbraIsReportOwner('JDOE', 'jdoe ') === true && penumbraIsReportOwner('', '') === false, 'real penumbraIsReportOwner lifted (case-folds, empty key owns nothing)');
ok(penumbraReportGrantMatches(array('reports' => array(array('pattern' => 'ALPHA*'))), 'ALPHA5') === true, 'real penumbraReportGrantMatches lifted (wildcard)');

// ---- string lifts from index.php -------------------------------------------
function lift_loop($idx) {
    $a = strpos($idx, '            // 4b. Reports that changed since this user last opened them');
    if ($a === false) return null;
    $b = strpos($idx, '            // 5. Platform pulse KPIs', $a);
    if ($b === false) return null;
    return substr($idx, $a, $b - $a);
}
function lift_rail($idx) {
    $start = "            <?php if (!empty(\$pnl_updated_rows)): ?>\n            <div class=\"pnl-rail-blk\" id=\"pnlRailUpdated\">";
    $a = strpos($idx, $start);
    if ($a === false) return null;
    $m = strpos($idx, "'more changed'); ?>", $a);
    if ($m === false) return null;
    $e = strpos($idx, '<?php endif; ?>', $m);
    if ($e === false) return null;
    return substr($idx, $a, $e + strlen('<?php endif; ?>') - $a);
}
function run_loop($code, $recent_reports, $isAdmin, $pnbEditorRolesOn, $currentUserKey, $userGrants) {
    $pnl_updated_rows = array();
    eval($code);
    return $pnl_updated_rows;
}
function render_rail($tpl, $pnl_updated_rows) {
    $pnl_vh_rail = false;
    $moreCalls = array();
    $pnlRailMore = function ($extra, $label) use (&$moreCalls) { $moreCalls[] = array($extra, $label); };
    ob_start();
    eval('?>' . $tpl . '<?php ');
    $html = ob_get_clean();
    return array($html, $pnl_vh_rail, $moreCalls);
}
/** The rail's rows, one HTML chunk each (split on the row wrapper). */
function rail_rows($html) {
    $parts = explode('<div class="pnl-mini-wrap"', $html);
    array_shift($parts);
    return $parts;
}
function edit_map($rows) {
    $m = array();
    foreach ($rows as $r) $m[trim($r['sid'])] = isset($r['edit']) ? $r['edit'] : null;
    return $m;
}

/** Every PHP-side check as [label, bool]; run against a new build, the old one, and mutants. */
function php_checks($idx) {
    global $TEST_TAGS;
    $c = array();
    $loop = lift_loop($idx);
    $rail = lift_rail($idx);
    $c[] = array('lift: 4b loop found', $loop !== null);
    $c[] = array('lift: updated-rows rail block found', $rail !== null);
    if ($loop === null || $rail === null) return $c;

    // --- the 4b loop: who gets 'edit' ---
    $rows = array(
        array('SHORT_ID' => 'ALPHA1',   'TITLE' => '<b>Alpha</b> one', 'LAST_OPENED' => '2026-10-01 10:00:00', 'LAST_UPDATED' => '2026-10-02 10:00:00', 'IS_NEW' => '0', 'OWNER_ID' => 'jdoe'),
        array('SHORT_ID' => 'BETA2',    'TITLE' => 'Beta',             'LAST_OPENED' => '2026-10-01 10:00:00', 'LAST_UPDATED' => '2026-10-03 10:00:00', 'IS_NEW' => '0', 'OWNER_ID' => 'MSMITH   '),
        array('SHORT_ID' => 'GAMMA3',   'TITLE' => 'Gamma',            'LAST_OPENED' => '2026-10-01 10:00:00', 'LAST_UPDATED' => '2026-10-04 10:00:00', 'IS_NEW' => '0', 'OWNER_ID' => null),
        array('SHORT_ID' => 'OLD4',     'TITLE' => 'Old',              'LAST_OPENED' => '2026-10-05 10:00:00', 'LAST_UPDATED' => '2026-10-02 10:00:00', 'IS_NEW' => '0', 'OWNER_ID' => 'jdoe'),
        array('SHORT_ID' => 'ALPHA5',   'TITLE' => 'Alpha five',       'LAST_OPENED' => '2026-10-01 10:00:00', 'LAST_UPDATED' => '2026-10-06 10:00:00', 'IS_NEW' => '1', 'OWNER_ID' => 'someone'),
        array('SHORT_ID' => 'TAGGED6',  'TITLE' => 'Tagged',           'LAST_OPENED' => '2026-10-01 10:00:00', 'LAST_UPDATED' => '2026-10-07 10:00:00', 'IS_NEW' => '0', 'OWNER_ID' => 'x'),
        array('SHORT_ID' => 'NOUPD7',   'TITLE' => 'Never updated',    'LAST_OPENED' => '2026-10-01 10:00:00', 'LAST_UPDATED' => null,                  'IS_NEW' => '0', 'OWNER_ID' => 'jdoe'),
    );
    $TEST_TAGS = array('TAGGED6' => array('finance'));
    $noGrants = array('reports' => array(), 'tags' => array());
    $alphaGrant = array('reports' => array(array('pattern' => 'ALPHA*')), 'tags' => array());
    $tagGrant = array('reports' => array(), 'tags' => array(array('tag' => 'finance')));

    $viewer = run_loop($loop, $rows, false, true, 'viewer1', $noGrants);
    $c[] = array('loop: 5 updated rows (OLD4 / NOUPD7 excluded) - unchanged rule', count($viewer) === 5 && !isset(edit_map($viewer)['OLD4']) && !isset(edit_map($viewer)['NOUPD7']));
    $c[] = array('loop: sid/title/ts preserved (title stripped of tags)', isset($viewer[0]['sid']) && $viewer[0]['sid'] === 'ALPHA1' && $viewer[0]['title'] === 'Alpha one' && $viewer[0]['ts'] === strtotime('2026-10-02 10:00:00') * 1000);
    $c[] = array('loop: every row carries an edit flag', count(array_filter($viewer, function ($r) { return isset($r['edit']) && is_bool($r['edit']); })) === 5);
    $c[] = array('loop: plain viewer - edit false on every row', count(array_filter(edit_map($viewer))) === 0);

    $owner = edit_map(run_loop($loop, $rows, false, true, 'JDOE', $noGrants));
    $c[] = array('loop: owner (key JDOE vs OWNER_ID jdoe) - only own row', !empty($owner['ALPHA1']) && empty($owner['BETA2']) && empty($owner['GAMMA3']) && empty($owner['ALPHA5']) && empty($owner['TAGGED6']));
    $owner2 = edit_map(run_loop($loop, $rows, false, true, 'msmith', $noGrants));
    $c[] = array('loop: owner (padded upper-case OWNER_ID) - only own row', !empty($owner2['BETA2']) && empty($owner2['ALPHA1']) && empty($owner2['GAMMA3']));
    $grant = edit_map(run_loop($loop, $rows, false, true, 'g1', $alphaGrant));
    $c[] = array('loop: report grant ALPHA* - both ALPHA rows, nothing else', !empty($grant['ALPHA1']) && !empty($grant['ALPHA5']) && empty($grant['BETA2']) && empty($grant['GAMMA3']) && empty($grant['TAGGED6']));
    $tag = edit_map(run_loop($loop, $rows, false, true, 'g2', $tagGrant));
    $c[] = array('loop: tag grant finance - the tagged row only', !empty($tag['TAGGED6']) && empty($tag['ALPHA1']) && empty($tag['ALPHA5']));
    $admin = edit_map(run_loop($loop, $rows, true, true, 'adm', $noGrants));
    $c[] = array('loop: admin - every row', count(array_filter($admin)) === 5);
    $noadm = edit_map(run_loop($loop, $rows, false, false, 'jdoe', $alphaGrant));
    $c[] = array('loop: &noadm (roles off, admin cleared) - nothing, not even the owner', count(array_filter($noadm)) === 0);
    $emptyKey = edit_map(run_loop($loop, $rows, false, true, '', $noGrants));
    $c[] = array('loop: empty user key owns nothing (NULL OWNER_ID row included)', count(array_filter($emptyKey)) === 0);
    $noOwnerCol = $rows; foreach ($noOwnerCol as &$r) { unset($r['OWNER_ID']); } unset($r);
    $legacy = edit_map(run_loop($loop, $noOwnerCol, false, true, 'jdoe', $noGrants));
    $c[] = array('loop: a row without OWNER_ID (older query) is a viewer row, no notice', count(array_filter($legacy)) === 0);

    // --- the rail block: who gets the link, and its shape ---
    $fx = array(
        array('sid' => 'ALPHA1', 'title' => 'Alpha & "Beta" <i>', 'ts' => 1759400000000, 'edit' => true),
        array('sid' => 'BETA2',  'title' => 'Beta',               'ts' => 1759400000000, 'edit' => false),
        array('sid' => 'GAMMA3  ', 'title' => 'Gamma',            'ts' => 1759400000000, 'edit' => true),
        array('sid' => 'DELTA4', 'title' => 'Delta',              'ts' => 1759400000000, 'edit' => false),
        array('sid' => 'EPS5',   'title' => 'Epsilon',            'ts' => 1759400000000, 'edit' => false),
        array('sid' => 'ZETA6',  'title' => 'Zeta',               'ts' => 1759400000000, 'edit' => true),
    );
    list($html, $flag, $more) = render_rail($rail, $fx);
    $rowsHtml = rail_rows($html);
    $c[] = array('rail: six rows rendered', count($rowsHtml) === 6);
    $c[] = array('rail: exactly the three editor rows carry the history link', substr_count($html, 'class="pnl-mini-vh"') === 3);
    $r1 = isset($rowsHtml[0]) ? $rowsHtml[0] : '';
    $c[] = array('rail: editor row - href keeps the ?id=&vh=1 deep link in a new tab', strpos($r1, '<a class="pnl-mini-vh" href="?id=ALPHA1&amp;vh=1" target="_blank" rel="noopener"') !== false);
    $c[] = array('rail: editor row - data-vh-report-id', strpos($r1, ' data-vh-report-id="ALPHA1"') !== false);
    $c[] = array('rail: editor row - data-vh-report-title escaped', strpos($r1, ' data-vh-report-title="Alpha &amp; &quot;Beta&quot; &lt;i&gt;"') !== false);
    $c[] = array('rail: editor row - aria-label escaped', strpos($r1, 'aria-label="Version history: Alpha &amp; &quot;Beta&quot; &lt;i&gt;"') !== false);
    $c[] = array('rail: editor row - tooltip says what the dialog shows', strpos($r1, 'title="Every saved version of this report, what each save changed, and one-click restore"') !== false);
    $c[] = array('rail: editor row - link text is plain "history" (no new-tab arrow)', preg_match('/<a class="pnl-mini-vh"[^>]*>history<\/a>/', $r1) === 1 && strpos($html, '&#8599;') === false);
    $c[] = array('rail: editor row - the raw title never lands unescaped', strpos($html, '"Beta" <i>') === false);
    $r2 = isset($rowsHtml[1]) ? $rowsHtml[1] : '';
    $c[] = array('rail: viewer row - no history link', strpos($r2, 'pnl-mini-vh') === false);
    $c[] = array('rail: viewer row - still the report link and the time', strpos($r2, '<a class="pnl-mini" href="?id=BETA2">') !== false && strpos($r2, 'class="pnl-mini-w pnl-row-time"') !== false);
    $r3 = isset($rowsHtml[2]) ? $rowsHtml[2] : '';
    $c[] = array('rail: a space-padded sid is trimmed in data-vh-report-id', strpos($r3, ' data-vh-report-id="GAMMA3"') !== false);
    $c[] = array('rail: editor rows keep the time after the link', isset($rowsHtml[5]) && strpos($rowsHtml[5], 'class="pnl-mini-w pnl-row-time"') > strpos($rowsHtml[5], 'class="pnl-mini-vh"'));
    $c[] = array('rail: rows past the cap still ship hidden (data-rail-extra)', isset($rowsHtml[4], $rowsHtml[3]) && strpos($rowsHtml[4], ' data-rail-extra hidden') === 0 && strpos($rowsHtml[3], ' data-rail-extra hidden') !== 0);
    $c[] = array('rail: "N more" expander asked for 2 more changed', count($more) === 1 && $more[0][0] === 2 && $more[0][1] === 'more changed');
    $c[] = array('rail: $pnl_vh_rail raised when a link rendered', $flag === true);

    list($html2, $flag2) = render_rail($rail, array_slice($fx, 1, 1) + array(5 => $fx[3]));
    $c[] = array('rail: all-viewer list - zero history links', strpos($html2, 'pnl-mini-vh') === false && count(rail_rows($html2)) === 2);
    $c[] = array('rail: all-viewer list - $pnl_vh_rail stays false', $flag2 === false);
    $legacyFx = array(array('sid' => 'X1', 'title' => 'X', 'ts' => 1759400000000));
    list($html3, $flag3) = render_rail($rail, $legacyFx);
    $c[] = array('rail: a row without an edit key gets no link (defensive !empty)', strpos($html3, 'pnl-mini-vh') === false && $flag3 === false);
    $c[] = array('rail: the owner id is never written into the page', stripos($rail, 'OWNER_ID') === false);

    // --- wiring: the dialog gate, the flag init, the query column ---
    $c[] = array('gate: the dialog markup ships for the loaded report\'s editors OR a rail link',
        strpos($idx, "<?php if (\$canEditLoadedReport || \$pnl_vh_rail): ?>\n<div id=\"versionHistoryLightbox\"") !== false);
    $pInit = strpos($idx, "\$pnl_vh_rail = false;");
    $pFetch = strpos($idx, '// --- LANDING PAGE DATA FETCH ---');
    $pBlock = strpos($idx, "if (!isset(\$_GET['id']) && !isset(\$_GET['state']) && !\$isRepoMode && !empty(\$currentUserKey)) {");
    $c[] = array('init: $pnl_vh_rail = false sits unconditionally before the landing block', $pInit !== false && $pFetch !== false && $pBlock !== false && $pInit > $pFetch && $pInit < $pBlock);
    $sqlA = strpos($idx, '$audit_sql = "');
    $sqlB = $sqlA !== false ? strpos($idx, 'FETCH FIRST 30 ROWS ONLY', $sqlA) : false;
    $sql = ($sqlA !== false && $sqlB !== false) ? substr($idx, $sqlA, $sqlB - $sqlA) : '';
    $alias = preg_match('/MAX\(r\.OWNER_ID\) as (\w+)/', $sql, $mm) ? $mm[1] : '';
    $key = preg_match('/\$pnlUr\[\'(OWNER_\w+)\'\]/', $loop, $mk) ? $mk[1] : '';
    $c[] = array('query: the recents SELECT carries MAX(r.OWNER_ID) as OWNER_ID', $alias === 'OWNER_ID');
    $c[] = array('query: the loop reads the same key the SELECT aliases', $key !== '' && $key === $alias);
    $c[] = array('query: GROUP BY untouched (the owner comes as an aggregate)', strpos($sql, 'GROUP BY r.SHORT_ID, r.TITLE') !== false);
    $c[] = array('copy: the old "history (arrow)" link text is gone', strpos($idx, 'history &#8599;') === false);
    return $c;
}

// ---- JS side: headless Edge harness ----------------------------------------
function harness_html() {
    return <<<'HTML'
<!doctype html><html><head><meta charset="utf-8"><title>railvh</title>
<script>window.__errs = []; window.onerror = function (m) { window.__errs.push(String(m)); };</script>
</head><body>
<pre id="out">RUNNING</pre>
<div id="rail"></div>
<script src="landing.js"></script>
<script>
(function () {
    var results = [];
    var calls = [];
    function setBridge(on) {
        if (on) { window.Penumbra = { openVersionHistory: function () { calls.push(Array.prototype.slice.call(arguments)); } }; }
        else { try { delete window.Penumbra; } catch (e) { window.Penumbra = undefined; } }
    }
    function setDialog(on) {
        var d = document.getElementById('versionHistoryLightbox');
        if (on && !d) { d = document.createElement('div'); d.id = 'versionHistoryLightbox'; document.body.appendChild(d); }
        if (!on && d) { d.parentNode.removeChild(d); }
    }
    function build(opts) {
        opts = opts || {};
        document.getElementById('rail').innerHTML =
            '<div class="pnl-mini-wrap"><a class="pnl-mini" href="#other">x</a>' +
            '<a class="pnl-mini-vh" href="#vh" target="_blank" rel="noopener"' +
            (opts.noId ? '' : ' data-vh-report-id="ABC1"') +
            (opts.noTitle ? '' : ' data-vh-report-title="Alpha Report"') + '>' +
            (opts.child ? '<span id="inner">history</span>' : 'history') + '</a></div>';
    }
    // Registered AFTER landing.js's listeners: records what they decided, then
    // blocks the navigation itself so the harness never leaves the page.
    var lastPrevented = null;
    document.addEventListener('click', function (e) { lastPrevented = e.defaultPrevented; e.preventDefault(); });
    function fire(sel, init) {
        calls = []; lastPrevented = null;
        var el = document.querySelector(sel);
        var ev = new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true, view: window, button: 0 }, init || {}));
        el.dispatchEvent(ev);
        return { prevented: lastPrevented, calls: calls.slice() };
    }
    function rec(name, r) { results.push({ name: name, prevented: r.prevented, calls: r.calls }); }
    setBridge(true); setDialog(true);
    build(); rec('plain', fire('a.pnl-mini-vh'));
    build(); rec('ctrl', fire('a.pnl-mini-vh', { ctrlKey: true }));
    build(); rec('meta', fire('a.pnl-mini-vh', { metaKey: true }));
    build(); rec('shift', fire('a.pnl-mini-vh', { shiftKey: true }));
    build(); rec('alt', fire('a.pnl-mini-vh', { altKey: true }));
    build(); rec('middle', fire('a.pnl-mini-vh', { button: 1 }));
    build({ child: true }); rec('child', fire('#inner'));
    build({ noTitle: true }); rec('notitle', fire('a.pnl-mini-vh'));
    build({ noId: true }); rec('noid', fire('a.pnl-mini-vh'));
    build(); rec('otherlink', fire('a.pnl-mini'));
    setDialog(false); build(); rec('nodialog', fire('a.pnl-mini-vh')); setDialog(true);
    setBridge(false); build(); rec('nobridge', fire('a.pnl-mini-vh')); setBridge(true);
    window.Penumbra = { openVersionHistory: 'not a function' }; build(); rec('bridgenotfn', fire('a.pnl-mini-vh')); setBridge(true);
    build(); rec('keyboard', fire('a.pnl-mini-vh', { detail: 0 }));
    // Regression: the "N more" expander beside it still works.
    document.getElementById('rail').innerHTML = '<div class="pnl-rail-blk"><a data-rail-extra hidden id="x1">a</a><button type="button" data-rail-more aria-expanded="false" data-more-label="2 more">2 more</button></div>';
    document.querySelector('[data-rail-more]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    results.push({ name: 'railmore', hidden: document.getElementById('x1').hidden, text: document.querySelector('[data-rail-more]').textContent });
    results.push({ name: 'errors', errs: window.__errs.slice() });
    document.getElementById('out').textContent = 'RESULT ' + JSON.stringify(results);
})();
</script>
</body></html>
HTML;
}
function edge_dump($htmlPath, $profileDir, $errFile) {
    // PHP's own pipes see NOTHING from msedge --dump-dom: the launcher exits in
    // 0.1 s (rc 0) and the browser child writes to a handle nobody reads. The
    // proven route (js_syntax_check_via_cscript) is PowerShell's Start-Process
    // with -RedirectStandardOutput to a FILE, which the child inherits; read it
    // once it has stopped growing. No path here may contain a space.
    $url = 'file:///' . str_replace('\\', '/', $htmlPath);
    $outFile = dirname($htmlPath) . '\\dom.txt';
    @unlink($outFile);
    $args = array('--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
                  '--disable-sync', '--disable-extensions', '--allow-file-access-from-files',
                  '--user-data-dir=' . $profileDir, '--dump-dom', $url);
    $cmd = 'powershell -NoProfile -NonInteractive -Command "Start-Process -FilePath \'' . EDGE . '\' -Wait -NoNewWindow'
         . ' -RedirectStandardOutput ' . $outFile . ' -RedirectStandardError ' . $errFile
         . ' -ArgumentList \'' . implode("','", $args) . '\'"';
    exec($cmd, $o, $rc);
    $last = -1; $stable = 0;
    for ($i = 0; $i < 100; $i++) {   // <= 20 s for a child still flushing
        clearstatcache(true, $outFile);
        $size = is_file($outFile) ? filesize($outFile) : 0;
        if ($size > 0 && $size === $last) { if (++$stable >= 2) break; } else { $stable = 0; }
        $last = $size;
        usleep(200000);
    }
    return is_file($outFile) ? (string)file_get_contents($outFile) : '';
}
function rrmdir($dir) {
    // Only ever this suite's own C:\Temp\railvh_<pid> tree - assert the leaf before any recursive delete.
    // Edge's profile keeps a few files locked for a moment after the dump, so retry for up to ~10 s.
    if (!preg_match('/^railvh_\d+$/', basename($dir)) || !is_dir($dir)) return;
    for ($try = 0; $try < 20 && is_dir($dir); $try++) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) { $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname()); }
        @rmdir($dir);
        if (is_dir($dir)) usleep(500000);
    }
}
/** Sweep railvh_<pid> trees an earlier run could not remove (a lock it gave up on), once they are old. */
function sweep_stale_work() {
    foreach ((array)glob('C:\\Temp\\railvh_*') as $d) {
        if (preg_match('/^railvh_\d+$/', basename($d)) && is_dir($d) && filemtime($d) < time() - 1800) rrmdir($d);
    }
}
$WORK = 'C:\\Temp\\railvh_' . getmypid();
sweep_stale_work();
$harnessRuns = 0;
/** Run the harness on one landing.js text; returns the results array (name => row) or null. */
function run_harness($landingJs, $tag) {
    global $WORK, $harnessRuns;
    $dir = $WORK . '\\' . $tag;
    @mkdir($dir, 0777, true);
    file_put_contents($dir . '\\landing.js', $landingJs);
    file_put_contents($dir . '\\harness.html', harness_html());
    $dump = edge_dump($dir . '\\harness.html', $WORK . '\\prof', $WORK . '\\edge.err');
    $harnessRuns++;
    if (!preg_match('/RESULT (\[.*\])<\/pre>/s', $dump, $m)) return null;
    $rows = json_decode(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), true);
    if (!is_array($rows)) return null;
    $by = array();
    foreach ($rows as $r) $by[$r['name']] = $r;
    return $by;
}
/** Every JS-side check as [label, bool]. */
function js_checks($by) {
    $c = array();
    $c[] = array('js: harness produced results', is_array($by) && isset($by['plain']));
    if (!is_array($by) || !isset($by['plain'])) return $c;
    $g = function ($n) use ($by) { return isset($by[$n]) ? $by[$n] : array('prevented' => null, 'calls' => array()); };
    $p = $g('plain');
    $c[] = array('js: plain click is intercepted (no navigation)', $p['prevented'] === true);
    $c[] = array('js: plain click opens the dialog once, (null, sid, title)', count($p['calls']) === 1 && $p['calls'][0] === array(null, 'ABC1', 'Alpha Report'));
    foreach (array('ctrl', 'meta', 'shift', 'alt') as $k) {
        $r = $g($k);
        $c[] = array("js: $k+click falls through to the href, no dialog", $r['prevented'] === false && count($r['calls']) === 0);
    }
    $r = $g('middle');  $c[] = array('js: middle button falls through, no dialog', $r['prevented'] === false && count($r['calls']) === 0);
    $r = $g('child');   $c[] = array('js: a click on a child node of the link still opens the dialog', $r['prevented'] === true && count($r['calls']) === 1 && $r['calls'][0][1] === 'ABC1');
    $r = $g('notitle'); $c[] = array('js: a missing title opens with an empty heading, never undefined', $r['prevented'] === true && count($r['calls']) === 1 && $r['calls'][0][2] === '');
    $r = $g('noid');    $c[] = array('js: a link without data-vh-report-id falls through', $r['prevented'] === false && count($r['calls']) === 0);
    $r = $g('otherlink'); $c[] = array('js: the row\'s report link is untouched', $r['prevented'] === false && count($r['calls']) === 0);
    $r = $g('nodialog'); $c[] = array('js: no dialog in the DOM - fall through to the href', $r['prevented'] === false && count($r['calls']) === 0);
    $r = $g('nobridge'); $c[] = array('js: no window.Penumbra - fall through, no throw', $r['prevented'] === false && count($r['calls']) === 0);
    $r = $g('bridgenotfn'); $c[] = array('js: a bridge without the function - fall through', $r['prevented'] === false && count($r['calls']) === 0);
    $r = $g('keyboard'); $c[] = array('js: a keyboard-activated click (detail 0) opens the dialog', $r['prevented'] === true && count($r['calls']) === 1);
    $rm = isset($by['railmore']) ? $by['railmore'] : array('hidden' => true, 'text' => '');
    $c[] = array('js: the "N more" expander still reveals its rows', $rm['hidden'] === false && $rm['text'] === 'Show fewer');
    $errs = isset($by['errors']['errs']) ? $by['errors']['errs'] : array('missing');
    $c[] = array('js: no uncaught error in landing.js (' . implode(' | ', $errs) . ')', count($errs) === 0);
    return $c;
}
function failing($checks) {
    $out = array();
    foreach ($checks as $ch) if (!$ch[1]) $out[] = $ch[0];
    return $out;
}

// ============================================================================
$IDX = slurp(pick('index.php'));
$LND = slurp(pick('js/landing.js'));

echo "PHP side (" . $APP . ")\n";
foreach (php_checks($IDX) as $ch) ok($ch[1], $ch[0]);

$edgeOk = false;
if (!$NO_EDGE) {
    @mkdir($WORK, 0777, true);
    // exec() goes through cmd.exe, which refuses a UNC cwd (this suite lives on d$). NOT $WORK itself:
    // a process cannot remove its own cwd, which is how the first runs left empty railvh_<pid> dirs behind.
    chdir('C:\\Temp');
    file_put_contents($WORK . '\\control.html', '<!doctype html><html><body><pre id="out">CTRL_OK</pre></body></html>');
    $ctl = edge_dump($WORK . '\\control.html', $WORK . '\\prof', $WORK . '\\edge.err');
    $edgeOk = strpos($ctl, 'CTRL_OK') !== false;
    if (!$edgeOk) { fwrite(STDERR, "FATAL: headless Edge --dump-dom returned nothing for the control page (capture broken, not the code under test)\n"); rrmdir($WORK); exit(2); }
    echo "JS side (headless Edge)\n";
    foreach (js_checks(run_harness($LND, 'new')) as $ch) ok($ch[1], $ch[0]);
} else {
    echo "JS side SKIPPED (--no-edge)\n";
}

if (!$NO_OLD) {
    echo "OLD build ($OLD_REV) must fail the new checks\n";
    $oldIdx = slurp(oldver_git_show($OLD_REV, 'index.php'));
    $fo = failing(php_checks($oldIdx));
    ok(count($fo) >= 20, 'old index.php fails the new PHP checks (' . count($fo) . ' of them)');
    ok(in_array('rail: viewer row - no history link', $fo, true), 'old index.php: the viewer row DID get a link');
    ok(in_array('gate: the dialog markup ships for the loaded report\'s editors OR a rail link', $fo, true), 'old index.php: the dialog gate was $canEditLoadedReport only');
    if ($edgeOk) {
        $oldLnd = slurp(oldver_git_show($OLD_REV, 'js/landing.js'));
        $fj = failing(js_checks(run_harness($oldLnd, 'old')));
        ok(in_array('js: plain click is intercepted (no navigation)', $fj, true), 'old landing.js: a plain click navigated (not intercepted)');
        ok(!in_array('js: the "N more" expander still reveals its rows', $fj, true), 'old landing.js: the expander worked there too (harness is sane)');
    }
}

echo "MUTANTS (each must be caught)\n";
$phpMutants = array(
    array('P1 rail gate dropped (viewers get the link)', "<?php if (!empty(\$pnlUrow['edit'])): \$pnl_vh_rail = true; ?>", "<?php if (true): \$pnl_vh_rail = true; ?>"),
    array('P2 owner clause removed from the edit flag', "penumbraIsReportOwner(isset(\$pnlUr['OWNER_ID']) ? \$pnlUr['OWNER_ID'] : '', \$currentUserKey)\n                                       || ", ''),
    array('P3 dialog gate back to the loaded report only', "<?php if (\$canEditLoadedReport || \$pnl_vh_rail): ?>", "<?php if (\$canEditLoadedReport): ?>"),
    array('P4 the rail flag never raised', ": \$pnl_vh_rail = true; ?>", ": ?>"),
    array('P5 &noadm no longer switches editors off', "\$isAdmin || (\$pnbEditorRolesOn\n", "\$isAdmin || (true\n"),
    array('P6 SELECT alias renamed away from the loop\'s key', 'MAX(r.OWNER_ID) as OWNER_ID', 'MAX(r.OWNER_ID) as OWNER_IDX'),
    array('P7 title attribute left unescaped', "data-vh-report-title=\"<?php echo htmlspecialchars(\$pnlUrow['title']); ?>\"", "data-vh-report-title=\"<?php echo \$pnlUrow['title']; ?>\""),
);
foreach ($phpMutants as $m) {
    list($label, $from, $to) = $m;
    $hits = substr_count($IDX, $from);
    ok($hits === 1, "mutant $label: anchor hits exactly once (hits=$hits)");
    if ($hits !== 1) continue;
    $f = failing(php_checks(str_replace($from, $to, $IDX)));
    ok(count($f) > 0, "mutant $label: caught by " . (count($f) ? ('"' . $f[0] . '"' . (count($f) > 1 ? ' +' . (count($f) - 1) : '')) : 'NOTHING'));
}
if ($edgeOk) {
    $jsMutants = array(
        array('J1 preventDefault dropped (link navigates too)', "        e.preventDefault();\n        bridge.openVersionHistory(", "        bridge.openVersionHistory("),
        array('J2 modifier / middle guard dropped', "        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;\n", ''),
        array('J3 dialog presence check dropped', "        if (!document.getElementById('versionHistoryLightbox')) return;\n", ''),
        array('J4 arguments shifted (sid as the version to preselect)', "bridge.openVersionHistory(null, sid, ", "bridge.openVersionHistory(sid, null, "),
        array('J5 bridge check dropped (throws without main.js)', "        if (!bridge || typeof bridge.openVersionHistory !== 'function') return;\n", ''),
        array('J6 missing-id guard dropped', "        if (!sid) return;\n", ''),
    );
    $i = 0;
    foreach ($jsMutants as $m) {
        list($label, $from, $to) = $m;
        $hits = substr_count($LND, $from);
        ok($hits === 1, "mutant $label: anchor hits exactly once (hits=$hits)");
        if ($hits !== 1) continue;
        $f = failing(js_checks(run_harness(str_replace($from, $to, $LND), 'm' . (++$i))));
        ok(count($f) > 0, "mutant $label: caught by " . (count($f) ? ('"' . $f[0] . '"' . (count($f) > 1 ? ' +' . (count($f) - 1) : '')) : 'NOTHING'));
    }
}

if ($CONTROL) {
    echo "Control (must FAIL)\n";
    ok(false, 'control: a deliberately false assertion');
}

rrmdir($WORK);
echo "\n(" . $harnessRuns . " headless Edge runs)\nPASS $pass   FAIL $fail\n";
exit($fail === 0 ? 0 : 1);
