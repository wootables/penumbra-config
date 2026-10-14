<?php
/**
 * test_subtip.php - server side of two scheduler features (2026-10-07):
 *   1. the header Subscribe button's DETAIL CARD - the facts penumbra_sub_task_about()
 *      (cron_describe.php) hands the boot payload and the scheduler list;
 *   2. the CUSTOM LIVE LINK TEXT - the pencil after "Include Live Link" saves
 *      OPTIONS.link_text, manage_schedule.php normalizes it, the runner uses it.
 *
 *   php.exe -n -d date.timezone=America/New_York test_subtip.php --app=<webroot or stage> [--control] [--mutant=<name>]
 *
 * A. penumbra_sub_task_about(), evaluated from the real cron_describe.php (pure functions):
 *    each fact, the runner's flag semantics, the __SNAP_TYPE twin, clipping, the next-send
 *    line, and that nothing private ever comes out of it.
 * B. Drift guard: its __SNAP_TYPE patterns are byte-identical to the runner's.
 * C. penumbra_email_link_text(), lifted from schedule_runner.php by the tokenizer.
 * D. The runner's wiring, read from the source.
 * E. manage_schedule.php: the save block (lifted by its anchors and run), the prune helper
 *    (tokenizer), and the list action's SUB_ABOUT.
 * F. index.php: NEXT_RUN in the payload query, the guarded 'about' call, the pencil markup.
 *
 * --control adds ONE deliberately false assertion (must report FAIL: 1).
 * --mutant=<name> edits the source text in memory before it is evaluated or read; run.ps1
 * holds the expected fail count of each. EXPECTED TAIL: "PASS: N   FAIL: 0".
 */

$APP = null; $CONTROL = false; $MUTANT = '';
foreach ($argv as $a) {
    if (strpos($a, '--app=') === 0) $APP = rtrim(substr($a, 6), "\\/");
    if ($a === '--control') $CONTROL = true;
    if (strpos($a, '--mutant=') === 0) $MUTANT = substr($a, 9);
}
if ($APP === null) { fwrite(STDERR, "--app=<dir> is required\n"); exit(2); }

