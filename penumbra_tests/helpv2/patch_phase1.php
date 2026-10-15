<?php
/**
 * patch_phase1.php - phase 1 content edits on the help/ fragments (byte-safe, CRLF kept).
 *
 *   php patch_phase1.php --stage <stage dir> [--check]
 *
 * What it does (every edit anchors on exact text and is skipped when already applied):
 *   Scheduler book   a second row of jump pills to the four folded topics; ids on their h3s.
 *   Dynamic dates    canonical = Dynamic Values (ids, data-canonical, the one row and phrase only the
 *                    Scheduler copy had are moved in); the Scheduler's duplicate tables -> a pointer.
 *   me() values      canonical = Dynamic Values' section (one fact moved in); the Scheduler's -> a pointer.
 *   Access List      canonical = the Access List fragment (ids, the pill-tooltip bullet moved in);
 *                    Security's six-bullet copy -> two sentences and a link; Dashboards and the
 *                    Scheduler's recipient rules link to it.
 *   Snapshots        the "For Administrators" rotation bullets MOVE into the Scheduler's Take a Snapshot
 *                    section (new anchor); the snapshot topic keeps a pointer.
 *   Shortcuts        canonical = Power Features' Quick-Open table; View Options' copy -> a pointer.
 *   Templates        canonical = Copy with Custom Template; Download and Drop File reference it by link.
 *   Two engines      the SQL and snippet me() key tables and the browser / scheduler search grammars are
 *                    deliberately NOT merged (different code paths); they get canonical keys and links.
 * Markup: a pointer is `<a href="#" data-jump-to="<anchor>" class="help-jump-link" data-canonical-ref="<key>">`,
 * the canonical heading carries `data-canonical="<key>"`; lint L12/L14 check both.
 */
$o = getopt('', array('stage:', 'check'));
if (empty($o['stage'])) { fwrite(STDERR, "usage: --stage <dir> [--check]\n"); exit(2); }
$stage = rtrim($o['stage'], '/\\');
$dir = "$stage/help/topics";
$check = isset($o['check']);
$EOL = "\r\n";
$H4 = 'style="border-bottom: 2px solid #336699; padding-bottom: 6px; margin-bottom: 12px;"';
$files = array(); $log = array();

