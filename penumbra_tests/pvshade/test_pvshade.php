<?php
// pvshade suite - PHP half (2026-10-10). generate_pivot_html() - the emailed pivot -
// run from a side-effect-free mirror of schedule_runner.php (pivotparity's
// extract_mirror.php; never require the runner: it connects and SENDS MAIL).
//   php -n test_pvshade.php <mirror.php> <themes_config.php>
require_once $argv[1];
require_once $argv[2];
if (function_exists('penumbra_build_theme_styles')) { $theme_styles = penumbra_build_theme_styles(); }
set_error_handler(function () { return true; }, E_ALL);
$pass = 0; $fail = 0;
function ok($c, $name, $info = '') { global $pass, $fail; if ($c) { $pass++; echo "  PASS  $name\n"; } else { $fail++; echo "  FAIL  $name   $info\n"; } }

$rows = array();
$colleges = array('Engineering', 'Sciences', 'Arts', 'Design', 'Education');
$fys = array('2023', '2024', '2025');
$k = 0;
foreach ($colleges as $ci => $c) {
    foreach ($fys as $fi => $fy) {
        for ($j = 0; $j < 3; $j++) { $k++; $rows[] = array('COLLEGE' => $c, 'FY' => $fy, 'AMOUNT' => (string)(($ci + 1) * 1000 + $fi * 300 + $j * 17 + $k)); }
    }
}
function settings($shade) {
    return array('rows' => array('COLLEGE'), 'cols' => array('FY'), 'vals' => 'AMOUNT', 'agg' => array('sum', 'count'),
                 'aggLabels' => array('Amt', 'N'), 'aggColOverrides' => array('AMOUNT', 'AMOUNT'),
                 'rowLayout' => 'flat', 'colLayout' => 'flat', 'sortOrder' => 'asc', 'aggShade' => $shade);
}
function run($shade, $rules = array()) { global $rows; return generate_pivot_html($rows, settings($shade), 'theme-default', true, $rules); }
// A data bar ends 'background-repeat:no-repeat' (the pivot's own styles never use it; its
// header gradients do use linear-gradient, so that is not a marker). A heat FILL is
// 'background-color:#' with no space - the base cell styles write 'background-color: #'.
function nbars($h) { return substr_count($h, 'background-repeat:no-repeat'); }
function cellstyles($h) { preg_match_all("/<td[^>]*style='([^']*)'[^>]*>/i", $h, $m); return $m[1]; }

$none = run(null);
$b0 = run(array('bar', null));
$bb = run(array('bar', 'bar'));
$b1 = run(array(null, 'bar'));
$s0 = run(array('scale', null));
ok(nbars($none) === 0, 'E0 no shading: no bar anywhere', nbars($none));
ok(nbars($b0) >= 12, 'E1 Amt shaded: its value cells carry a data bar', nbars($b0));
ok(nbars($bb) > nbars($b0) && nbars($b1) > 0, 'E2 the shading is PER value: both shaded draws more bars than one; N alone draws its own', nbars($bb) . '/' . nbars($b0) . '/' . nbars($b1));
ok(nbars($b0) > 0 && nbars($bb) === nbars($b0) + nbars($b1), 'E3 ...exactly the two rows\' bars added together (each row on its own)', nbars($bb) . ' vs ' . (nbars($b0) + nbars($b1)));
$fillsNone = count(array_filter(cellstyles($none), function ($s) { return strpos($s, 'background-color:#') !== false; }));
$fillsS0 = count(array_filter(cellstyles($s0), function ($s) { return strpos($s, 'background-color:#') !== false; }));
ok(nbars($s0) === 0 && $fillsS0 >= $fillsNone + 12, 'E4 a color scale: fills (no bars) on Amt\'s cells', "$fillsS0 vs $fillsNone");
// a snippet heatmap(pivot) on every value + Amt's own Data bars: Amt follows ITS option (bars),
// N keeps the snippet's fill
$snip = array(array('type' => 'heat', 'target' => 'pivot', 'columns' => array(), 'scale' => 'grid', 'scope' => 'filtered', 'ramp' => 'brand',
                    'curve' => 'linear', 'range' => null, 'mid' => null, 'bins' => 0, 'text' => 'auto', 'mode' => 'fill',
                    'condition' => null, 'style' => '', 'targetColumn' => null));
$withSnip = run(array('bar', null), $snip);
$fillsSnip = count(array_filter(cellstyles($withSnip), function ($s) { return strpos($s, 'background-color:#') !== false; }));
$both = count(array_filter(cellstyles($withSnip), function ($s) { return strpos($s, 'background-repeat:no-repeat') !== false && (strpos($s, 'background-color:#') !== false); }));
ok(nbars($b0) > 0 && nbars($withSnip) === nbars($b0) && $fillsSnip >= $fillsNone + 12 && $both === 0, 'E5 the value\'s option outranks a snippet heatmap(pivot): Amt bars only, N the snippet\'s fill', nbars($withSnip) . " bars, $fillsSnip fills, $both both");