$PASS = 0; $FAIL = 0;
function ok($cond, $label, $detail = null) {
    global $PASS, $FAIL;
    if ($cond) { $PASS++; echo "ok   $label\n"; return; }
    $FAIL++; echo "FAIL $label\n";
    if ($detail !== null) echo "       got: " . (is_string($detail) ? $detail : json_encode($detail)) . "\n";
}
function src($rel) {
    global $APP;
    $p = $APP . '/' . $rel;
    if (!is_file($p)) { fwrite(STDERR, "cannot read $p\n"); exit(2); }
    return file_get_contents($p);
}
// In-memory mutants: each names a file, an exact anchor (must occur once) and its replacement.
$MUTANTS = array(
    'about-snap-any-op'   => array('cron_describe.php', "if (\$filter !== '' && preg_match_all(\"/__SNAP_TYPE\\s*(=|!=|<>)\\s*'([^']*)'/i\"", "if (\$filter !== '' && preg_match_all(\"/__SNAP_TYPE\\s*(=|!=|<>|!~)\\s*'([^']*)'/i\""),
    'about-leaks-condition' => array('cron_describe.php', "            'confirm'   => !isset(\$opts['subscriptions_notify']) || \$truthy('subscriptions_notify')\n", "            'confirm'   => !isset(\$opts['subscriptions_notify']) || \$truthy('subscriptions_notify'),\n            'audience'  => isset(\$opts['subscriptions_condition']) ? \$opts['subscriptions_condition'] : ''\n"),
    'about-changes-truthy' => array('cron_describe.php', "'changes'   => \$strict('changes_only'),", "'changes'   => \$truthy('changes_only'),"),
    'about-no-stale-guard' => array('cron_describe.php', "if (\$ts !== false && \$ts >= \$now - 600) {", "if (\$ts !== false) {"),
    'linktext-unescaped'  => array('schedule_runner.php', "    return (\$t === '') ? '' : htmlspecialchars(\$t, ENT_QUOTES, 'UTF-8');\n}", "    return \$t;\n}"),
    // Round 3 (the other links' pencils). Single-quoted: no \$ juggling.
    'compare-fn-ignores-text' => array('schedule_runner.php', '($text !== \'\' ? $text : "View the comparison analysis.")', '"View the comparison analysis."'),
    'full-site-literal'   => array('schedule_runner.php', '{$_prTruncHt[\'titleColor\']}; font-weight: bold; text-decoration: underline;\'>" . ($linkTextFull !== \'\' ? $linkTextFull : "View the full report (all rows) in Penumbra.") . "</a>"',
                                   '{$_prTruncHt[\'titleColor\']}; font-weight: bold; text-decoration: underline;\'>View the full report (all rows) in Penumbra.</a>"'),
    'caption-unescaped'   => array('penumbra_render_charts.php', '? htmlspecialchars(trim($img[\'linkCaption\']), ENT_QUOTES, \'UTF-8\') : \'Open to full view\';', '? trim($img[\'linkCaption\']) : \'Open to full view\';'),
    'caption-not-handed'  => array('schedule_runner.php', '\'caption\' => penumbra_email_link_text_plain(isset($options[\'link_text_chart\']) ? $options[\'link_text_chart\'] : \'\')', '\'caption\' => \'\''),
    'runner-compare-literal' => array('schedule_runner.php', "\$linkText = (\$linkTextCustom !== '') ? \$linkTextCustom : \"View the live report.\";", "\$linkText = \"View the live report.\";"),
    'runner-custom-unused' => array('schedule_runner.php', "                if (\$linkTextCustom !== '') {\n                    \$linkText = \$linkTextCustom;", "                if (\$linkTextCustom !== '') {\n                    \$linkTextCustom = \$linkTextCustom;"),
    'prune-missing'       => array('manage_schedule.php', ",\n                        'link_text', 'link_text_compare', 'link_text_full', 'link_text_chart');", ");"),
    'save-no-cap'         => array('manage_schedule.php', "if (\$link_text !== '' && preg_match('/^(.{200}).+\$/su', \$link_text, \$link_m)) \$link_text = rtrim(\$link_m[1]);", ""),
    'index-unguarded'     => array('index.php', "'about'      => function_exists('penumbra_sub_task_about')\n                                    ? penumbra_sub_task_about(", "'about'      => true\n                                    ? penumbra_sub_task_about("),
);
$SRC = array();
foreach (array('cron_describe.php', 'schedule_runner.php', 'manage_schedule.php', 'index.php', 'penumbra_render_charts.php') as $f) $SRC[$f] = src($f);
if ($MUTANT !== '') {
    if (!isset($MUTANTS[$MUTANT])) { fwrite(STDERR, "unknown mutant $MUTANT\n"); exit(2); }
    list($mf, $from, $to) = $MUTANTS[$MUTANT];
    // The runner is CRLF: an anchor written with \n matches its \r\n form too.
    $hits = substr_count($SRC[$mf], $from);
    if ($hits !== 1 && strpos($from, "\r\n") === false) {
        $fromCr = str_replace("\n", "\r\n", $from); $toCr = str_replace("\n", "\r\n", $to);
        if (substr_count($SRC[$mf], $fromCr) === 1) { $from = $fromCr; $to = $toCr; $hits = 1; }
    }
    if ($hits !== 1) { echo "MUTANT NOT APPLICABLE ($MUTANT: anchor found $hits x)\nPASS: 0   FAIL: 99\n"; exit(1); }
    $SRC[$mf] = str_replace($from, $to, $SRC[$mf]);
}

// ---------------------------------------------------------------- tokenizer lift
function lift_function($src, $name) {
    $toks = token_get_all($src);
    $n = count($toks);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($toks[$i]) || $toks[$i][0] !== T_FUNCTION) continue;
        $j = $i + 1;
        while ($j < $n && is_array($toks[$j]) && $toks[$j][0] === T_WHITESPACE) $j++;
        if (!is_array($toks[$j]) || $toks[$j][0] !== T_STRING || $toks[$j][1] !== $name) continue;
        $out = ''; $depth = 0; $started = false;
        for ($k = $i; $k < $n; $k++) {
            $t = $toks[$k];
            $txt = is_array($t) ? $t[1] : $t;
            $out .= $txt;
            if (!is_array($t) && $t === '{') { $depth++; $started = true; }
            elseif (is_array($t) && ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES)) { $depth++; }
            elseif (!is_array($t) && $t === '}') { $depth--; if ($started && $depth === 0) return $out; }
        }
    }
    return null;
}