function f_load($id) { global $files, $dir; if (!isset($files[$id])) { $p = "$dir/$id.php"; $s = file_get_contents($p); if ($s === false) { fwrite(STDERR, "cannot read $p\n"); exit(2); } $files[$id] = array('path' => $p, 's' => $s, 'cr' => substr_count($s, "\r"), 'dirty' => false); } return $files[$id]['s']; }
function f_set($id, $s) { global $files; $files[$id]['s'] = $s; $files[$id]['dirty'] = true; }
function note($m) { global $log; $log[] = $m; echo "  $m\n"; }
function fail($m) { fwrite(STDERR, "FAIL: $m\n"); exit(2); }
function lines($s) { return preg_split('/(?<=\n)/', $s); }
/** Replace an exact substring once (skips when $skipIf is already present). */
function rep($id, $find, $replace, $skipIf = null) {
    $s = f_load($id);
    if ($skipIf !== null && strpos($s, $skipIf) !== false) { note("$id: already has " . substr($skipIf, 0, 40)); return; }
    $n = substr_count($s, $find);
    if ($n !== 1) fail("$id: anchor found $n times: " . substr($find, 0, 70));
    f_set($id, str_replace($find, $replace, $s)); note("$id: replaced " . substr(strip_tags($find), 0, 50));
}
/** Replace the span of LINES from the line containing $start through the first line (after it) matching $endTest. */
function rep_span($id, $start, $endTest, $replacement, array $mustContain, array $mustNotContain, $skipIf, $after = null) {
    $s = f_load($id);
    if (strpos($s, $skipIf) !== false) { note("$id: span already replaced (" . substr($skipIf, 0, 40) . ")"); return; }
    $L = lines($s); $i0 = null; $from = 0;
    if ($after !== null) { $from = null; foreach ($L as $i => $l) if (strpos($l, $after) !== false) { $from = $i; break; } if ($from === null) fail("$id: 'after' marker not found: $after"); }
    for ($i = $from; $i < count($L); $i++) if (strpos($L[$i], $start) !== false) { $i0 = $i; break; }   // first match after the marker
    if ($i0 === null) fail("$id: span start not found: " . substr($start, 0, 60));
    $i1 = null;
    for ($i = $i0; $i < count($L); $i++) { if ($endTest($L[$i], $i, $i0)) { $i1 = $i; break; } }
    if ($i1 === null) fail("$id: span end not found");
    $span = implode('', array_slice($L, $i0, $i1 - $i0 + 1));
    foreach ($mustContain as $m) if (strpos($span, $m) === false) fail("$id: span lacks '$m'");
    foreach ($mustNotContain as $m) if (strpos($span, $m) !== false) fail("$id: span unexpectedly contains '$m'");
    $words = str_word_count(strip_tags($span));
    array_splice($L, $i0, $i1 - $i0 + 1, array($replacement));
    f_set($id, implode('', $L)); note("$id: span of " . ($i1 - $i0 + 1) . " lines ($words words) replaced");
    return $span;
}
/** Insert $text after the first line containing $needle that comes after the line containing $after (or from the top). */
function ins_after($id, $needle, $text, $skipIf, $after = null) {
    $s = f_load($id);
    if (strpos($s, $skipIf) !== false) { note("$id: insert already present (" . substr($skipIf, 0, 40) . ")"); return; }
    $L = lines($s); $from = 0;
    if ($after !== null) { $from = null; foreach ($L as $i => $l) if (strpos($l, $after) !== false) { $from = $i; break; } if ($from === null) fail("$id: 'after' marker not found: $after"); }
    $at = null; for ($i = $from; $i < count($L); $i++) if (strpos($L[$i], $needle) !== false) { $at = $i; break; }
    if ($at === null) fail("$id: insert needle not found: $needle");
    array_splice($L, $at + 1, 0, array($text));
    f_set($id, implode('', $L)); note("$id: inserted after '" . substr(trim($needle), 0, 40) . "'");
}
$endsUl   = function ($l) { return trim($l) === '</ul>'; };
$endsDiv  = function ($l) { return trim($l) === '</div>'; };

// ================================================================ Scheduler book
$pill = function ($anchor, $label) { return '                <a href="#" data-jump-to="' . $anchor . '" class="help-jump-link" style="font-size: 11px; padding: 3px 10px; border-radius: 3px; border: 1px solid #336699; color: #336699; text-decoration: none;">' . $label . '</a>'; };
ins_after('schedulerHelpLightbox', '</div>',
    '            <!-- SETTINGS SHARED BY THE TASK TYPES: topics folded into this one on 2026-10-14 -->' . $EOL
    . '            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">' . $EOL
    . $pill('schedDyn-top', 'Dynamic values') . $EOL
    . $pill('schedCond-top', 'Skip when (conditions)') . $EOL
    . $pill('schedFilter-top', 'Search filter') . $EOL
    . $pill('schedDone-top', 'On completion') . $EOL
    . '            </div>' . $EOL,
    'data-jump-to="schedDyn-top"', 'data-jump-to="schedHelp-dbdump"');
rep('schedOnCompletionHelpLightbox', '<h3>On Completion &ndash; Notifications <span class="help-admin-tag">', '<h3 id="schedDone-top">On Completion &ndash; Notifications <span class="help-admin-tag">', 'id="schedDone-top"');
rep('schedulerPromptHelpLightbox', '<h3>Scheduler Dynamic Values <span class="help-admin-tag">', '<h3 id="schedDyn-top">Scheduler Dynamic Values <span class="help-admin-tag">', 'id="schedDyn-top"');
rep('customConditionHelpLightbox', '<h3 style="margin-bottom: 4px;">Conditional (Skip When) Help <span class="help-admin-tag">', '<h3 id="schedCond-top" style="margin-bottom: 4px;">Conditional (Skip When) Help <span class="help-admin-tag">', 'id="schedCond-top"');
rep('searchFilterHelpLightbox', '<h3 style="margin-bottom: 4px;">Search Filter (scheduler) <span class="help-admin-tag">', '<h3 id="schedFilter-top" style="margin-bottom: 4px;">Search Filter (scheduler) <span class="help-admin-tag">', 'id="schedFilter-top"');

