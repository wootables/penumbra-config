<?php
/**
 * gen_snippets_help.php - render help/topics/optionsHelpLightbox.php from help/snippets.php (phase 4, 2026-10-15).
 *
 *   php -n gen_snippets_help.php --app <stage or live dir> [--check]
 *
 * The registry is the ONE source for the Custom Code reference: edit it, run this, commit both. The generated
 * topic carries the registry's sha256 in its header and lint L17 compares them, so a stale topic is a red check.
 * --check renders in memory, prints FRESH or STALE and exits 1 when stale (writes nothing).
 *
 * Refuses (exit 2, writes nothing): a function without a signature (components excepted), a parameter row
 * without an example or a meaning, an em-dash anywhere in the registry text, a duplicate anchor id, a category
 * the registry does not list, a 'related' id that is not a function.
 *
 * What it renders, in the tier standard: the panel-safe sticky header (title, what/when + "Open it:", a jump row
 * per category), Getting Started, then one section per category and one subsection per function: heading with
 * the availability badge (and the canonical key where the registry gives one), summary, the signature, the
 * parameter table (Parameter | Required | Meaning | Example), the body, and "See also" links.
 */
$o = getopt('', array('app:', 'check'));
if (empty($o['app'])) { fwrite(STDERR, "usage: --app <dir> [--check]\n"); exit(2); }
$app = rtrim(str_replace('\\', '/', $o['app']), '/');
$regPath = $app . '/help/snippets.php';
$outPath = $app . '/help/topics/optionsHelpLightbox.php';
if (!is_file($regPath)) { fwrite(STDERR, "no registry at $regPath\n"); exit(2); }
if (!defined('PNB_HELP_V2')) define('PNB_HELP_V2', 2);
$R = require $regPath;
$regSha = hash('sha256', file_get_contents($regPath));