// ======================================================================= A
echo "A. penumbra_sub_task_about() - the detail card's facts\n";
eval('?>' . $SRC['cron_describe.php']);
ok(function_exists('penumbra_sub_task_about') && function_exists('penumbra_cron_human'), 'cron_describe.php defines the extractor beside the cron describer');
// A pre-feature app has no extractor: score the rest of A as one failure instead of a fatal.
if (!function_exists('penumbra_sub_task_about')) {
    function penumbra_sub_task_about($o, $n = '', $t = null) {
        return array('next' => null, 'body' => null, 'changes' => null, 'snippet' => null, 'attach' => array(), 'link' => null, 'inputs' => array(),
            'only' => array(), 'except' => array(), 'filter' => null, 'personal' => null, 'skipEmpty' => null, 'skipSame' => null, 'skipIf' => null, 'confirm' => null);
    }
}
$NOW = mktime(9, 0, 0, 10, 7, 2026);   // Wed Oct 7 2026 09:00 local (America/New_York)
$about = function ($opts, $next = '') use ($NOW) { return penumbra_sub_task_about($opts, $next, $NOW); };

$d = $about(array());
ok($d['body'] === 'table' && $d['changes'] === false && $d['attach'] === array(), 'no options: the data table, no change analysis, no attachments');
ok($d['link'] === true && $d['snippet'] === true && $d['confirm'] === true, "no options: the runner's defaults - live link, snippet and confirmations are ON when unset");
ok($d['next'] === '' && $d['inputs'] === array() && $d['filter'] === '' && $d['personal'] === false
    && $d['skipEmpty'] === false && $d['skipSame'] === false && $d['skipIf'] === '', 'no options: nothing else claimed');

// The live hitratio task (#1345) as stored on 2026-10-07.
$hit = array('attach_csv' => true, 'attach_xlsx' => false, 'attach_pdf' => false, 'no_body' => false, 'include_link' => true,
    'no_links' => false, 'skip_empty' => false, 'skip_no_change' => false, 'skip_custom_condition' => false, 'custom_condition_expr' => '',
    'skip_if_missed_min' => 0, 'include_snippet' => false, 'body_preamble' => '', 'search_filter' => '', 'changes_only' => false,
    'prompt_answers' => array('submitted' => 'first day of 5 fiscal years ago..last day of last fiscal year'), 'me_map' => array(),
    'subscriptions_enabled' => true, 'subscriptions_notify' => true);
$d = $about($hit, '2026-11-01 08:40:00');
ok($d['attach'] === array('csv') && $d['snippet'] === false && $d['link'] === true, 'hitratio: CSV only, snippet off, live link on');
ok($d['inputs'] === array(array('name' => 'submitted', 'value' => 'first day of 5 fiscal years ago..last day of last fiscal year')),
    'hitratio: its saved prompt answer, relative dates readable as stored', $d['inputs']);
ok($d['next'] === 'Sun, Nov 1 at 8:40 AM', 'next send: weekday, month, day and time (this year: no year)', $d['next']);
$d = $about($hit, '2027-01-04 08:40:00');
ok($d['next'] === 'Mon, Jan 4, 2027 at 8:40 AM', 'next send in another year carries the year', $d['next']);
$d = $about($hit, '2026-10-07 08:00:00');
ok($d['next'] === '', 'a next send an hour in the past (scheduler behind or paused) is not shown', $d['next']);
$d = $about($hit, '2026-10-07 08:55:00');
ok($d['next'] === 'Wed, Oct 7 at 8:55 AM', '...but five minutes late (the run is just due) still is', $d['next']);
ok($about($hit, 'not a date')['next'] === '' && $about($hit, null)['next'] === '', 'an unreadable or missing NEXT_RUN gives no next line');

$d = $about(array('attach_pdf' => true, 'attach_csv' => 1, 'attach_xlsx' => 'yes', 'no_body' => true, 'include_link' => false,
    'include_snippet' => true, 'subscriptions_notify' => false));
ok($d['attach'] === array('xlsx', 'csv', 'pdf'), 'attachments: truthy flags, listed Excel, CSV, PDF', $d['attach']);
ok($d['body'] === 'summary' && $d['link'] === false && $d['snippet'] === true && $d['confirm'] === false,
    'no_body = a summary email; include_link false = no link; confirmations off is reported');
ok($about(array('include_link' => 'false', 'attach_csv' => 'false'))['link'] === false && $about(array('attach_csv' => 'false'))['attach'] === array(),
    "a stored string 'false' is not mistaken for ON");

// Strict flags: the runner counts changes_only / skip_no_change / skip_custom_condition only when === true.
$d = $about(array('changes_only' => 'true', 'skip_no_change' => 1, 'skip_custom_condition' => 'true', 'custom_condition_expr' => 'count() = 0'));
ok($d['changes'] === false && $d['skipSame'] === false && $d['skipIf'] === '', "strict flags: 'true' / 1 do not count (the runner's === true)", $d);
$d = $about(array('changes_only' => true, 'skip_no_change' => true, 'skip_empty' => true, 'skip_custom_condition' => true, 'custom_condition_expr' => "  sum(AMOUNT)\n < 10000000 "));
ok($d['changes'] === true && $d['skipSame'] === true && $d['skipEmpty'] === true, 'change analysis, skip-if-unchanged, skip-when-empty all reported');
ok($d['skipIf'] === 'sum(AMOUNT) < 10000000', 'the skip condition: one line, trimmed', $d['skipIf']);
ok($about(array('skip_custom_condition' => true, 'custom_condition_expr' => '  '))['skipIf'] === '', 'a skip condition switched on with no expression claims nothing');

