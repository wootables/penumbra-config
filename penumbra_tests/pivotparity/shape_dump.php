<?php
// One-shot: show the actual shape of each builder's output so the extractors in
// builder_diff.php can target the real markup instead of a guess.
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);
require_once __DIR__ . '/pivot_mirror.php';
require_once '\\\\oitras.oit.ncsu.edu\\c$\\inetpub\\wwwroot\\sponsor_migration\\penumbra\\themes_config.php';
$theme_styles = penumbra_build_theme_styles();

$rows = array(
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '10', 'AMOUNT' => '1000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2024', 'RATE' => '20', 'AMOUNT' => '9000'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '50', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Engineering', 'FY' => '2025', 'RATE' => '60', 'AMOUNT' => '10'),
    array('COLLEGE' => 'Sciences',    'FY' => '2024', 'RATE' => '5',  'AMOUNT' => '100'),
    array('COLLEGE' => 'Sciences',    'FY' => '2025', 'RATE' => '80', 'AMOUNT' => '9900'),
);
$set = array('rows'=>array('COLLEGE'),'cols'=>array('FY'),'vals'=>'RATE','agg'=>array('sum'),
             'rowLayout'=>'flat','colLayout'=>'flat','sortOrder'=>'asc');

$h = generate_pivot_html($rows, $set, 'theme-default', true);
echo "===== HTML: rows containing 'Engineering' =====\n";
if (preg_match('#<tr[^>]*>(?:(?!</tr>).)*?Engineering(?:(?!</tr>).)*?</tr>#s', $h, $m)) {
    echo substr(preg_replace('/\s+/', ' ', $m[0]), 0, 1200), "\n";
} else { echo "(no matching <tr>)\n"; }
echo "\n===== HTML: does 'grand-total' appear at all? =====\n";
echo (strpos($h, 'grand-total') !== false ? "yes\n" : "no\n");
preg_match_all('#class="([^"]*total[^"]*)"#i', $h, $cl);
echo "total-ish classes seen: " . implode(', ', array_unique($cl[1])) . "\n";

echo "\n===== CSV =====\n";
echo substr(generate_pivot_csv_string($rows, $set), 0, 600), "\n";

echo "\n===== XLSX rows =====\n";
$x = pivot_build_xlsx_rows($rows, $set);
echo "type: " . gettype($x) . "; count: " . (is_array($x) ? count($x) : 'n/a') . "\n";
if (is_array($x)) {
    $keys = array_keys($x);
    echo "top-level keys: " . implode(', ', array_slice($keys, 0, 8)) . "\n";
    $i = 0;
    foreach ($x as $k => $r) {
        echo "  [$k] " . (is_array($r) ? json_encode(array_slice($r, 0, 8)) : json_encode($r)) . "\n";
        if (++$i >= 8) break;
    }
}