// ================================================================ Dynamic dates
rep('schedulerPromptHelpLightbox', '<h4>📆 Dynamic Dates</h4>', '<h4 id="schedDyn-dates" data-canonical="dynamic-dates">📆 Dynamic Dates</h4>', 'id="schedDyn-dates"');
rep('schedulerPromptHelpLightbox', '<h4>🗣️ Natural Language</h4>', '<h4 id="schedDyn-natural">🗣️ Natural Language</h4>', 'id="schedDyn-natural"');
ins_after('schedulerPromptHelpLightbox', '<code>+1 week 2 days</code>',
    '            <tr><td style="padding:5px; border-bottom:1px solid #eee;"><code>-3 months</code></td><td style="padding:5px; border-bottom:1px solid #eee;"><?php echo strtoupper(date(\'d-M-y\', strtotime(\'-3 months\'))); ?></td></tr>' . $EOL,
    '<code>-3 months</code>');
// the Scheduler copy's offset row named NOW+30 as well; the canonical row named SYSDATE+30 and NOW - 1 only
rep('schedulerPromptHelpLightbox', '(<code>SYSDATE+30</code>, <code>NOW - 1</code> also work)', '(<code>SYSDATE+30</code>, <code>NOW+30</code>, <code>NOW - 1</code> also work)', '<code>NOW+30</code>');
rep('schedulerPromptHelpLightbox', 'the bare form &rarr; just the FY number. <strong>Caveat:</strong>',
    'the bare form &rarr; just the FY number. <code>this</code> / <code>next fiscal year</code> and <code>N fiscal years ago</code> work too. <strong>Caveat:</strong>', 'fiscal years ago</code> work too');
rep_span('schedulerHelpLightbox', '<p>Prompt values support dynamic date keywords that are evaluated at runtime:</p>',
    function ($l) { return strpos($l, '<strong>Caveat:</strong> a <code>type=date</code> prompt expects a date') !== false; },
    '            <p style="font-size: 11px;">Prompt values accept the dynamic date keywords - <code>SYSDATE</code>, <code>NOW</code>, offsets such as <code>SYSDATE-7</code>, natural-language phrases and fiscal years. The full list, with today\'s values, is under <a href="#" data-jump-to="schedDyn-dates" class="help-jump-link" data-canonical-ref="dynamic-dates">Dynamic Dates</a> below.</p>' . $EOL,
    array('$_fyS', 'first day of last fiscal year', '<code>-3 months</code>'), array('<h4'), 'data-canonical-ref="dynamic-dates"');

// ================================================================ me() values
rep('schedulerPromptHelpLightbox', '<h4 id="schedDyn-meValues">', '<h4 id="schedDyn-meValues" data-canonical="me-values">', 'data-canonical="me-values"');
rep('schedulerPromptHelpLightbox', "and the email's parameter pills / <code>data(promptN)</code> show the resolved value.",
    "and the email's parameter pills, the PDF cover line and <code>data(promptN)</code> show the resolved value.", 'the PDF cover line and <code>data(promptN)</code>');
rep_span('schedulerHelpLightbox', "<p>A scheduled run has no signed-in user, so every <code>me(...)</code> in the report's SQL needs a value.", $endsUl,
    '            <p>A scheduled run has no signed-in user, so each <code>me(...)</code> token in the report\'s SQL gets a value on the form (one field per distinct token). What a field accepts, what a blank means and which task types allow a recipient variable: <a href="#" data-jump-to="schedDyn-meValues" class="help-jump-link" data-canonical-ref="me-values">me() Values (identity for scheduled runs)</a> below.</p>' . $EOL,
    array('Recipient variables are refused on Snapshot', 'PDF cover line'), array('<h4'), 'data-canonical-ref="me-values"');

