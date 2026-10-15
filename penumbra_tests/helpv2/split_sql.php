<?php
/**
 * split_sql.php - phase 1: the SQL Editor topic becomes four topics.
 *
 *   php split_sql.php --stage <stage dir> [--check]
 *
 * Reads help/topics/sqlHelpLightbox.php (the phase 0 cut) and writes:
 *   sqlHelpLightbox.php         Features & Shortcuts, CLOB columns, User Variables, Special Encodings
 *   promptsHelpLightbox.php     Query Prompts            (NEW topic)
 *   importsHelpLightbox.php     Importing External Files (NEW topic)
 *   subqueriesHelpLightbox.php  Cross-Database Subqueries (NEW topic)
 * Section bodies move verbatim (CRLF kept). The SQL Editor's jump row lists what stayed and
 * links to what moved; each new topic gets the same shell (close button, h3, one-line intro)
 * and keeps its original h4 id, so every existing data-jump-to / openHelpCenter() anchor
 * still resolves (main.js re-resolves the owning topic since the 2026-10-14 patch).
 * Idempotent: refuses to run twice (the new files exist / the markers are gone).
 */
$o = getopt('', array('stage:', 'check'));
if (empty($o['stage'])) { fwrite(STDERR, "usage: --stage <dir> [--check]\n"); exit(2); }
$stage = rtrim($o['stage'], '/\\');
$dir = "$stage/help/topics";
$src = "$dir/sqlHelpLightbox.php";
if (is_file("$dir/promptsHelpLightbox.php")) { echo "already split (promptsHelpLightbox.php exists)\n"; exit(0); }
$raw = file_get_contents($src);
if ($raw === false) { fwrite(STDERR, "cannot read $src\n"); exit(2); }
$eol = "\r\n";
$lines = preg_split('/(?<=\n)/', $raw);

$markers = array(
    'features'   => '<!-- FEATURES & SHORTCUTS -->',
    'subqueries' => '<!-- CROSS-DATABASE SUBQUERIES -->',
    'clob'       => '<!-- CLOB / LARGE TEXT COLUMNS -->',
    'imports'    => '<!-- IMPORTING EXTERNAL FILES -->',
    'prompts'    => '<!-- QUERY PROMPTS -->',
    'uservars'   => '<!-- USER VARIABLES -->',
    'encoding'   => '<!-- SPECIAL ENCODINGS -->',
);
$idx = array();
foreach ($lines as $i => $l) foreach ($markers as $k => $m) if (strpos($l, $m) !== false) { if (isset($idx[$k])) { fwrite(STDERR, "marker $m twice\n"); exit(2); } $idx[$k] = $i; }
foreach ($markers as $k => $m) if (!isset($idx[$k])) { fwrite(STDERR, "marker $m not found\n"); exit(2); }
$order = array('features', 'subqueries', 'clob', 'imports', 'prompts', 'uservars', 'encoding');
for ($i = 1; $i < count($order); $i++) if ($idx[$order[$i]] <= $idx[$order[$i - 1]]) { fwrite(STDERR, "markers out of order\n"); exit(2); }

// The two closing </div> lines of the topic are the last two non-blank lines.
$n = count($lines); $closers = array(); $k = $n - 1;
while ($k >= 0 && count($closers) < 2) { if (trim($lines[$k]) !== '') array_unshift($closers, $k); $k--; }
if (count($closers) !== 2 || trim($lines[$closers[0]]) !== '</div>' || trim($lines[$closers[1]]) !== '</div>') { fwrite(STDERR, "closing divs not where expected\n"); exit(2); }
$bodyEnd = $closers[0]; // exclusive