// ------------------------------------------------------------------ style tokens (the tier standard)
$STY = array(
    'h4' => 'border-bottom: 2px solid var(--brand-primary, #336699); padding-bottom: 6px; margin: 18px 0 10px;',
    'h4fn' => 'margin: 18px 0 6px; font-size: 12px;',
    'p' => 'font-size: 11px; margin: 0 0 8px;',
    'table' => 'width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;',
    'th' => 'padding: 5px; border-bottom: 1px solid #ccc; text-align: left; white-space: normal; max-width: none;',
    'td' => 'padding: 5px; border-bottom: 1px solid #eee; vertical-align: top; white-space: normal; max-width: none;',
    'sticky' => 'position: sticky; top: -14px; z-index: 2; background: var(--bg-surface, #fefefe); margin: 0 -16px 14px; padding: 10px 16px 10px; border-bottom: 1px solid rgba(0,0,0,0.08);',
    'sep' => '<span style="opacity: 0.25; margin: 0 4px;">|</span>',
);
function h($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function fail($msg) { fwrite(STDERR, "gen_snippets_help: $msg\n"); exit(2); }
function textWords($html) { return preg_match_all('/\S+/', html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8')); }

// ------------------------------------------------------------------ validation
$functions = isset($R['functions']) ? $R['functions'] : array();
$categories = isset($R['categories']) ? $R['categories'] : array();
$badges = isset($R['badges']) ? $R['badges'] : array();
if (!$functions || !$categories) fail('registry has no functions or no categories');
$seen = array();
foreach ($functions as $id => $f) {
    if (!preg_match('/^[a-z][a-z0-9_]*$/', $id)) fail("bad anchor id '$id'");
    if (isset($seen[$id])) fail("duplicate anchor '$id'"); $seen[$id] = 1;
    if (!isset($categories[$f['category']])) fail("$id: unknown category '{$f['category']}'");
    if ($f['category'] !== 'components' && empty($f['signature'])) fail("$id: no signature");
    if (!isset($badges[$f['where']])) fail("$id: unknown 'where' '{$f['where']}' (no badge)");
    foreach ((array)$f['params'] as $i => $p) {
        if (empty($p['name']) || empty($p['meaning']) || !isset($p['example']) || trim($p['example']) === '') fail("$id: parameter #" . ($i + 1) . " needs name, meaning and example");
    }
    foreach ((array)(isset($f['forms']) ? $f['forms'] : array()) as $i => $fm) {
        if (empty($fm['signature']) || empty($fm['meaning']) || !isset($fm['example']) || trim($fm['example']) === '') fail("$id: form #" . ($i + 1) . " needs signature, meaning and example");
    }
    foreach ((array)$f['related'] as $rel) if (!isset($functions[$rel])) fail("$id: related '$rel' is not a function");
    foreach (array('summary', 'body') as $k) {
        $t = preg_replace('#<pre\b.*?</pre>|<code\b.*?</code>#s', '', (string)$f[$k]);
        if (preg_match('/&mdash;|&#8212;|\x{2014}/u', $t)) fail("$id: em-dash in '$k'");
    }
}
foreach (array('what', 'open', 'getting_started') as $k) if (preg_match('/&mdash;|&#8212;|\x{2014}/u', preg_replace('#<pre\b.*?</pre>|<code\b.*?</code>#s', '', $R['intro'][$k]))) fail("intro '$k': em-dash");

// ------------------------------------------------------------------ render
$byCat = array();
foreach ($categories as $ck => $ct) $byCat[$ck] = array();
foreach ($functions as $id => $f) $byCat[$f['category']][] = $id;

$out = "<?php\n";
$out .= "// help/topics/optionsHelpLightbox.php - Help Center topic (v2). Audience: writer. The Custom Code reference.\n";
$out .= "// GENERATED by tests/gen_snippets_help.php from help/snippets.php (sha256 $regSha).\n";
$out .= "// DO NOT EDIT THIS FILE: edit the registry and regenerate; lint L17 fails while this file is stale.\n";
$out .= "// Served only through help/loader.php (the Help Center fetches help_content.php).\n";
$out .= "if (!defined('PNB_HELP_V2')) { http_response_code(404); exit; }\n";
$out .= "?>\n";
$out .= "<div id=\"optionsHelpLightbox\" class=\"help-topic\" data-audience=\"writer\">\n";
$out .= "    <div class=\"lightbox-content\" style=\"width: 80%; max-width: 1100px; font-size: 12px; line-height: 1.55;\">\n";
$out .= "        <div style=\"{$STY['sticky']}\">\n";
$out .= "            <button type=\"button\" class=\"close-lightbox\" aria-label=\"Close\" title=\"Close (Esc)\">&times;</button>\n";
$out .= "            <h3 style=\"margin: 0 0 4px;\">Custom Code <span class=\"help-admin-tag\">(for report writers and administrators only)</span></h3>\n";
$out .= "            <p style=\"margin: 0 0 8px; font-size: 11px; opacity: 0.8;\">{$R['intro']['what']} <strong>Open it:</strong> {$R['intro']['open']}</p>\n";
$out .= "            <div style=\"display: flex; flex-wrap: wrap; gap: 2px 0; align-items: center;\"><a href=\"#\" data-jump-to=\"snippet-getting-started\" class=\"help-jump-link\">Getting started</a></div>\n";
foreach ($categories as $ck => $ct) {
    if (!$byCat[$ck]) continue;
    $links = array();
    foreach ($byCat[$ck] as $id) $links[] = '<a href="#" data-jump-to="' . $id . '" class="help-jump-link">' . h($functions[$id]['title']) . '</a>';
    $out .= "            <div style=\"display: flex; flex-wrap: wrap; gap: 2px 0; align-items: center; font-size: 11px;\"><span style=\"opacity: 0.7; margin-right: 6px;\">" . h($ct) . ":</span>" . implode($STY['sep'], $links) . "</div>\n";
}
$out .= "        </div>\n\n";
$out .= "        <h4 id=\"snippet-getting-started\" style=\"{$STY['h4']}\">Getting Started</h4>\n";
$out .= indent($R['intro']['getting_started'], 8) . "\n";
foreach ($categories as $ck => $ct) {
    if (!$byCat[$ck]) continue;
    $out .= "\n        <h4 style=\"{$STY['h4']}\">" . h($ct) . "</h4>\n";
    foreach ($byCat[$ck] as $id) {
        $f = $functions[$id];
        $badge = $badges[$f['where']];
        $canon = $f['canonical'] ? ' data-canonical="' . h($f['canonical']) . '"' : '';
        $out .= "\n        <h4 id=\"$id\"$canon style=\"{$STY['h4fn']}\">" . h($f['title']) . " <span style=\"" . h($badge['style']) . "\">" . h($badge['label']) . "</span></h4>\n";
        if ($f['summary'] !== '') $out .= "        <p style=\"{$STY['p']}\">{$f['summary']}</p>\n";
        if (!empty($f['signature'])) $out .= "        <p style=\"{$STY['p']}\"><code>" . h($f['signature']) . "</code></p>\n";
        if (!empty($f['params'])) {
            $out .= "        <table style=\"{$STY['table']}\">\n";
            $out .= "            <tr><th style=\"{$STY['th']} width: 18%;\">Parameter</th><th style=\"{$STY['th']} width: 10%;\">Required</th><th style=\"{$STY['th']}\">Meaning</th><th style=\"{$STY['th']} width: 30%;\">Example</th></tr>\n";
            foreach ($f['params'] as $p) {
                $req = !empty($p['required']) ? 'yes' : (isset($p['default']) && $p['default'] !== '' ? 'no, default ' . h($p['default']) : 'no');
                $out .= "            <tr><td style=\"{$STY['td']}\"><code>" . h($p['name']) . "</code></td><td style=\"{$STY['td']}\">$req</td><td style=\"{$STY['td']}\">{$p['meaning']}</td><td style=\"{$STY['td']}\"><code>" . h($p['example']) . "</code></td></tr>\n";
            }
            $out .= "        </table>\n";
        }
        if (!empty($f['forms'])) {
            $out .= "        <table style=\"{$STY['table']}\">\n";
            $out .= "            <tr><th style=\"{$STY['th']} width: 34%;\">Form</th><th style=\"{$STY['th']}\">Does</th><th style=\"{$STY['th']} width: 30%;\">Example</th></tr>\n";
            foreach ($f['forms'] as $fm) $out .= "            <tr><td style=\"{$STY['td']}\"><code>" . h($fm['signature']) . "</code></td><td style=\"{$STY['td']}\">{$fm['meaning']}</td><td style=\"{$STY['td']}\"><code>" . h($fm['example']) . "</code></td></tr>\n";
            $out .= "        </table>\n";
        }
        if (trim((string)$f['body']) !== '') $out .= indent($f['body'], 8) . "\n";
        if (!empty($f['related'])) {
            $links = array();
            foreach ($f['related'] as $rel) $links[] = '<a href="#" data-jump-to="' . $rel . '" class="help-jump-link">' . h($functions[$rel]['title']) . '</a>';
            $out .= "        <p style=\"{$STY['p']}\">See also: " . implode(', ', $links) . ".</p>\n";
        }
    }
}
$out .= "    </div>\n</div>\n";

function indent($html, $n) {
    $pad = str_repeat(' ', $n);
    $lines = explode("\n", rtrim($html, "\n"));
    foreach ($lines as &$l) $l = ($l === '') ? '' : $pad . $l;
    return implode("\n", $lines);
}

// ------------------------------------------------------------------ write or check
if (isset($o['check'])) {
    $cur = is_file($outPath) ? file_get_contents($outPath) : '';
    $fresh = ($cur === $out);
    echo $fresh ? "FRESH: $outPath matches help/snippets.php ($regSha)\n" : "STALE: $outPath does not match help/snippets.php (regenerate)\n";
    exit($fresh ? 0 : 1);
}
file_put_contents($outPath, $out);
$n = count($functions); $w = textWords($out);
echo "generated $outPath: $n functions, " . count(array_filter($byCat)) . " categories, $w words, registry sha256 " . substr($regSha, 0, 12) . "\n";
