<?php
/**
 * snippets_import.php - ONE-OFF importer (phase 4, 2026-10-15): builds the FIRST help/snippets.php registry
 * from the v1 Custom Code topic (help/topics/optionsHelpLightbox.php as cut in phase 0), so that no sentence
 * and no code example is retyped. After this run the registry is edited by hand and the topic is GENERATED
 * from it (tests/gen_snippets_help.php); this script is kept only as the record of how the registry began.
 *
 *   php -n snippets_import.php --src <optionsHelpLightbox.php> --out <help/snippets.php>
 *
 * What it takes from the v1 fragment, per function heading (<h4 id="name">):
 *   - the badge text after the heading            -> 'where'   (browser+email | browser | exports | admin | styling)
 *   - the first paragraph (when 60 words or less) -> 'summary' (otherwise its first sentence; the paragraph stays)
 *   - the rest of the section, to the next <h4>   -> 'body'    (cleaned: em-dashes and double hyphens outside
 *                                                    code/pre become " - ", emoji entities leave headings and
 *                                                    labels, th/td get the inline cell style, long space-free
 *                                                    <code> gets overflow-wrap, HTML comments are dropped)
 *   - the category                                 -> from the sticky header's index table (the curated order)
 *   - the signature                                -> the editor's hover cards (js/penumbra_snippet_help.js,
 *                                                    copied below on 2026-10-15; vis() from ai_system_prompt.php)
 *   - 'params'                                     -> EMPTY: written by hand afterwards (the generator refuses a
 *                                                    parameter without an example)
 */
$o = getopt('', array('src:', 'out:'));
if (empty($o['src']) || empty($o['out'])) { fwrite(STDERR, "usage: --src <optionsHelpLightbox.php> --out <help/snippets.php>\n"); exit(2); }
$src = file_get_contents($o['src']);
if ($src === false) { fwrite(STDERR, "cannot read {$o['src']}\n"); exit(2); }
$src = str_replace("\r\n", "\n", $src);

// ------------------------------------------------------------------ signatures (hover cards, 2026-10-15)
$SIG = array(
    'data' => 'data(KEY, ARG?, VISIBILITY?)', 'me' => 'me(ATTRIBUTE?)', 'now' => 'now(FORMAT?, OFFSET...)',
    'case' => 'case(COND, VAL, [COND2, VAL2, ...], DEFAULT)', 'lookup' => 'lookup(RETURN_COL, CONDITION)',
    'calc' => 'calc(EXPRESSION)', 'round' => 'round(VALUE, DECIMALS?)', 'fixed' => 'fixed(VALUE, DECIMALS?)',
    'mathhelpers' => 'abs(VALUE) / floor(VALUE) / ceil(VALUE) / mod(VALUE, DIVISOR)',
    'count' => 'count(CONDITION?, SCOPE?)', 'sum' => 'sum(COLUMN, CONDITION?, all?)', 'avg' => 'avg(COLUMN, CONDITION?, all?)',
    'min' => 'min(COLUMN, CONDITION?, all?)', 'max' => 'max(COLUMN, CONDITION?, all?)', 'median' => 'median(COLUMN, CONDITION?, all?)',
    'mode' => 'mode(COLUMN, CONDITION?, all?)', 'distinct' => 'distinct(COLUMN, CONDITION?, all?)',
    'rank' => 'rank(N, COLUMN, CONDITION?)', 'percentile' => 'percentile(N, COLUMN, CONDITION?, all?)',
    'stddev' => 'stddev(COLUMN, CONDITION?, all?)', 'string' => 'string(OPERATION, TEXT, ARGS...)',
    'date_format' => 'date_format(SUBJECT, FORMAT?, OFFSET...?)', 'date_diff' => 'date_diff(END, START, UNITS...)',
    'format' => 'format(TARGET, COL?, CONDITION?, STYLE)', 'heatmap' => 'heatmap(TARGET, COLUMNS?, key=value...)',
    'rewrite' => 'rewrite(COLUMN, CONDITION?, TEMPLATE)', 'layout_switch' => "layout_switch('Label|TRIGGER', 'Label|TRIGGER', ...)",
    'toggle_switch' => "toggle_switch('LABEL', 'on|COMMAND', 'off|COMMAND')",
    'filter_strip' => "filter_strip('LABEL|COLUMN', 'LABEL|COLUMN|exclude', ...)",
    'progress_bar' => 'progress_bar(VALUE, MAX, COLOR?)', 'sparkline' => 'sparkline(COLUMN, GROUPCOL?, COLOR?)',
    'sparkline_cell' => 'sparkline_cell(TARGET_COLUMN, COL1|COL2|COL3, COLOR?)', 'action' => 'action(TYPE, ...)',
    'chain' => "chain('Label', 'command1', 'command2', ...)",
    'vis' => 'vis(type, xAxis, yAxis, groupBy, agg, limit, title, legend, values, width, height, legendPos, valuePos, animate, stacked, horizontal, titlePos, sortBy, ...)',
    'slide' => 'slide(CONTENT, INLINE?)', 'web' => 'web(CONTENT)', 'noweb' => 'noweb(CONTENT)', 'info' => 'info(SECTION?)',
);
$NAMES = array('mathhelpers' => array('abs', 'floor', 'ceil', 'mod'));
$CATKEY = array('Aggregation' => 'aggregation', 'Data &amp; Identity' => 'identity', 'Math' => 'math', 'Date' => 'date',
    'Text &amp; Lookup' => 'text', 'Logic' => 'logic', 'Formatting' => 'formatting', 'Interactive' => 'interactive');