// Section bodies: from the marker line up to (not including) the next section's separator (hr + blank).
$isSep = function ($l) { $t = trim($l); return $t === '' || strpos($t, '<hr ') === 0 || $t === '<hr>'; };
$sections = array();
for ($i = 0; $i < count($order); $i++) {
    $from = $idx[$order[$i]];
    $to = ($i + 1 < count($order)) ? $idx[$order[$i + 1]] : $bodyEnd;
    while ($to - 1 > $from && $isSep($lines[$to - 1])) $to--;   // drop the trailing separator lines
    $sections[$order[$i]] = array_slice($lines, $from, $to - $from);
}
// Sanity: every section carries its h4 id.
foreach (array('features' => 'features', 'subqueries' => 'subqueries', 'clob' => 'clob-columns', 'imports' => 'imports', 'prompts' => 'prompts', 'uservars' => 'uservars', 'encoding' => 'encoding') as $k => $id) {
    if (strpos(implode('', $sections[$k]), 'id="' . $id . '"') === false) { fwrite(STDERR, "section $k lacks h4 id $id\n"); exit(2); }
}

// The head: everything before the first section (guard header, topic div, sticky header).
$head = array_slice($lines, 0, $idx['features']);
$headTxt = implode('', $head);
// Rewrite the jump row: what stays, then what moved.
$rowStart = strpos($headTxt, '<!-- JUMP INDEX -->');
$rowOpen  = strpos($headTxt, '<div style="display: flex; flex-wrap: wrap; gap: 2px 0; align-items: center;">', $rowStart);
$rowClose = strpos($headTxt, '</div>', $rowOpen);
if ($rowStart === false || $rowOpen === false || $rowClose === false) { fwrite(STDERR, "jump row not found in the head\n"); exit(2); }
$sep = '<span style="opacity: 0.25; margin: 0 4px;">|</span>';
$ind = '                  ';
$newRow = '<div style="display: flex; flex-wrap: wrap; gap: 2px 0; align-items: center;">' . $eol
    . $ind . '<a href="#" data-jump-to="features" class="help-jump-link">Features &amp; Shortcuts</a>' . $sep . $eol
    . $ind . '<a href="#" data-jump-to="clob-columns" class="help-jump-link">CLOB Columns &amp; Speed</a>' . $sep . $eol
    . $ind . '<a href="#" data-jump-to="uservars" class="help-jump-link">User Variables</a>' . $sep . $eol
    . $ind . '<a href="#" data-jump-to="encoding" class="help-jump-link">Special Encodings</a>' . $eol
    . '              </div>' . $eol
    . '              <p style="margin: 6px 0 0; font-size: 11px; opacity: 0.8;">Topics of their own (2026-10-14): '
    . '<a href="#" data-jump-to="prompts" class="help-jump-link">Query Prompts</a>, '
    . '<a href="#" data-jump-to="imports" class="help-jump-link">Importing External Files</a> and '
    . '<a href="#" data-jump-to="subqueries" class="help-jump-link">Cross-Database Subqueries</a>.</p>' . $eol
    . '          ';
$headTxt = substr($headTxt, 0, $rowOpen) . $newRow . substr($headTxt, $rowClose + strlen('</div>'));
// The h3 keeps its title; the one-line intro now describes the editor only.
$headTxt = str_replace(
    '<p style="margin: 0 0 8px; font-size: 11px; opacity: 0.7;">A CodeMirror-based SQL editor with syntax highlighting, autocomplete, and application-specific extensions.</p>',
    '<p style="margin: 0 0 8px; font-size: 11px; opacity: 0.7;">The query editor: shortcuts, autocomplete, the Tag Generator, how to keep large text columns from slowing a report, the <code>me()</code> user variables and the cell encodings (<code>@@HTML</code>, <code>@@JSON</code>, ...).</p>',
    $headTxt, $cnt);
if ($cnt !== 1) { fwrite(STDERR, "intro line not found\n"); exit(2); }
// The header comment names the audience and origin; note the split.
$headTxt = preg_replace('/^(\/\/ help\/topics\/sqlHelpLightbox\.php - Help Center topic \(v2\)\. Audience: writer\.)/m', '$1 Split 2026-10-14 (phase 1): prompts, imports and subqueries are topics of their own.', $headTxt, 1, $cnt);
if ($cnt !== 1) { fwrite(STDERR, "header comment not found\n"); exit(2); }

