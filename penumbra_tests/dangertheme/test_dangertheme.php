<?php
// =============================================================================
// Penumbra DANGER-THEME SUITE (2026-10-10) - each theme's own --accent-danger.
//   The twelve registry themes carry 'accent-danger' in their cssVars and penumbra_emit_theme_css()
//   emits it inside their body.theme-x block (after main.css, so it wins over body.is-dark); the five
//   hand-written themes carry a `body.theme-x { --accent-danger: #rrggbb; }` line in css/main.css after
//   the light / dark fallback pair; every value reads >= 4.5:1 on its theme's surface (the filled
//   danger button paints its glyph with the surface colour, and the token is the error text colour)
//   and stays apart from the brand primary (>= 1.05:1, never the same colour).
//   php.exe -n test_dangertheme.php --cfg=<themes_config.php> --css=<css/main.css>
//   Exit 0 when GREEN, 1 when RED, 2 on bad arguments. Reads only; writes nothing.
// =============================================================================
$cfg = null; $css = null;
foreach ($argv as $a) { if (strpos($a, '--cfg=') === 0) $cfg = substr($a, 6); if (strpos($a, '--css=') === 0) $css = substr($a, 6); }
if (!$cfg || !$css || !is_file($cfg) || !is_file($css)) { fwrite(STDERR, "usage: --cfg=<themes_config.php> --css=<css/main.css>\n"); exit(2); }
require $cfg;
function lum($hex) { $hex = ltrim(trim($hex), '#'); if (!preg_match('/^[0-9a-fA-F]{6}$/', $hex)) return null; $c = array(); foreach (array(0, 2, 4) as $i) { $v = hexdec(substr($hex, $i, 2)) / 255; $c[] = ($v <= 0.03928) ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4); } return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2]; }
function ratio($a, $b) { $la = lum($a); $lb = lum($b); if ($la === null || $lb === null) return null; $hi = max($la, $lb); $lo = min($la, $lb); return round(($hi + 0.05) / ($lo + 0.05), 2); }
// (2026-11-15) Hue angle in degrees (null for a grey). "Stays apart from the brand" was luminance contrast alone, which
// cannot tell a red from a teal of the same lightness: Golden Hour (theme-solarized-light, re-coloured 2026-11-07..10,
// e65935d) has danger #b3261e beside brand #1f6b66, 1.04:1 yet 170 degrees apart. Apart = the old 1.05:1, OR hues at
// least 60 degrees apart. The same colour, or a shade of the brand's own hue, still fails (mutant `brand`).
function hue($hex) { $hex = ltrim(trim($hex), '#'); if (!preg_match('/^[0-9a-fA-F]{6}$/', $hex)) return null; $r = hexdec(substr($hex, 0, 2)) / 255; $g = hexdec(substr($hex, 2, 2)) / 255; $b = hexdec(substr($hex, 4, 2)) / 255; $mx = max($r, $g, $b); $mn = min($r, $g, $b); $dl = $mx - $mn; if ($dl < 0.08) return null; if ($mx == $r) $h = fmod(($g - $b) / $dl, 6); elseif ($mx == $g) $h = ($b - $r) / $dl + 2; else $h = ($r - $g) / $dl + 4; $h *= 60; if ($h < 0) $h += 360; return $h; }
function hue_apart($a, $b) { $ha = hue($a); $hb = hue($b); if ($ha === null || $hb === null) return 0; $x = abs($ha - $hb); return round($x > 180 ? 360 - $x : $x); }
$PASS = 0; $FAIL = 0;
function ok($c, $l) { global $PASS, $FAIL; if ($c) { $PASS++; echo "  ok   $l\n"; } else { $FAIL++; echo "  FAIL $l\n"; } }
$mainCss = file_get_contents($css);
// (2026-11-15) Charcoal & Gold became theme-graphite-brass on 2026-11-07 (catch-up commit e65935d); the old id is only an
// alias in themes_config.php. A pre-rename copy (-App control) still has the old line, so the id is read off the CSS.
$gbId = (strpos($mainCss, 'body.theme-charcoal-gold') !== false && strpos($mainCss, 'body.theme-graphite-brass') === false) ? 'theme-charcoal-gold' : 'theme-graphite-brass';
$handWritten = array('theme-wolfpack', 'theme-light-sepia', 'theme-dark-blue', $gbId, 'theme-wolfpack-dark');
echo "[main.css]\n";
ok(strpos($mainCss, ':root { --accent-danger: #c62828; }') !== false && strpos($mainCss, 'body.is-dark { --accent-danger: #ff8a8a; }') !== false, 'the light / dark fallback pair, the light one a deeper red than the brand-ish #cc0000');
foreach ($handWritten as $id) { ok(preg_match('/^body\.' . preg_quote($id, '/') . '\s+\{ --accent-danger: #[0-9a-f]{6}; \}/m', $mainCss) === 1, "$id has its own danger line"); }
$fb = strpos($mainCss, 'body.is-dark { --accent-danger: #ff8a8a; }'); $hw = strpos($mainCss, 'body.theme-wolfpack-dark { --accent-danger:');
ok($fb !== false && $hw !== false && $hw > $fb, 'the hand-written lines come AFTER the fallback pair (equal specificity: order wins)');
echo "[registry + emitted CSS + contrast]\n";
ob_start(); penumbra_emit_theme_css(); $emitted = ob_get_clean();
foreach (penumbra_get_themes() as $id => $t) {
    $all = array_merge(isset($t['vars']) ? $t['vars'] : array(), isset($t['cssVars']) ? $t['cssVars'] : array());
    $surf = isset($all['bg-surface']) ? $all['bg-surface'] : null; $brand = isset($all['brand-primary']) ? $all['brand-primary'] : null;
    $danger = null;
    if (!empty($t['cssVars'])) {
        ok(isset($t['cssVars']['accent-danger']), "registry: $id carries accent-danger");
        $danger = isset($t['cssVars']['accent-danger']) ? $t['cssVars']['accent-danger'] : null;
        ok(preg_match('/body\.' . preg_quote($id, '/') . ' \{[^}]*--accent-danger: ' . ($danger ? preg_quote($danger, '/') : 'x') . '/', $emitted) === 1, "emitted CSS: $id declares --accent-danger");
    } elseif (in_array($id, $handWritten, true) && preg_match('/^body\.' . preg_quote($id, '/') . '\s+\{ --accent-danger: (#[0-9a-f]{6}); \}/m', $mainCss, $m)) {
        $danger = $m[1];
    } elseif ($surf) {
        $danger = !empty($t['isDark']) ? '#ff8a8a' : '#c62828';   // the fallback pair
    }
    if ($danger && $surf) { $r = ratio($danger, $surf); ok($r !== null && $r >= 4.5, "$id: $danger reads $r:1 on the surface $surf (>= 4.5)"); }
    if ($danger && $brand) { $r2 = ratio($danger, $brand); $h2 = hue_apart($danger, $brand); ok($r2 !== null && ($r2 >= 1.05 || $h2 >= 60), "$id: $danger stays apart from the brand $brand ($r2:1, hues $h2 deg apart)"); }
}
echo "\nPASS: $PASS   FAIL: $FAIL\nRESULT: " . ($FAIL ? 'RED' : 'GREEN') . "\n";
exit($FAIL ? 1 : 0);