$CATTITLE = array('interactive' => 'Interactive', 'aggregation' => 'Aggregation', 'math' => 'Math', 'logic' => 'Logic',
    'identity' => 'Data and Identity', 'date' => 'Date', 'text' => 'Text and Lookup', 'formatting' => 'Formatting',
    'components' => 'Components');
$WHERE = array('Browser + Email' => 'browser+email', 'Browser Only' => 'browser', 'Exports Only' => 'exports',
    'Admins Only' => 'admin', 'Browser styling' => 'styling');

// ------------------------------------------------------------------ cleaning helpers
function clean_outside_code($html, $fn) {
    $parts = preg_split('#(<pre\b.*?</pre>|<code\b.*?</code>|<kbd\b.*?</kbd>)#s', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
    foreach ($parts as $i => $p) { if ($i % 2 === 0) $parts[$i] = $fn($p); }
    return implode('', $parts);
}
function sweep_dashes($html) {
    return clean_outside_code($html, function ($t) {
        $t = preg_replace('/\s*(?:&mdash;|&#8212;|\x{2014})\s*/u', ' - ', $t);
        $t = preg_replace('/(?<=\S)\s+--\s+(?=\S)/', ' - ', $t);
        return $t;
    });
}
function strip_emoji($html) {
    // True emoji (U+1F000 and up) leave everything; the dingbat range (U+2600-27BF) leaves headings and labels only.
    $html = preg_replace('/&#(1[0-9]{5}|12[0-9]{4});\s*/', '', $html);
    $html = preg_replace('/[\x{1F000}-\x{1FAFF}]\s*/u', '', $html);
    $html = preg_replace_callback('#(<(?:h[3-5]|strong|summary)\b[^>]*>)(.*?)(</(?:h[3-5]|strong|summary)>)#s', function ($m) {
        $t = preg_replace('/&#(9[6-9][0-9]{2}|10[0-1][0-9]{2});\s*/', '', $m[2]);   // 9600-10175 = U+2580-27BF
        $t = preg_replace('/[\x{2600}-\x{27BF}]\s*/u', '', $t);
        return $m[1] . $t . $m[3];
    }, $html);
    return $html;
}
function cell_style($html) {
    $th = 'padding: 5px; border-bottom: 1px solid #ccc; text-align: left; white-space: normal; max-width: none;';
    $td = 'padding: 5px; border-bottom: 1px solid #eee; vertical-align: top; white-space: normal; max-width: none;';
    return preg_replace_callback('#<(td|th)\b([^>]*)>#', function ($m) use ($th, $td) {
        $attrs = $m[2];
        if (preg_match('/\sstyle="([^"]*)"/', $attrs, $s)) {
            $style = rtrim($s[1]);
            if (strpos($style, 'white-space') === false) $style = rtrim($style, '; ') . '; white-space: normal; max-width: none;';
            $attrs = str_replace($s[0], ' style="' . $style . '"', $attrs);
        } else {
            $attrs .= ' style="' . ($m[1] === 'th' ? $th : $td) . '"';
        }
        return '<' . $m[1] . $attrs . '>';
    }, $html);
}
function wrap_long_code($html) {
    return preg_replace_callback('#<code>([^<]*)</code>#', function ($m) {
        $longest = 0;
        foreach (preg_split('/\s+/', html_entity_decode($m[1], ENT_QUOTES, 'UTF-8')) as $w) $longest = max($longest, strlen($w));
        return $longest >= 50 ? '<code style="overflow-wrap: anywhere;">' . $m[1] . '</code>' : $m[0];
    }, $html);
}
function strip_comments($html) {
    return preg_replace('/\s*<!--.*?-->/s', '', $html);
}
function clean($html) {
    $html = strip_comments($html);
    $html = sweep_dashes($html);
    $html = strip_emoji($html);
    $html = cell_style($html);
    $html = wrap_long_code($html);
    // the v1 category-free spacer: a bare <hr> between sections
    $html = preg_replace('/\n\s*<hr>\s*\n/', "\n", $html);
    return trim($html, "\n");
}
function words($html) { $t = html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8'); return preg_match_all('/\S+/', $t); }
function dedent($html) {
    $lines = explode("\n", $html);
    $min = PHP_INT_MAX;
    foreach ($lines as $l) { if (trim($l) === '') continue; $min = min($min, strlen($l) - strlen(ltrim($l, ' '))); }
    if ($min === PHP_INT_MAX) $min = 0;
    foreach ($lines as &$l) { $l = (strlen($l) >= $min) ? substr($l, $min) : ltrim($l, ' '); }
    return implode("\n", $lines);
}

// ------------------------------------------------------------------ the index table -> categories + order
$order = array(); $cat = array();
if (preg_match('#CATEGORIZED FUNCTION INDEX.*?<table.*?</table>#s', $src, $tm)) {
    if (preg_match_all('#<td[^>]*>(.*?)</td>#s', $tm[0], $tds)) {
        foreach ($tds[1] as $td) {
            if (!preg_match('#<span[^>]*>\s*(?:&\#\d+;\s*)?([^<]+?)\s*</span>#', $td, $sm)) continue;
            $label = trim($sm[1]);
            $key = isset($CATKEY[$label]) ? $CATKEY[$label] : strtolower(preg_replace('/\W+/', '', $label));
            if (preg_match_all('/data-jump-to="([a-z_]+)"/', $td, $am)) {
                foreach ($am[1] as $id) { if (!isset($cat[$id])) { $cat[$id] = $key; $order[] = $id; } }
            }
        }
    }
}

// ------------------------------------------------------------------ sections
$pos = array();
if (preg_match_all('/<h4\b[^>]*>/', $src, $hm, PREG_OFFSET_CAPTURE)) foreach ($hm[0] as $h) $pos[] = $h[1];
$end = strlen($src);
if (preg_match('#\n\s*</div>\s*</div>\s*$#', $src, $em, PREG_OFFSET_CAPTURE)) $end = $em[0][1];

$intro = ''; $functions = array(); $badgeStyle = array();
for ($i = 0; $i < count($pos); $i++) {
    $start = $pos[$i];
    $next = ($i + 1 < count($pos)) ? $pos[$i + 1] : $end;
    $chunk = substr($src, $start, $next - $start);
    if (!preg_match('/^<h4\b([^>]*)>(.*?)<\/h4>/s', $chunk, $h)) continue;
    $attrs = $h[1]; $heading = $h[2];
    $rest = substr($chunk, strlen($h[0]));
    if (!preg_match('/id="([a-z_-]+)"/', $attrs, $idm)) continue;      // a category heading: no id
    $id = $idm[1];
    if ($id === 'snippet-getting-started') { $intro = clean($rest); continue; }
    $where = 'browser+email'; $badge = '';
    if (preg_match('#<span([^>]*)>([^<]*)</span>#', $heading, $bm)) {
        $badge = trim($bm[2]);
        if (isset($WHERE[$badge])) $where = $WHERE[$badge];
        if (preg_match('/style="([^"]*)"/', $bm[1], $st)) $badgeStyle[$where] = array('label' => $badge, 'style' => $st[1]);
    }
    $canonical = preg_match('/data-canonical="([^"]+)"/', $attrs, $cm) ? $cm[1] : null;
    $title = trim(preg_replace('/<span.*$/s', '', $heading));
    $summary = ''; $body = $rest;
    if (preg_match('/^\s*<p\b[^>]*>(.*?)<\/p>/s', $rest, $pm)) {
        $first = trim(preg_replace('/\s+/', ' ', $pm[1]));
        if (words($first) <= 60) { $summary = $first; $body = substr($rest, strlen($pm[0])); }
        else { $summary = preg_match('/^(.*?[.!?])(\s|$)/s', $first, $fs) ? $fs[1] : $first; }
    }
    $functions[$id] = array(
        'title' => html_entity_decode(strip_tags($title), ENT_QUOTES, 'UTF-8'),
        'names' => isset($NAMES[$id]) ? $NAMES[$id] : array($id),
        'signature' => isset($SIG[$id]) ? $SIG[$id] : null,
        'category' => in_array($id, array('stat_cards', 'breakdown_cards')) ? 'components' : (isset($cat[$id]) ? $cat[$id] : 'formatting'),
        'where' => $where,
        'canonical' => $canonical,
        'summary' => sweep_dashes(strip_emoji($summary)),
        'params' => array(),
        'body' => dedent(clean($body)),
        'related' => array(),
    );
    if (!isset($cat[$id])) $order[] = $id;
}
// functions in index order, components last
usort($order, function ($a, $b) use ($functions) {
    $ca = $functions[$a]['category'] === 'components' ? 1 : 0; $cb = $functions[$b]['category'] === 'components' ? 1 : 0;
    return $ca <=> $cb;
});
$ordered = array();
foreach ($order as $id) if (isset($functions[$id])) $ordered[$id] = $functions[$id];
foreach ($functions as $id => $f) if (!isset($ordered[$id])) $ordered[$id] = $f;

// ------------------------------------------------------------------ write the registry
function php_str($s) { return var_export($s, true); }
function php_heredoc($s, $indent) {
    // <<<'PNBHTML' ... PNBHTML; the closing marker's indentation is stripped from every line (PHP 7.3+)
    $lines = explode("\n", $s);
    foreach ($lines as &$l) { $l = ($l === '') ? '' : str_repeat(' ', $indent) . $l; }
    return "<<<'PNBHTML'\n" . implode("\n", $lines) . "\n" . str_repeat(' ', $indent) . "PNBHTML";
}
$out = "<?php\n";
$out .= "// help/snippets.php - THE Custom Code reference (Help Center v2, phase 4, 2026-10-15): one structured source for\n";
$out .= "// every snippet function and component. help/topics/optionsHelpLightbox.php is GENERATED from this file by\n";
$out .= "// tests/gen_snippets_help.php (lint L17 fails while the topic is stale), so this is the only file to edit.\n";
$out .= "// Per function: 'signature' (as the editor's hover card shows it), 'names' (the editor's function names it\n";
$out .= "// covers), 'category', 'where' (browser+email | browser | exports | admin | styling), 'summary' (one short\n";
$out .= "// paragraph), 'params' (one row per parameter: name, required, meaning, example - the generator refuses a row\n";
$out .= "// without an example), 'body' (the longer reference: examples, notes, tables; inline HTML to the tier standard),\n";
$out .= "// 'related' (anchor ids), 'canonical' (a data-canonical key for the heading, or null).\n";
$out .= "// First built by tests/snippets_import.php from the v1 topic so that no example was retyped.\n";
$out .= "// Served only through the generator and help/loader.php (the Help Center fetches help_content.php).\n";
$out .= "if (!defined('PNB_HELP_V2')) { http_response_code(404); exit; }\n";
$out .= "return array(\n";
$out .= "    'intro' => array(\n";
$out .= "        'what' => 'The custom code editor lets you write dynamic snippet panels that appear alongside your report data: text, HTML and the functions below, which read the rows the viewer is looking at.',\n";
$out .= "        'open' => 'the <strong>Custom Code</strong> tab of the editor console (<kbd>F8</kbd> cycles to it) and the <strong>?</strong> on that tab; <kbd>Ctrl+Space</kbd> in the editor lists the functions, and the helper panel beside it inserts templates.',\n";
$out .= "        'getting_started' => " . php_heredoc($intro, 8) . ",\n";
$out .= "    ),\n";
$out .= "    'badges' => array(\n";
foreach ($badgeStyle as $k => $b) $out .= "        " . php_str($k) . " => array('label' => " . php_str($b['label']) . ", 'style' => " . php_str($b['style']) . "),\n";
$out .= "    ),\n";
$out .= "    'categories' => array(\n";
foreach ($CATTITLE as $k => $t) $out .= "        " . php_str($k) . " => " . php_str($t) . ",\n";
$out .= "    ),\n";
$out .= "    'functions' => array(\n";
foreach ($ordered as $id => $f) {
    $out .= "        " . php_str($id) . " => array(\n";
    $out .= "            'title' => " . php_str($f['title']) . ",\n";
    $out .= "            'names' => array(" . implode(', ', array_map('php_str', $f['names'])) . "),\n";
    $out .= "            'signature' => " . php_str($f['signature']) . ",\n";
    $out .= "            'category' => " . php_str($f['category']) . ",\n";
    $out .= "            'where' => " . php_str($f['where']) . ",\n";
    $out .= "            'canonical' => " . php_str($f['canonical']) . ",\n";
    $out .= "            'summary' => " . php_str($f['summary']) . ",\n";
    $out .= "            'params' => array( // @params $id\n            ),\n";
    $out .= "            'body' => " . php_heredoc($f['body'], 12) . ",\n";
    $out .= "            'related' => array(),\n";
    $out .= "        ),\n";
}
$out .= "    ),\n";
$out .= ");\n";
file_put_contents($o['out'], $out);
printf("registry written: %d functions, intro %d words; %s\n", count($ordered), words($intro), $o['out']);
foreach ($ordered as $id => $f) printf("  %-16s %-13s %-14s sig=%s summary=%d body=%d words\n", $id, $f['category'], $f['where'], $f['signature'] ? 'y' : '-', words($f['summary']), words($f['body']));