// ================================================================ Access List
rep('accessListHelpLightbox', '<h4 ' . $H4 . '>Accepted Entry Types</h4>', '<h4 id="acl-entries" data-canonical="access-list-entries" ' . $H4 . '>Accepted Entry Types</h4>', 'id="acl-entries"');
rep('accessListHelpLightbox', '<h4 ' . $H4 . '>OUC Prefix Matching</h4>', '<h4 id="acl-ouc" ' . $H4 . '>OUC Prefix Matching</h4>', 'id="acl-ouc"');
rep('accessListHelpLightbox', '<h4 ' . $H4 . '>Autocomplete vs. Manual Entry</h4>', '<h4 id="acl-autocomplete" ' . $H4 . '>Autocomplete vs. Manual Entry</h4>', 'id="acl-autocomplete"');
rep('accessListHelpLightbox', '<h4 ' . $H4 . '>Scheduled Email Authorization</h4>', '<h4 id="acl-scheduled" ' . $H4 . '>Scheduled Email Authorization</h4>', 'id="acl-scheduled"');
rep('accessListHelpLightbox', '<h4 ' . $H4 . '>Notes</h4>', '<h4 id="acl-notes" ' . $H4 . '>Notes</h4>', 'id="acl-notes"');
ins_after('accessListHelpLightbox', '</table>',
    '        <p style="font-size: 11px; margin-bottom: 14px;"><strong>Hover any pill for details:</strong> person pills show the directory record (name, Unity ID, OUC, department - the same tooltip as the email recipients list), OUC pills show what the code means - the college/unit name, how many directory departments fall under the prefix, and a few examples - and <code>public</code> / <code>adminonly</code> pills explain the access rule they set, so you can tell at a glance who an entry actually lets in.</p>' . $EOL,
    'Hover any pill for details', 'id="acl-entries"');
rep_span('saveSecurityHelpLightbox', '<h4 ' . $H4 . '>Access List (Shibboleth)</h4>', $endsUl,
    '        <h4 id="sec-access-list" ' . $H4 . '>Access List (Shibboleth)</h4>' . $EOL
    . '        <p style="font-size: 11px; margin-bottom: 8px;">' . $EOL
    . '            Decides who can open the report in the browser and who may receive its scheduled emails. Authentication is NC State Shibboleth, and administrators can always open every report.' . $EOL
    . '        </p>' . $EOL
    . '        <p style="font-size: 11px; margin-bottom: 14px;">' . $EOL
    . '            The entry types (Unity IDs, campus and external emails, 2, 4 and 6-digit OUCs, <code>public</code>, <code>adminonly</code>), prefix matching and the pill tooltips are described once, under <a href="#" data-jump-to="acl-entries" class="help-jump-link" data-canonical-ref="access-list-entries">Access List</a> below.' . $EOL
    . '        </p>' . $EOL,
    array('Hover any pill for details', 'adminonly', 'OUC-based entries use hierarchical prefix matching'), array('IP Address List'), 'data-canonical-ref="access-list-entries"');
// Dashboards + Scheduler recipients link to the canonical entry types.
$dash = f_load('dashboardsHelpLightbox');
if (strpos($dash, 'data-canonical-ref="access-list-entries"') === false) {
    $hit = null; foreach (array("the same entries as a report's Access List:", 'the same entries as a report&rsquo;s Access List:') as $v) if (substr_count($dash, $v) === 1) $hit = $v;
    if ($hit === null) fail('dashboardsHelpLightbox: access-list phrase not found once');
    rep('dashboardsHelpLightbox', $hit, str_replace('Access List:', '<a href="#" data-jump-to="acl-entries" class="help-jump-link" data-canonical-ref="access-list-entries">Access List</a>:', $hit));
}
rep('schedulerHelpLightbox', "<p>Before sending, the scheduler validates every recipient against the report's <strong>Access List</strong> (set in the Save dialog). The rules are:</p>",
    "<p>Before sending, the scheduler validates every recipient against the report's <a href=\"#\" data-jump-to=\"acl-scheduled\" class=\"help-jump-link\" data-canonical-ref=\"access-list-entries\">Access List</a> (set in the Save dialog). The rules are:</p>", 'data-jump-to="acl-scheduled"');