// E6: the bars sit on Amt's cells only - a Count cell here holds 3 (three rows per
// college x year), an Amt cell thousands
preg_match_all("/<td[^>]*style='([^']*)'[^>]*>(?:<strong>)?([^<]*)/i", $b0, $mm, PREG_SET_ORDER);   // a total cell's figure is in <strong> (pvgt)
$onAmt = 0; $onN = 0;
foreach ($mm as $c) { if (strpos($c[1], 'background-repeat:no-repeat') === false) continue; $v = (float)str_replace(array(',', '$'), '', $c[2]); if ($v > 100) $onAmt++; else $onN++; }
ok($onAmt > 0 && $onN === 0, 'E6 the bars are on the shaded value\'s cells, none on the Count cells', "amt=$onAmt n=$onN");

// E7 (pvscale 2026-10-11): a colour scale runs each column's OWN min..max - per FY column,
// the smallest Amt's fill against the largest's >= 3.5:1 (the old log + 0: ~2:1)
function lumx($h) { $o = 0; foreach (array(0.2126, 0.7152, 0.0722) as $i => $w) { $c = hexdec(substr($h, $i * 2, 2)) / 255; $o += $w * ($c <= 0.03928 ? $c / 12.92 : pow(($c + 0.055) / 1.055, 2.4)); } return $o; }
preg_match_all("/<tr[^>]*>(.*?)<\/tr>/is", $s0, $trs);
$cols = array();
foreach ($trs[1] as $tr) {
    if (stripos($tr, 'Total') !== false) continue;
    preg_match_all("/<td[^>]*style='([^']*)'[^>]*>([^<]*)/i", $tr, $tds, PREG_SET_ORDER);
    $ci = 0;
    foreach ($tds as $td) {
        $ci++;
        if (!preg_match('/background-color:#([0-9a-f]{6})/i', $td[1], $hm)) continue;
        $v = (float)str_replace(array(',', '$'), '', $td[2]);
        if ($v <= 100) continue;
        $cols[$ci][] = array($v, $hm[1]);
    }
}
$spreads = array();
foreach ($cols as $ci => $list) {
    usort($list, function ($x, $y) { return $x[0] <=> $y[0]; });
    $l1 = lumx($list[0][1]); $l2 = lumx($list[count($list) - 1][1]);
    $spreads[] = round((max($l1, $l2) + 0.05) / (min($l1, $l2) + 0.05), 2);
}
ok(count($spreads) >= 2 && min($spreads) >= 3.5, 'E7 a colour scale spans each column: smallest vs largest Amt >= 3.5:1', json_encode($spreads));

// E8 (pvsum 2026-10-11): a formula is ONE-sided - {Amt} / {N} as data bars grows from 0 at
// the left edge; drawn two-sided round 0 (the old rule for every formula) its bars began mid-cell
$fs = settings(array(null, null, 'bar'));
$fs['agg'] = array('sum', 'count', 'formula'); $fs['aggLabels'] = array('Amt', 'N', 'Per'); $fs['aggColOverrides'] = array('AMOUNT', 'AMOUNT', null);
$fs['aggFormulas'] = array(null, null, '{Amt} / {N}');
$fh = generate_pivot_html($rows, $fs, 'theme-default', true, array());
preg_match_all('/background-image:\s*linear-gradient\(90deg,\s*([^,]+?)\s+0%/i', $fh, $starts);
ok(nbars($fh) >= 12 && count($starts[1]) === nbars($fh) && stripos($fh, 'transparent 50%') === false,
   'E8 a formula\'s bars start at 0 (one-sided), none mid-cell', nbars($fh) . ' bars, ' . count($starts[1]) . ' from 0');