// __SNAP_TYPE: change-analysis group clauses (twin of the runner).
$d = $about(array('changes_only' => true, 'search_filter' => "__SNAP_TYPE != 'Unchanged Rows'"));
ok($d['except'] === array('Unchanged Rows') && $d['only'] === array() && $d['filter'] === '', 'grantprofiles-style clause: "leaves out Unchanged Rows", no row filter left', $d);
$d = $about(array('changes_only' => true, 'search_filter' => "__SNAP_TYPE = 'New Rows' AND STATUS = 'Active' or __SNAP_TYPE = 'Modified Rows' AND __SNAP_TYPE <> 'Unchanged Rows'"));
ok($d['only'] === array('New Rows', 'Modified Rows') && $d['except'] === array('Unchanged Rows'), 'include (=) and exclude (!= / <>) sets, in order', $d);
ok($d['filter'] === "STATUS = 'Active'", "the real row clause survives, the group clauses are stripped", $d['filter']);
$d = $about(array('changes_only' => false, 'search_filter' => "STATUS = 'Active' AND __SNAP_TYPE != 'Unchanged Rows'"));
ok($d['except'] === array() && $d['only'] === array() && $d['filter'] === "STATUS = 'Active'", 'without a change analysis the group clauses do nothing - not claimed, still stripped', $d);
$d = $about(array('changes_only' => true, 'search_filter' => "__SNAP_TYPE !~ 'Unchanged Rows'"));
ok($d['except'] === array() && $d['filter'] === "__SNAP_TYPE !~ 'Unchanged Rows'", 'an operator the runner does not read as a group clause (!~) is shown as the row filter it is', $d);

// Personalization: recipient variables in the filter, or in a me() mapping.
$d = $about(array('search_filter' => 'LEAD_UNIT = /^{OUC}/'));
ok($d['personal'] === true && $d['filter'] === 'LEAD_UNIT = /^{OUC}/', 'a {OUC} filter = rows picked per recipient');
ok($about(array('search_filter' => 'X = { oucs2d }'))['personal'] === true, 'braces may hold spaces and any case (the parser trims them)');
ok($about(array('search_filter' => 'X = {SOMETHING}'))['personal'] === false, 'an unknown {TOKEN} is not a recipient variable');
ok($about(array('me_map' => array('dept' => '{DEPT}')))['personal'] === true && $about(array('me_map' => array('dept' => 'ENGR')))['personal'] === false,
    'me() mapped to a recipient variable personalizes; a fixed value does not');

// Prompt answers: arrays joined, numeric keys and blanks skipped, at most six.
$pa = array('fy' => array('2025', '2026'), 0 => 'positional', 'blank' => '', 'n1' => 'a', 'n2' => 'b', 'n3' => 'c', 'n4' => 'd', 'n5' => 'e', 'n6' => 'f');
$d = $about(array('prompt_answers' => $pa));
ok(count($d['inputs']) === 6 && $d['inputs'][0] === array('name' => 'fy', 'value' => '2025, 2026') && $d['inputs'][5]['name'] === 'n5',
    'prompt answers: a multi-value joined with commas, positional and blank skipped, capped at six', $d['inputs']);
ok($about(array('prompt_answers' => 'not-an-array'))['inputs'] === array(), 'prompt_answers that is not an object is ignored');

// Clipping: one line, a cap, an ellipsis; non-UTF-8 dropped rather than mangled.
$long = str_repeat('COL = 1 AND ', 30);
$d = $about(array('search_filter' => $long));
ok(substr($d['filter'], -3) === '...' && strlen($d['filter']) <= 163 && strpos($d['filter'], "\n") === false, 'a long filter is clipped to 160 characters + "..."', strlen($d['filter']));
ok($about(array('search_filter' => "A = 1\r\n  AND\tB = 2"))['filter'] === 'A = 1 AND B = 2', 'whitespace runs (newlines, tabs) collapse to one space');
$d = $about(array('search_filter' => "NAME = '\xC3\xA9t\xC3\xA9'"));
ok($d['filter'] === "NAME = '\xC3\xA9t\xC3\xA9'", 'UTF-8 text passes through intact');
ok($about(array('search_filter' => "bad \xFF\xFE bytes"))['filter'] === '', 'a non-UTF-8 value is dropped, never half-printed');
$uni = str_repeat("\xC3\xA9", 170);
$d = $about(array('search_filter' => $uni));
ok(preg_match('//u', $d['filter']) === 1 && substr($d['filter'], -3) === '...', 'clipping counts characters, not bytes (a 2-byte letter is never cut in half)');