// ================================================================ Snapshots -> Scheduler (move)
$snap = f_load('snapshotsHelpLightbox');
if (strpos($snap, 'data-canonical-ref="scheduled-snapshots"') === false) {
    $L = lines($snap); $li = null;
    foreach ($L as $i => $l) if (strpos($l, 'Scheduler-created snapshots show a machine creator instead of a person') !== false) { $li = $i; break; }
    if ($li === null) fail('snapshots: rotation bullet not found');
    $u0 = $li; while ($u0 > 0 && strpos($L[$u0], '<ul') === false) $u0--;
    $u1 = $li; while ($u1 < count($L) && trim($L[$u1]) !== '</ul>') $u1++;
    if (strpos($L[$u0], '<ul') === false || trim($L[$u1]) !== '</ul>' || $u1 - $u0 > 8) fail('snapshots: ul bounds unexpected');
    $ul = array_slice($L, $u0, $u1 - $u0 + 1);
    $ulTxt = implode('', $ul);
    if (strpos($ulTxt, 'Max snapshots to keep') === false || strpos($ulTxt, 'Skip-if-no-changes') === false) fail('snapshots: ul content unexpected');
    array_splice($L, $u0, $u1 - $u0 + 1, array(
        '        <p style="font-size: 11px; margin-bottom: 10px;">What a Snapshot task names its snapshots, who they show as the creator (<code>SCHEDULER</code>), how the rotation limit works and which snapshots it never touches: <a href="#" data-jump-to="schedHelp-snapshotPool" class="help-jump-link" data-canonical-ref="scheduled-snapshots">Take a Snapshot: creators and rotation</a> in the Scheduler topic.</p>' . $EOL));
    f_set('snapshotsHelpLightbox', implode('', $L)); note('snapshotsHelpLightbox: rotation bullets (' . str_word_count(strip_tags($ulTxt)) . ' words) replaced by a pointer');
    // re-indent the moved list for its new home and insert it after the "Two snapshot roles" box
    $moved = array(); foreach ($ul as $l) $moved[] = '    ' . $l;
    ins_after('schedulerHelpLightbox', '</div>',
        '            <h4 id="schedHelp-snapshotPool" data-canonical="scheduled-snapshots">Creators and Rotation</h4>' . $EOL
        . '            <p style="font-size: 11px;">What the scheduler writes into the snapshot list, and how its rotation keeps the pool bounded:</p>' . $EOL
        . implode('', $moved),
        'id="schedHelp-snapshotPool"', '<strong>Two snapshot roles, one pool:</strong>');
} else { note('snapshotsHelpLightbox: already a pointer'); }
rep('schedulerHelpLightbox', '<h4 ' . $H4 . '>Take a Snapshot</h4>', '<h4 id="schedHelp-snapshotHead" ' . $H4 . '>Take a Snapshot</h4>', 'id="schedHelp-snapshotHead"');

// ================================================================ Shortcuts
rep_span('viewoptionsHelpLightbox', '<div style="margin: 6px 0; font-size: 11px;">', $endsDiv,
    '        <p style="font-size: 11px;">The shortcuts are listed once, with their single-key twins, under <a href="#" data-jump-to="pf-themes" class="help-jump-link" data-canonical-ref="quick-open-shortcuts">Quick-Open Shortcuts</a> (Power Features &amp; URL Parameters).</p>' . $EOL,
    array('Ctrl+Shift+Y', 'Ctrl+Shift+P'), array('<h4', '<kbd style="background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 3px; font-size: 10px;">Alt+Page Up</kbd>'), 'data-canonical-ref="quick-open-shortcuts"',
    'id="vo-hotkeys"');