// E9 / E10: LOPSIDED values - Engineering x1000, Arts / Design / Education all 0, so each FY
// column holds 0, 0, 0, Sciences, Engineering: the colour scale colours by RANK (Sciences
// mid-ramp, where a straight scale leaves it at ~1/1000 of Engineering, i.e. the floor) and
// the run of 0s ranks as one value, AT the floor - bare surface, not a tint
$lrows = array();
foreach ($rows as $r) {
    if ($r['COLLEGE'] === 'Engineering') $r['AMOUNT'] = (string)((float)$r['AMOUNT'] * 1000);
    else if ($r['COLLEGE'] !== 'Sciences') $r['AMOUNT'] = '0';
    $lrows[] = $r;
}
$lh = generate_pivot_html($lrows, settings(array('scale', null)), 'theme-default', true, array());
$surfHex = strtolower(pnb_heat_to_hex(pnb_heat_parse_color(pnb_heat_theme_var('bg-surface', '#ffffff', 'theme-default'))));
$sci = array(); $zero = array();
preg_match_all("/<tr[^>]*>(.*?)<\/tr>/is", $lh, $ltrs);
foreach ($ltrs[1] as $tr) {
    preg_match_all("/<td[^>]*style='([^']*)'[^>]*>([^<]*)/i", $tr, $tds, PREG_SET_ORDER);
    if (!$tds) continue;
    $label = trim($tds[0][2]);
    if (stripos($tr, 'Sciences') !== false) $label = 'Sciences';
    foreach ($tds as $td) {
        if (!preg_match('/background-color:#([0-9a-f]{6})/i', $td[1], $hm)) continue;
        $v = (float)str_replace(array(',', '$'), '', $td[2]);
        if ($label === 'Sciences' && $v > 100) $sci[] = round((max(lumx($hm[1]), lumx(substr($surfHex, 1))) + 0.05) / (min(lumx($hm[1]), lumx(substr($surfHex, 1))) + 0.05), 2);
        if (trim($td[2]) === '0' || $v === 0.0 && trim($td[2]) !== '') $zero[] = strtolower('#' . $hm[1]);
    }
}
ok(count($sci) >= 3 && min($sci) >= 1.5, 'E9 lopsided: Sciences, ~1/1000 of Engineering, is shaded by rank (>= 1.5:1 off the surface), not left at the floor', json_encode($sci));
ok(count($zero) >= 9 && count(array_unique($zero)) === 1 && $zero[0] === $surfHex, 'E10 the run of 0s ranks as one value, at the floor: bare surface ' . $surfHex, json_encode(array_count_values($zero)));

// E11..E14 (pvgt 2026-10-11): the Grand Total ROW under a builder shading - its cells on
// their own domain (one per FY here), never the corner Grand Total column; a lone cell gets
// a bar but no fill; no placeholder ever reaches the output
function tfoot($h) { $i = strpos($h, '<tfoot>'); $j = strpos($h, '</tfoot>'); return ($i === false || $j === false) ? '' : substr($h, $i, $j - $i); }
function ftcells($h) { preg_match_all("/<td[^>]*style='([^']*)'[^>]*>(?:<strong>)?([^<]*)/i", tfoot($h), $m, PREG_SET_ORDER); return $m; }
$gtA = 0; $gtN = 0;
foreach (ftcells($b0) as $c) { if (strpos($c[1], 'background-repeat:no-repeat') === false) continue; if ((float)str_replace(array(',', '$'), '', $c[2]) > 100) $gtA++; else $gtN++; }
ok(tfoot($b0) !== '' && $gtA === 3 && $gtN === 0 && nbars(tfoot($none)) === 0, 'E11 Data bars: each FY\'s Grand Total cell of the shaded value has a bar - not Count\'s, not the corner', "amt=$gtA other=$gtN");
$gtF = array();
foreach (ftcells($s0) as $c) { if (preg_match('/background-color:(#[0-9a-f]{6})/i', $c[1], $mf)) $gtF[] = strtolower($mf[1]); }
ok(count($gtF) === 3 && count(array_unique($gtF)) === 3, 'E12 Color scale: the three Grand Total cells fill, each a different shade (their own min..max)', json_encode($gtF));
$one = function ($shade) { global $rows; $st = settings($shade); $st['cols'] = array(); return generate_pivot_html($rows, $st, 'theme-default', true, array()); };
$o1b = $one(array('bar', null)); $o1s = $one(array('scale', null));
$o1sf = count(array_filter(ftcells($o1s), function ($c) { return strpos($c[1], 'background-color:#') !== false; }));
ok(nbars(tfoot($o1b)) === 1 && $o1sf === 0 && nbars($o1s) === 0, 'E13 no column field (one Grand Total cell): a bar, but no fill - a scale of one value says nothing', nbars(tfoot($o1b)) . ' bars, ' . $o1sf . ' fills');
$leak = 0; foreach (array($none, $b0, $bb, $b1, $s0, $o1b, $o1s) as $_h) { if (strpos($_h, "\x01") !== false || strpos($_h, 'GTH') !== false) $leak++; }
ok($leak === 0, 'E14 no Grand Total placeholder reaches the output', "$leak leaked");
echo "TOTAL pass=$pass fail=$fail\n";
echo ($fail === 0 && $pass > 0) ? "RESULT: GREEN\n" : "RESULT: RED\n";