// Viewer safety: the boot payload reaches every authorized viewer.
$secret = array('recipients' => 'boss@ncsu.edu', 'recipient_vars' => array('pat@ncsu.edu' => array('FNAME' => 'Pat')),
    'subscribers' => array(array('uid' => 'sub1', 'email' => 'sub1@ncsu.edu', 'name' => 'Sub One')), 'suppressed' => array('opt@ncsu.edu'),
    'subscriptions_condition' => '{OUC2D} = 14', 'report_password' => 'hunter2', 'drop_password' => 'p4ss', 'drop_s3_secret_key' => 'S3CRET',
    'notify_success_recipients' => 'notify@ncsu.edu', 'body_preamble' => 'Hi {FNAME}', 'change_columns' => array('SECRETCOL'));
$enc = json_encode($about($secret + $hit, '2026-11-01 08:40:00'));
$leaks = array();
foreach (array('boss@', 'pat@', 'Pat', 'sub1', 'Sub One', 'opt@', 'OUC2D', 'hunter2', 'p4ss', 'S3CRET', 'notify@', 'Hi {FNAME}', 'SECRETCOL') as $needle) {
    if (strpos($enc, $needle) !== false) $leaks[] = $needle;
}
ok($leaks === array(), 'nothing private comes out: recipients, subscribers, opt-outs, the audience condition, passwords, keys, notify lists', $leaks);
ok(array_keys($about(array())) === array('next', 'body', 'changes', 'snippet', 'attach', 'link', 'inputs', 'only', 'except', 'filter', 'personal', 'skipEmpty', 'skipSame', 'skipIf', 'confirm'),
    'the fact set is exactly the documented keys (a new key is a new disclosure - review it)');
ok($about('not an array')['body'] === 'table', 'garbage options degrade to the defaults');

// ======================================================================= B
echo "B. drift guard: the __SNAP_TYPE patterns are the runner's\n";
// Every double-quoted regex literal that names __SNAP_TYPE ("/...__SNAP_TYPE.../i").
preg_match_all('#"(/[^"\n]*__SNAP_TYPE[^"\n]*)"#', $SRC['cron_describe.php'], $mc);
preg_match_all('#"(/[^"\n]*__SNAP_TYPE[^"\n]*)"#', $SRC['schedule_runner.php'], $mr);
$runnerSet = array_values(array_unique($mr[1]));
ok(count($mc[1]) === 4 && count(array_diff($mc[1], $runnerSet)) === 0, 'all four __SNAP_TYPE patterns (match + three strips) appear verbatim in the runner',
    array('describer' => $mc[1], 'runner' => $runnerSet));

// ======================================================================= C
echo "C. penumbra_email_link_text() - the runner's escape + normalize\n";
$fnPlain = lift_function($SRC['schedule_runner.php'], 'penumbra_email_link_text_plain');
$fn = lift_function($SRC['schedule_runner.php'], 'penumbra_email_link_text');
ok($fn !== null && $fnPlain !== null, 'lifted from schedule_runner.php by the tokenizer (normalize + escape)');
if ($fn !== null && $fnPlain !== null) {
    eval($fnPlain);
    eval($fn);
    ok(penumbra_email_link_text_plain("  <b>x</b> &\n y ") === '<b>x</b> & y', 'the plain form normalizes but does NOT escape (the chart module escapes its caption itself)');
    ok(penumbra_email_link_text('Open the award dashboard') === 'Open the award dashboard', 'plain text passes unchanged');
    ok(penumbra_email_link_text('<b>x</b> & "y" \'z\'') === '&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot; &#039;z&#039;', 'markup, ampersands and both quotes are escaped');
    ok(penumbra_email_link_text("  two\r\nlines\there  ") === 'two lines here', 'newlines and tabs collapse; trimmed');
    ok(penumbra_email_link_text("a\x00b\x1Fc\x7Fd") === 'a b c d', 'control characters become spaces');
    ok(penumbra_email_link_text('') === '' && penumbra_email_link_text('   ') === '' && penumbra_email_link_text(null) === '' && penumbra_email_link_text(array('x')) === '',
        "blank, null and non-scalars mean 'automatic'");
    $c = penumbra_email_link_text(str_repeat("\xC3\xA9", 250));
    ok($c === str_repeat("\xC3\xA9", 200), 'capped at 200 characters (not bytes)', strlen($c));
    ok(penumbra_email_link_text("\xFF\xFE") === '', 'non-UTF-8 is dropped');
}
$cmpFn = lift_function($SRC['schedule_runner.php'], 'penumbra_pr_compare_links_html');
ok($cmpFn !== null, 'penumbra_pr_compare_links_html lifted by the tokenizer');
if ($cmpFn !== null) {
    eval($cmpFn);
    $h1 = penumbra_pr_compare_links_html('https://x.test/p?id=r&snapcmp=7', array('tsColor' => '#111', 'titleColor' => '#222'));
    ok(strpos($h1, "underline;'>View the comparison analysis.</a>") !== false && strpos($h1, 'snapcmp=7') !== false,
        'per-recipient comparison link: two arguments = the automatic text (existing callers render as before)');
    $h2 = penumbra_pr_compare_links_html('https://x.test/p?id=r', array(), 'See &lt;what&gt; changed');
    ok(strpos($h2, "underline;'>See &lt;what&gt; changed</a>") !== false && strpos($h2, 'View the comparison analysis.') === false,
        "...and the task's own (already escaped) text when given");
}