rep('powerFeaturesHelpLightbox', '<h4 id="pf-themes" style=', '<h4 id="pf-themes" data-canonical="quick-open-shortcuts" style=', 'data-canonical="quick-open-shortcuts"');

// ================================================================ Two engines: keys + links, no merge
rep('sqlHelpLightbox', '<h4 id="uservars" style="margin-bottom: 2px;">', '<h4 id="uservars" data-canonical="me-keys-sql" style="margin-bottom: 2px;">', 'data-canonical="me-keys-sql"');
rep('sqlHelpLightbox', "set each me() value in the task's <em>me() Values</em> section (Scheduler tab)",
    "set each me() value in the task's <a href=\"#\" data-jump-to=\"schedDyn-meValues\" class=\"help-jump-link\" data-canonical-ref=\"me-values\">me() Values</a> section (Scheduler tab)", 'data-canonical-ref="me-values"');
rep('optionsHelpLightbox', '<h4 id="me" style="margin-bottom: 2px;">', '<h4 id="me" data-canonical="me-keys-snippet" style="margin-bottom: 2px;">', 'data-canonical="me-keys-snippet"');
rep('searchHelpLightbox', '<h4 id="search-syntax" style=', '<h4 id="search-syntax" data-canonical="search-syntax" style=', 'data-canonical="search-syntax"');
rep('searchFilterHelpLightbox', '<h4 ' . $H4 . '>Syntax Reference</h4>',
    '<h4 id="schedFilter-syntax" data-canonical="scheduler-filter-syntax" ' . $H4 . '>Syntax Reference</h4>' . $EOL
    . '        <p style="font-size: 11px; margin-top: 0;">The same grammar as the report search box (<a href="#" data-jump-to="search-syntax" class="help-jump-link" data-canonical-ref="search-syntax">Advanced Search: Syntax Reference</a>), evaluated by the scheduler; the notes above say what it does differently (dates, per-recipient tokens, pivot aggregates).</p>',
    'id="schedFilter-syntax"');

// ================================================================ Templates
rep('copyHelpLightbox', '<h4 ' . $H4 . '>Copy with Custom Template</h4>', '<h4 id="copy-template" data-canonical="template-placeholders" ' . $H4 . '>Copy with Custom Template</h4>', 'id="copy-template"');
rep('downloadHelpLightbox', '<h4 ' . $H4 . '>Download with Custom Template</h4>', '<h4 id="dl-template" ' . $H4 . '>Download with Custom Template</h4>', 'id="dl-template"');
rep('downloadHelpLightbox', 'so the placeholder and <code>string()</code> syntax documented under <strong>Copy Options</strong> applies here verbatim.',
    'so the placeholder and <code>string()</code> syntax documented under <a href="#" data-jump-to="copy-template" class="help-jump-link" data-canonical-ref="template-placeholders">Copy with Custom Template</a> applies here verbatim.', 'data-canonical-ref="template-placeholders"');
rep('schedulerHelpLightbox', '(see <strong>Download with Custom Template</strong> and <strong>Copy with Custom Template</strong> for the full syntax and worked examples)',
    '(see <a href="#" data-jump-to="dl-template" class="help-jump-link">Download with Custom Template</a> and <a href="#" data-jump-to="copy-template" class="help-jump-link" data-canonical-ref="template-placeholders">Copy with Custom Template</a> for the full syntax and worked examples)', 'data-jump-to="dl-template"');

// ================================================================ write
$written = 0;
foreach ($files as $id => $f) {
    if (!$f['dirty']) continue;
    $cr = substr_count($f['s'], "\r"); $lf = substr_count($f['s'], "\n");
    if ($cr !== $lf) fail("$id: CR/LF mismatch after edit ($cr/$lf)");
    if (!$check) { if (file_put_contents($f['path'], $f['s']) === false) fail("cannot write {$f['path']}"); }
    $written++;
    printf("  %-34s CR %6d -> %6d%s\n", $id, $f['cr'], $cr, $check ? '  (check only)' : '');
}
echo ($check ? 'would write ' : 'wrote ') . "$written fragment files\n";
