<?php
// pvfix suite - email half (2026-10-20 d). The scheduler's twins of the page's two-sided Color
// scale on lopsided values, from a side-effect-free mirror of schedule_runner.php (pivotparity's
// extract_mirror.php; never require the runner: it connects and SENDS MAIL).
//   php -n test_pvfix.php <mirror.php> <themes_config.php> <vec.json>
// vec.json: the page's colorizer answers (driver.js pfneg, rankSides), value by value.
require_once $argv[1];
require_once $argv[2];
if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
set_error_handler(function () { return true; }, E_ALL);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }

// --- V: the colorizer's rankSides, value by value, against the page ---------------------------
$vec = json_decode((string)@file_get_contents($argv[3]), true);
$opts = array('ramp' => 'diverging', 'curve' => 'rank', 'rankSides' => true, 'mode' => 'fill', 'text' => 'auto');
$vn = 0; $vbad = array();
if (is_array($vec)) {
    foreach ($vec as $vi => $v) {
        $dom = pnb_heat_domain_from($v['vals'], null, '0');
        foreach ($v['vals'] as $i => $x) {
            $vn++;
            $php = pnb_heat_css_for($x, $dom, $opts, 'theme-default');
            if ($php !== $v['css'][$i]) $vbad[] = "v$vi:$x page '" . $v['css'][$i] . "' email '$php'";
        }
    }
}
ok($vn >= 15 && !$vbad, 'V-twin the email colours each side by rank exactly as the page (' . $vn . ' values)', implode(' | ', array_slice($vbad, 0, 3)));

// --- L: the lopsided test both ways from the middle ------------------------------------------
$mk = function ($vals) { return array('k' => pnb_heat_domain_from($vals, null, '0')); };
$lop = array(-2000, -1500, 1200, 1900, 2500, 2100000);
$bal = array(-900, -400, 300, 500, 800, 1000);
ok(function_exists('pivot_shade_lopsided_two') && pivot_shade_lopsided_two($mk($lop), array('k' => $lop)) === true
   && pivot_shade_lopsided_two($mk($bal), array('k' => $bal)) === false,
   'L-two lopsided both ways (a few huge totals) - yes; spread over the scale - no');

// --- E: the emailed pivot: Amt (sum) both ways from zero, North x1000, West negated ------------
$rows = array();
$groups = array('North', 'South', 'East', 'West', 'Central');
$stats = array('Open', 'Closed', 'Pending');
foreach ($groups as $gi => $g) {
    foreach ($stats as $si => $st) {
        for ($j = 0; $j < 6; $j++) {
            $a = 100 + $j * 13 + $gi * 7 + $si * 3;
            if ($g === 'North') $a *= 1000;
            if ($g === 'West') $a = -$a;
            $rows[] = array('GRP' => $g, 'STATUS' => $st, 'AMT' => (string)$a);
        }
    }
}
$settings = array('rows' => array('GRP'), 'cols' => array('STATUS'), 'vals' => 'AMT', 'agg' => array('sum', 'pct_change'),
                  'aggLabels' => array('Amt', 'Chg'), 'aggColOverrides' => array('AMT', null),
                  'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc', 'aggShade' => array('scale', null));
$html = generate_pivot_html($rows, $settings, 'theme-default', true, array());
$lin = pnb_heat_domain_from(array(-1, 0, 1), null, '0');
$lo = array('ramp' => 'diverging', 'curve' => 'linear', 'mode' => 'fill', 'text' => 'keep');
$hex = function ($css) { return preg_match('/background-color:(#[0-9a-fA-F]{6})/', (string)$css, $m) ? strtolower($m[1]) : null; };
$NEG = $hex(pnb_heat_css_for(-1, $lin, $lo, 'theme-default'));
$MID = $hex(pnb_heat_css_for(0, $lin, $lo, 'theme-default'));
$POS = $hex(pnb_heat_css_for(1, $lin, $lo, 'theme-default'));
$rgb = function ($h) { return array(hexdec(substr($h, 1, 2)), hexdec(substr($h, 3, 2)), hexdec(substr($h, 5, 2))); };
$dist = function ($a, $b) use ($rgb) { $x = $rgb($a); $y = $rgb($b); return sqrt(pow($x[0] - $y[0], 2) + pow($x[1] - $y[1], 2) + pow($x[2] - $y[2], 2)); };
// the body rows: a group's label, then per status its Amt and Chg cells
preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $html, $trs);
$west = array(); $north = array(); $mids = array(); $amtCells = 0;
foreach ($trs[1] as $tr) {
    preg_match_all("/<td([^>]*)>(.*?)<\/td>/is", $tr, $tds, PREG_SET_ORDER);
    if (count($tds) < 7) continue;
    $label = trim(strip_tags($tds[0][2]));
    if (!in_array($label, $groups, true)) continue;
    foreach (array(1, 3, 5) as $ci) {
        $st = preg_match("/style='([^']*)'/", $tds[$ci][1], $sm) ? $sm[1] : '';
        $h = $hex($st);
        $amtCells++;
        if ($label === 'West') $west[] = $h;
        elseif ($label === 'North') $north[] = $h;
        else $mids[] = $h ? $dist($h, $MID) / max(1, $dist($POS, $MID)) : 0;
    }
}
ok($amtCells === 15, 'E-cells the emailed pivot: 5 groups x 3 statuses of Amt', $amtCells);
ok(count($west) === 3 && count(array_filter($west, function ($h) use ($NEG) { return $h === $NEG; })) === 3,
   'E-neg every column\'s one negative (West) takes the far negative colour', json_encode($west) . " want $NEG");
ok(count($north) === 3 && count(array_filter($north, function ($h) use ($POS) { return $h === $POS; })) === 3,
   'E-top every column\'s largest (North) takes the brand colour', json_encode($north) . " want $POS");
sort($mids);
ok(count($mids) === 9 && $mids[0] >= 0.1 && $mids[4] >= 0.35,
   'E-spread the positives between are spread by rank, none left at the middle shade', json_encode(array_map(function ($x) { return round($x, 2); }, $mids)));

echo "TOTAL pass=$pass fail=$fail\n";