$hrLine = '          <hr style="margin: 14px 0; border: none; border-top: 1px solid rgba(0,0,0,0.08);">' . $eol . $eol;
$sql = $headTxt
    . implode('', $sections['features']) . $eol . $hrLine
    . implode('', $sections['clob'])     . $eol . $hrLine
    . implode('', $sections['uservars']) . $eol . $hrLine
    . implode('', $sections['encoding']) . $eol
    . implode('', array_slice($lines, $closers[0]));

function shell($id, $title, $intro, array $body, $srcLines) {
    $eol = "\r\n";
    $h = '<?php' . $eol
        . "// help/topics/$id.php - Help Center topic (v2). Audience: writer." . $eol
        . "// Split out of the SQL Editor topic on 2026-10-14 (phase 1), source lines $srcLines of help_content.php; body verbatim." . $eol
        . '// Served only through help/loader.php (the Help Center fetches help_content.php).' . $eol
        . "if (!defined('PNB_HELP_V2')) { http_response_code(404); exit; }" . $eol
        . '?>' . $eol
        . '<div id="' . $id . '" class="help-topic" data-audience="writer">' . $eol
        . '    <div class="lightbox-content" style="width: 70%; max-width: 900px; font-size: 12px; line-height: 1.55;">' . $eol
        . '        <button type="button" class="close-lightbox" aria-label="Close" title="Close (Esc)">&times;</button>' . $eol
        . '        <h3 style="margin: 0 0 4px;">' . $title . ' <span class="help-admin-tag">(for report writers and administrators only)</span></h3>' . $eol
        . '        <p style="margin: 0 0 8px; font-size: 11px; opacity: 0.7;">' . $intro . '</p>' . $eol
        . $eol
        . implode('', $body) . $eol
        . '    </div>' . $eol
        . '</div>' . $eol;
    return $h;
}
$out = array(
    "$dir/sqlHelpLightbox.php" => $sql,
    "$dir/promptsHelpLightbox.php" => shell('promptsHelpLightbox', 'Query Prompts',
        'Ask the person running the report for a value before the query runs: a date, a pick list, yes or no, free text. A prompt is a tag written into the SQL; the Tag Generator on the editor toolbar writes it for you.',
        $sections['prompts'], '1095-1496'),
    "$dir/importsHelpLightbox.php" => shell('importsHelpLightbox', 'Importing External Files',
        'Upload a CSV, Excel or JSON file once and query it like a table, on its own or joined to live data. Imports are stored on the server and stay available across sessions.',
        $sections['imports'], '799-1093'),
    "$dir/subqueriesHelpLightbox.php" => shell('subqueriesHelpLightbox', 'Cross-Database Subqueries',
        'Run a query against one database and use its result inside a query against another: <code>[SUBQUERY]</code> for an IN list, <code>[CTE_SUBQUERY]</code> for a table you can join.',
        $sections['subqueries'], '703-767'),
);
$wordsBefore = str_word_count(strip_tags($raw));
$wordsAfter = 0; foreach ($out as $t) $wordsAfter += str_word_count(strip_tags($t));
if (isset($o['check'])) { printf("would write 4 files; words %d -> %d\n", $wordsBefore, $wordsAfter); exit(0); }
foreach ($out as $p => $t) { if (file_put_contents($p, $t) === false) { fwrite(STDERR, "cannot write $p\n"); exit(2); } printf("  %-60s %7d bytes  CR=%d LF=%d\n", basename($p), strlen($t), substr_count($t, "\r"), substr_count($t, "\n")); }
printf("split done; words %d -> %d (new shells only)\n", $wordsBefore, $wordsAfter);
