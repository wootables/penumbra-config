<?php
// shade suite - PHP half (2026-10-10).
//   php -n test_parity.php <schedule_runner.php> <parity.json>
// LIFTS the heat engine's functions out of schedule_runner.php (never require it:
// it connects to Oracle and sends mail), stubs pnb_heat_theme_var with the theme
// the browser read, runs every case through pnb_heat_domain_from + pnb_heat_css_for
// and compares with the browser's css, byte for byte. Plus the email side's rule
// parser (style=bar -> mode) and its allowed-properties list, by source.
$src = str_replace("\r\n", "\n", (string)@file_get_contents($argv[1]));   // schedule_runner.php is CRLF
$fx = json_decode(@file_get_contents($argv[2]), true);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }
ok($src && is_array($fx), 'S0 inputs read');

$THEME = isset($fx['theme']) ? $fx['theme'] : array();
function pnb_heat_theme_var($name, $fallback, $themeName = null) { global $THEME; return isset($THEME[$name]) && $THEME[$name] ? $THEME[$name] : $fallback; }

$fns = array('_pnb_heat_jsround', '_pnb_heat_cbrt', '_pnb_heat_srgb_to_linear', '_pnb_heat_linear_to_srgb', '_pnb_heat_rgb_to_oklab',
    '_pnb_heat_oklab_to_rgb', 'pnb_heat_parse_color', 'pnb_heat_to_hex', '_pnb_heat_rotate_hue', 'pnb_heat_build_ramp', 'pnb_heat_sample',
    '_pnb_heat_rel_lum', 'pnb_heat_contrast', 'pnb_heat_readable_on', '_pnb_heat_percentile', 'pnb_heat_domain_from', '_pnb_heat_shape',
    '_pnb_heat_rank_t', '_pnb_heat_pc', '_pnb_heat_bar_css', 'pnb_heat_css_for', 'pnb_heat_parse_args');
$missing = array();
foreach ($fns as $fn) {
    if (preg_match('/^function ' . preg_quote($fn, '/') . '\([^\n]*\}[ \t]*$/m', $src, $m)) { eval($m[0]); continue; }
    if (preg_match('/^function ' . preg_quote($fn, '/') . '\(.*?\n\}/sm', $src, $m)) { eval($m[0]); continue; }
    $missing[] = $fn;
}
ok(!$missing, 'S1 the heat engine lifted', implode(',', $missing));
if ($missing) { echo "TOTAL pass=$pass fail=$fail\nRESULT: RED\n"; exit; }

$byId = array();
foreach ($fx['out'] as $o) $byId[$o['id']] = $o['css'];
foreach ($fx['cases'] as $c) {
    $opts = $c['opts'];
    if (!isset($opts['range'])) $opts['range'] = null;
    $mid = isset($opts['mid']) ? $opts['mid'] : null;
    $dom = pnb_heat_domain_from($c['values'], $opts['range'], $mid);
    $got = array();
    foreach ($c['values'] as $v) $got[] = pnb_heat_css_for($v, $dom, $opts, null);
    $want = isset($byId[$c['id']]) ? $byId[$c['id']] : null;
    $same = $want !== null && $got === $want;
    ok($same, 'P-' . $c['id'] . ' the email css equals the browser css', $same ? '' : json_encode(array('php' => $got, 'js' => $want)));
}
// the money case caps at the p99, and the straddle case draws both ways
$m = isset($byId['straddle']) ? $byId['straddle'] : array();
ok(count($m) === 5 && strpos($m[0], 'background-image:linear-gradient(90deg,transparent 25%,') === 0 && strpos($m[0], ' 50%,transparent 50%);background-repeat:no-repeat') !== false
   && strpos($m[4], 'background-image:linear-gradient(90deg,transparent 50%,') === 0 && strpos($m[4], ' 100%,transparent 100%)') !== false && $m[2] === '',
   'B1 a column straddling zero: -50 grows LEFT of the middle (to 25%), 100 RIGHT (to 100%), zero draws nothing');
$p = isset($byId['pos']) ? $byId['pos'] : array();
ok(count($p) === 5 && $p[0] === '' && strpos($p[4], ' 100%,transparent 100%);background-repeat:no-repeat') !== false && strpos($p[2], ' 10%,transparent 10%)') !== false,
   'B2 bars start at ZERO: 0 draws nothing, 10 of 100 is a 10% bar, the max a full one');

// the email side's rule parser and allowed properties
$r = pnb_heat_parse_args(array('cell', 'AMOUNT', 'style=bar'));
$r2 = pnb_heat_parse_args(array('cell', 'AMOUNT', 'style=bogus'));
ok($r && $r['mode'] === 'bar' && $r['style'] === '' && $r2 && $r2['mode'] === 'fill', 'R1 style=bar parses to mode (the format() style slot stays empty)');
ok(strpos($src, "parse_css_properties(\$css, array('background-color', 'color', 'background-image', 'background-repeat'))") !== false,
   'R2 the email keeps the bar (background-image / -repeat allowed on a heat cell)');

echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
