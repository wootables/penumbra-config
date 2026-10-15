<?php
/**
 * readme_row.php - stage the README.md row for the Help Center v2 tree.
 *
 *   php readme_row.php --stage <stage dir>
 *
 * Inserts one row into section 2's "Area | Files" table, right before the
 * "| Preset engine |" row, keeping the file's own line endings. Idempotent.
 */
$opts = getopt('', array('stage:'));
if (empty($opts['stage'])) { fwrite(STDERR, "usage: --stage <dir>\n"); exit(2); }
$path = rtrim($opts['stage'], '/\\') . '/README.md';
$s = file_get_contents($path);
if ($s === false) { fwrite(STDERR, "cannot read $path\n"); exit(2); }
$eol = (strpos($s, "\r\n") !== false) ? "\r\n" : "\n";
$row = '| Help Center v2 (staged 2026-10-15, phases 0-2) | `help/manifest.php` - the switch (`help/v2.on` marker, admin preview cookie `pnb_help_v2` via `help_content.php?helpv2=1`), the audience gate (`pnb_help_show()`: viewer / writer / admin; built, OFF until a `help/gate.on` marker or `PNB_HELP_GATE`), and the registry (categories a reader arrives with; per topic id, title, audience, aliases, keywords, `extra` = fragments folded into the topic: the Scheduler shows Dynamic Values, Skip When, Search Filter and On Completion as one book, Security shows the Access List); `help/loader.php` assembles `help/topics/<id>.php` (32: the SQL Editor split into SQL Editor, Query Prompts, Importing External Files, Cross-Database Subqueries) + `help/tips/<id>.php` (5) in manifest order. `help_content.php` and `help_manifest.php` keep their URLs and carry a 4-line shim each that hands over to the fragments while v2 is active, so index.php and the dashboard are unchanged; `js/main.js` gained one behaviour (2026-10-14): a jump link or `?` icon whose anchor lives in another topic activates that topic (`activateHelpTopic` re-resolves the owner; a folded topic opened without an anchor lands on its own start), so cross-references between topics work. Duplicated passages are collapsed to ONE canonical section (`data-canonical="key"` on its heading) and pointers (`data-canonical-ref="key"` on a `data-jump-to` link): dynamic dates, me() values, access-list entries, scheduled-snapshot rotation, quick-open shortcuts, template placeholders. Two engines are deliberately kept apart and cross-linked, not merged: the SQL and snippet `me()` key tables, and the browser vs scheduler search grammars. `help_retrieval.php` builds the AI help chunks from the fragments into `cache/help_chunks_v2.json` (own signature; every chunk carries its audience). Topic ids, anchor ids and `data-tip` keys are a contract (42 `?` icons, `#help=` links, 40+ suites): a renamed topic lists its old id in `aliases`, which ride in `data-extra`. Phase 2 (2026-10-15) rewrote the twelve viewer topics to the tier standard (Search, Grouping, Column Summaries, Pivot, Visualization, Snapshots, Journal, Download, Copy, Email, Settings, Dashboards): one `?` per feature with an "Open it:" line and a jump row, parameter tables with examples, paragraphs under 80 words, no emoji headings, no em-dashes; every code example, key and number of the old text survives (equivalence P9, with deliberate drops listed in `pnb_help_v2_dropped_tokens()`), the Email help\'s stale 2,000-row embed gate became the relay cap (main.js `ROW_EMBED_CEILING` = 25,000 since 2026-08-30) and the theme list gained Monochrome. Table cells carry an inline `white-space: normal` and the topic header a panel-safe sticky style, because the dashboard\'s own help panel strips the `.lightbox-content` wrapper that neutralises main.css\'s report-table rules. Rollback = delete `help/v2.on`. Suite `penumbra_tests\helpv2` (lint L1-L16, equivalence E*/P* incl. P9 fact tokens, retrieval R1-R5, headless jump harness J1-J2, visual harness, coverage map, 13 mutants). |';
if (preg_match('/^\| Help Center v2 [^\n]*\|\r?$/m', $s, $m)) {
    if (trim($m[0]) === $row) { echo "README.md: row already current\n"; exit(0); }
    $s = str_replace($m[0], $row . (substr($m[0], -1) === "\r" ? "\r" : ''), $s);
    file_put_contents($path, $s);
    echo "README.md: row refreshed\n"; exit(0);
}
$anchor = $eol . '| Preset engine | ';
$pos = strpos($s, $anchor);
if ($pos === false || strpos($s, $anchor, $pos + 1) !== false) { fwrite(STDERR, "anchor not found or not unique\n"); exit(2); }
$s = substr($s, 0, $pos) . $eol . $row . substr($s, $pos);
file_put_contents($path, $s);
echo "README.md: row inserted before the Preset engine row (EOL " . ($eol === "\r\n" ? 'CRLF' : 'LF') . ")\n";