// ======================================================================= D
echo "D. the runner uses it everywhere the header link is worded\n";
$R = str_replace("\r\n", "\n", $SRC['schedule_runner.php']);
$custom = "\$linkTextCustom = penumbra_email_link_text(isset(\$options['link_text']) ? \$options['link_text'] : '');";
ok(substr_count($R, $custom) === 1, 'the task\'s OPTIONS.link_text is read once, through the escaping helper');
$pPivot = strpos($R, "\$linkText = \"View this report for the interactive pivot view with sorting and search.\";");
$pCustom = strpos($R, $custom);
$pUse = strpos($R, "if (\$linkTextCustom !== '') {\n                    \$linkText = \$linkTextCustom;");
ok($pPivot !== false && $pCustom !== false && $pUse !== false && $pPivot < $pCustom && $pCustom < $pUse,
    'it replaces the automatic text AFTER the table/pivot choice (so it wins over both)');
ok(substr_count($R, "\$linkText = (\$linkTextCustom !== '') ? \$linkTextCustom : ") === 3,
    'all three change-analysis sites (broadcast + both per-recipient paths) keep the custom text');
ok(preg_match_all("/\\\$linkText\s*=\s*['\"]View the live report\.['\"];/", $R) === 0, 'no bare "View the live report." assignment is left');
// Round 3: the other links' own wording.
ok(substr_count($R, "\$linkTextCompare = penumbra_email_link_text(isset(\$options['link_text_compare']) ? \$options['link_text_compare'] : '');") === 1
    && substr_count($R, "\$linkTextFull = penumbra_email_link_text(isset(\$options['link_text_full']) ? \$options['link_text_full'] : '');") === 1,
    'the comparison and full-report texts are read once each, through the escaping helper');
ok(substr_count($R, "(\$linkTextCompare !== '' ? \$linkTextCompare : \"View the comparison analysis.\")") === 1
    && substr_count($R, "penumbra_pr_compare_links_html(\$emailCompareUrl, \$_prCmpHt, \$linkTextCompare)") === 2,
    'the comparison link: the broadcast header pair and both per-recipient paths');
ok(substr_count($R, "(\$linkTextCompare !== '' ? \$linkTextCompare : \"View the full snapshot comparison analysis.\")") === 3,
    'its repeat in the cut-to-fit notice, at all three sites');
ok(substr_count($R, "(\$linkTextFull !== '' ? \$linkTextFull : \"View the full report (all rows) in Penumbra.\")") === 3,
    "the notice's full-report link, at all three sites");
ok(preg_match_all('#>View the (full report \(all rows\) in Penumbra|full snapshot comparison analysis|comparison analysis)\.</a>#', $R) === 0,
    'no automatic link text is left hard-wired inside a link (each sits behind its fallback)');
ok(strpos($R, "'caption' => penumbra_email_link_text_plain(isset(\$options['link_text_chart']) ? \$options['link_text_chart'] : '')") !== false,
    'the chart caption goes to the chart module as PLAIN text (the module escapes what it prints)');
$emailBranch = strpos($R, "\$linkTextCustom = penumbra_email_link_text(");
$generic = strpos($R, "function penumbra_email_link_text(");
ok($generic !== false && strpos(substr($R, $generic, 1200), "link_text'") === false,
    "the helper never names the option key - only the EMAIL branch reads 'link_text' (schedprune's drift guard)");

// ======================================================================= E
echo "E. manage_schedule.php\n";
$M = str_replace("\r\n", "\n", $SRC['manage_schedule.php']);
$LINK_KEYS = array('link_text', 'link_text_compare', 'link_text_full', 'link_text_chart');
$startA = "        foreach (array('link_text', 'link_text_compare', 'link_text_full', 'link_text_chart') as \$link_key) {\n";
$s = strpos($M, $startA);
$e = ($s === false) ? false : strpos($M, "\n        }\n", $s);
ok($s !== false && $e !== false && substr_count($M, $startA) === 1, 'the save block is found by its anchor (once): ONE rule for all four link texts');
if ($s !== false && $e !== false) {
    $block = substr($M, $s, $e - $s + 10);
    $save = function ($opts) use ($block) { $options = $opts; eval($block); return $options; };
    $o = $save(array('link_text' => "  Open\nthe   dashboard  ", 'other' => 1));
    ok($o === array('link_text' => 'Open the dashboard', 'other' => 1), 'save: one line, collapsed, trimmed', $o);
    $o = $save(array('link_text' => 'A', 'link_text_compare' => "  See \t what  changed ", 'link_text_full' => '   ', 'link_text_chart' => str_repeat("\xC3\xA9", 210), 'other' => 1));
    ok($o === array('link_text' => 'A', 'link_text_compare' => 'See what changed', 'link_text_chart' => str_repeat("\xC3\xA9", 200), 'other' => 1),
        'save: the comparison, full-report and chart texts follow the same rule (a blank one is dropped, 200 characters max)', $o);
    $o1 = $save(array('link_text' => '   ')); $o2 = $save(array('link_text_full' => ''));
    ok(!array_key_exists('link_text', $o1) && !array_key_exists('link_text_full', $o2), 'save: blank drops the key (= automatic)');
    $o1 = $save(array('link_text' => array('x'))); $o2 = $save(array('link_text_chart' => "\xFF"));
    ok(!array_key_exists('link_text', $o1) && !array_key_exists('link_text_chart', $o2), 'save: a non-scalar or non-UTF-8 value is dropped');
    $o = $save(array('link_text' => str_repeat('x', 250)));
    ok(isset($o['link_text']) && strlen($o['link_text']) === 200, 'save: capped at 200 characters', isset($o['link_text']) ? strlen($o['link_text']) : null);
    $o = $save(array('link_text_compare' => '<b>kept raw</b>'));
    ok($o['link_text_compare'] === '<b>kept raw</b>', 'save: stored as typed (the runner escapes at send time, once)');
    ok(strpos($block, 'mb_') === false, 'save: no mbstring call (the save path must not need the extension)');
}
$prune = lift_function($SRC['manage_schedule.php'], 'penumbra_sched_prune_email_only');
ok($prune !== null, 'prune helper lifted by the tokenizer');
if ($prune !== null) {
    eval($prune);
    $base = array('link_text' => 'Mine', 'link_text_compare' => 'C', 'link_text_full' => 'F', 'link_text_chart' => 'G', 'include_link' => true, 'search_filter' => 'A = 1');
    $kept = penumbra_sched_prune_email_only('EMAIL', $base);
    $gone = true;
    foreach (array('SNAPSHOT', 'DB_DUMP', 'DROP_FILE') as $tt) {
        $p = penumbra_sched_prune_email_only($tt, $base);
        foreach ($LINK_KEYS as $lk) { if (array_key_exists($lk, $p)) $gone = false; }
        if (!array_key_exists('search_filter', $p)) $gone = false;
    }
    ok($kept === $base && $gone, 'prune: an EMAIL task keeps all four link texts; snapshot, DB dump and file drop tasks lose them');
}
ok(strpos($M, "&& !empty(\$opts['subscriptions_enabled']) && function_exists('penumbra_sub_task_about')) {\n                \$cleaned_row['SUB_ABOUT'] = penumbra_sub_task_about(\$opts, isset(\$cleaned_row['NEXT_RUN']) ? \$cleaned_row['NEXT_RUN'] : '');") !== false
    && strpos($M, "\$cleaned_row['TASK_TYPE'] === 'EMAIL' && is_array(\$opts)") !== false,
    'list: SUB_ABOUT for subscribable EMAIL tasks, from the same extractor, guarded, fed NEXT_RUN');

// ======================================================================= F
echo "F. index.php\n";
$I = str_replace("\r\n", "\n", $SRC['index.php']);
ok(strpos($I, "\"SELECT ID, SUBJECT, CRON_EXPRESSION, RECIPIENTS, OPTIONS,\n                                    TO_CHAR(NEXT_RUN, 'YYYY-MM-DD HH24:MI:SS') AS NEXT_RUN") !== false,
    'payload query reads NEXT_RUN in the format the extractor parses');
ok(strpos($I, "'about'      => function_exists('penumbra_sub_task_about')\n                                    ? penumbra_sub_task_about(\$pnbSubOpts, isset(\$pnbSubRow['NEXT_RUN']) ? \$pnbSubRow['NEXT_RUN'] : '')\n                                    : null") !== false,
    "payload: 'about' is guarded (an undefined function is an Error the surrounding catch (Exception) would not stop)");
ok(strpos($I, "require_once 'cron_describe.php';") !== false, 'index.php already includes cron_describe.php');
$mk = strpos($I, '<span class="sched-link-opt"><label class="sched-option-label"><input type="checkbox" id="schedIncludeLink" checked> Include Live Link</label><button type="button" id="schedLinkTextBtn"');
ok($mk !== false, 'markup: the pencil is a sibling AFTER the label, never inside it (a click must not toggle the checkbox)');
ok(preg_match('#<input type="text" id="schedLinkText" tabindex="-1" aria-hidden="true" autocomplete="off" style="display: none;">#', $I) === 1,
    'markup: the store is a text input kept out of sight - not type=hidden, which serializeSchedulerForm skips');

$pencils = array(
    array('id="schedIncludeBody" checked> Include Table in Body', 'schedLinkTextFullBtn', 'full', 'schedLinkTextFull'),
    array('id="schedIncludeSnippet"> Include Snippet', 'schedLinkTextChartBtn', 'chart', 'schedLinkTextChart'),
    array('id="schedChangesOnly"> Send as Change Analysis', 'schedLinkTextCompareBtn', 'compare', 'schedLinkTextCompare'),
);
$missing = array();
foreach ($pencils as $pc) {
    if (strpos($I, $pc[0] . '</label><button type="button" id="' . $pc[1] . '" class="sched-link-text-btn" data-link-kind="' . $pc[2] . '"') === false
        || strpos($I, '<input type="text" id="' . $pc[3] . '" tabindex="-1" aria-hidden="true" autocomplete="off" style="display: none;">') === false) $missing[] = $pc[2];
}
ok($missing === array(), 'markup: a pencil after Include Table in Body, Include Snippet and Send as Change Analysis - outside each label, with its kind and its own text store', $missing);

// ======================================================================= G
echo "G. penumbra_render_charts.php - the chart caption\n";
$C = str_replace("\r\n", "\n", $SRC['penumbra_render_charts.php']);
$lc = lift_function($SRC['penumbra_render_charts.php'], 'penumbra_vis_linked_chart');
ok($lc !== null, 'penumbra_vis_linked_chart lifted by the tokenizer');
if ($lc !== null) {
    eval($lc);
    $img = array('href' => 'https://x.test/p?id=r&fullscreen=true&fspages=2', 'linkColor' => '#990000', 'linkFont' => 'Verdana');
    $def = penumbra_vis_linked_chart($img, '<img>', false);
    ok(substr_count($def, 'underline;">Open to full view</a>') === 1, 'no caption of its own: "Open to full view", as before');
    $img['linkCaption'] = '  See <b>this</b> & "more"  ';
    $own = penumbra_vis_linked_chart($img, '<img>', true);
    ok(strpos($own, 'underline;">See &lt;b&gt;this&lt;/b&gt; &amp; &quot;more&quot;</a>') !== false && strpos($own, 'Open to full view') === false && strpos($own, '<b>') === false,
        "the task's caption replaces it, escaped by the module", $own);
    $img['linkCaption'] = '   ';
    ok(strpos(penumbra_vis_linked_chart($img, '<img>', false), 'underline;">Open to full view</a>') !== false, 'a blank caption keeps "Open to full view"');
}
ok(strpos($C, "'caption' => (isset(\$link['caption']) && is_string(\$link['caption'])) ? \$link['caption'] : '');") !== false
    && strpos($C, "\$img['linkCaption'] = \$links[\$tok]['caption'];") !== false,
    'penumbra_vis_chart_links carries the caption, and each linked image is stamped with it');

if ($CONTROL) ok(false, 'CONTROL: this assertion is false on purpose');
echo "\nPASS: $PASS   FAIL: $FAIL\n";
exit($FAIL === 0 ? 0 : 1);
